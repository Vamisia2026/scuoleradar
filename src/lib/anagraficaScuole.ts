/**
 * ScuoleRadar.it — ANAGRAFICA NAZIONALE DELLE SCUOLE (superficie pubblica, solo-Node).
 *
 * Perché esiste: le fonti degli interpelli pubblicano spesso solo codici (dump di
 * classi, meccanografici) o niente affatto. Senza il nome reale dell'istituto la
 * vetrina pubblica scarta la riga (§26.20) e la notifica resta senza recapito di
 * candidatura (gate di qualità degli invii). L'anagrafica ufficiale del Ministero
 * — i file SCUANAGRAFE (scuole statali, paritarie, autonomie di Trento/Bolzano) —
 * lega ogni CODICE SCUOLA a denominazione, istituto di riferimento, email PEO e PEC.
 *
 * Qui vivono il LOOKUP (per codice o per nome) e l'ARRICCHIMENTO di una riga
 * d'interpello: la lettura dei CSV e l'indice stanno in `lib/anagraficaCsv.ts` e
 * `lib/anagraficaIndice.ts` (questo file li ri-esporta: si importa solo da qui).
 *
 * DOVE SI USA. Solo processi Node: `scripts/arricchisci-interpelli.ts`
 * (manutenzione dati) e lo scraper all'inserimento
 * (`src/scraper/anagraficaInterpelli.ts`), così ogni riga nasce già completa e
 * TUTTE e tre le superfici — Radar Pubblico (bacheca), Personale (feed
 * dell'utente) e Regionale (prova) — leggono le stesse righe arricchite, senza
 * logica duplicata. **Non è importabile dal browser** (`node:fs`).
 *
 * Verificato da `npm run test:anagrafica` (incluso in `npm test`).
 */
import { chiaveCodiceScuola, normalizzaNomeScuola, type ScuolaAnagrafica } from './anagraficaCsv';
import type { IndiceAnagrafica } from './anagraficaIndice';
import { estraiCodiceMeccanograficoDaTesto } from './emailScuola';
import { nomeIstitutoPresentabile } from './nomeIstituto';

export {
  PREFISSI_ANAGRAFICA,
  chiaveCodiceScuola,
  chiaveProvincia,
  normalizzaNomeScuola,
  parseCsv,
  provinciaCodiceDaNome,
  type ScuolaAnagrafica,
} from './anagraficaCsv';
export {
  caricaAnagrafica,
  cartellaAnagrafica,
  fileAnagrafici,
  type FileAnagraficaLetto,
  type IndiceAnagrafica,
} from './anagraficaIndice';

/** Scuola per codice meccanografico: sede (`CODICESCUOLA`) o istituto di riferimento. */
export function scuolaDaCodice(
  indice: IndiceAnagrafica,
  codice?: string | null,
): ScuolaAnagrafica | null {
  const c = chiaveCodiceScuola(codice);
  if (!c) return null;
  return indice.perCodice.get(c) ?? indice.perIstituto.get(c) ?? null;
}

/**
 * Scuola per NOME (fallback quando il codice manca): si accetta solo se il nome
 * identifica UNA scuola — o una sola nella provincia dichiarata. Si riprova anche
 * togliendo una testa iniziale di 2–6 caratteri, perché l'avviso scrive spesso
 * «I.C. Ferruccio Ulivi» mentre l'anagrafica registra «Ferruccio Ulivi». Un nome
 * ambiguo non produce nulla: meglio nessun arricchimento che uno sbagliato.
 */
export function scuolaDaNome(
  indice: IndiceAnagrafica,
  nome?: string | null,
  provinciaCodice?: string | null,
): ScuolaAnagrafica | null {
  const chiave = normalizzaNomeScuola(nome);
  if (chiave.length < 5) return null;
  const provincia = (provinciaCodice ?? '').trim().toUpperCase() || null;

  /** Una scuola sola: senza provincia basta che sia unica; con provincia deve essere di quella. */
  const trovaInLista = (lista: ScuolaAnagrafica[] | undefined): ScuolaAnagrafica | null => {
    if (!lista || lista.length === 0) return null;
    if (
      lista.length === 1 &&
      (!provincia || !lista[0].provinciaCodice || lista[0].provinciaCodice === provincia)
    ) {
      return lista[0];
    }
    if (!provincia) return null;
    const inProvincia = lista.filter((c) => c.provinciaCodice === provincia);
    return inProvincia.length === 1 ? inProvincia[0] : null;
  };

  const esatta = trovaInLista(indice.perNome.get(chiave));
  if (esatta) return esatta;
  for (let taglio = 2; taglio <= 6 && taglio < chiave.length; taglio += 1) {
    const coda = trovaInLista(indice.perNome.get(chiave.slice(taglio)));
    if (coda) return coda;
  }
  return null;
}

