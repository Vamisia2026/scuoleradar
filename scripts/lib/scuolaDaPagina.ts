/**
 * ScuoleRadar.it — Manutenzione DATI: nome istituto letto dalla PAGINA della fonte.
 *
 * Modulo di supporto del backfill (`scripts/backfill-nomi-istituto.ts`): dato un
 * avviso già in tabella, ricava il nome reale dell'istituto nell'ordine rigoroso
 * di affidabilità
 *   1. dal TITOLO, con lo stesso parser dello scraper (`estraiScuola`);
 *   2. dalla PAGINA della fonte (`source_url`), dove le tabelle regionali pubblicano
 *      il nome in una colonna accanto al codice meccanografico (`scuolaDaRiga`):
 *      prima l'intera pagina, poi — se serve — la finestra attorno al titolo
 *      dell'avviso (le pagine con più righe altrimenti confondono il contesto);
 *   3. dal registro scuole per codice (`nomeScuolaDaCodice`).
 *
 * Regole di prodotto rispettate: niente inventato (se nessuna strada dà un nome che
 * superi il gate `nomeIstitutoPresentabile`, si restituisce `null`), una pagina è
 * scaricata una sola volta per run e il budget di rete è esplicito (`maxFetch`).
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { scuolaDaRiga } from '../../src/scraper/scuolaDaRiga.ts';
import { estraiScuola } from '../../src/scraper/parser.ts';
import { nomeIstitutoPresentabile } from '../../src/lib/nomeIstituto.ts';
import { nomeScuolaDaCodice } from '../../src/lib/school-lookup.ts';
import {
  estraiCodiceMeccanograficoDaTesto,
  normalizzaCodiceMeccanografico,
} from '../../src/lib/emailScuola.ts';

/** Riga di `interpelli` necessaria alla risoluzione (solo i campi usati). */
export interface RigaInterpello {
  id: string;
  title: string | null;
  school_name: string | null;
  school_code: string | null;
  province: string | null;
  expiration_date: string | null;
  source_url: string | null;
}

/** Nome d'istituto risolto + come è stato ricavato (per il report del backfill). */
export interface Risoluzione {
  nome: string;
  via: 'titolo' | 'fonte' | 'registro';
  codice: string | null;
}

/** Risolutore con budget di rete: `pagineLette()` espone il consumo effettivo. */
export interface Risolutore {
  risolvi(riga: RigaInterpello): Promise<Risoluzione | null>;
  pagineLette(): number;
}

const UA = 'ScuoleRadarBot/1.0 (+https://scuoleradar.it — manutenzione dati)';

/** Finestra di testo (caratteri) attorno al titolo dell'avviso nella pagina. */
const AMPIEZZA_CONTESTO = 600;

/** Testo semplificato (minuscolo, senza punteggiatura) per cercare un titolo. */
const semplifica = (t: string): string =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/g, ' ')
    .trim();

/** Finestra di testo attorno al titolo: contesto giusto nelle pagine multi-riga. */
function contestoTitolo(testo: string, titolo: string): string | null {
  const ago = semplifica(titolo).slice(0, 40);
  if (ago.length < 12) return null;
  const posizione = semplifica(testo).indexOf(ago);
  if (posizione < 0) return null;
  return testo.slice(
    Math.max(0, posizione - AMPIEZZA_CONTESTO),
    posizione + AMPIEZZA_CONTESTO,
  );
}

/**
 * Crea un risolutore che scarica ogni pagina al massimo una volta, entro il budget
 * indicato: esaurito il budget le righe restanti restano invariate (mai un errore
 * fatale: una fonte regionale che risponde 403/timeout non è un dato da inventare).
 */
export function creaRisolutore(opts: { maxFetch: number }): Risolutore {
  const cache = new Map<string, string | null>();
  let lette = 0;

  async function testoPagina(link: string): Promise<string | null> {
    const inCache = cache.get(link);
    if (inCache !== undefined) return inCache;
    if (lette >= opts.maxFetch) {
      cache.set(link, null);
      return null;
    }
    lette += 1;
    try {
      const res = await axios.get<string>(link, {
        timeout: 15_000,
        responseType: 'text',
        maxRedirects: 3,
        headers: { 'User-Agent': UA, 'Accept-Language': 'it-IT,it;q=0.9' },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      const testo = cheerio.load(String(res.data))('body').text().replace(/\s+/g, ' ').trim();
      cache.set(link, testo);
      return testo;
    } catch {
      // Fonte non leggibile: la riga resta com'è, nessun nome inventato.
      cache.set(link, null);
      return null;
    }
  }

  /** Nome presentabile dalla fonte: pagina intera, poi finestra attorno al titolo. */
  async function dallaFonte(riga: RigaInterpello, codice: string): Promise<string | null> {
    const link = (riga.source_url ?? '').trim();
    if (!/^https?:\/\//i.test(link) || /\.pdf$/i.test(link)) return null;
    const testo = await testoPagina(link);
    if (!testo) return null;
    const intera = nomeIstitutoPresentabile(scuolaDaRiga(testo, codice));
    if (intera) return intera;
    const contesto = contestoTitolo(testo, riga.title ?? '');
    if (!contesto || contesto === testo) return null;
    return nomeIstitutoPresentabile(scuolaDaRiga(contesto, codice));
  }

  async function risolvi(riga: RigaInterpello): Promise<Risoluzione | null> {
    const codice =
      normalizzaCodiceMeccanografico(riga.school_code) ??
      estraiCodiceMeccanograficoDaTesto(`${riga.title ?? ''} ${riga.source_url ?? ''}`);

    const dalTitolo = nomeIstitutoPresentabile(estraiScuola(riga.title ?? ''));
    if (dalTitolo) return { nome: dalTitolo, via: 'titolo', codice };

    if (codice) {
      const fonte = await dallaFonte(riga, codice);
      if (fonte) return { nome: fonte, via: 'fonte', codice };
      const registro = nomeIstitutoPresentabile(nomeScuolaDaCodice(codice));
      if (registro) return { nome: registro, via: 'registro', codice };
    }
    return null;
  }

  return { risolvi, pagineLette: () => lette };
}
