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
  inviaNotificheInterpello,
  type DettagliNotifica,
  type DestinatarioNotifica,
} from './resend.ts';
import { findUtentiCompatibili, type UtenteCompatibile } from './matchingEngine.ts';

export interface NotificheOptions {
  /** Logga le email senza inviarle (per test). */
  dryRun?: boolean;
  /** URL della dashboard per il pulsante CTA (default da env). */
  dashboardUrl?: string;
}

export interface EsitoNotifiche {
  inviate: number;
  fallite: number;
}

/**
 * Invia le notifiche email per i nuovi interpelli agli utenti compatibili.
 * Non lancia eccezioni: eventuali errori vengono loggati e conteggiati.
 */
export async function notificaNuoviInterpelli(
  client: SupabaseClient | null,
  nuovi: InterpelloParsato[],
  opts: NotificheOptions = {},
): Promise<EsitoNotifiche> {
  const resend = getResendClient();
  if (!resend) {
    console.log('ℹ Notifiche email disattivate: RESEND_API_KEY non configurata.');
    return { inviate: 0, fallite: 0 };
  }
  if (nuovi.length === 0) {
    console.log('ℹ Nessun interpello nuovo: nessuna notifica email da inviare.');
    return { inviate: 0, fallite: 0 };
  }

  let totInviate = 0;
  let totFallite = 0;

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
      title: interpello.title,
      schoolName: interpello.schoolName,
      province: interpello.province,
      classi: interpello.classCodes,
      scadenza: interpello.expirationDate,
      link: interpello.link,
    };
    const destinatari: DestinatarioNotifica[] = utenti.map((u: UtenteCompatibile) => ({
      email: u.email,
      nome: u.nome,
      province: u.province,
      classi: u.classi,
    }));

    const esito = await inviaNotificheInterpello(resend, dettagli, destinatari, opts);
    totInviate += esito.inviate;
    totFallite += esito.fallite;
  }

  console.log(`✓ Notifiche email elaborate: ${totInviate} inviate · ${totFallite} fallite.`);
  return { inviate: totInviate, fallite: totFallite };
}
