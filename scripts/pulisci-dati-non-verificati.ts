/**
 * PULIZIA — prepara `interpelli` per la bacheca pubblica e ripulisce `notices`.
 *
 * Direttiva cliente 22/10/2026: sul tabellone NON devono esistere link morti.
 * Nessuna pagina può accorgersi che un avviso è diventato un 404, quindi il
 * controllo va fatto QUI, prima che la riga sia considerata pronta:
 *
 *   1. TITOLO/FONTE — le righe che non superano `verificaAvviso` (segnali di
 *      test/mock, URL non http(s), fonte mancante) si cancellano;
 *   2. DOMINIO UFFICIALE — il `school_site` mancante si riempie con il dominio
 *      `*.edu.it` dell'anagrafica MIM (`lib/dominiAnagrafica.ts`), così la bacheca
 *      può aprire la home dell'istituto invece del portale privato;
 *   3. LINK — un avviso che risponde 404/410, o che non risponde affatto, non si
 *      pubblica: se l'istituto ha una home `.edu.it` il click porta lì, altrimenti
 *      la riga esce (`lib/validitaLink.ts`); il controllo HTTP è `HEAD` con
 *      fallback `GET` e timeout corto (`scraper/verificaLinkHttp.ts`);
 *   4. NOME — `school_name` fittizio (sigle di classe, «VISUALIZZA INTERPELLI»)
 *      riportato a `NULL`.
 *
 * La REGOLA (pura, con test) vive in `./lib/puliziaInterpelli.ts`; questo script
 * legge, misura, stampa e — solo con `--apply` — scrive. Se oltre il 30% dei link
 * risulta morto il run si dichiara sospetto (probabile guasto di rete nostro) e
 * NON cancella nulla: exit 2.
 *
 * Uso: `npx tsx scripts/pulisci-dati-non-verificati.ts` (DRY-RUN)
 *      `… --apply` (scrive) · `… --senza-link` (salta il controllo di rete)
 *      `… --max 5000` (quante righe leggere, default 2000)
 * Exit 0 = fatto · 1 = errori di lettura/scrittura · 2 = piano sospetto (allarme).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import process from 'node:process';
import { caricaAnagrafica } from '../src/lib/anagraficaScuole.ts';
import { mappaDominiDaAnagrafica } from '../src/lib/dominiAnagrafica.ts';
import { statisticheMappa } from '../src/lib/dominiScuola.ts';
import type { EsitoPingLink } from '../src/lib/validitaLink.ts';
import { verificaAvviso } from '../src/scraper/parser.ts';
import { verificaLinkInLotti } from '../src/scraper/verificaLinkHttp.ts';
import { colonnaAssente } from './lib/interpelliManutenzione.ts';
import {
  costruisciPianoPulizia,
  descriviPiano,
  nomeScuolaDaAzzerare,
  type RigaPulizia,
} from './lib/puliziaInterpelli.ts';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env: uso l'ambiente di sistema */
}

const APPLY = process.argv.includes('--apply');
/** `--senza-link`: nessuna richiesta HTTP (rete assente o prova offline). */
const SENZA_LINK = process.argv.includes('--senza-link') || process.argv.includes('--senza-rete');
/** Righe lette per tabella (default 2000; `--max N` per allargare). */
const LIMITE = ((): number => {
  const i = process.argv.indexOf('--max');
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2000;
})();

const URL_ = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Colonne che servono alla pulizia (le recenti possono mancare: migrazione). */
const COLONNE_PULIZIA = [
  'id', 'title', 'school_name', 'school_code',
  'source_url', 'school_site', 'contact_email', 'school_pec',
];

