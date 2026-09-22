/**
 * TEST — DEDUPLICA STRICT per utente (bug "lo stesso alert arriva più volte").
 * ---------------------------------------------------------------------------
 * Riproduce il caso reale del Liceo Monti: la STESSA opportunità ri-scrapata con
 * un `hash_id` DIVERSO (perché `generaHashId` include titolo e data) tornava a
 * essere notificata. Verifica che:
 *   1. il registro invii usi TRE identificatori stabili per (utente × canale):
 *      `hash`, `impronta` (stabile: titolo normalizzato + scuola + provincia +
 *      classi normalizzate) e `url` ufficiale;
 *   2. un invio riuscito venga registrato IMMEDIATAMENTE (ledger su file + DB) e
 *      che il guard blocchi QUALSIASI invio successivo (Telegram ed email);
 *   3. il guard sia PER CANALE (email ≠ telegram) e compatibile con la chiave
 *      LEGACY agnostica `notifica`;
 *   4. il DIGEST giornaliero, con client STUB e sender iniettati, NON rispedisca
 *      l'avviso quando torna con un hash diverso (regressione del loop);
 *   5. il promemoria 24h non riparta sullo stesso avviso.
 *
 * Tutto con client stub: nessuna rete, nessun invio reale.
 *
 * Esecuzione: npm run test:dedup:utente
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { improntaAvviso } from '../src/lib/dedupAvvisi.ts';
import {
  chiaveLedger,
  ledgerLocaleRegistra,
  ledgerLocaleSalva,
} from '../src/lib/ledgerLocale.ts';
import {
  avvisoGiaInviato,
  identificatoriAvviso,
  inviaDigestGiornaliero,
  inviaPromemoria24h,
  registraInvioAvviso,
  valoreRegistro,
  type AvvisoDedup,
} from '../src/lib/notifier.ts';

declare const process: { exitCode?: number; env: Record<string, string | undefined>; pid: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

// LEDGER ISOLATO: il test non tocca il ledger reale del workspace.
const percorsoLedger = join(tmpdir(), `scuoleradar-dedup-utente-${process.pid}.json`);
process.env.SCUOLERADAR_LEDGER_PATH = percorsoLedger;
writeFileSync(percorsoLedger, JSON.stringify({ aggiornato: new Date().toISOString(), chiavi: [] }), 'utf8');

process.env.RESEND_API_KEY = 'test-key-not-real';
process.env.TELEGRAM_BOT_TOKEN = '';

/* --------------------------- Client Supabase STUB --------------------------- */

const USER_ID = '11111111-1111-1111-1111-111111111111';

let PROFILI: Array<Record<string, unknown>> = [];
let INTERPELLI: Array<Record<string, unknown>> = [];
/** `notifications_log` in memoria: l'upsert del registro scrive QUI. */
const LOG: Array<Record<string, unknown>> = [];
let erroreLog: string | null = null;

function clientStub(): unknown {
  const thenable = (tabella: string) => {
    const filtri: Array<(r: Record<string, unknown>) => boolean> = [];
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = (col: string, val: unknown) => {
      filtri.push((r) => String(r[col]) === String(val));
      return b;
    };
    b.in = (col: string, vals: unknown) => {
      const ammessi = (vals as unknown[]).map(String);
      filtri.push((r) => ammessi.includes(String(r[col])));
      return b;
    };
    b.gte = () => b;
    b.or = () => b;
    b.order = () => b;
    b.limit = () => b;
    b.update = () => b;
    b.insert = () => b;
    b.upsert = async (riga: Record<string, unknown>) => {
      if (tabella === 'notifications_log') LOG.push({ ...riga, sent_at: new Date().toISOString() });
      return { error: null };
    };
    const esito = (): { data: unknown[] | null; error: { message: string } | null } => {
      if (tabella === 'notifications_log' && erroreLog) return { data: null, error: { message: erroreLog } };
      const righe =
        tabella === 'profiles'
          ? PROFILI
          : tabella === 'interpelli'
            ? INTERPELLI
            : tabella === 'notifications_log'
              ? LOG
              : [];
      return { data: righe.filter((r) => filtri.every((f) => f(r))), error: null };
    };
    b.maybeSingle = async () => ({ data: esito().data?.[0] ?? null, error: null });
    b.then = (resolve: (v: unknown) => void) => resolve(esito());
    return b;
  };
  return {
    from: (tabella: string) => thenable(tabella),
    rpc: async () => ({ data: [{ consentito: true, notifiche_usate: 1 }], error: null }),
  };
}

