/**
 * scripts/crawl-mvp.ts
 *
 * IL GIRO DELL'MVP: capoluoghi di regione + Asti, più le province che gli utenti
 * hanno chiesto davvero. (§26.126 · termostato §26.127)
 *
 * PERCHÉ ESISTE. `crawl-provincia.ts` scandisce UNA provincia scelta a mano;
 * `table-reporter.ts` senza filtro scandisce tutto il Paese. L'MVP sta in mezzo:
 * una BASE NAZIONALE stabile (i 20 capoluoghi di regione + Asti, così il Radar
 * Live mostra copertura su tutta Italia) e un'INTENSITÀ che sale dove c'è
 * domanda (`province_domanda`: prova del Radar e province salvate nel profilo).
 *
 * COSA FA, IN FILA
 *   1. legge la domanda da `province_domanda` (service role) e costruisce il
 *      piano con `lib/mvpPerimetro.pianoScansione` — finestra di 7 giorni;
 *   2. stampa il piano PRIMA di toccare la rete: baseline, domanda, province
 *      fuori baseline (quelle che la domanda aggiunge), richieste scadute e
 *      codici sconosciuti;
 *   3. con `--apply` promuove i target `pending` delle SOLO province richieste
 *      ad `active_crawler` (le altre restano coperte dagli hub USR del giro di
 *      fondo: nessun risveglio di massa);
 *   4. LEGGE IL TERMOSTATO (§26.127): conta gli avvisi attivi — la STESSA
 *      popolazione che il Radar Live mostra — e sceglie il regime del giro:
 *        · sotto 1.000  → carenza:    giro esteso (fondo 20 scuole/provincia,
 *                                     hub a 80 documenti per elenco);
 *        · 1.000–1.150  → equilibrio: giro standard (8 · 40);
 *        · oltre 1.150  → saturo:     rallenta (3 · 25).
 *      La soglia non si «raggiunge» creando righe: il numero è quello vero del
 *      database, e fluttua perché il crawler aggiunge e il tempo toglie;
 *   5. esegue `table-reporter` DUE volte, perché la densità è diversa:
 *        · province richieste   → `--max-scuole=tutte` (anagrafica MIM intera:
 *          una ricerca su un capoluogo lo promuove subito a questa densità);
 *        · provincia di fondo   → `--max-scuole=<fondo>`  (un campione).
 *      In entrambi i giri il deep crawl parte dall'anagrafica MIM della
 *      provincia (`--scuole-provincia`) e legge gli hub della regione.
 *
 * Il mestiere operativo (argomenti, stampa, lancio del crawler) sta in
 * `scripts/lib/giroMvp.ts`: questo file resta il racconto del giro, non il
 * motore. La regola della soglia è in `src/lib/termostatoCrawl.ts`, il perimetro
 * in `src/lib/mvpPerimetro.ts`.
 *
 * Uso:
 *   npx tsx scripts/crawl-mvp.ts                     (piano + due giri reali)
 *   npx tsx scripts/crawl-mvp.ts --solo-piano        (piano + termostato, no rete)
 *   npx tsx scripts/crawl-mvp.ts --apply             (promuove le richieste)
 *   npx tsx scripts/crawl-mvp.ts --dry-run           (nessuna scrittura)
 *   npx tsx scripts/crawl-mvp.ts --province=AT,CN    (domanda manuale in più)
 *   npx tsx scripts/crawl-mvp.ts --giorni=14 --max-scuole-domanda=80 \
 *                                --max-scuole-fondo=4 --soglia=1200
 */

import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  contaAvvisiAttivi,
  leggiDomanda,
  promuoviRichieste,
} from './lib/domandaProvincia.ts';
import { STATO_ATTIVO } from './lib/codaTargets.ts';
import {
  argomento,
  eseguiCrawlerMvp,
  numero,
  positivo,
  stampaPiano,
  stampaTermostato,
  tettoDaArgomento,
} from './lib/giroMvp.ts';
import {
  GIORNI_DOMANDA,
  TUTTE_LE_SCUOLE,
  pianoScansione,
  type RichiestaProvincia,
  type TettiScuole,
} from '../src/lib/mvpPerimetro.ts';
import { leggiTermostato } from '../src/lib/termostatoCrawl.ts';

dotenv.config();

/** `--apply` promuove la coda; senza, il giro legge e scrive solo gli avvisi. */
const APPLY = process.argv.includes('--apply');
/** Nessuna scrittura su `interpelli` (il crawler gira in `--dry-run`). */
const DRY_RUN = process.argv.includes('--dry-run');
/** Solo il piano: nessun crawler, nessuna promozione. */
const SOLO_PIANO = process.argv.includes('--solo-piano');
/** Finestra della domanda, in giorni (default: quella del monitoraggio della prova). */
const GIORNI = numero('giorni', GIORNI_DOMANDA);
/** Soglia del termostato, se il giro ne vuole una diversa (`--soglia=1200`). */
const SOGLIA_ARG = positivo('soglia');
/** Fascia morta sopra la soglia (`--isteresi=200`). */
const ISTERESI_ARG = positivo('isteresi');