/** Legge le righe di `interpelli` togliendo le colonne che il database non conosce. */
async function leggiInterpelli(sb: SupabaseClient): Promise<RigaPulizia[] | null> {
  const colonne = [...COLONNE_PULIZIA];
  for (let tentativo = 0; tentativo <= COLONNE_PULIZIA.length; tentativo += 1) {
    const { data, error } = await sb.from('interpelli').select(colonne.join(', ')).limit(LIMITE);
    if (!error) return (data ?? []) as RigaPulizia[];
    const mancante = colonnaAssente(error.message);
    if (!mancante || !colonne.includes(mancante)) {
      console.log(`\n=== interpelli: errore di lettura ${error.message}`);
      return null;
    }
    console.log(`⚠ interpelli.${mancante} assente (migrazione non applicata): proseguo senza.`);
    colonne.splice(colonne.indexOf(mancante), 1);
  }
  return [];
}

/** Controllo HTTP dei link dichiarati dalle righe (null = controllo non eseguito). */
async function esitiLink(
  righe: ReadonlyArray<RigaPulizia>,
): Promise<Map<string, EsitoPingLink> | null> {
  if (SENZA_LINK) {
    console.log('  · controllo link: SALTATO (--senza-link)');
    return null;
  }
  const esiti = await verificaLinkInLotti(
    righe.map((r) => r.source_url),
    { concorrenza: 8 },
  );
  console.log(`  · controllo link: ${esiti.size} URL raggiunti (HEAD, fallback GET)`);
  return esiti;
}


/** Cancella per lotti: un `.in()` con migliaia di id non passa da PostgREST. */
async function cancellaInLotti(sb: SupabaseClient, ids: ReadonlyArray<string>): Promise<number> {
  let cancellati = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const lotto = ids.slice(i, i + 50);
    const { error } = await sb.from('interpelli').delete().in('id', lotto);
    if (error) console.log(`  ✗ cancellazione (${lotto.length}): ${error.message}`);
    else cancellati += lotto.length;
  }
  return cancellati;
}

/** Applica il piano: aggiornamenti puntuali, poi cancellazioni. */
async function applicaPiano(
  sb: SupabaseClient,
  piano: ReturnType<typeof costruisciPianoPulizia>,
  fuoriPerTitolo: ReadonlyArray<string>,
): Promise<boolean> {
  let errori = 0;
  for (const { id, patch } of piano.aggiorna) {
    const { error } = await sb.from('interpelli').update(patch).eq('id', id);
    if (error) {
      errori += 1;
      if (errori <= 5) console.log(`  ✗ update ${id.slice(0, 8)}: ${error.message}`);
    }
  }
  console.log(`  ✓ aggiornate ${piano.aggiorna.length - errori} righe`);
  const ids = [...fuoriPerTitolo, ...piano.cancella.map((c) => c.id)];
  if (ids.length > 0) {
    console.log(`  ✓ cancellate ${await cancellaInLotti(sb, ids)} righe non pubblicabili`);
  }
  return errori === 0;
}

/** Esito della pulizia di `interpelli`: decide l'exit code, come dichiarato in testa. */
type EsitoPulizia = 'ok' | 'allarme' | 'errore';

