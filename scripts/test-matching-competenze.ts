/**
 * TEST — COMPETENZE E PAROLE CHIAVE nel matching («In cosa puoi lavorare, anche
 * oltre la tua classe di concorso?»).
 *
 * Perché esiste: `materie_id`/`materie_custom` erano l'unico blocco delle
 * preferenze mai scritto su `profiles`: il profilo configurato SOLO con quelle
 * (nessuna classe di concorso) arrivava al motore senza criteri → Radar acceso e
 * nessuna opportunità consegnata, senza alcun errore visibile.
 *
 * Verifica: (1) la regola unica `avvisoCompatibileConProfilo` con competenze di
 * catalogo e parole chiave libere (accenti e plurali normalizzati); (2) le
 * competenze NON allargano i profili che hanno già una classe, non scavalcano la
 * provincia né la guardia sostegno, e i token generici non producono match;
 * (3) il DIGEST end-to-end (client Supabase STUB, DRY-RUN): l'avviso pertinente
 * arriva, quello fuori competenza no.
 *
 * Esecuzione: npm run test:matching (insieme a `test-matching-profilo.ts`).
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RPC_MATCH_INTERPELLI,
  avvisoCompatibileConProfilo,
  normalizzaCompetenza,
  tokenCompetenza,
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
const percorsoLedger = join(tmpdir(), `scuoleradar-competenze-test-${process.pid}.json`);
process.env.SCUOLERADAR_LEDGER_PATH = percorsoLedger;
writeFileSync(percorsoLedger, JSON.stringify({ aggiornato: new Date().toISOString(), chiavi: [] }), 'utf8');

/** Motivo dello scarto (o `null` se l'avviso è compatibile). */
function motivo(
  profilo: Parameters<typeof avvisoCompatibileConProfilo>[0],
  avviso: Parameters<typeof avvisoCompatibileConProfilo>[1],
  ignoraFiltri = false,
): string | null {
  const esito = avvisoCompatibileConProfilo(profilo, avviso, { ignoraFiltri });
  return esito.ok ? null : (esito.motivo ?? 'sconosciuto');
}

/* ===== 1) REGOLA UNICA: profilo configurato SOLO su competenze/parole chiave ===== */

console.log('— Competenze: profilo configurato SOLO su «in cosa puoi lavorare» —');

/** Profilo senza classi: competenze di catalogo (`materie_id`) + parole libere. */
const profiloCompetenze = {
  province: ['TO'],
  classi: [] as string[],
  materieId: ['intelligenza_artificiale', 'robotica'],
  materieCustom: ['Lingua inglese', 'digital storytelling'],
};
check(
  "id di catalogo risolto nel nome × titolo dell'avviso → compatibile",
  null,
  motivo(profiloCompetenze, { province: 'TO', classi: [], titolo: 'Bando PNRR per esperto di Intelligenza Artificiale — Torino' }),
);
check(
  "parola chiave libera × materia dell'avviso → compatibile",
  null,
  motivo(profiloCompetenze, { province: 'TO', classi: [], materia: 'Inglese' }),
);
check('plurali/singolari: «digital storytelling» × «Digital Storytelling»', null, motivo(profiloCompetenze, { province: 'TO', classi: [], titolo: 'Laboratorio di Digital Storytelling' }));
check('accenti ignorati: «Creatività digitale» × «creativita digitale»', null, motivo({ province: ['TO'], classi: [], materieCustom: ['Creatività digitale'] }, { province: 'TO', classi: [], titolo: 'Percorso su creativita digitale e making' }));
check('competenza NON pertinente → scartato (mai un invio a caso)', 'classe', motivo(profiloCompetenze, { province: 'TO', classi: [], titolo: 'Interpello supplenza di Matematica' }));
check('profilo senza classi E senza competenze → ancora nessuna notifica casuale', 'profilo-senza-classi', motivo({ province: ['TO'], classi: [] }, { province: 'TO', classi: [], titolo: 'Bando per esperto di robotica' }));
check('provincia sempre vincolante anche con le competenze', 'provincia', motivo(profiloCompetenze, { province: 'PO', classi: [], titolo: 'Bando PNRR per esperto di Intelligenza Artificiale — Prato' }));
check('le competenze NON allargano i profili che hanno già una classe', 'classe', motivo({ province: ['TO'], classi: ['A-22'], materieId: ['robotica'], materieCustom: ['inglese'] }, { province: 'TO', classi: ['A-025'], titolo: 'Interpello robotica e inglese' }));
check('token generico («laboratorio») → nessun match automatico', 'classe', motivo({ province: ['TO'], classi: [], materieCustom: ['laboratorio'] }, { province: 'TO', classi: [], titolo: 'Laboratorio di scienze' }));

