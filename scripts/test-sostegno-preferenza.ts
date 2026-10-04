/**
 * TEST — AREA SOSTEGNO (special education) nel Radar.
 * -----------------------------------------------------------------
 * Verifica la regola di servizio (policy 04/10/2026):
 *   · il SOSTEGNO è un'abilitazione SEPARATA dalle classi disciplinari, ma è
 *     SEMPRE INCLUSA: nessuna preferenza dell'utente, nessun interruttore e
 *     nessun opt-out (`profiles.sostegno` non è più un filtro);
 *   · gli avvisi di sostegno (ADAA/ADEE/ADMM/ADSS — o titolo/materia che lo
 *     dichiarano) vengono consegnati a TUTTI i profili della provincia, anche a
 *     chi non ha una classe AD… tra le proprie preferenze;
 *   · l'inclusione è permanente ma NON cieca: resta il vincolo di provincia e il
 *     gate di qualità (link diretto all'avviso + recapito di candidatura);
 *   · gli avvisi DISCIPLINARI restano invariati (nessuna regressione);
 *   · con la colonna `profiles.sostegno` assente (DB non migrato) il matching
 *     continua a funzionare identico (degrada, non si rompe).
 *
 * Tutto in DRY-RUN con un client Supabase STUB: nessun invio reale, nessuna rete.
 *
 * Esecuzione: npm run test:sostegno
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codiciSostegno, eAvvisoSostegno, isCodiceSostegno } from '../src/data/classiConcorso.ts';
import {
  RPC_MATCH_INTERPELLI,
  avvisoCompatibileConProfilo,
  avvisoDiSostegno,
  findUtentiCompatibili,
} from '../src/lib/matchingEngine.ts';
import { inviaAlertTelegramTempoReale, inviaDigestGiornaliero } from '../src/lib/notifier.ts';

declare const process: { exitCode?: number; env: Record<string, string | undefined>; pid: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Motivo di scarto della REGOLA UNICA profilo ↔ opportunità (`null` = compatibile). */
function motivo(
  profilo: Parameters<typeof avvisoCompatibileConProfilo>[0],
  avviso: Parameters<typeof avvisoCompatibileConProfilo>[1],
): string | null {
  const esito = avvisoCompatibileConProfilo(profilo, avviso);
  return esito.ok ? null : (esito.motivo ?? 'sconosciuto');
}

// LEDGER ISOLATO: il test non deve toccare il ledger reale del workspace.
const percorsoLedger = join(tmpdir(), `scuoleradar-sostegno-test-${process.pid}.json`);
process.env.SCUOLERADAR_LEDGER_PATH = percorsoLedger;
writeFileSync(percorsoLedger, JSON.stringify({ aggiornato: new Date().toISOString(), chiavi: [] }), 'utf8');

/* ------------------------- 1) UNITÀ: riconoscimento ------------------------- */

console.log('— Classi di sostegno del catalogo —');
check('codici sostegno (ADAA/ADEE/ADMM/ADSS)', ['ADAA', 'ADEE', 'ADMM', 'ADSS'], codiciSostegno);

console.log('\n— isCodiceSostegno —');
check('ADEE', true, isCodiceSostegno('ADEE'));
check('ADMM', true, isCodiceSostegno('ADMM'));
check('ADSS', true, isCodiceSostegno('ADSS'));
check('ADAA', true, isCodiceSostegno('ADAA'));
check('AD24 (variante delle fonti)', true, isCodiceSostegno('AD24'));
check('minuscolo + spazi " adee "', true, isCodiceSostegno(' adee '));
check('A-22 (tedesco) NON è sostegno', false, isCodiceSostegno('A-22'));
check('A-25 NON è sostegno', false, isCodiceSostegno('A-25'));
check('A-24 NON è sostegno', false, isCodiceSostegno('A-24'));
check('EEEE (primaria) NON è sostegno', false, isCodiceSostegno('EEEE'));
check('vuoto', false, isCodiceSostegno(''));
check('null', false, isCodiceSostegno(null));

console.log('\n— eAvvisoSostegno —');
check('codice ADEE tra le classi', true, eAvvisoSostegno(['ADEE']));
check('codice ADMM tra classi miste', true, eAvvisoSostegno(['A-22', 'ADMM']));
check('titolo "Interpello sostegno primaria"', true, eAvvisoSostegno([], 'Interpello sostegno primaria'));
check('titolo con sigla "Interpello ADEE"', true, eAvvisoSostegno([], 'Interpello ADEE — IC De Amicis'));
check('materia inferita "Sostegno"', true, eAvvisoSostegno([], null, 'Sostegno'));
check('avviso disciplinare A-22 tedesco', false, eAvvisoSostegno(['A-022'], 'Interpello supplenza A-022 Tedesco'));
check('avviso PNRR con "inclusione" (NON è sostegno)', false, eAvvisoSostegno([], 'Avviso PNRR inclusione e laboratori'));
check('nessun dato', false, eAvvisoSostegno([], null, null));

