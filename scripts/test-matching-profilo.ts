/**
 * TEST — FILTRO STRICT profilo ↔ opportunità (Radar + notifiche).
 * -----------------------------------------------------------------
 * Verifica la regola unica `avvisoCompatibileConProfilo` e il suo uso nel DIGEST
 * (dispatch delle notifiche), con i casi che in produzione generavano avvisi
 * FUORI CONTESTO:
 *   · profilo di TORINO/Piemonte che riceveva un'opportunità di PRATO/Toscana
 *     (province non salvate → query senza filtro geografico);
 *   · profilo con classi configurate che riceveva avvisi di classi NON sue;
 *   · profilo SENZA province o SENZA classi (preferenze incomplete): nessuna
 *     notifica "a caso" — meglio nessun avviso che un avviso sbagliato;
 *   · guardia SOSTEGNO invariata (avvisi AD… solo a chi ha aderito);
 *   · avvisi senza codice classe: ammessi SOLO se la materia è coperta dalle
 *     classi del profilo (mai a tutti).
 *
 * Tutto in DRY-RUN con client Supabase STUB: nessuna rete, nessun invio reale.
 *
 * Esecuzione: npm run test:matching
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  avvisoCompatibileConProfilo,
  contieneClasse,
  materiaCompatibileConClassi,
  normalizzaClasse,
  normalizzaClassi,
  rimuoviClasse,
} from '../src/lib/matchingEngine.ts';
import { inviaDigestGiornaliero } from '../src/lib/notifier.ts';

declare const process: { exitCode?: number; env: Record<string, string | undefined>; pid: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

// LEDGER ISOLATO: il test non tocca il ledger reale del workspace.
const percorsoLedger = join(tmpdir(), `scuoleradar-matching-test-${process.pid}.json`);
process.env.SCUOLERADAR_LEDGER_PATH = percorsoLedger;
writeFileSync(percorsoLedger, JSON.stringify({ aggiornato: new Date().toISOString(), chiavi: [] }), 'utf8');

/** Motivo dello scarto (o `null` se l'avviso è compatibile). */
function motivo(
  profilo: Parameters<typeof avvisoCompatibileConProfilo>[0],
  avviso: Parameters<typeof avvisoCompatibileConProfilo>[1],
): string | null {
  const esito = avvisoCompatibileConProfilo(profilo, avviso);
  return esito.ok ? null : (esito.motivo ?? 'sconosciuto');
}


/* ===================== 1) PROVINCIA: mai un'altra regione ===================== */

console.log('— Provincia: Torino/Piemonte NON riceve avvisi di Prato/Toscana —');
const profiloTorino = { province: ['TO'], classi: ['A-22'] };
check(
  'TO + A-22 × avviso PO (Prato) → scartato per provincia',
  'provincia',
  motivo(profiloTorino, { province: 'PO', classi: ['A-022'] }),
);
check(
  'TO + A-22 × avviso TO → compatibile',
  null,
  motivo(profiloTorino, { province: 'TO', classi: ['A-022'] }),
);
check(
  'provincia normalizzata (minuscolo/spazi)',
  null,
  motivo(profiloTorino, { province: ' to ', classi: ['A-022'] }),
);
check(
  'multi-provincia PRO (TO + MI) copre entrambe',
  null,
  motivo({ province: ['TO', 'MI'], classi: ['A-22'] }, { province: 'MI', classi: ['A-022'] }),
);
check(
  'profilo SENZA province → nessuna notifica casuale',
  'profilo-senza-province',
  motivo({ province: [], classi: ['A-22'] }, { province: 'TO', classi: ['A-022'] }),
);
check(
  'avviso senza provincia → scartato',
  'provincia',
  motivo(profiloTorino, { province: null, classi: ['A-022'] }),
);

/* ======================= 2) CLASSE: solo quelle scelte ======================= */