/**
 * Nome da MOSTRARE di una scuola dell'anagrafica: la denominazione dell'ISTITUTO
 * (il nome "vero"), ripulita dal gate di vetrina (§26.20), con la denominazione
 * della sede come alternativa. `null` se nessuna delle due è presentabile.
 */
export function nomeDaAnagrafica(scuola: ScuolaAnagrafica): string | null {
  return nomeIstitutoPresentabile(scuola.istitutoNome) ?? nomeIstitutoPresentabile(scuola.nome);
}

/** Vista minima di una riga d'interpello da arricchire. */
export interface RigaDaArricchire {
  school_code?: string | null;
  school_name?: string | null;
  contact_email?: string | null;
  school_pec?: string | null;
  /** Titolo dell'avviso: da qui si tenta di estrarre il codice meccanografico. */
  title?: string | null;
  /** Provincia dell'avviso (codice): serve al matching per nome non ambiguo. */
  province?: string | null;
}

/** Campi che l'arricchimento scrive (solo quelli mancanti). */
export interface PatchAnagrafica {
  school_code?: string;
  school_name?: string;
  contact_email?: string;
  school_pec?: string;
}

/** Esito dell'arricchimento: cosa scrivere, la scuola trovata e come. */
export interface EsitoArricchimento {
  patch: PatchAnagrafica;
  scuola: ScuolaAnagrafica | null;
  via: 'codice' | 'nome' | 'nessuna';
}

/**
 * Arricchimento di UNA riga d'interpello dall'anagrafica:
 *   1. il codice meccanografico della riga (o estratto dal titolo/nome);
 *   2. `school_code`, `school_name` (denominazione presentabile), `contact_email`
 *      (PEO, altrimenti PEC) e `school_pec` — **solo se mancanti**: un dato già
 *      presente non viene mai sovrascritto.
 * Con il codice assente si tenta il NOME (solo se univoco): è il caso delle righe
 * che hanno un nome leggibile ma nessun meccanografico — lì si recupera anche il
 * codice e quindi il recapito ufficiale.
 */
export function arricchisciDaAnagrafica(
  indice: IndiceAnagrafica,
  riga: RigaDaArricchire,
): EsitoArricchimento {
  const patch: PatchAnagrafica = {};
  const esito: EsitoArricchimento = { patch, scuola: null, via: 'nessuna' };
  if (!indice.disponibile) return esito;

  const codice =
    chiaveCodiceScuola(riga.school_code) ??
    estraiCodiceMeccanograficoDaTesto(`${riga.title ?? ''} ${riga.school_name ?? ''}`);
  let scuola = scuolaDaCodice(indice, codice);
  if (scuola) esito.via = 'codice';
  if (!scuola) {
    const perNome = scuolaDaNome(indice, riga.school_name, riga.province);
    if (perNome) {
      scuola = perNome;
      esito.via = 'nome';
    }
  }
  if (!scuola) return esito;
  esito.scuola = scuola;

  if (!chiaveCodiceScuola(riga.school_code)) patch.school_code = codice ?? scuola.codice;
  if (!nomeIstitutoPresentabile(riga.school_name)) {
    const nome = nomeDaAnagrafica(scuola);
    if (nome) patch.school_name = nome;
  }
  if (!(riga.contact_email ?? '').trim()) {
    const recapito = scuola.email ?? scuola.pec;
    if (recapito) patch.contact_email = recapito;
  }
  if (!(riga.school_pec ?? '').trim() && scuola.pec) patch.school_pec = scuola.pec;
  return esito;
}