/* ---------------- 2) UNITÀ: area sostegno SEMPRE inclusa ------------------- */

console.log("\n— avvisoDiSostegno: riconoscimento dell'area —");
check(
  'avviso sostegno (codice ADEE + titolo)',
  true,
  avvisoDiSostegno({
    classi: ['ADEE', 'A-022'],
    titolo: 'Interpello sostegno scuola primaria — IC De Amicis',
  }),
);
check(
  'avviso sostegno dal solo titolo (nessun codice AD…)',
  true,
  avvisoDiSostegno({ classi: ['A-22'], titolo: 'Interpello sostegno' }),
);
check(
  'avviso DISCIPLINARE di tedesco',
  false,
  avvisoDiSostegno({
    classi: ['A-022'],
    titolo: 'Interpello supplenza A-022 Tedesco — Liceo Monti',
    materia: 'Lingue straniere',
  }),
);

console.log('\n— REGOLA UNICA: sostegno sempre consegnato (nessun opt-out) —');
check(
  "profilo A-22 (tedesco) riceve l'avviso di sostegno",
  null,
  motivo({ province: ['AT'], classi: ['A-22'] }, { province: 'AT', classi: ['ADEE'], materia: 'Sostegno' }),
);
check(
  'preferenza storica `sostegno: false` NON esclude più nulla',
  null,
  motivo(
    { province: ['AT'], classi: ['A-22'], sostegno: false },
    { province: 'AT', classi: ['ADEE', 'A-022'], materia: 'Sostegno' },
  ),
);
check(
  'avviso di sostegno senza classi in comune: comunque consegnato',
  null,
  motivo({ province: ['AT'], classi: ['A-26'] }, { province: 'AT', classi: [], materia: 'Sostegno' }),
);
check(
  "l'inclusione NON supera la PROVINCIA: avviso di un'altra provincia → scartato",
  'provincia',
  motivo({ province: ['TO'], classi: ['A-22'] }, { province: 'AT', classi: ['ADEE'], materia: 'Sostegno' }),
);
check(
  'avviso DISCIPLINARE: la regola di classe resta invariata',
  'classe',
  motivo({ province: ['AT'], classi: ['A-22'] }, { province: 'AT', classi: ['A-025'] }),
);
check(
  'profilo non configurato (nessuna classe/competenza) resta fuori',
  'profilo-senza-classi',
  motivo({ province: ['AT'], classi: [] }, { province: 'AT', classi: ['ADEE'], materia: 'Sostegno' }),
);


/* --------------------- 3) INTEGRAZIONE: client STUB ------------------------- */

const ID_PRO_TEDESCO = '11111111-1111-1111-1111-111111111111';
const ID_PRO_TEDESCO_SOSTEGNO = '22222222-2222-2222-2222-222222222222';
const ID_BASE_ADEE = '33333333-3333-3333-3333-333333333333';

/** Profilo di prova: docente di tedesco (A-22) oppure di sostegno (ADEE). */
function profilo(o: {
  id: string;
  piano: string;
  classi: string[];
  sostegno: boolean | undefined;
}): Record<string, unknown> {
  const riga: Record<string, unknown> = {
    id: o.id,
    email: `utente-${o.id.slice(0, 4)}@example.it`,
    email_notifica: `utente-${o.id.slice(0, 4)}@example.it`,
    nome: `Utente ${o.id.slice(0, 4)}`,
    province_interesse: ['AT'],
    province_attive: ['AT'],
    classi_concorso: o.classi,
    telegram_chat_id: `chat-${o.id.slice(0, 4)}`,
    piano: o.piano,
    radar_attivo: true,
    is_free_forever: false,
    notifiche_blocco_inviato: false,
    notifiche_recap_inviato: false,
  };
  // `sostegno: undefined` = riga di un DB NON ancora migrato (colonna assente).
  if (o.sostegno !== undefined) riga.sostegno = o.sostegno;
  return riga;
}

const PROFILI: Array<Record<string, unknown>> = [
  profilo({ id: ID_PRO_TEDESCO, piano: 'pro', classi: ['A-22'], sostegno: false }),
  profilo({ id: ID_PRO_TEDESCO_SOSTEGNO, piano: 'pro', classi: ['A-22'], sostegno: true }),
  // ADEE tra le classi = adesione IMPLICITA, senza toccare la preferenza esplicita.
  profilo({ id: ID_BASE_ADEE, piano: 'base', classi: ['ADEE'], sostegno: false }),
];