console.log('\n— Classe: solo le classi configurate nel profilo —');
check('A-22 × A-022 → compatibile (formato normalizzato)', null, motivo(profiloTorino, { province: 'TO', classi: ['A-022'] }));
check('A-22 × A-25 (altra classe) → scartato', 'classe', motivo(profiloTorino, { province: 'TO', classi: ['A-025'] }));
check(
  "intersezione anche con più classi sull'avviso",
  null,
  motivo({ province: ['AT'], classi: ['A-26'] }, { province: 'AT', classi: ['A-050', 'A-026'] }),
);
check(
  "avviso che cita una classe di sostegno (ADEE) → guardia sostegno",
  'sostegno',
  motivo({ province: ['AT'], classi: ['A-26'] }, { province: 'AT', classi: ['ADEE', 'A-026'] }),
);
check(
  'profilo SENZA classi → nessuna notifica casuale',
  'profilo-senza-classi',
  motivo({ province: ['TO'], classi: [] }, { province: 'TO', classi: ['A-022'] }),
);
check('normalizzaClasse(A-022) = A-22', 'A-22', normalizzaClasse('A-022'));
check('normalizzaClasse(A042) = A-42', 'A-42', normalizzaClasse('A042'));
// TOLLERANZA DI SCRITTURA: la stessa classe comunque venga digitata.
check('normalizzaClasse("A-18") = A-18', 'A-18', normalizzaClasse('A-18'));
check('normalizzaClasse("A18") = A-18', 'A-18', normalizzaClasse('A18'));
check('normalizzaClasse("a 18") = A-18', 'A-18', normalizzaClasse('a 18'));
check('normalizzaClasse("A_18") = A-18', 'A-18', normalizzaClasse('A_18'));
check('normalizzaClasse("A.18") = A-18', 'A-18', normalizzaClasse('A.18'));
check('normalizzaClasse("A - 018") = A-18', 'A-18', normalizzaClasse('A - 018'));
check('normalizzaClasse("  a-018  ") = A-18', 'A-18', normalizzaClasse('  a-018  '));
check('sostegno invariato (ADEE)', 'ADEE', normalizzaClasse('ADEE'));
check('sostegno invariato (AD24)', 'AD24', normalizzaClasse('AD24'));
{
  // LISTA: normalizza + dedup (A-022 ≡ A-22) + scarta i vuoti.
  check(
    'normalizzaClassi: dedup e formato canonico',
    ['A-18', 'A-22', 'ADEE'],
    normalizzaClassi(['a 18', 'A-022', 'A18', 'ADEE', '', null, ' adee ']),
  );
  check('contieneClasse: vera con formato diverso', true, contieneClasse(['A-022'], 'a 22'));
  check('contieneClasse: falsa per classe assente', false, contieneClasse(['A-022'], 'A-18'));
  check('rimuoviClasse: rimuove anche il formato diverso', ['A-18'], rimuoviClasse(['a 18', 'A-022'], 'A-22'));
}

/* ============ 3) AVVISO SENZA CLASSE: solo se la materia è coperta ============ */

console.log('\n— Avviso senza codice classe: match solo sulla MATERIA coperta —');
check('materia "Matematica" coperta da A-26', true, materiaCompatibileConClassi('Matematica', ['A-26']));
check('materia "Sostegno" coperta da ADEE', true, materiaCompatibileConClassi('Sostegno', ['ADEE']));
check('materia "Informatica" NON coperta da A-22 (tedesco)', false, materiaCompatibileConClassi('Informatica', ['A-22']));
check('nessuna materia → nessun match', false, materiaCompatibileConClassi(null, ['A-26']));
check(
  'avviso senza classi + materia coerente → compatibile',
  null,
  motivo({ province: ['AT'], classi: ['A-26'] }, { province: 'AT', classi: [], materia: 'Matematica' }),
);
check(
  'avviso senza classi + materia estranea → scartato',
  'classe',
  motivo({ province: ['AT'], classi: ['A-26'] }, { province: 'AT', classi: [], materia: 'Informatica' }),
);
check(
  'avviso senza classi né materia → scartato',
  'classe',
  motivo({ province: ['AT'], classi: ['A-26'] }, { province: 'AT', classi: [] }),
);

/* ============================ 4) GUARDIA SOSTEGNO ============================ */

console.log('\n— Guardia SOSTEGNO: gli avvisi AD… solo a chi aderisce —');
check(
  'profilo disciplinare (A-22) × avviso ADEE → scartato per sostegno',
  'sostegno',
  motivo({ province: ['AT'], classi: ['A-22'] }, { province: 'AT', classi: ['ADEE'], materia: 'Sostegno' }),
);
check(
  "l'adesione al sostegno NON inventa una classe: serve la classe AD… tra le proprie",
  'classe',
  motivo(
    { province: ['AT'], classi: ['A-22'], sostegno: true },
    { province: 'AT', classi: ['ADEE'], materia: 'Sostegno' },
  ),
);
check(
  'profilo con classe di sostegno (adesione implicita) → compatibile',
  null,
  motivo({ province: ['AT'], classi: ['ADEE'] }, { province: 'AT', classi: ['ADEE'], materia: 'Sostegno' }),
);
check(
  'enumerazione profili notificabili (ignoraFiltri) NON salta la guardia sostegno',
  'sostegno',
  (() => {
    const e = avvisoCompatibileConProfilo(
      { province: [], classi: [], sostegno: false },
      { province: 'AT', classi: ['ADEE'], materia: 'Sostegno' },
      { ignoraFiltri: true },
    );
    return e.ok ? null : (e.motivo ?? 'sconosciuto');
  })(),
);


