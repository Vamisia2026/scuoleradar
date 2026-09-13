/**
 * ScuoleRadar.it — Notifier (FASE 4)
 * Riceve i nuovi interpelli, trova gli utenti compatibili e invia le
 * notifiche su entrambi i canali (Resend email + Telegram) in parallelo.
 * Non lancia eccezioni: ogni errore viene loggato e conteggiato.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { InterpelloParsato } from '../scraper/parser.ts';
import {
  getResendClient,
  inviaNotificaEmail,
  type DettagliNotifica,
  type DestinatarioNotifica,
  type TipoMessaggio,
} from './resend.ts';
import { inviaNotificaTelegram } from './telegram.ts';
import { findUtentiCompatibili, normalizzaClasse, searchInterpelli } from './matchingEngine.ts';

export interface NotificheOptions {
  /** Logga le notifiche senza inviarle (per test). */
  dryRun?: boolean;
  /** URL della dashboard per il pulsante CTA (default da env). */
  dashboardUrl?: string;
}

export interface EsitoNotifiche {
  inviate: number;
  fallite: number;
  telegramInviate: number;
  telegramFallite: number;
}

type EsitoJob = { ok: boolean };

/** Piani con notifiche illimitate (PRO a pagamento + PRO Free Forever). */
function pianoIllimitato(piano?: string): boolean {
  return piano === 'pro' || piano === 'free_forever';
}

/**
 * Deduplica per (utente, interpello): usa la tabella `notifications_log`
 * (migrazione `20260914010000_notifications_log.sql`). Se la tabella non esiste
 * ancora le letture/scritture sono best-effort (nessun blocco dell'invio).
 */