/**
 * Tetto di scuole per provincia RICHIESTA: `tutte` (l'anagrafica MIM intera). Il
 * vecchio default di 60 è caduto (§26.127): chi aspetta non si serve a metà.
 * `--max-scuole-domanda=80` resta per una campagna manuale.
 */
const MAX_SCUOLE_DOMANDA = tettoDaArgomento('max-scuole-domanda') ?? TUTTE_LE_SCUOLE;
/**
 * Tetto di scuole per provincia di FONDO: `null` = lo decide il termostato
 * (20 in carenza, 8 in equilibrio, 3 in saturo). `--max-scuole-fondo=N` lo fissa.
 */
const MAX_SCUOLE_FONDO = positivo('max-scuole-fondo');
/** Province chieste a mano (workflow): si sommano alla domanda registrata. */
const PROVINCE_EXTRA = argomento('province')
  .split(',')
  .map((codice) => codice.trim().toUpperCase())
  .filter(Boolean);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Client di servizio (il registro `province_domanda` è RLS-locked al browser). */
function clientServizio(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main(): Promise<void> {
  console.log(
    `[crawl-mvp] MVP demand-driven · ${
      SOLO_PIANO ? 'solo piano' : DRY_RUN ? 'dry-run' : 'scrittura attiva'
    }${APPLY ? ' · promozione coda' : ''}`,
  );

  const supabase = clientServizio();
  // Domanda e conteggio sono indipendenti: una sola attesa per tutte e due.
  const [richieste, attivi] = await Promise.all([
    leggiDomanda(supabase),
    contaAvvisiAttivi(supabase),
  ]);
  // Il termostato decide la densità del FONDO e la profondità degli hub; la
  // provincia in domanda resta al 100% in ogni regime (§26.127).
  const opzioniTermostato = {
    ...(SOGLIA_ARG ? { soglia: SOGLIA_ARG } : {}),
    ...(ISTERESI_ARG ? { isteresi: ISTERESI_ARG } : {}),
  };
  const termostato = leggiTermostato(attivi, opzioniTermostato);
  const tetti: TettiScuole = {
    domanda: MAX_SCUOLE_DOMANDA,
    fondo: MAX_SCUOLE_FONDO ?? termostato.tarature.scuoleFondo,
  };
  // `--province=AT,CN` è una domanda MANUALE (workflow/diagnosi): entra nella
  // stessa finestra delle altre, con la data di adesso.
  const adesso = new Date();
  const manuali: RichiestaProvincia[] = PROVINCE_EXTRA.map((province) => ({
    province,
    ultima_richiesta: adesso.toISOString(),
  }));
  const piano = pianoScansione([...richieste, ...manuali], { adesso, giorni: GIORNI });
  stampaPiano(piano, tetti, GIORNI);
  stampaTermostato(termostato, tetti);

  if (SOLO_PIANO) {
    console.log('\n[crawl-mvp] --solo-piano: nessuna rete, nessuna scrittura.');
    return;
  }

  if (!supabase) {
    console.warn(
      '[crawl-mvp] Nessun client Supabase: salto la promozione della coda e vado ' +
        'diretto al crawler (che ha bisogno delle stesse credenziali).',
    );
  } else if (APPLY) {
    const errori = await promuoviRichieste(supabase, piano.domanda, DRY_RUN);
    if (errori > 0) {
      console.error(`[crawl-mvp] ${errori} lotti NON aggiornati: coda incompleta.`);
      process.exitCode = 1;
    }
  } else {
    console.log(
      '[crawl-mvp] Nessuna promozione (rilancia con --apply per portare ad ' +
        `«${STATO_ATTIVO}» i target delle province richieste).`,
    );
  }

  // Due giri, due densità: prima chi aspetta (100% dell'anagrafica), poi il
  // fondo nazionale con la profondità che il termostato concede.
  const fondo = piano.tutte.filter((provincia) => !piano.domanda.includes(provincia));
  const statoDomanda = eseguiCrawlerMvp(piano.domanda, tetti.domanda, termostato.tarature.hub, DRY_RUN);
  if (statoDomanda !== 0) {
    console.error(`[crawl-mvp] Giro della domanda terminato con codice ${statoDomanda}.`);
    process.exitCode = statoDomanda;
  }
  if (fondo.length > 0) {
    const statoFondo = eseguiCrawlerMvp(fondo, tetti.fondo, termostato.tarature.hub, DRY_RUN);
    if (statoFondo !== 0) {
      console.error(`[crawl-mvp] Giro di fondo terminato con codice ${statoFondo}.`);
      process.exitCode = statoFondo;
    }
  }

  console.log(
    '\n[crawl-mvp] Fatto: la lista delle scuole contattate è nei blocchi ' +
      '«SCUOLE CONTATTATE» sopra, uno per giro.',
  );
}

main().catch((err) => {
  console.error('[crawl-mvp] Errore:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
