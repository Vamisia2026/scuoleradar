/**
 * TEST — SPLIT TELEGRAM PER TIER + deduplica PER CANALE.
 * -----------------------------------------------------------------
 * Verifica la regola di servizio:
 *   · **PRO**  → alert INDIVIDUALI in TEMPO REALE su Telegram (appena scrapati);
 *   · **BASE** → NESSUN alert immediato: un solo BATCH alle 17:00.
 * E la deduplica per canale che la rende possibile:
 *   · una consegna su un canale non blocca l'altro (email vs Telegram);
 *   · la chiave LEGACY agnostica (`|notifica`) vale per TUTTI i canali.
 *
 * Tutto in DRY-RUN con un client Supabase STUB: nessun invio reale, nessuna rete.
 *
 * Esecuzione: npm run test:telegram:tier
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inviaAlertTelegramTempoReale, inviaDigestGiornaliero } from '../src/lib/notifier.ts';

declare const process: { exitCode?: number; env: Record<string, string | undefined>; pid: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

// LEDGER ISOLATO: il test non deve toccare il ledger reale del workspace.
const percorsoLedger = join(tmpdir(), `scuoleradar-tier-test-${process.pid}.json`);
process.env.SCUOLERADAR_LEDGER_PATH = percorsoLedger;

const HASH = 'hash-tier-001';
const ID_PRO = '11111111-1111-1111-1111-111111111111';
const ID_BASE = '22222222-2222-2222-2222-222222222222';
const ID_BASE_LEGACY = '33333333-3333-3333-3333-333333333333';

// Pre-seed del ledger (letto al primo accesso):
//  · BASE → già consegnato su TELEGRAM (il batch serale non deve ripeterlo);
//  · BASE_LEGACY → chiave LEGACY agnostica (nessun canale deve rimandare).
writeFileSync(
  percorsoLedger,
  JSON.stringify({
    aggiornato: new Date().toISOString(),
    chiavi: [`utente|${ID_BASE}:${HASH}|telegram`, `utente|${ID_BASE_LEGACY}:${HASH}|notifica`],
  }),
  'utf8',
);

/** Profilo di prova (riga `profiles`). */
function profilo(id: string, piano: string): Record<string, unknown> {
  return {
    id,
    email: `utente-${id.slice(0, 4)}@example.it`,
    email_notifica: `utente-${id.slice(0, 4)}@example.it`,
    nome: `Utente ${piano}`,
    province_interesse: ['AT'],
    province_attive: ['AT'],
    classi_concorso: ['A-22'],
    telegram_chat_id: `chat-${id.slice(0, 4)}`,
    piano,
    radar_attivo: true,
    is_free_forever: false,
    notifiche_blocco_inviato: false,
    notifiche_recap_inviato: false,
  };
}

/** Riga `interpelli` compatibile con i profili (provincia AT, classe A-022). */
function interpello() {
  return {
    id: 'row-1',
    hash_id: HASH,
    title: 'Interpello supplenza A-022 Matematica — Liceo Augusto Monti',
    province: 'AT',
    class_codes: ['A-022'],
    school_name: 'Liceo Augusto Monti',
    school_code: 'ASTF01000X',
    source_url: 'https://www.usp-asti.gov.it/interpelli/avviso-a022',
    expiration_date: '2099-12-31',
    created_at: new Date().toISOString(),
    contact_email: 'astf01000x@istruzione.it',
    materia: 'Matematica',
  };
}

const PROFILI = [profilo(ID_PRO, 'pro'), profilo(ID_BASE, 'base'), profilo(ID_BASE_LEGACY, 'base')];

// AMBIENTE DI PROVA: Resend "configurato" (nessuna chiamata reale: tutto gira in
// dryRun) e Telegram VOLUTAMENTE non configurato → impossibile inviare davvero.
process.env.RESEND_API_KEY = 'test-key-not-real';
process.env.TELEGRAM_BOT_TOKEN = '';

/** Client Supabase STUB: catena thenable + rpc che consente sempre. */
function clientStub(): unknown {
  const thenable = (righe: unknown[]) => {
    const b: Record<string, unknown> = {};
    const self = () => b;
    for (const m of ['select', 'in', 'overlaps', 'or', 'order', 'limit', 'eq', 'update', 'insert']) {
      b[m] = self;
    }
    b.maybeSingle = async () => ({ data: righe[0] ?? null, error: null });
    b.upsert = async () => ({ error: null });
    b.then = (resolve: (v: unknown) => void) => resolve({ data: righe, error: null });
    return b;
  };
  return {
    // `profiles` → profili di prova; `interpelli` → l'avviso di prova;
    // QUALSIASI altra tabella (es. `notifications_log`) → nessuna riga, così la
    // deduplica dipende SOLO dal ledger su file che il test controlla.
    from: (tabella: string) =>
      thenable(tabella === 'profiles' ? PROFILI : tabella === 'interpelli' ? [interpello()] : []),
    rpc: async () => ({ data: [{ consentito: true, notifiche_usate: 1 }], error: null }),
  };
}

async function main(): Promise<void> {
  const client = clientStub() as never;

  console.log('— TEMPO REALE: solo il piano PRO riceve gli alert individuali —');
  const realtime = await inviaAlertTelegramTempoReale(
    client,
    [
      {
        hashId: HASH,
        title: 'Interpello supplenza A-022 Matematica — Liceo Augusto Monti',
        province: 'AT',
        classCodes: ['A-022'],
        schoolName: 'Liceo Augusto Monti',
        schoolCode: 'ASTF01000X',
        link: 'https://www.usp-asti.gov.it/interpelli/avviso-a022',
        expirationDate: '2099-12-31',
        contactEmail: 'astf01000x@istruzione.it',
        publishedAt: null,
        materia: 'Matematica',
        source: 'test',
      },
    ],
    { dryRun: true },
  );
  check('1 solo alert immediato (il PRO)', 1, realtime.telegramInviate);
  check('nessun errore', 0, realtime.telegramFallite);

  console.log('\n— BATCH 17:00: email per tutti, Telegram SOLO per BASE —');
  const digest = await inviaDigestGiornaliero(client, { dryRun: true, forzato: true });
  check('utenti esaminati', 3, digest.utenti);
  // Email: PRO + BASE (BASE_LEGACY è già consegnato → chiave legacy agnostica).
  check('riepiloghi email inviati', 2, digest.inviate);
  // Telegram: nessun batch (PRO escluso per tier; BASE ha già il canale marcato).
  check('nessun batch Telegram da inviare', 0, digest.telegramInviate);
  check('utente già consegnato (chiave legacy) → saltato', 1, digest.saltati);

  console.log('\n— DEDUPLICA PER CANALE —');
  // Il BASE ha la chiave TELEGRAM: il batch Telegram è saltato ma l'EMAIL parte
  // comunque (un canale non blocca l'altro).
  check('canale Telegram non blocca l\'email', true, digest.inviate === 2);
  // La chiave LEGACY agnostica blocca TUTTI i canali (nessun doppio invio storico).
  check('chiave legacy agnostica = tutti i canali', true, digest.saltati === 1);

  console.log(errori === 0 ? '\n✅ TELEGRAM TIER: nessun problema' : `\n❌ TELEGRAM TIER: ${errori} errore/i`);
  process.exitCode = errori === 0 ? 0 : 1;
}

await main();
if (existsSync(percorsoLedger)) rmSync(percorsoLedger, { force: true });