/* --------------- 1) Identificatori stabili e chiavi del registro --------------- */

console.log('— Identificatori stabili dell’avviso —');
const client = clientStub() as never;
const avviso: AvvisoDedup = {
  hashId: 'hash-a',
  title: 'Interpello supplenza A-022 Informatica — IIS Vittorio Alfieri',
  schoolName: 'IIS Vittorio Alfieri',
  province: 'AT',
  classi: ['A-022'],
  link: 'https://www.usp-asti.gov.it/interpelli/avviso-alfieri?x=1#top',
};
const identificatori = identificatoriAvviso(avviso);
check('tre identificatori (hash, impronta, url)', ['hash', 'impronta', 'url'], identificatori.map(([t]) => t));
check('valore del registro: hash NON prefissato (compatibilità DB)', 'hash-a', valoreRegistro('hash', 'hash-a'));
check(
  'valore del registro: impronta prefissata',
  true,
  valoreRegistro('impronta', 'impr-x').startsWith('i:'),
);
check('valore del registro: url prefissato', true, valoreRegistro('url', 'https://x').startsWith('u:'));
check(
  'URL normalizzato (frammento rimosso)',
  'https://www.usp-asti.gov.it/interpelli/avviso-alfieri?x=1',
  identificatori.find(([t]) => t === 'url')?.[1],
);
check(
  'chiave ledger = utente × valore × canale',
  chiaveLedger('utente', `${USER_ID}:hash-a`, 'email'),
  chiaveLedger('utente', `${USER_ID}:${identificatori[0][1]}`, 'email'),
);

console.log('\n— Impronta STABILE anche se il codice classe cambia formato —');
const base = {
  titolo: 'Interpello supplenza Matematica — Liceo Augusto Monti',
  scuola: 'Liceo Augusto Monti',
  provincia: 'AT',
};
check('A-022 ≡ A-22', improntaAvviso({ ...base, classi: ['A-022'] }), improntaAvviso({ ...base, classi: ['A-22'] }));
check('A042 ≡ A-42', improntaAvviso({ ...base, classi: ['A042'] }), improntaAvviso({ ...base, classi: ['A-42'] }));

/* --------------- 2) Guard e registrazione (stub, per canale) --------------- */

console.log('\n— Guard: registrazione immediata e per canale —');
/** Stessa opportunità "ripubblicata": cambia il protocollo/la data nel titolo. */
const avvisoB: AvvisoDedup = {
  hashId: 'hash-b',
  title:
    'Interpello supplenza A-022 Informatica — IIS Vittorio Alfieri (prot. n. 1234 del 16/09/2026)',
  schoolName: 'IIS Vittorio Alfieri',
  province: 'AT',
  classi: ['A-22'],
  link: 'https://www.usp-asti.gov.it/interpelli/avviso-alfieri?v=2',
};

check('avviso mai inviato → nessun blocco', { inviato: false }, await avvisoGiaInviato(client, USER_ID, avviso, 'email'));
check('registrazione su email (3 identificatori)', 3, await registraInvioAvviso(client, USER_ID, avviso, 'email'));
check(
  'stesso avviso → bloccato (già inviato OGGI)',
  { inviato: true, per: 'stesso-giorno' },
  await avvisoGiaInviato(client, USER_ID, avviso, 'email'),
);
check(
  'stesso avviso su TELEGRAM → NON bloccato (guard per canale)',
  { inviato: false },
  await avvisoGiaInviato(client, USER_ID, avviso, 'telegram'),
);
check(
  'hash DIVERSO + protocollo/data nel titolo → bloccato (stessa opportunità, stesso giorno) ← bug Liceo Monti',
  { inviato: true, per: 'stesso-giorno' },
  await avvisoGiaInviato(client, USER_ID, avvisoB, 'email'),
);
check(
  'hash diverso, titolo riscritto e URL diverso → bloccato (stessa opportunità)',
  true,
  (
    await avvisoGiaInviato(
      client,
      USER_ID,
      { ...avvisoB, link: 'https://www.usp-asti.gov.it/interpelli/avviso-alfieri?v=3' },
      'email',
    )
  ).inviato,
);
check(
  'righe DB scritte dal registro (hash + i: + u:)',
  3,
  LOG.filter((r) => r.user_id === USER_ID && r.canale === 'email').length,
);
check(
  'DB: l’hash è salvato NON prefissato (il promemoria 24h deve ritrovarlo)',
  1,
  LOG.filter((r) => r.interpello_hash === 'hash-a').length,
);
check(
  'DB: impronta e URL salvati con prefisso',
  2,
  LOG.filter(
    (r) =>
      String(r.interpello_hash).startsWith('i:') || String(r.interpello_hash).startsWith('u:'),
  ).length,
);