/** `let`: gli scenari cambiano il parco profili restituito dallo stub. */
let PROFILI: Array<Record<string, unknown>> = [];
let INTERPELLI: Array<Record<string, unknown>> = [];

/** Client Supabase STUB (catena thenable): nessuna rete, filtri non applicati. */
function clientStub(): unknown {
  const thenable = (tabella: string) => {
    const b: Record<string, unknown> = {};
    const self = () => b;
    for (const m of ['in', 'overlaps', 'or', 'order', 'limit', 'eq', 'update', 'insert']) b[m] = self;
    b.select = () => b;
    const esito = () => ({
      data: (tabella === 'profiles' ? PROFILI : tabella === 'interpelli' ? INTERPELLI : []) as unknown[],
      error: null as { message: string } | null,
    });
    b.maybeSingle = async () => ({ data: esito().data[0] ?? null, error: null });
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

/** Profilo notificabile SENZA classi di concorso: vale solo per le competenze. */
const profiloSoloCompetenze = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'docente-competenze@example.it',
  email_notifica: 'docente-competenze@example.it',
  nome: 'Docente Competenze',
  province_interesse: ['TO'],
  province_attive: ['TO'],
  classi_concorso: [],
  materie_id: ['intelligenza_artificiale'],
  materie_custom: ['digital storytelling'],
  telegram_chat_id: null,
  piano: 'pro',
  radar_attivo: true,
  is_free_forever: false,
  notifiche_blocco_inviato: false,
  notifiche_recap_inviato: false,
  sostegno: false,
};

function rigaInterpello(hashId: string, title: string, province: string, classCodes: string[]) {
  return {
    id: `row-${hashId}`,
    hash_id: hashId,
    title,
    province,
    class_codes: classCodes,
    school_name: 'Liceo Augusto Monti',
    source_url: `https://www.usp-torino.gov.it/interpelli/${hashId}`,
    expiration_date: '2099-12-31',
    created_at: new Date().toISOString(),
    contact_email: 'atff01000x@istruzione.it',
    materia: null,
  };
}

// AMBIENTE DI PROVA: Resend "configurato" (tutto in dryRun), Telegram spento.
process.env.RESEND_API_KEY = 'test-key-not-real';
process.env.TELEGRAM_BOT_TOKEN = '';

async function digests(): Promise<void> {
  const client = clientStub() as never;

  console.log('\n— DIGEST: profilo configurato SOLO su competenze/parole chiave —');
  PROFILI = [profiloSoloCompetenze];
  INTERPELLI = [rigaInterpello('hash-to-ia-1', 'Bando PNRR per esperto di Intelligenza Artificiale — Torino', 'TO', [])];
  const perCompetenza = await inviaDigestGiornaliero(client, { dryRun: true, forzato: true });
  check('utenti esaminati', 1, perCompetenza.utenti);
  check('digest inviato al profilo a competenze', 1, perCompetenza.inviate);
  check('una voce consegnata', 1, perCompetenza.voci);

  console.log('\n— DIGEST: competenza non pertinente → nessun invio —');
  INTERPELLI = [rigaInterpello('hash-to-mate-1', 'Interpello supplenza A-022 Matematica — Torino', 'TO', ['A-022'])];
  const fuoriCompetenza = await inviaDigestGiornaliero(client, { dryRun: true, forzato: true });
  check('nessun digest inviato (competenza assente)', 0, fuoriCompetenza.inviate);
  check('profilo saltato', 1, fuoriCompetenza.saltati);

  console.log(
    errori === 0
      ? '\n✅ COMPETENZE NEL MATCHING: nessun problema'
      : `\n❌ COMPETENZE NEL MATCHING: ${errori} errore/i`,
  );
  process.exitCode = errori === 0 ? 0 : 1;
}

await digests();
if (existsSync(percorsoLedger)) rmSync(percorsoLedger, { force: true });

check('area sostegno sempre inclusa anche per i profili a competenze', null, motivo({ ...profiloCompetenze, sostegno: false }, { province: 'TO', classi: ['ADEE'], materia: 'Sostegno' }));
check('enumerazione dei profili notificabili: le competenze valgono anche nel digest', null, motivo(profiloCompetenze, { province: null, classi: [], titolo: 'Robotica educativa' }, true));
check('normalizzaCompetenza: accenti e punteggiatura', 'intelligenza artificiale', normalizzaCompetenza('  Intelligenza  Artificiale!! '));
check('tokenCompetenza: radici, senza parole generiche', ['intelligenz', 'artificial'], tokenCompetenza('Intelligenza Artificiale e laboratori'));

/* ===== 2) DIGEST end-to-end: la consegna arriva (e non arriva) davvero ===== */
