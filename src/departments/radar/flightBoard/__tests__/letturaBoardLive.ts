/**
 * ScuoleRadar.it — VERIFICA LIVE della lettura del tabellone «Radar Live».
 *
 * NON è un test di catena: parla col database vero, quindi resta una verifica
 * manuale (fuori da `npm test`). Vive accanto ai moduli che controlla — dentro il
 * dipartimento — così il gate strutturale non vede un import che scavalca
 * l'`index.ts` del dipartimento (`E-DOM`).
 *
 * Perché esiste: la bacheca pubblica leggeva gli interpelli con UNA richiesta,
 * ma Supabase/PostgREST non consegna più di `max-rows` righe per risposta — il
 * resto spariva in silenzio (con l'ordinamento per pubblicazione decrescente,
 * proprio gli avvisi più vecchi). Qui si misura il tetto REALE del progetto e si
 * confronta con la lettura a pagine che ora usa `FlightBoardInterpelli.tsx`:
 *
 *   1. `attese`  = conteggio ESATTO degli avvisi attivi (filtro di prodotto);
 *   2. `singola` = quante righe consegna UNA richiesta larga 1.000 (`max-rows`);
 *   3. `totale`  = quante righe legge la bacheca a pagine (`leggiTutteLePagine`);
 *   4. la differenza `totale − singola` è la vetrina che prima non si vedeva.
 *
 * SICUREZZA: sola lettura, nessuna scrittura; non stampa dati di riga, solo
 * conteggi (e, in caso di errore, il messaggio del database).
 *
 * Uso:
 *   npm run board:verifica
 *   SCUOLERADAR_CHIAVE=anon npm run board:verifica   (chiave del browser/RLS)
 *
 * Exit code: 0 = la bacheca copre TUTTO ciò che è attivo · 1 = ancora troncata
 * (o credenziali mancanti).
 */
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { preparaRigheBoard, rigaPresentabileVetrina, type RigaBoard } from '@/lib/liveBoard';
import { filtroAttivi } from '../filtroAttivi.ts';
import { leggiTutteLePagine } from '../letturaBoard.ts';
import { metricaBoard } from '../metricaBoard.ts';
import { urlValido } from '../righeBoard.ts';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env: uso l'ambiente di sistema */
}

const BASE = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SERVIZIO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? '';
/**
 * La bacheca è pubblica: la chiave anon legge gli stessi avvisi del browser.
 * `SCUOLERADAR_CHIAVE=anon` forza la chiave del browser (utile per verificare
 * che le policy RLS non nascondano righe al tabellone pubblico).
 */
const CHIAVE = process.env.SCUOLERADAR_CHIAVE === 'anon' ? ANON : SERVIZIO || ANON;

/** Le stesse colonne servite al tabellone (una sola definizione, nel componente). */
const COLONNE =
  'id, title, school_name, school_code, province, class_codes, materia, expiration_date, created_at, source_url';

/** Le stesse cinque righe per pagina della vetrina. */
const RIGHE_PER_PAGINA = 5;

/**
 * Campi di riga che servono a QUESTA verifica: identità, presenza della fonte e
 * i campi su cui si esprime il gate di vetrina (`preparaRigheBoard`).
 */
interface Riga extends RigaBoard {
  id: string;
  source_url?: string | null;
}