console.log('\n— Compatibilità con la chiave LEGACY agnostica —');
ledgerLocaleRegistra(chiaveLedger('utente', `${USER_ID}:hash-legacy`, 'notifica'));
ledgerLocaleSalva();
const avvisoLegacy: AvvisoDedup = {
  hashId: 'hash-legacy',
  title: 'Interpello supplenza A-022 — IC De Amicis',
  schoolName: 'IC De Amicis',
  province: 'AT',
  classi: ['A-022'],
  link: 'https://www.usp-asti.gov.it/interpelli/avviso-de-amicis',
};
check(
  'chiave legacy → bloccato su QUALSIASI canale',
  [true, true],
  [
    (await avvisoGiaInviato(client, USER_ID, avvisoLegacy, 'email')).inviato,
    (await avvisoGiaInviato(client, USER_ID, avvisoLegacy, 'telegram')).inviato,
  ],
);

console.log('\n— Ledger DB assente: il ledger su FILE protegge comunque —');
erroreLog = 'relation "notifications_log" does not exist';
check(
  'stesso avviso → bloccato dal ledger su file (già inviato oggi)',
  { inviato: true, per: 'stesso-giorno' },
  await avvisoGiaInviato(client, USER_ID, avviso, 'email'),
);
erroreLog = null;


/* --------------- 3) DIGEST: il loop di notifiche si ferma --------------- */

/** Righe del digest per lo scenario "Liceo Monti" (stessa scuola, hash diversi). */
function rigaInterpello(hashId: string, titolo: string) {
  return {
    id: `row-${hashId}`,
    hash_id: hashId,
    title: titolo,
    province: 'AT',
    class_codes: ['A-022'],
    school_name: 'Liceo Augusto Monti',
    school_code: 'ATTF01000X',
    source_url: 'https://www.usp-asti.gov.it/interpelli/avviso-a022',
    expiration_date: '2099-12-31',
    created_at: new Date().toISOString(),
    contact_email: 'attf01000x@istruzione.it',
    materia: null,
  };
}

function profilo(piano: string, chatId: string | null): Array<Record<string, unknown>> {
  return [
    {
      id: USER_ID,
      email: 'docente@example.it',
      email_notifica: 'docente@example.it',
      nome: 'Docente Asti',
      province_interesse: ['AT'],
      province_attive: ['AT'],
      classi_concorso: ['A-22'],
      telegram_chat_id: chatId,
      piano,
      radar_attivo: true,
      is_free_forever: false,
      notifiche_blocco_inviato: false,
      notifiche_recap_inviato: false,
      sostegno: false,
    },
  ];
}

let inviateEmail: Array<{ voci: string[]; email: string }> = [];
let inviateTelegram: Array<{ chatId: string; voci: string[] }> = [];
const inviaEmail = async (voci: Array<{ id?: string }>, dest: { email: string }) => {
  inviateEmail.push({ voci: voci.map((v) => String(v.id)), email: dest.email });
  return { inviata: true };
};
const inviaTelegram = async (chatId: string, voci: Array<{ id?: string }>) => {
  inviateTelegram.push({ chatId, voci: voci.map((v) => String(v.id)) });
  return { ok: true };
};

