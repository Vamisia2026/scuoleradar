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
import { findUtentiCompatibili } from './matchingEngine.ts';

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
      scadenza: interpello.expirationDate,
      link: interpello.link,
    };

    const risultati = await Promise.all(
      utenti.map(async (utente) => {
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
              } else if (!utente.notificheBloccoInviato) {
                tipo = 'extra'; // Email 5 — warning: periodo di prova terminato
              } else {
                skip = true;
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