async function giaNotificato(
  client: SupabaseClient,
  userId: string,
  hash: string,
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from('notifications_log')
      .select('interpello_hash')
      .eq('user_id', userId)
      .eq('interpello_hash', hash)
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

async function registraNotifica(
  client: SupabaseClient,
  userId: string,
  hash: string,
  canale: 'email' | 'telegram',
): Promise<void> {
  try {
    await client
      .from('notifications_log')
      .upsert({ user_id: userId, interpello_hash: hash, canale }, { onConflict: 'user_id,interpello_hash,canale' });
  } catch {
    /* tabella assente: nessun blocco */
  }
}

export async function notificaNuoviInterpelli(
  client: SupabaseClient | null,
  nuovi: InterpelloParsato[],
  opts: NotificheOptions = {},
): Promise<EsitoNotifiche> {
  const esito: EsitoNotifiche = { inviate: 0, fallite: 0, telegramInviate: 0, telegramFallite: 0 };
  const resend = getResendClient();
  if (!resend) {
    console.log('ℹ Notifiche email disattivate: RESEND_API_KEY non configurata o placeholder.');
  }
  if (nuovi.length === 0) {
    console.log('ℹ Nessun interpello nuovo: nessuna notifica da inviare.');
    return esito;
  }

  const { dryRun = false, dashboardUrl } = opts;

  // Stato PER-RUN. La lista utenti è uno snapshot letto dal DB una volta per
  // interpello: senza questi set, quando in un solo run arrivano PIÙ interpelli
  // nuovi, lo stesso utente verrebbe riprocessato e riceverebbe più volte
  // l'avviso "periodo di prova terminato" (extra) perché il flag letto in
  // memoria resta `false` anche dopo l'update su DB → loop sullo stesso record.
  const utentiBloccoGiaAvvisati = new Set<string>();
  const utentiEsauriti = new Set<string>();

  for (const interpello of nuovi) {
    // Matching Engine: utenti con provincia e almeno una classe in comune
    const utenti = await findUtentiCompatibili(client, {
      province: interpello.province,
      classi: interpello.classCodes,
    });

    if (utenti.length === 0) {
      console.log(`  ℹ Nessun utente compatibile per [${interpello.province}] ${interpello.title.slice(0, 60)}`);
      continue;
    }

    const dettagli: DettagliNotifica = {
      id: interpello.hashId,
      title: interpello.title,
      schoolName: interpello.schoolName,
      province: interpello.province,
      classi: interpello.classCodes,
      materia: interpello.materia,
      scadenza: interpello.expirationDate,
      link: interpello.link,
      contactEmail: interpello.contactEmail,
    };

    const risultati = await Promise.all(
      utenti.map(async (utente) => {
        // Utente già saturato in questo run (BASE oltre il limite): nessun
        // ulteriore processamento, il cron `step5-notifiche` gestirà il recap.
        if (utentiEsauriti.has(utente.id)) return [];

        // FASE 6 — guardia server-side: RPC atomica del contatore notifiche.
        // base → max 3 per ANNO SCOLASTICO (reset automatico a settembre);
        // pro → sempre consentito.
        // Sequenza BASE: Email 1 (welcome) dal trigger su auth.users;
        // Email 2-4 (prova1/prova2/prova3) ed Email 5 (extra = avviso) da qui;
        // Email 6 (recap = avviso finale) dal cron `step5-notifiche` 2 ore
        // dopo la consegna dell'avviso (extra).
        let tipo: TipoMessaggio = 'notifica_pro';
        let skip = false;
        const chatId = utente.telegramChatId;

        if (client) {
          const { data: rpcData, error: rpcError } = await client.rpc('incrementa_notifiche_utente', {
            p_user_id: utente.id,
          });
          if (rpcError) {
            console.warn(
              `  ⚠ RPC contatore notifiche fallita per ${utente.id.slice(0, 8)}… (${rpcError.message}) — invio comunque.`,
            );
            if (!pianoIllimitato(utente.piano)) tipo = 'prova1';
          } else if (rpcData?.[0]) {
            if (rpcData[0].consentito === false) {
              // Ciclo BASE completato (3 notifiche/anno scolastico inviate):
              // Email 5 (extra = avviso) una sola volta, poi si salta.
              // Email 6 (recap = avviso finale) è schedulata dal cron
              // `step5-notifiche` (Edge Function, 2 ore dopo l'avviso).
              if (pianoIllimitato(utente.piano)) {
                tipo = 'notifica_pro';
              } else if (!utente.notificheBloccoInviato && !utentiBloccoGiaAvvisati.has(utente.id)) {
                // Email 5 — warning "periodo di prova terminato": UNA SOLA VOLTA.
                // Il set per-run evita di ripeterlo per ogni altro interpello del
                // batch (il flag `notifiche_blocco_inviato` in memoria è ancora false).
                tipo = 'extra';
                utentiBloccoGiaAvvisati.add(utente.id);
              } else {
                skip = true;
                utentiEsauriti.add(utente.id);
              }
            } else {
              const usate = Number(rpcData[0].notifiche_usate);
              tipo =
                pianoIllimitato(utente.piano)
                  ? 'notifica_pro'
                  : usate === 1
                    ? 'prova1'
                    : usate === 2
                      ? 'prova2'
                      : 'prova3';
            }
          }
        }

        if (skip) return [];

        const jobs: Array<{ tipo: 'email' | 'telegram'; promessa: Promise<EsitoJob> }> = [];

        // Canale EMAIL (Resend): tentato per OGNI notifica; l'errore API esatto
        // viene loggato integralmente.
        if (utente.email && resend) {
          const destinatario: DestinatarioNotifica = {
            email: utente.email,
            nome: utente.nome,
            province: utente.province,
            classi: utente.classi,
          };
          jobs.push({
            tipo: 'email',
            promessa: inviaNotificaEmail(resend, dettagli, destinatario, {
              dryRun,
              dashboardUrl,
              tipo,
            }).then((e) => {
              if (!e.inviata) {
                console.warn(`  ✗ Email a ${utente.email} fallita: ${e.error ?? 'errore sconosciuto'}`);
              }
              return { ok: e.inviata };
            }),
          });
        }

        // Canale TELEGRAM: tentato per OGNI notifica se il bot è collegato.
        if (chatId) {
          jobs.push({
            tipo: 'telegram',
            promessa: (async () => {
              if (dryRun) {
                console.log(`  ✈ [DRY-RUN] → Telegram ${chatId}`);
                return { ok: true };
              }
              const r = await inviaNotificaTelegram(chatId, dettagli, {
                classiUtente: utente.classi,
                dashboardUrl,
                tipo,
              });
              if (r.ok) console.log(`  ✓ Telegram inviato a chat ${chatId}`);
              else console.warn(`  ✗ Telegram a ${chatId} fallito: ${r.error ?? 'errore'}`);
              return { ok: r.ok };
            })(),
          });
        }

        const completati = await Promise.all(
          jobs.map((j) =>
            j.promessa
              .then((valore) => ({ tipo: j.tipo, valore }))
              .catch(() => ({ tipo: j.tipo, valore: { ok: false } })),
          ),
        );

        // Email 5 (extra) consegnata su almeno un canale: segna l'istante di
        // invio e il flag una tantum. Il cron `step5-notifiche` invierà poi
        // Email 6 (recap = avviso finale) 2 ore dopo via Edge Function.
        if (client && tipo === 'extra' && completati.some((c) => c.valore.ok)) {
          const { error: errFlag } = await client
            .from('profiles')
            .update({ notifiche_blocco_inviato: true, step4_inviata_at: new Date().toISOString() })
            .eq('id', utente.id);
          if (errFlag) {
            console.warn(`  ⚠ flag sequenza post-prova non aggiornato per ${utente.id.slice(0, 8)}… (${errFlag.message})`);
          }
        }
        // Ledger anti-duplicato: registra i canali andati a buon fine (best-effort).
        if (client) {
          for (const c of completati) {
            if (c.valore.ok) await registraNotifica(client, utente.id, interpello.hashId, c.tipo);
          }
        }
        return completati;
      }),
    );

    for (const gruppo of risultati) {
      for (const r of gruppo) {
        if (r.valore.ok) {
          if (r.tipo === 'email') esito.inviate += 1;
          else esito.telegramInviate += 1;
        } else if (r.tipo === 'email') {
          esito.fallite += 1;
        } else {
          esito.telegramFallite += 1;
        }
      }
    }
  }

  console.log(
    `✓ Notifiche elaborate: ${esito.inviate} email inviate · ${esito.fallite} email fallite · ` +
      `${esito.telegramInviate} Telegram inviati · ${esito.telegramFallite} Telegram falliti.`,
  );
  return esito;
}

/* -------------------- Dispatch immediato per singolo utente -------------------- */

export interface EsitoDispatchUtente extends EsitoNotifiche {
  /** Interpelli ATTIVI compatibili con il profilo. */
  interpelli: number;
  /** Interpelli saltati perché già notificati (ledger). */
  saltati: number;
}

/**
 * DISPATCH IMMEDIATO per un utente: notifica OGNI interpello ATTIVO compatibile
 * con il suo profilo (province + classi), anche se già presente in DB — colma il
 * caso in cui un'opportunità è in bacheca ma non è mai stata notificata (perché
 * l'utente non era matchato al momento dell'inserimento, o il matching era
 * disallineato). Ogni notifica include l'EMAIL DI CANDIDATURA dell'avviso.
 *
 * Dedupe tramite `notifications_log` (best-effort se la tabella non esiste):
 * una seconda esecuzione NON rispedisce gli stessi interpelli.
 * Non lancia eccezioni: ogni errore è loggato e conteggiato.
 */
export async function notificaInterpelliPerUtente(
  client: SupabaseClient | null,
  target: { userId?: string; email?: string },
  opts: NotificheOptions = {},
): Promise<EsitoDispatchUtente> {
  const esito: EsitoDispatchUtente = {
    inviate: 0,
    fallite: 0,
    telegramInviate: 0,
    telegramFallite: 0,
    interpelli: 0,
    saltati: 0,
  };
  if (!client) {
    console.warn('⚠ dispatch: client Supabase mancante.');
    return esito;
  }

  // 1. Profilo (per id o per email, case-insensitive).
  let q = client
    .from('profiles')
    .select(
      'id,email,email_notifica,nome,province_interesse,province_attive,classi_concorso,telegram_chat_id,piano,is_free_forever,radar_attivo',
    );
  q = target.userId
    ? q.eq('id', target.userId)
    : q.eq('email', String(target.email ?? '').trim().toLowerCase());
  const { data: prof, error } = await q.maybeSingle();
  if (error || !prof) {
    console.warn(`⚠ dispatch: profilo non trovato (${error?.message ?? 'nessuna riga'}).`);
    return esito;
  }
  if (prof.radar_attivo === false) {
    console.warn(`⚠ dispatch: Radar in PAUSA per ${prof.email} — nessun invio.`);
    return esito;
  }

  const email = String(prof.email_notifica || prof.email || '').trim();
  const chatId = prof.telegram_chat_id ? String(prof.telegram_chat_id).trim() : '';
  const province = (prof.province_interesse ?? prof.province_attive ?? []) as string[];
  const classiProfilo = (prof.classi_concorso ?? []) as string[];
  const classiNorm = new Set(classiProfilo.map(normalizzaClasse));
  const piano = prof.is_free_forever === true ? 'free_forever' : String(prof.piano ?? 'base');
  const resend = getResendClient();

  if (!email && !chatId) {
    console.warn(`⚠ dispatch: nessun canale (email/Telegram) per ${prof.email}.`);
    return esito;
  }

  // 2. Interpelli ATTIVI nelle province del profilo (nessun filtro classe qui:
  //    il match classe è applicato sotto con la normalizzazione A-26≡A-026).
  const righe = (await searchInterpelli(client, { province })) ?? [];
  const oggi = Date.now();

  for (const r of righe) {
    if (r.expiration_date && new Date(r.expiration_date).getTime() < oggi) continue;
    const classiInterpello = (r.class_codes ?? []).filter(Boolean);
    const matchClasse =
      classiProfilo.length === 0 ||
      classiInterpello.length === 0 ||
      classiInterpello.some((c) => classiNorm.has(normalizzaClasse(c)));
    if (!matchClasse) continue;
    esito.interpelli += 1;

    if (await giaNotificato(client, String(prof.id), r.hash_id)) {
      esito.saltati += 1;
      continue;
    }

    const dettagli: DettagliNotifica = {
      id: r.hash_id,
      title: r.title,
      schoolName: r.school_name,
      province: r.province,
      classi: classiInterpello,
      materia: r.materia,
      scadenza: r.expiration_date,
      link: r.source_url,
      contactEmail: r.contact_email,
    };
    const tipo: TipoMessaggio = pianoIllimitato(piano) ? 'notifica_pro' : 'prova1';

    let okAny = false;
    if (email && resend) {
      const destinatario: DestinatarioNotifica = {
        email,
        nome: prof.nome ? String(prof.nome) : undefined,
        province,
        classi: classiProfilo,
      };
      const e = await inviaNotificaEmail(resend, dettagli, destinatario, {
        dryRun: opts.dryRun,
        dashboardUrl: opts.dashboardUrl,
        tipo,
      });
      if (e.inviata) {
        esito.inviate += 1;
        okAny = true;
        if (!opts.dryRun) await registraNotifica(client, String(prof.id), r.hash_id, 'email');
      } else {
        esito.fallite += 1;
        console.warn(`  ✗ Email a ${email} fallita: ${e.error ?? 'errore sconosciuto'}`);
      }
    }

    if (chatId) {
      if (opts.dryRun) {
        console.log(`  ✈ [DRY-RUN] Telegram ${chatId} ← ${r.title.slice(0, 60)}`);
        esito.telegramInviate += 1;
        okAny = true;
      } else {
        const t = await inviaNotificaTelegram(chatId, dettagli, {
          classiUtente: classiProfilo,
          dashboardUrl: opts.dashboardUrl,
          tipo,
        });
        if (t.ok) {
          esito.telegramInviate += 1;
          okAny = true;
          await registraNotifica(client, String(prof.id), r.hash_id, 'telegram');
        } else {
          esito.telegramFallite += 1;
          console.warn(`  ✗ Telegram a ${chatId} fallito: ${t.error ?? 'errore'}`);
        }
      }
    }

    if (!okAny) console.warn(`  ⚠ Nessun canale disponibile per "${r.title.slice(0, 60)}".`);
  }

  console.log(
    `✓ Dispatch ${prof.email}: ${esito.interpelli} interpelli compatibili · ${esito.saltati} già notificati · ` +
      `${esito.inviate} email · ${esito.telegramInviate} Telegram.`,
  );
  return esito;
}