async function scenariDigest(): Promise<void> {
  console.log('\n— DIGEST: stesso avviso, hash diverso → NESSUN secondo invio —');
  PROFILI = profilo('pro', null);

  // 1° giro: l'avviso del Liceo Monti → 1 email.
  INTERPELLI = [
    rigaInterpello('monti-1', 'Interpello supplenza A-022 Matematica — Liceo Augusto Monti'),
  ];
  inviateEmail = [];
  const giro1 = await inviaDigestGiornaliero(client, { dryRun: false, forzato: true, inviaEmail });
  check('1° giro: un digest inviato', 1, giro1.inviate);
  check('1° giro: una voce', [['monti-1']], inviateEmail.map((e) => e.voci));

  // 2° giro: STESSA opportunità ri-scrapata → hash NUOVO e titolo con rumore.
  INTERPELLI = [
    rigaInterpello('monti-2', 'Interpello suppl. A-22 matematica Liceo Augusto Monti del 17/09/2026'),
  ];
  inviateEmail = [];
  const giro2 = await inviaDigestGiornaliero(client, { dryRun: false, forzato: true, inviaEmail });
  check('2° giro (hash diverso): NESSUN invio', 0, giro2.inviate);
  check('2° giro: nessuna email', [], inviateEmail);
  check('2° giro: utente saltato', 1, giro2.saltati);

  // 2-bis: hash diverso E titolo con solo rumore (protocollo/data) → impronta.
  INTERPELLI = [
    rigaInterpello(
      'monti-3',
      'Interpello supplenza A-022 Matematica — Liceo Augusto Monti (prot. n. 999 del 17/09/2026)',
    ),
  ];
  inviateEmail = [];
  const giro2bis = await inviaDigestGiornaliero(client, { dryRun: false, forzato: true, inviaEmail });
  check('2-bis giro (solo rumore nel titolo): NESSUN invio', 0, giro2bis.inviate);
  check('2-bis giro: nessuna email', [], inviateEmail);

  // 3° giro: opportunità DIVERSA (altra scuola) → deve passare.
  INTERPELLI = [
    rigaInterpello('monti-4', 'Interpello suppl. A-22 matematica Liceo Augusto Monti del 17/09/2026'),
    {
      ...rigaInterpello('artom-1', 'Interpello supplenza A-022 Matematica — ITIS A. Artom'),
      school_name: 'ITIS A. Artom',
      source_url: 'https://www.usp-asti.gov.it/interpelli/avviso-artom',
    },
  ];
  inviateEmail = [];
  const giro3 = await inviaDigestGiornaliero(client, { dryRun: false, forzato: true, inviaEmail });
  check('3° giro (avviso diverso): 1 invio', 1, giro3.inviate);
  check('3° giro: solo l’avviso nuovo', [['artom-1']], inviateEmail.map((e) => e.voci));

  console.log('\n— DIGEST Telegram (BASE): stesso guard sul canale telegram —');
  PROFILI = profilo('base', 'chat-1');
  INTERPELLI = [
    rigaInterpello('monti-5', 'Interpello supplenza A-022 Matematica — Liceo Augusto Monti'),
  ];
  inviateTelegram = [];
  inviateEmail = [];
  const tg1 = await inviaDigestGiornaliero(client, {
    dryRun: false,
    forzato: true,
    inviaEmail,
    inviaTelegram,
  });
  check('BASE 1° giro: batch Telegram inviato', 1, tg1.telegramInviate);
  check('BASE 1° giro: una voce', [['monti-5']], inviateTelegram.map((t) => t.voci));

  // Stessa opportunità con un hash NUOVO → il batch Telegram NON riparte.
  INTERPELLI = [
    rigaInterpello('monti-6', 'Interpello suppl. A-22 Matematica Liceo Augusto Monti (prot. 999)'),
  ];
  inviateTelegram = [];
  inviateEmail = [];
  const tg2 = await inviaDigestGiornaliero(client, {
    dryRun: false,
    forzato: true,
    inviaEmail,
    inviaTelegram,
  });
  check('BASE 2° giro (hash diverso): nessun batch Telegram', 0, tg2.telegramInviate);
  check('BASE 2° giro: nessuna voce', [], inviateTelegram);

  console.log('\n— PROMEMORIA 24h: nessuna ripetizione sullo stesso avviso —');
  // Lo storico email contiene la consegna di `monti-5` (BASE, ora): per il
  // promemoria serve un invio di ≥ 24h, quindi si aggiunge la riga con sent_at vecchio.
  LOG.push({
    user_id: USER_ID,
    interpello_hash: 'monti-5',
    canale: 'email',
    sent_at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
  });
  INTERPELLI = [
    rigaInterpello('monti-7', 'Interpello suppl. A-022 Matematica Liceo Augusto Monti (bando)'),
  ];
  let promemoriaInviati = 0;
  const prom = await inviaPromemoria24h(client, {
    adesso: new Date(),
    dryRun: false,
    inviaEmail: async () => {
      promemoriaInviati += 1;
      return { inviata: true };
    },
  });
  check('promemoria: nessun invio (hash nuovo, stessa scuola)', 0, prom.inviate);
  check('promemoria: nessuna email inviata', 0, promemoriaInviati);
}

await scenariDigest();
ledgerLocaleSalva();
if (existsSync(percorsoLedger)) rmSync(percorsoLedger, { force: true });

console.log(
  errori === 0
    ? '\n✅ DEDUPLICA PER UTENTE: nessun problema'
    : `\n❌ DEDUPLICA PER UTENTE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