/* ==================== 5) DIGEST: dispatch senza avvisi a caso ==================== */

const ID_PRO_TO = '11111111-1111-1111-1111-111111111111';

function rigaInterpello(hashId: string, title: string, province: string, classCodes: string[]) {
  return {
    id: `row-${hashId}`,
    hash_id: hashId,
    title,
    province,
    class_codes: classCodes,
    school_name: 'Liceo Augusto Monti',
    school_code: 'ATTF01000X',
    source_url: `https://www.usp-torino.gov.it/interpelli/${hashId}`,
    expiration_date: '2099-12-31',
    created_at: new Date().toISOString(),
    contact_email: 'atff01000x@istruzione.it',
    materia: null,
  };
}

const PROFILI = [
  {
    id: ID_PRO_TO,
    email: 'docente-to@example.it',
    email_notifica: 'docente-to@example.it',
    nome: 'Docente Torino',
    province_interesse: ['TO'],
    province_attive: ['TO'],
    classi_concorso: ['A-22'],
    telegram_chat_id: null,
    piano: 'pro',
    radar_attivo: true,
    is_free_forever: false,
    notifiche_blocco_inviato: false,
    notifiche_recap_inviato: false,
    sostegno: false,
  },
];

let INTERPELLI: Array<Record<string, unknown>> = [];

/** Client Supabase STUB (catena thenable): nessuna rete, filtri non applicati. */
function clientStub(): unknown {
  const thenable = (tabella: string) => {
    const b: Record<string, unknown> = {};
    const self = () => b;
    for (const m of ['in', 'overlaps', 'or', 'order', 'limit', 'eq', 'update', 'insert']) {
      b[m] = self;
    }
    b.select = () => b;
    const esito = (): { data: unknown[] | null; error: { message: string } | null } => ({
      data: tabella === 'profiles' ? PROFILI : tabella === 'interpelli' ? INTERPELLI : [],
      error: null,
    });
    b.maybeSingle = async () => ({ data: (esito().data ?? [])[0] ?? null, error: null });
    b.upsert = async () => ({ error: null });
    b.then = (resolve: (v: unknown) => void) => resolve(esito());
    return b;
  };
  return {
    from: (tabella: string) => thenable(tabella),
    rpc: async () => ({ data: [{ consentito: true, notifiche_usate: 1 }], error: null }),
  };
}

// AMBIENTE DI PROVA: Resend "configurato" (tutto in dryRun), Telegram spento.
process.env.RESEND_API_KEY = 'test-key-not-real';
process.env.TELEGRAM_BOT_TOKEN = '';

async function digests(): Promise<void> {
  const client = clientStub() as never;

  console.log("\n— DIGEST: avviso di PRATO non entra nel digest di un profilo di TORINO —");
  INTERPELLI = [rigaInterpello('hash-po-1', 'Interpello supplenza A-022 — Prato', 'PO', ['A-022'])];
  const soloPrato = await inviaDigestGiornaliero(client, { dryRun: true, forzato: true });
  check('utenti esaminati', 1, soloPrato.utenti);
  check("nessun digest inviato (avviso di un'altra provincia)", 0, soloPrato.inviate);
  check('profilo saltato (nessuna voce compatibile)', 1, soloPrato.saltati);

  console.log("\n— DIGEST: solo l'avviso di TORINO viene consegnato —");
  INTERPELLI = [
    rigaInterpello('hash-po-2', 'Interpello supplenza A-022 — Prato', 'PO', ['A-022']),
    rigaInterpello('hash-to-1', 'Interpello supplenza A-022 — Torino', 'TO', ['A-022']),
  ];
  const misto = await inviaDigestGiornaliero(client, { dryRun: true, forzato: true });
  check('un digest inviato', 1, misto.inviate);
  check("una sola voce (l'avviso di Torino)", 1, misto.voci);
  check('nessun profilo saltato', 0, misto.saltati);

  console.log('\n— DIGEST: la classe è vincolante (A-25 non è A-22) —');
  INTERPELLI = [rigaInterpello('hash-to-2', 'Interpello supplenza A-025 — Torino', 'TO', ['A-025'])];
  const altraClasse = await inviaDigestGiornaliero(client, { dryRun: true, forzato: true });
  check('nessun digest inviato', 0, altraClasse.inviate);
  check('profilo saltato (classe non seguita)', 1, altraClasse.saltati);

  console.log(errori === 0 ? '\n✅ FILTRO PROFILO: nessun problema' : `\n❌ FILTRO PROFILO: ${errori} errore/i`);
  process.exitCode = errori === 0 ? 0 : 1;
}

await digests();
if (existsSync(percorsoLedger)) rmSync(percorsoLedger, { force: true });