async function main(): Promise<void> {
  console.log('━━ ScuoleRadar — verifica lettura tabellone (Radar Live) ━━');
  if (!BASE || !CHIAVE) {
    console.error('✗ Credenziali mancanti (.env: SUPABASE_URL / VITE_SUPABASE_URL + chiave anon o service_role)');
    process.exitCode = 1;
    return;
  }
  const host = (() => {
    try {
      return new URL(BASE).host;
    } catch {
      return BASE;
    }
  })();
  console.log(`• Progetto: ${host}`);
  // L'etichetta dice la chiave DAVVERO usata, non la prima disponibile.
  console.log(`• Chiave: ${CHIAVE === SERVIZIO && SERVIZIO ? 'service_role' : 'anon (come il browser)'}`);
  console.log(`• Filtro di prodotto: ${filtroAttivi()}`);

  const client = createClient(BASE, CHIAVE);

  // ---- 1) Quanti avvisi attivi ha DAVVERO il database (conteggio esatto) e
  //         quante righe consegna UNA sola richiesta larga 1.000.
  const unaRichiesta = await client
    .from('interpelli')
    .select('id', { count: 'exact' })
    .or(filtroAttivi())
    .order('created_at', { ascending: false })
    .order('expiration_date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: false })
    .range(0, 1_000 - 1);
  if (unaRichiesta.error) {
    console.error(`✗ Lettura impossibile: ${unaRichiesta.error.message}`);
    process.exitCode = 1;
    return;
  }
  const attese = typeof unaRichiesta.count === 'number' ? unaRichiesta.count : null;
  const singola = (unaRichiesta.data ?? []) as Riga[];
  const tettoRaggiunto = attese !== null && singola.length < attese;

  // ---- 2) La lettura a pagine: le stesse regole del componente.
  const lettura = await leggiTutteLePagine<Riga>({
    attese,
    chiave: (r) => r.id,
    chiediPagina: async (da, a) => {
      const { data, error } = await client
        .from('interpelli')
        .select(COLONNE)
        .or(filtroAttivi())
        .order('created_at', { ascending: false })
        .order('expiration_date', { ascending: true, nullsFirst: false })
        .order('id', { ascending: false })
        .range(da, a);
      return { data: (data ?? null) as Riga[] | null, error };
    },
  });

  // ---- 3) Le righe che entrano in tabellone (come le conta il componente).
  const conFonte = lettura.righe.filter((r) => Boolean(urlValido(r.source_url)));
  const metrica = metricaBoard({
    righeCaricate: conFonte.length,
    totaleReale: attese,
    righePerPagina: RIGHE_PER_PAGINA,
    pagina: 1,
  });

  // ---- 3-bis. La VETRINA: le righe che superano il gate di presentabilità
  //           (`preparaRigheBoard`: avviso vivo + istituto reale). È QUESTO il
  //           numero che genera «Schermata X di Y`: senza misurarlo, la verifica
  //           confrontava il conteggio del database con righe che il tabellone
  //           non mostra — e il contatore delle schermate risultava più corto
  //           del doppio (sintomo: «869 attivi» ma «Schermata 1 di 80»).
  const inVetrina = preparaRigheBoard(conFonte);
  const metricaVetrina = metricaBoard({
    righeCaricate: inVetrina.length,
    totaleReale: attese,
    righePerPagina: RIGHE_PER_PAGINA,
    pagina: 1,
  });

  console.log('\n— Lettura del tabellone —');
  console.log(`  avvisi attivi nel database       : ${attese ?? '(conteggio non disponibile)'}`);
  console.log(
    `  righe da UNA richiesta (max-rows) : ${singola.length}${tettoRaggiunto ? '  ← tetto PostgREST raggiunto' : ''}`,
  );
  console.log(`  righe lette A PAGINE             : ${lettura.righe.length} in ${lettura.pagineLette} pagine`);
  console.log(`  righe scartate come doppioni     : ${lettura.duplicati}`);
  console.log(`  lettura esaustiva                : ${lettura.esaustiva ? 'sì' : 'NO'}`);
  if (lettura.errore) console.log(`  errore di lettura                : ${lettura.errore}`);
  console.log(`  righe con una fonte valida       : ${conFonte.length}`);

  console.log('\n— Vetrina (gate di presentabilità) —');
  console.log(`  righe IN VETRINA                 : ${inVetrina.length}`);
  console.log(`  scartate dal gate (scuola/vita)  : ${conFonte.length - inVetrina.length}`);
  // Composizione dello scarto: senza scadenza (finestra dei 60 giorni) oppure
  // senza un istituto reale. Sono due problemi DIVERSI (regola di prodotto vs
  // anagrafica) e vanno contati separatamente per non decidere alla cieca.
  const senzaScadenza = conFonte.filter((r) => !(r.expiration_date ?? '').trim()).length;
  const senzaNome = conFonte.filter((r) => !rigaPresentabileVetrina(r)).length;
  console.log(`   · senza scadenza pubblicata      : ${senzaScadenza}`);
  console.log(`   · senza istituto reale           : ${senzaNome}`);
  console.log(`  etichetta sugli avvisi attivi    : ${metrica.etichettaPagine}`);
  console.log(`  etichetta REALE delle schermate  : ${metricaVetrina.etichettaPagine}`);
  console.log(`  etichetta degli avvisi attivi    : ${metrica.etichettaTotale ?? '(nessuna)'}`);

  // ---- 3-ter. Campione OPZIONALE delle righe scartate dal gate: serve a
  //            decidere se lo scarto è «anagrafica da arricchire» o «contorno da
  //            togliere dal database». Si attiva solo a mano.
  if (process.env.SCUOLERADAR_ESEMPI === '1') {
    const scartate = conFonte.filter((r) => !rigaPresentabileVetrina(r));
    const conData = scartate.filter((r) => (r.expiration_date ?? '').trim());
    const host = (url?: string | null): string => {
      try {
        return new URL(String(url)).host;
      } catch {
        return '(host n/d)';
      }
    };
    const perHost = new Map<string, number>();
    for (const r of scartate) perHost.set(host(r.source_url), (perHost.get(host(r.source_url)) ?? 0) + 1);
    console.log('\n— Scartate dal gate: distribuzione per host —');
    for (const [h, n] of [...perHost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`  ${String(n).padStart(4)}  ${h}`);
    }
    console.log(
      `\n— Scartate dal gate: ${conData.length} hanno una SCADENZA (opportunità vere da recuperare) —`,
    );
    for (const r of conData.slice(0, 40)) {
      console.log(
        `  · [${r.province ?? '—'}] ${host(r.source_url)} | ${r.expiration_date ?? 'n/d'}` +
          ` | codice: ${r.school_code ?? '—'} | scuola: ${(r.school_name ?? '—').slice(0, 42)}` +
          ` | titolo: ${(r.title ?? '—').slice(0, 45)}`,
      );
    }
  }
  if (singola.length < lettura.righe.length) {
    const recuperate = lettura.righe.length - singola.length;
    console.log(
      `\n  ➜ la lettura singola perdeva ${recuperate} avvisi ` +
        `(${Math.round((recuperate / lettura.righe.length) * 100)}% della bacheca).`,
    );
  }

  const completa = lettura.esaustiva && !lettura.errore && (attese === null || lettura.righe.length >= attese);
  if (completa) {
    console.log('\n✅ Tabellone completo: la bacheca copre tutti gli avvisi attivi, senza troncamenti muti.');
    return;
  }
  console.log('\n❌ Tabellone ancora incompleto: la lettura a pagine non ha coperto il database.');
  console.log('   Controlla l’ordinamento (serve un ultimo criterio univoco, es. `id`) e la guardia di pagine.');
  process.exitCode = 1;
}

void main();
