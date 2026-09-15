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
  inviaDigestEmail,
  inviaNotificaEmail,
  type DettagliNotifica,
  type DestinatarioNotifica,
  type TipoMessaggio,
} from './resend.ts';
import { inviaDigestTelegram, inviaNotificaTelegram } from './telegram.ts';
import { chiaveLedger, ledgerLocaleGia, ledgerLocaleRegistra, ledgerLocaleSalva } from './ledgerLocale.ts';
import {
  elencaUtentiNotificabili,
  findUtentiCompatibili,
  normalizzaClasse,
  searchInterpelli,
  sostegnoAmmesso,
  type UtenteCompatibile,
} from './matchingEngine.ts';
import { emailAvviso } from './alertInterpello.ts';
import { risolviEmailUfficialeScuola } from './emailScuola.ts';
import { descrizioneFinestraDigest, etichettaDataItalia, ordinaVociDigest } from './digest.ts';

/**
 * Recapito di CANDIDATURA da mettere nella notifica: se la pipeline ha già
 * estratto un'email la usa così com'è (normalizzata); altrimenti ricostruisce la
 * PEO ufficiale dal codice meccanografico (convenzione MIM). Così il contatto —
 * asset del piano PRO — c'è anche quando l'unico link raggiungibile è una pagina
 * di riepilogo/"Stampa" senza descrizione. Non inventa nulla: senza email né
 * codice resta `null` e la riga viene omessa dal messaggio.
 */
function recapitoNotifica(
  email?: string | null,
  schoolCode?: string | null,
  testo?: string | null,
): string | null {
  return (
    emailAvviso(email) ??
    risolviEmailUfficialeScuola({ schoolCode: schoolCode ?? null, testo: testo ?? null })?.email ??
    null
  );
}

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
/** Avviso una-tantum quando il ledger non è disponibile (tabella non creata). */
let ledgerNotificheAvvisato = false;

/** Canali di notifica (allineati a `notifications_log.canale`). */
export type CanaleNotifica = 'email' | 'telegram';

/** Canale LEGACY agnostico: una chiave con questo valore vale per TUTTI i canali. */
const CANALE_LEGACY = 'notifica';

/**
 * Deduplica UNIFICATA AGNOSTICA: ledger locale su file (funziona SEMPRE, anche
 * senza migrazioni) + ledger DB `notifications_log`. True se la coppia
 * (utente, interpello) è già stata consegnata su QUALSIASI canale.
 * Usata dai flussi legacy e dal recupero.
 */
async function giaNotificatoL(
  client: SupabaseClient | null,
  userId: string,
  hash: string,
): Promise<boolean> {
  if (ledgerLocaleGia(chiaveLedger('utente', `${userId}:${hash}`, CANALE_LEGACY))) return true;
  if (client && (await giaNotificato(client, userId, hash))) return true;
  return false;
}

/** Registra la consegna come AGGANCIATA a tutti i canali (semantica legacy). */
function registraNotificaLocale(userId: string, hash: string): void {
  ledgerLocaleRegistra(chiaveLedger('utente', `${userId}:${hash}`, CANALE_LEGACY));
}

/** Registra la consegna sul ledger locale PER CANALE (dispatch a tier). */
function registraNotificaCanaleLocale(userId: string, hash: string, canale: CanaleNotifica): void {
  ledgerLocaleRegistra(chiaveLedger('utente', `${userId}:${hash}`, canale));
}

/**
 * Deduplica PER CANALE: true se la coppia (utente, interpello) è già stata
 * consegnata su QUEL canale.
 *
 * È la semantica richiesta dallo split a tier: un alert PRO consegnato in tempo
 * reale su Telegram NON deve tornare nel batch Telegram serale, ma PUÒ comparire
 * nel riepilogo EMAIL del pomeriggio (canale diverso).
 *
 * Compatibilità: la chiave LEGACY agnostica (`utente|<id>:<hash>|notifica`) vale
 * come "consegnato su tutti i canali" → nessun doppio invio degli avvisi storici.
 */