/** Riga `interpelli` (mutabile: i test giocano su più avvisi). */
function rigaInterpello(
  hashId: string,
  title: string,
  classCodes: string[],
  materia: string | null,
) {
  return {
    id: `row-${hashId}`,
    hash_id: hashId,
    title,
    province: 'AT',
    class_codes: classCodes,
    school_name: 'IC De Amicis',
    school_code: 'ATTF01000X',
    source_url: `https://www.usp-asti.gov.it/interpelli/${hashId}`,
    expiration_date: '2099-12-31',
    created_at: new Date().toISOString(),
    contact_email: 'attf01000x@istruzione.it',
    materia,
  };
}

let INTERPELLI: Array<Record<string, unknown>> = [];
/** Simula un DB non ancora migrato: la SELECT di `sostegno` fallisce (PGRST204). */
let colonnaSostegnoAssente = false;

/** Client Supabase STUB: catena thenable; `profiles.sostegno` può mancare. */
function clientStub(): unknown {
  const thenable = (tabella: string) => {
    const b: Record<string, unknown> = {};
    const self = () => b;
    let colonne = '';
    for (const m of ['in', 'overlaps', 'or', 'order', 'limit', 'eq', 'update', 'insert']) {
      b[m] = self;
    }
    b.select = (cols: unknown) => {
      colonne = String(cols ?? '');
      return b;
    };
    const esito = (): { data: unknown[] | null; error: { message: string } | null } => {
      if (tabella === 'profiles' && colonnaSostegnoAssente && /sostegno/.test(colonne)) {
        return {
          data: null,
          error: { message: 'column profiles.sostegno does not exist (PGRST204)' },
        };
      }
      return {
        data: tabella === 'profiles' ? PROFILI : tabella === 'interpelli' ? INTERPELLI : [],
        error: null,
      };
    };
    b.maybeSingle = async () => {
      const r = esito();
      return { data: (r.data ?? [])[0] ?? null, error: r.error };
    };
    b.upsert = async () => ({ error: null });
    b.then = (resolve: (v: unknown) => void) => resolve(esito());
    return b;
  };
  return {
    from: (tabella: string) => thenable(tabella),
    // RPC DISTINTE per nome: `match_interpelli` (Matching Engine nativo) serve le
    // righe di `interpelli` del DB simulato — il filtro provincia/classe/competenze
    // resta alla REGOLA UNICA in JS — mentre le altre RPC (contatore notifiche)
    // rispondono col loro esito. Un esito unico per TUTTE le RPC faceva tornare al
    // digest righe senza i campi di `interpelli`: 0 voci, tutti i profili saltati.
    rpc: async (nome: string) =>
      nome === RPC_MATCH_INTERPELLI
        ? { data: INTERPELLI, error: null }
        : { data: [{ consentito: true, notifiche_usate: 1 }], error: null },
  };
}

// AMBIENTE DI PROVA: Resend "configurato" (tutto gira in dryRun) e Telegram
// VOLUTAMENTE non configurato → impossibile inviare davvero.
process.env.RESEND_API_KEY = 'test-key-not-real';
process.env.TELEGRAM_BOT_TOKEN = '';

/** Avviso di SOSTEGNO: cita anche A-022 (è il falso positivo storico). */
const AVVISO_SOSTEGNO = {
  hashId: 'hash-sostegno-1',
  title: 'Interpello sostegno scuola primaria ADEE (valutabile anche A-022) — IC De Amicis',
  province: 'AT',
  classCodes: ['ADEE', 'A-022'],
  schoolName: 'IC De Amicis',
  schoolCode: 'ATTF01000X',
  link: 'https://www.usp-asti.gov.it/interpelli/hash-sostegno-1',
  expirationDate: '2099-12-31',
  contactEmail: 'attf01000x@istruzione.it',
  publishedAt: null,
  materia: 'Sostegno',
  source: 'test',
};

/** Avviso DISCIPLINARE di tedesco (stessa provincia e stessa classe A-022). */
const AVVISO_TEDESCO = {
  hashId: 'hash-tedesco-1',
  title: 'Interpello supplenza A-022 Tedesco — Liceo Monti',
  province: 'AT',
  classCodes: ['A-022'],
  schoolName: 'Liceo Monti',
  schoolCode: 'ATTF01000X',
  link: 'https://www.usp-asti.gov.it/interpelli/hash-tedesco-1',
  expirationDate: '2099-12-31',
  contactEmail: 'attf01000x@istruzione.it',
  publishedAt: null,
  materia: 'Lingue straniere',
  source: 'test',
};

/* ------------------------------- 4) SCENARI -------------------------------- */