/** Pulizia di `interpelli`: la pipeline completa (misura · piano · applicazione). */
async function pulisciInterpelli(sb: SupabaseClient): Promise<EsitoPulizia> {
  const righe = await leggiInterpelli(sb);
  if (!righe) return 'errore';
  console.log(`\n=== interpelli: ${righe.length} righe esaminate ===`);
  if (righe.length === 0) return 'ok';

  const indice = caricaAnagrafica();
  const mappa = indice.disponibile ? mappaDominiDaAnagrafica(indice) : null;
  const stat = statisticheMappa(mappa);
  console.log(
    indice.disponibile
      ? `  · anagrafica MIM: ${stat.codici} codici → ${stat.domini} domini ufficiali`
      : '  · anagrafica MIM: NON disponibile (nessun file SCUANAGRAFE)',
  );

  // 1) Righe che non sono nemmeno un avviso: fuori prima di sprecare richieste HTTP.
  const pubblicabili = new Set(
    righe.filter((r) => verificaAvviso({ title: r.title, link: r.source_url }).ok).map((r) => r.id),
  );
  const valide = righe.filter((r) => pubblicabili.has(r.id));
  const fuoriPerTitolo = righe.filter((r) => !pubblicabili.has(r.id)).map((r) => r.id);

  // 2) Link: controllo HTTP leggero, 3) piano (dominio, link, nome).
  const esiti = await esitiLink(valide);
  const piano = costruisciPianoPulizia(valide, { mappa, esiti });
  piano.conteggi.esaminate = righe.length;
  console.log(`  · ${descriviPiano(piano)}`);
  console.log(`  · scartate per titolo/fonte non credibile: ${fuoriPerTitolo.length}`);

  for (const c of piano.cancella.slice(0, 10)) console.log(`      ✗ ${c.motivo}`);
  for (const a of piano.aggiorna.slice(0, 10)) console.log(`      · ${a.motivi.join(' · ')}`);
  if (piano.aggiorna.length + piano.cancella.length > 20) console.log('      … (elenco troncato)');

  if (!APPLY) {
    console.log('  (DRY-RUN: nessuna modifica. Rilancia con --apply per applicare.)');
    return 'ok';
  }
  if (piano.allarme.troppiScarti) {
    console.log('  ✗ ALLARME: troppi link morti in un solo run — probabile guasto di rete.');
    console.log('    Nessuna cancellazione applicata: verifica la connessione o usa --senza-link.');
    return 'allarme';
  }
  return (await applicaPiano(sb, piano, fuoriPerTitolo)) ? 'ok' : 'errore';
}

/** `notices` (legacy): igiene minima, nessun controllo di rete. */
async function pulisciNotices(sb: SupabaseClient): Promise<boolean> {
  let { data, error } = await sb
    .from('notices')
    .select('id, title, school_name, source_url')
    .limit(LIMITE);
  // `notices` non ha la colonna school_name → ripiega senza sanificazione.
  if (error && /school_name/.test(error.message)) {
    ({ data, error } = await sb.from('notices').select('id, title, source_url').limit(LIMITE));
  }
  if (error) {
    console.log(`\n=== notices: errore di lettura ${error.message}`);
    return false;
  }
  const righe = (data ?? []) as Array<{
    id: string;
    title: string | null;
    school_name?: string | null;
    source_url: string | null;
  }>;
  const daCancellare = righe.filter(
    (r) => !verificaAvviso({ title: r.title, link: r.source_url }).ok,
  );
  const fuori = new Set(daCancellare.map((r) => r.id));
  const daAzzerare = righe.filter((r) => !fuori.has(r.id) && nomeScuolaDaAzzerare(r.school_name));
  console.log(`\n=== notices: ${righe.length} righe ===`);
  console.log(`  · non verificati da cancellare: ${daCancellare.length}`);
  console.log(`  · nomi scuola fittizi da azzerare: ${daAzzerare.length}`);
  if (!APPLY) {
    console.log('  (DRY-RUN: nessuna modifica.)');
    return true;
  }
  const ids = daCancellare.map((r) => r.id);
  if (ids.length > 0) {
    const { error: errDel } = await sb.from('notices').delete().in('id', ids);
    console.log(errDel ? `  ✗ delete fallita: ${errDel.message}` : `  ✓ cancellati ${ids.length} record`);
  }
  for (const r of daAzzerare) {
    const { error: errUpd } = await sb.from('notices').update({ school_name: null }).eq('id', r.id);
    if (errUpd) console.log(`  ✗ update ${r.id.slice(0, 8)}: ${errUpd.message}`);
  }
  return true;
}

async function main(): Promise<void> {
  console.log(`Pulizia dati non verificati — modalità ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const sb = createClient(URL_, SERVICE);
  const esitoInterpelli = await pulisciInterpelli(sb);
  const okNotices = await pulisciNotices(sb);
  // Exit dichiarati in testa: 2 = piano sospetto (allarme), 1 = errori di lettura/scrittura.
  if (esitoInterpelli === 'allarme') process.exitCode = 2;
  else if (esitoInterpelli === 'errore' || !okNotices) process.exitCode = 1;
}

void main();