async function giaNotificatoCanale(
  client: SupabaseClient | null,
  userId: string,
  hash: string,
  canale: CanaleNotifica,
): Promise<boolean> {
  if (ledgerLocaleGia(chiaveLedger('utente', `${userId}:${hash}`, CANALE_LEGACY))) return true;
  if (ledgerLocaleGia(chiaveLedger('utente', `${userId}:${hash}`, canale))) return true;
  if (!client) return false;
  try {
    const { data, error } = await client
      .from('notifications_log')
      .select('canale')
      .eq('user_id', userId)
      .eq('interpello_hash', hash)
      .eq('canale', canale)
      .limit(1);
    if (error) {
      // Diagnostica esplicita: senza tabella il ledger DB non protegge.
      if (!ledgerNotificheAvvisato) {
        ledgerNotificheAvvisato = true;
        console.warn(
          `⚠ Ledger notifiche NON disponibile (${error.message}): la deduplica resta affidata al ` +
            'file `.scuoleradar/notifiche-ledger.json`; applica la migrazione ' +
            '`20260914030000_repair_notifications_log_e_rpc_quota.sql` (`npm run db:verifica`).',
        );
      }
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

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
    if (error) {
      // Diagnostica esplicita: senza tabella il ledger non protegge → spam possibile.
      if (!ledgerNotificheAvvisato) {
        ledgerNotificheAvvisato = true;
        console.warn(
          `⚠ Ledger notifiche NON disponibile (${error.message}): applicare la migrazione ` +
            '`20260914010000_notifications_log.sql` per garantire zero duplicati.',
        );
      }
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Scrive una riga nel ledger DB `notifications_log`.
 *
 * Ritorna `false` (senza bloccare l'invio) quando la tabella non è disponibile:
 * in quel caso l'unica protezione resta il ledger su FILE, quindi lo segnaliamo
 * UNA volta con un warning operativo che nomina la migrazione da applicare.
 * NB: supabase-js NON lancia nei casi di errore DB (ritorna `{ error }`): senza
 * questo controllo un ledger assente passerebbe completamente inosservato.
 */
async function registraNotifica(
  client: SupabaseClient,
  userId: string,
  hash: string,
  canale: 'email' | 'telegram',
): Promise<boolean> {
  try {
    const { error } = await client
      .from('notifications_log')
      .upsert(
        { user_id: userId, interpello_hash: hash, canale },
        { onConflict: 'user_id,interpello_hash,canale' },
      );
    if (error) {
      if (!ledgerNotificheAvvisato) {
        ledgerNotificheAvvisato = true;
        console.warn(
          `⚠ Ledger DB non aggiornabile (${error.message}): la deduplica resta affidata al ` +
            'ledger su file (.scuoleradar/notifiche-ledger.json). Applica la migrazione ' +
            '`20260914030000_repair_notifications_log_e_rpc_quota.sql` e verifica con `npm run db:verifica`.',
        );
      }
      return false;
    }
    return true;
  } catch {
    /* rete/tabella assente: il ledger su file copre comunque */
    return false;
  }
}

/**
 * LEGACY (non più usata dalla pipeline): notifica IMMEDIATA per singolo
 * interpello. La pipeline di ingestione non invia più N email al giorno: accumula
 * le opportunità e le consegna con UN SOLO digest alle 18:00
 * (`inviaDigestGiornaliero`). La funzione resta per test/dry-run e per i
 * backfill manuali.
 */
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
    // (titolo + materia servono alla guardia SOSTEGNO: si veda `sostegnoAmmesso`).
    const utenti = await findUtentiCompatibili(client, {
      province: interpello.province,
      classi: interpello.classCodes,
      titolo: interpello.title,
      materia: interpello.materia,
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
      // Email di candidatura: se la pipeline non l'ha trovata, si ricostruisce
      // dal codice meccanografico (ultima ratio, convenzione MIM).
      contactEmail: recapitoNotifica(
        interpello.contactEmail,
        interpello.schoolCode,
        interpello.title,
      ),
    };

    const risultati = await Promise.all(
      utenti.map(async (utente) => {
        // Utente già saturato in questo run (BASE oltre il limite): nessun
        // ulteriore processamento, il cron `step5-notifiche` gestirà il recap.
        if (utentiEsauriti.has(utente.id)) return [];

        // ANTI-SPAM / IDEMPOTENZA (bug "notifiche ripetute"): se la coppia
        // (utente, interpello) è già nel ledger, la notifica NON si rimanda —
        // per QUALUNQUE piano. Senza questo controllo un avviso ri-rilevato come
        // "nuovo" (upsert ignorato, hash variato, run ripetuti) veniva rispedito
        // ogni volta, generando loop di messaggi identici.
        if (await giaNotificatoL(client, utente.id, interpello.hashId)) {
          return [];
        }

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
        // Ledger anti-duplicato: registra i canali andati a buon fine (best-effort)
        // e la coppia (utente, interpello) sul ledger locale (sempre disponibile).
        if (completati.some((c) => c.valore.ok)) {
          registraNotificaLocale(utente.id, interpello.hashId);
        }
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

    if (await giaNotificatoL(client, String(prof.id), r.hash_id)) {
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
      // Email di candidatura: eventuale fallback dalla convenzione MIM sul
      // codice meccanografico (le righe storiche possono averlo senza email).
      contactEmail: recapitoNotifica(
        r.contact_email,
        r.school_code,
        `${r.title} ${r.school_name ?? ''}`,
      ),
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
    else registraNotificaLocale(String(prof.id), r.hash_id);
  }

  console.log(
    `✓ Dispatch ${prof.email}: ${esito.interpelli} interpelli compatibili · ${esito.saltati} già notificati · ` +
      `${esito.inviate} email · ${esito.telegramInviate} Telegram.`,
  );
  return esito;
}


/* ======================= DIGEST GIORNALIERO (18:00 italiane) ======================= */

export interface EsitoDigest extends EsitoNotifiche {
  /** Profili notificabili esaminati. */
  utenti: number;
  /** Digest realmente inviati (almeno un canale consegnato). */
  digest: number;
  /** Opportunità incluse nei digest inviati. */
  voci: number;
  /** Utenti saltati (nessuna novità, quota esaurita, nessun canale). */
  saltati: number;
  /** Opportunità marcate come consegnate SENZA invio (modalità recupero). */
  registrate: number;
}

/** Esito vuoto (nessun invio). */
function esitoDigestVuoto(): EsitoDigest {
  return {
    inviate: 0,
    fallite: 0,
    telegramInviate: 0,
    telegramFallite: 0,
    utenti: 0,
    digest: 0,
    voci: 0,
    saltati: 0,
    registrate: 0,
  };
}

/** Profilo singolo (admin): riusa la validazione di eleggibilità del matching. */
async function utentiSingoli(
  client: SupabaseClient,
  target: { userId?: string; email?: string },
): Promise<UtenteCompatibile[]> {
  const tutti = await elencaUtentiNotificabili(client);
  const email = String(target.email ?? '').trim().toLowerCase();
  const trovati = tutti.filter((u) =>
    target.userId ? u.id === target.userId : String(u.email).toLowerCase() === email,
  );
  if (trovati.length === 0) {
    console.warn(`⚠ digest: profilo non trovato o non notificabile (${target.userId ?? target.email}).`);
  }
  return trovati;
}

/**
 * Opportunità ATTIVE compatibili con il profilo e NON ancora consegnate SU QUEL
 * CANALE (ledger per canale). Il match classe usa la normalizzazione A-26 ≡ A-026.
 */
async function raccogliVociCanale(
  client: SupabaseClient,
  utente: UtenteCompatibile,
  canale: CanaleNotifica,
  finoA?: string | null,
): Promise<DettagliNotifica[]> {
  const righe = (await searchInterpelli(client, { province: utente.province })) ?? [];
  const oggi = Date.now();
  const tetto = finoA ? new Date(finoA).getTime() : null;
  const classiNorm = new Set(utente.classi.map(normalizzaClasse));
  const voci: DettagliNotifica[] = [];
  for (const r of righe) {
    if (r.expiration_date && new Date(r.expiration_date).getTime() < oggi) continue;
    // Tetto temporale opzionale (recupero/marcatura di invii già avvenuti):
    // si escludono le opportunità inserite DOPO l'istante indicato, così non
    // vengono mai "marcate come inviate" segnalazioni nuove.
    if (tetto !== null && r.created_at) {
      const creato = new Date(r.created_at).getTime();
      if (!Number.isNaN(creato) && creato > tetto) continue;
    }
    const classiInterpello = (r.class_codes ?? []).filter(Boolean);
    // GUARDIA SOSTEGNO (stessa fonte unica del matching in tempo reale): un avviso
    // di sostegno (codice AD… oppure titolo/materia che lo dichiarano) entra nel
    // digest SOLO per i profili che hanno aderito alla preferenza.
    if (
      !sostegnoAmmesso(utente, {
        classi: classiInterpello,
        titolo: r.title,
        materia: r.materia,
      })
    ) {
      continue;
    }
    const matchClasse =
      classiNorm.size === 0 ||
      classiInterpello.length === 0 ||
      classiInterpello.some((c) => classiNorm.has(normalizzaClasse(c)));
    if (!matchClasse) continue;
    if (await giaNotificatoCanale(client, utente.id, r.hash_id, canale)) continue;
    voci.push({
      id: r.hash_id,
      title: r.title,
      schoolName: r.school_name,
      province: r.province,
      classi: classiInterpello,
      materia: r.materia,
      scadenza: r.expiration_date,
      link: r.source_url,
      contactEmail: recapitoNotifica(
        r.contact_email,
        r.school_code,
        `${r.title} ${r.school_name ?? ''}`,
      ),
    });
  }
  return ordinaVociDigest(voci);
}

/** Unione delle voci dei canali (dedup per id, ordine per scadenza). */
function unisciVoci(...liste: DettagliNotifica[][]): DettagliNotifica[] {
  const visti = new Set<string>();
  const out: DettagliNotifica[] = [];
  for (const lista of liste) {
    for (const v of lista) {
      const chiave = v.id ?? `${v.title}|${v.scadenza ?? ''}`;
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      out.push(v);
    }
  }
  return ordinaVociDigest(out);
}

/**
 * Esegue il DIGEST GIORNALIERO: per ogni profilo notificabile raccoglie TUTTE le
 * opportunità attive compatibili non ancora notificate (ledger) e invia UNA SOLA
 * email + UN SOLO messaggio Telegram con il riepilogo, ordinato per scadenza.
 *
 * Sostituisce l'invio in tempo reale (`notificaNuoviInterpelli`): niente più N
 * email al giorno. Va eseguito una volta al giorno alla chiusura delle scuole
 * (18:00 italiane — vedi `eOraDelDigest` e il workflow `digest.yml`).
 *
 * Consumo quota: UN credito per digest (il digest È la notifica del giorno), con
 * la stessa sequenza prova1 → prova2 → prova3 → extra del piano BASE; dopo il
 * digest `extra` il cron DB `step5-notifiche` invia l'avviso finale (recap).
 *
 * Dedupe: ledger locale + `notifications_log` (tutte le voci incluse vengono
 * marcate, così il digest di domani non le ripete). Non lancia eccezioni.
 */
export async function inviaDigestGiornaliero(
  client: SupabaseClient | null,
  opts: NotificheOptions & {
    /** Ignora la finestra oraria (lancio manuale / admin). */
    forzato?: boolean;
    /** Limita il digest a un solo profilo (per id o email). */
    soloUtente?: { userId?: string; email?: string };
    /**
     * MODALITÀ RECUPERO: marca le opportunità come CONSEGNATE senza inviare nulla.
     * Serve a registrare invii realmente avvenuti quando il ledger DB non era
     * disponibile (es. digest spedito prima di applicare le migrazioni): senza
     * questa marcatura il digest successivo rimanderebbe le stesse voci.
     * Non consuma quota e non tocca i canali.
     */
    soloRegistrare?: boolean;
    /**
     * Tetto temporale (ISO) per `soloRegistrare`: marca SOLO le opportunità
     * inserite entro quell'istante, così le segnalazioni più recenti (non ancora
     * inviate) mantengono il diritto al digest.
     */
    finoA?: string | null;
  } = {},
): Promise<EsitoDigest> {
  const esito = esitoDigestVuoto();
  if (!client) {
    console.warn('⚠ digest: client Supabase mancante.');
    return esito;
  }

  const resend = getResendClient();
  const { dryRun = false, dashboardUrl } = opts;
  const data = etichettaDataItalia();

  const utenti = opts.soloUtente
    ? await utentiSingoli(client, opts.soloUtente)
    : await elencaUtentiNotificabili(client);
  esito.utenti = utenti.length;
  if (utenti.length === 0) {
    console.log('ℹ digest: nessun profilo notificabile.');
    return esito;
  }
  console.log(
    `• Digest giornaliero (${descrizioneFinestraDigest()}): ${utenti.length} profili notificabili${
      dryRun ? ' [DRY-RUN]' : ''
    }.`,
  );

  // Stato PER-RUN: il flag in memoria `notifiche_blocco_inviato` resta `false`
  // dopo l'update su DB → senza questo set l'avviso "extra" potrebbe ripetersi
  // per lo stesso utente nello stesso run.
  const bloccoGiaAvvisati = new Set<string>();

  for (const utente of utenti) {
    const pro = pianoIllimitato(utente.piano);

    // EMAIL → riepilogo quotidiano per ENTRAMBI i tier (una sola email al giorno).
    const vociEmail =
      utente.email && resend ? await raccogliVociCanale(client, utente, 'email', opts.finoA) : [];
    // TELEGRAM → batch serale SOLO per BASE: i PRO ricevono gli alert in TEMPO
    // REALE appena scrapati (`inviaAlertTelegramTempoReale`), quindi il batch
    // Telegram ripeterebbe gli stessi avvisi.
    const vociTelegram =
      utente.telegramChatId && !pro
        ? await raccogliVociCanale(client, utente, 'telegram', opts.finoA)
        : [];
    const voci = unisciVoci(vociEmail, vociTelegram);
    if (voci.length === 0) {
      esito.saltati += 1;
      continue;
    }

    // MODALITÀ RECUPERO (nessun invio): marca le voci come consegnate su TUTTI i
    // canali (chiave legacy agnostica): registra invii realmente avvenuti quando
    // il ledger non era disponibile.
    if (opts.soloRegistrare) {
      let marcate = 0;
      for (const v of voci) {
        if (!v.id) continue;
        registraNotificaLocale(utente.id, v.id);
        await registraNotifica(client, utente.id, v.id, 'email');
        marcate += 1;
      }
      ledgerLocaleSalva();
      esito.registrate += marcate;
      console.log(
        `  ✎ ${utente.email || utente.id.slice(0, 8)}: ${marcate} opportunità marcate come consegnate (nessun invio).`,
      );
      continue;
    }

    // Quota: UN solo incremento al giorno e SOLO per BASE (PRO è illimitato:
    // nessuna chiamata RPC). `tipo` resta per la diagnostica e per il flag della
    // sequenza post-quota.
    let tipo: TipoMessaggio = 'notifica_pro';
    let skip = false;
    const rpc = pro
      ? { data: [] as Array<{ consentito?: boolean; notifiche_usate?: number }>, error: null }
      : await client.rpc('incrementa_notifiche_utente', { p_user_id: utente.id });
    if (rpc.error) {
      console.warn(
        `  ⚠ RPC contatore notifiche fallita per ${utente.id.slice(0, 8)}… (${rpc.error.message}) — invio comunque.`,
      );
      tipo = 'prova1';
    } else if (rpc.data?.[0]) {
      if (rpc.data[0].consentito === false) {
        // Ciclo BASE completato (3 notifiche/anno scolastico): avviso "extra" UNA
        // volta, poi si salta (il recap finale arriva dal cron `step5-notifiche`).
        if (!utente.notificheBloccoInviato && !bloccoGiaAvvisati.has(utente.id)) {
          tipo = 'extra';
          bloccoGiaAvvisati.add(utente.id);
        } else {
          skip = true;
        }
      } else {
        const usate = Number(rpc.data[0].notifiche_usate);
        tipo = usate === 1 ? 'prova1' : usate === 2 ? 'prova2' : 'prova3';
      }
    }
    if (skip) {
      esito.saltati += 1;
      console.log(`  – ${utente.email || utente.telegramChatId}: quota BASE esaurita, nessun digest.`);
      continue;
    }

    const destinatario: DestinatarioNotifica = {
      email: utente.email,
      nome: utente.nome,
      province: utente.province,
      classi: utente.classi,
    };

    const canaliOk: CanaleNotifica[] = [];

    // EMAIL: riepilogo delle voci non ancora inviate per email (entrambi i tier).
    if (vociEmail.length > 0 && utente.email && resend) {
      const e = await inviaDigestEmail(resend, vociEmail, destinatario, {
        dryRun,
        dashboardUrl,
        data,
      });
      if (e.inviata) {
        esito.inviate += 1;
        canaliOk.push('email');
      } else {
        esito.fallite += 1;
        console.warn(`  ✗ Riepilogo email a ${utente.email}: ${e.error ?? 'errore sconosciuto'}`);
      }
    }

    // TELEGRAM: UN SOLO batch e SOLO per BASE (i PRO sono già stati avvisati in
    // tempo reale). Resta un messaggio di testo: il batch è lungo.
    if (vociTelegram.length > 0 && utente.telegramChatId) {
      if (dryRun) {
        console.log(
          `  ✈ [DRY-RUN] Batch Telegram BASE → ${utente.telegramChatId} (${vociTelegram.length} voci)`,
        );
        esito.telegramInviate += 1;
        canaliOk.push('telegram');
      } else {
        const t = await inviaDigestTelegram(utente.telegramChatId, vociTelegram, {
          dashboardUrl,
          data,
          classiUtente: utente.classi,
        });
        if (t.ok) {
          esito.telegramInviate += 1;
          canaliOk.push('telegram');
        } else {
          esito.telegramFallite += 1;
          console.warn(`  ✗ Batch Telegram a ${utente.telegramChatId}: ${t.error ?? 'errore'}`);
        }
      }
    }

    if (canaliOk.length === 0) {
      console.warn(
        `  ⚠ Riepilogo non consegnato a ${utente.email || utente.id.slice(0, 8)} (nessun canale riuscito).`,
      );
      esito.saltati += 1;
      continue;
    }

    // Ledger PER CANALE: ogni voce è marcata sul canale con cui è stata consegnata
    // (email → `email`; batch → `telegram`), così né il batch di domani né il tempo
    // reale ripetono lo stesso avviso sullo stesso canale.
    // In DRY-RUN non si registra NULLA: un test non deve "bruciare" le voci.
    if (!dryRun) {
      for (const v of vociEmail) {
        if (!v.id) continue;
        registraNotificaCanaleLocale(utente.id, v.id, 'email');
        await registraNotifica(client, utente.id, v.id, 'email');
      }
      for (const v of vociTelegram) {
        if (!v.id) continue;
        registraNotificaCanaleLocale(utente.id, v.id, 'telegram');
        await registraNotifica(client, utente.id, v.id, 'telegram');
      }
      // Persistenza INCREMENTALE: se il run si interrompe (rete/DB caduti a metà
      // loop) quanto già consegnato è comunque su disco e non verrà rimandato.
      ledgerLocaleSalva();
    }

    // Quota BASE esaurita (avviso "extra") consegnata: flag una tantum + istante.
    // Il cron DB `step5-notifiche` invierà poi l'avviso finale (recap).
    if (tipo === 'extra') {
      const { error: errFlag } = await client
        .from('profiles')
        .update({ notifiche_blocco_inviato: true, step4_inviata_at: new Date().toISOString() })
        .eq('id', utente.id);
      if (errFlag) {
        console.warn(`  ⚠ flag post-quota non aggiornato per ${utente.id.slice(0, 8)}… (${errFlag.message})`);
      }
    }

    esito.digest += 1;
    esito.voci += voci.length;
    console.log(
      `  ✓ Riepilogo ${tipo} (${pro ? 'PRO' : 'BASE'}) a ${utente.email || utente.telegramChatId}: ` +
        `${voci.length} opportunità (${canaliOk.join('+')})`,
    );
  }

  // PERSISTENZA DEL LEDGER: `registraNotificaLocale` scrive in memoria, il file
  // va salvato a fine run. Senza questa chiamata il ledger locale andrebbe perso
  // a fine processo e — se la tabella `notifications_log` non è ancora applicata —
  // il digest successivo rimanderebbe le stesse opportunità (bug "notifiche
  // ripetute"). `ledgerLocaleSalva` è best-effort e non lancia mai.
  ledgerLocaleSalva();

  console.log(
    `✓ Digest giornaliero: ${esito.digest} inviati · ${esito.voci} opportunità · ${esito.registrate} marcate (recupero) · ` +
      `${esito.saltati} saltati · ${esito.inviate} email · ${esito.telegramInviate} Telegram · ` +
      `${esito.fallite + esito.telegramFallite} errori.`,
  );
  return esito;
}



/* =============== ALERT IN TEMPO REALE (solo PRO) — TELEGRAM =============== */

/**
 * DISPATCH IN TEMPO REALE su TELEGRAM — riservato al piano PRO.
 *
 * Split per tier:
 *   · **PRO** → alert INDIVIDUALI appena l'avviso viene scrapato (questo flusso):
 *     il vantaggio concreto del piano a pagamento;
 *   · **BASE** → NESSUN alert in tempo reale: un solo batch alle 17:00
 *     (`inviaDigestGiornaliero`).
 *
 * Note di servizio:
 *   · non consuma quota (PRO è illimitato by design) e non invia email (il
 *     riepilogo email resta quotidiano per entrambi i tier);
 *   · marca il canale `telegram` nel ledger → il batch serale (BASE) e il tempo
 *     reale non ripetono mai lo stesso avviso sullo stesso canale;
 *   · non lancia MAI eccezioni: ogni errore è loggato e contato.
 */
export async function inviaAlertTelegramTempoReale(
  client: SupabaseClient | null,
  nuovi: InterpelloParsato[],
  opts: NotificheOptions = {},
): Promise<EsitoNotifiche> {
  const esito: EsitoNotifiche = { inviate: 0, fallite: 0, telegramInviate: 0, telegramFallite: 0 };
  if (!client || nuovi.length === 0) return esito;
  const { dryRun = false, dashboardUrl } = opts;

  for (const interpello of nuovi) {
    // try/catch PER AVVISO: un errore su un avviso (dati sporchi, rete) non deve
    // interrompere il run e — soprattutto — non deve far perdere le marcature di
    // deduplica già registrate sugli avvisi precedenti.
    try {
      const utenti = await findUtentiCompatibili(client, {
        province: interpello.province,
        classi: interpello.classCodes,
        titolo: interpello.title,
        materia: interpello.materia,
      });

      for (const utente of utenti) {
        // BASE → nessun tempo reale: riceverà il batch serale.
        if (!pianoIllimitato(utente.piano)) continue;
        const chatId = utente.telegramChatId;
        if (!chatId) continue;
        if (await giaNotificatoCanale(client, utente.id, interpello.hashId, 'telegram')) continue;

        const dettagli: DettagliNotifica = {
          id: interpello.hashId,
          title: interpello.title,
          schoolName: interpello.schoolName,
          province: interpello.province,
          classi: interpello.classCodes,
          materia: interpello.materia,
          scadenza: interpello.expirationDate,
          link: interpello.link,
          contactEmail: recapitoNotifica(
            interpello.contactEmail,
            interpello.schoolCode,
            interpello.title,
          ),
        };

        if (dryRun) {
          console.log(
            `  ✈ [DRY-RUN] Alert PRO → ${chatId} · ${interpello.title.slice(0, 60)}`,
          );
          esito.telegramInviate += 1;
          continue;
        }

        const r = await inviaNotificaTelegram(chatId, dettagli, {
          classiUtente: utente.classi,
          dashboardUrl,
          tipo: 'notifica_pro',
        });
        if (r.ok) {
          esito.telegramInviate += 1;
          registraNotificaCanaleLocale(utente.id, interpello.hashId, 'telegram');
          await registraNotifica(client, utente.id, interpello.hashId, 'telegram');
          // PERSISTENZA IMMEDIATA della marcatura: se il run muore a metà (timeout
          // del workflow, kill del processo, errore su un avviso successivo) gli
          // alert GIÀ consegnati restano registrati e non vengono rimandati domani.
          ledgerLocaleSalva();
        } else {
          esito.telegramFallite += 1;
          console.warn(`  ✗ Alert PRO a ${chatId} fallito: ${r.error ?? 'errore'}`);
        }
      }
    } catch (err) {
      esito.fallite += 1;
      console.warn(
        `  ✗ Alert PRO non calcolabili per «${interpello.title.slice(0, 60)}»: ${(err as Error).message}`,
      );
    }
  }

  // Persistenza del ledger: gli alert consegnati non devono tornare nel batch.
  ledgerLocaleSalva();

  if (esito.telegramInviate + esito.telegramFallite > 0) {
    console.log(
      `• Alert PRO in tempo reale: ${esito.telegramInviate} inviati · ${esito.telegramFallite} falliti ` +
        `(${nuovi.length} avvisi esaminati).`,
    );
  }
  return esito;
}

