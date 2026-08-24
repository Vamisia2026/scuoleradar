/**
 * ScuoleRadar.it — Notifier (FASE 4)
 *
 * Riceve i nuovi interpelli inseriti dallo scraper, interroga il Matching
 * Engine (`findUtentiCompatibili`) per trovare gli utenti con preferenze
 * compatibili e invia la mail di avviso via Resend.
 *
 * Usato dallo scraper (Node) dopo l'upsert su Supabase.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { InterpelloParsato } from '../scraper/parser.ts';
import {
  getResendClient,
  inviaNotificaEmail,
  type DettagliNotifica,
  type DestinatarioNotifica,
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

/**
 * Invia le notifiche per i nuovi interpelli agli utenti compatibili:
 * - email via Resend (se l'utente ha un indirizzo valido)
 * - messaggio Telegram (se l'utente ha collegato il bot con il proprio chat_id)
 * Email e Telegram partono in parallelo per ogni utente.
 * Non lancia eccezioni: eventuali errori vengono loggati e conteggiati.
 */
export async function notificaNuoviInterpelli(
  client: SupabaseClient | null,
  nuovi: InterpelloParsato[],
  opts: NotificheOptions = {},
): Promise<EsitoNotifiche> {
  const esito: EsitoNotifiche = { inviate: 0, fallite: 0, telegramInviate: 0, telegramFallite: 0 };
  const resend = getResendClient();
  if (!resend) {
    console.log('ℹ Notifiche email disattivate: RESEND_API_KEY non configurata.');
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

    // Email + Telegram in parallelo per ogni utente qualificato
    const risultati = await Promise.all(
      utenti.map(async (utente) => {
        // FASE 6 — guardia server-side: RPC atomica del contatore notifiche.
        // base → max 3/mese (skip oltre il limite); pro → sempre consentito.
        if (client) {
          const { data: rpcData, error: rpcError } = await client.rpc('incrementa_notifiche_utente', {
            p_user_id: utente.id,
          });
          if (rpcError) {
            console.warn(
              `  ⚠ RPC contatore notifiche fallita per ${utente.id.slice(0, 8)}… (${rpcError.message}) — invio comunque.`,
            );
          } else if (rpcData?.[0]?.consentito === false) {
            console.log(
              `  ℹ Utente ${utente.id.slice(0, 8)}… al limite notifiche (${rpcData[0].notifiche_usate}/3): notifica saltata.`,
            );
            return [] as Array<{ tipo: 'email' | 'telegram'; valore: EsitoJob }>;
          }
        }

        const jobs: Array<{ tipo: 'email' | 'telegram'; promessa: Promise<EsitoJob> }> = [];

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
            }).then((e) => ({ ok: e.inviata })),
          });
        }

        const chatId = utente.telegramChatId;
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