async function main(): Promise<void> {
  const client = clientStub() as never;

  console.log('\n— Matching (findUtentiCompatibili): avviso di SOSTEGNO —');
  let utenti = await findUtentiCompatibili(client, {
    province: 'AT',
    classi: ['ADEE', 'A-022'],
    titolo: AVVISO_SOSTEGNO.title,
    materia: 'Sostegno',
  });
  check(
    'TUTTI i profili della provincia (sostegno sempre incluso, anche senza AD…)',
    [ID_BASE_ADEE, ID_PRO_TEDESCO, ID_PRO_TEDESCO_SOSTEGNO].sort(),
    utenti.map((u) => u.id).sort(),
  );
  check(
    "il docente di tedesco senza classe AD… è incluso (nessun opt-out)",
    true,
    utenti.some((u) => u.id === ID_PRO_TEDESCO),
  );

  console.log('\n— Matching: avviso DISCIPLINARE (nessuna regressione) —');
  utenti = await findUtentiCompatibili(client, {
    province: 'AT',
    classi: ['A-022'],
    titolo: AVVISO_TEDESCO.title,
    materia: 'Lingue straniere',
  });
  check(
    'tutti i docenti di tedesco A-22 compatibili per classe',
    [ID_PRO_TEDESCO, ID_PRO_TEDESCO_SOSTEGNO],
    utenti.map((u) => u.id).sort(),
  );

  console.log('\n— Alert PRO in TEMPO REALE —');
  INTERPELLI = [
    rigaInterpello(AVVISO_SOSTEGNO.hashId, AVVISO_SOSTEGNO.title, ['ADEE', 'A-022'], 'Sostegno'),
  ];
  const sostegnoRt = await inviaAlertTelegramTempoReale(client, [AVVISO_SOSTEGNO], { dryRun: true });
  check('avviso di sostegno → 2 alert (entrambi i PRO)', 2, sostegnoRt.telegramInviate);

  INTERPELLI = [
    rigaInterpello(AVVISO_TEDESCO.hashId, AVVISO_TEDESCO.title, ['A-022'], 'Lingue straniere'),
  ];
  const tedescoRt = await inviaAlertTelegramTempoReale(client, [AVVISO_TEDESCO], { dryRun: true });
  check('avviso di tedesco → 2 alert (entrambi i PRO)', 2, tedescoRt.telegramInviate);

  console.log('\n— DIGEST 17:00 —');
  INTERPELLI = [
    rigaInterpello(AVVISO_SOSTEGNO.hashId, AVVISO_SOSTEGNO.title, ['ADEE', 'A-022'], 'Sostegno'),
  ];
  const digestSostegno = await inviaDigestGiornaliero(client, { dryRun: true, forzato: true });
  check('utenti esaminati', 3, digestSostegno.utenti);
  check('email inviate (tutti: sostegno sempre incluso)', 3, digestSostegno.inviate);
  check('batch Telegram BASE (il solo profilo Base)', 1, digestSostegno.telegramInviate);
  check('nessun profilo saltato', 0, digestSostegno.saltati);

  INTERPELLI = [
    rigaInterpello(AVVISO_TEDESCO.hashId, AVVISO_TEDESCO.title, ['A-022'], 'Lingue straniere'),
  ];
  const digestTedesco = await inviaDigestGiornaliero(client, { dryRun: true, forzato: true });
  check('email inviate (solo i docenti A-22)', 2, digestTedesco.inviate);
  check('nessun batch Telegram (nessun BASE compatibile)', 0, digestTedesco.telegramInviate);
  check('profilo ADEE senza classi in comune → saltato', 1, digestTedesco.saltati);

  console.log('\n— DB NON MIGRATO: colonna `profiles.sostegno` assente —');
  colonnaSostegnoAssente = true;
  for (const riga of PROFILI) delete riga.sostegno;
  INTERPELLI = [
    rigaInterpello(AVVISO_SOSTEGNO.hashId, AVVISO_SOSTEGNO.title, ['ADEE', 'A-022'], 'Sostegno'),
  ];
  utenti = await findUtentiCompatibili(client, {
    province: 'AT',
    classi: ['ADEE', 'A-022'],
    titolo: AVVISO_SOSTEGNO.title,
    materia: 'Sostegno',
  });
  check(
    'matching ancora funzionante (colonna `sostegno` NON letta dalla decisione)',
    [ID_BASE_ADEE, ID_PRO_TEDESCO, ID_PRO_TEDESCO_SOSTEGNO].sort(),
    utenti.map((u) => u.id).sort(),
  );
  const digestNonMigrato = await inviaDigestGiornaliero(client, { dryRun: true, forzato: true });
  check('nessun crash: 3 email (inclusione indipendente dal DB)', 3, digestNonMigrato.inviate);
  check('nessun profilo saltato', 0, digestNonMigrato.saltati);

  console.log(
    errori === 0
      ? '\n✅ AREA SOSTEGNO: nessun problema'
      : `\n❌ AREA SOSTEGNO: ${errori} errore/i`,
  );
  process.exitCode = errori === 0 ? 0 : 1;
}

await main();
if (existsSync(percorsoLedger)) rmSync(percorsoLedger, { force: true });
