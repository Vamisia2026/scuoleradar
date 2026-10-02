/**
 * ScuoleRadar.it — Nome dell'istituto RILEVATO SULLA RIGA DELLA FONTE (modulo PURO).
 *
 * Perché esiste: le tabelle delle fonti regionali pubblicano il nome dell'istituto
 * in una COLONNA accanto al codice meccanografico, per esempio
 * `VCIC80500N | IC LIVORNO-TRONZANO | EEEE - PRIMARIA | …`. Fino a oggi il parser
 * salvava il CODICE ma non il nome (`school_name` vuoto in 53 righe attive su 58),
 * quindi la riga non superava il gate di vetrina e restava fuori dalla bacheca
 * anche quando aveva una scadenza vicinissima.
 *
 * Qui si legge la finestra di testo che SEGUE (o precede) il codice, si taglia al
 * primo confine di cella (ordine di scuola, stato della supplenza, codici di
 * classe, date) e si tiene il candidato più lungo che supera il gate condiviso
 * `nomeIstitutoPresentabile`. Se nessun candidato è un nome d'istituto vero si
 * restituisce `null`: mai un'etichetta di materia o un dump di codici al posto
 * della scuola (direttiva cliente 28/09/2026).
 *
 * Funzione pura: nessuna rete, nessuna dipendenza da React o Supabase.
 */

import { nomeIstitutoPresentabile } from '../lib/nomeIstituto.ts';

/**
 * Codice meccanografico nell'identico formato usato dal parser
 * (`RE_CODICE_MECCANOGRAFICO` in `parser.ts`): mai un secondo standard.
 */
export const RE_CODICE_MECCANOGRAFICO_RIGA = /\b([A-Z]{2}[A-Z0-9]{4}\d{3}[A-Z0-9])\b/;

/** Parole che chiudono il nome: da qui in avanti la riga è procedura/dati. */
const CONFINE = new Set([
  'interna', 'esterna', 'diurno', 'serale',
  'posta', 'posto', 'posti', 'supplenza',
  'supplenze', 'temporanea', 'determinato', 'indeterminato', 'dal', 'dalla', 'dalle',
  'al', 'alla', 'alle', 'fino', 'entro', 'scadenza', 'termine', 'pubblicazione',
  'docente', 'docenti', 'ata', 'classe', 'classi', 'interpello', 'interpelli',
  'avviso', 'avvisi', 'bando', 'bandi', 'selezione', 'selezioni', 'esperto',
  'esperti', 'protocollo', 'aperto', 'chiuso', 'visualizza', 'stampa', 'domanda',
]);

/**
 * Quanti token al massimo si esaminano dopo/prima il codice. Serve largo per i
 * nomi lunghi e veri delle fonti («ISTITUTO COMPRENSIVO DI SCUOLA MATERNA,
 * ELEMENTARE E MEDIA DI MOROZZO»); ad accorciare ci pensano i confini e il gate.
 */
const MAX_TOKEN_FINESTRA = 12;

/** True se il token chiude la finestra del nome (cella diversa, dato o codice). */
function eConfine(token: string): boolean {
  const pulito = token.replace(/^[|,\-–—]+|[|,\-–—]+$/g, '').trim();
  if (!pulito) return true;
  if (/\d/.test(pulito)) {
    // Un numero CORTO può far parte del nome («I.C. Castiglione 1», «IC 1 Asti»);
    // date, anni, classi di concorso e progressivi lunghi chiudono la finestra.
    return !/^\d{1,2}$/.test(pulito);
  }
  return CONFINE.has(pulito.toLowerCase());
}

/**
 * Candidato più lungo che il gate riconosce come nome d'istituto.
 * I token arrivano già tagliati al confine: si prova dal più lungo al più corto
 * per non troncare un nome reale («ISTITUTO COMPRENSIVO DON E. FERRARIS»).
 */
function migliorCandidato(token: string[]): string | null {
  for (let n = token.length; n >= 1; n -= 1) {
    // Una sigla di una lettera in coda («I.C. VILLAFRANCA D») è un'iniziale
    // spezzata dall'HTML, non un nome mostrabile: si passa al candidato più corto.
    const ultima = (token[n - 1] ?? '').replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (ultima.length > 0 && ultima.length < 3) continue;
    const nome = nomeIstitutoPresentabile(token.slice(0, n).join(' '));
    if (nome) return nome;
  }
  return null;
}

/** Finestra di token dopo (o prima) il codice, tagliata al primo confine. */
function finestra(token: string[], dalPiu: 'dopo' | 'prima'): string[] {
  const ordinati = dalPiu === 'dopo' ? token : [...token].reverse();
  const tenuti: string[] = [];
  for (const t of ordinati) {
    if (eConfine(t)) break;
    tenuti.push(t);
    if (tenuti.length >= MAX_TOKEN_FINESTRA) break;
  }
  return dalPiu === 'dopo' ? tenuti : tenuti.reverse();
}

/**
 * Nome dell'istituto che la FONTE pubblica accanto al codice meccanografico.
 *
 * @param testo  riga (o contesto) della fonte, già normalizzata o meno
 * @param codice codice meccanografico trovato dal parser; se assente si cerca nel testo
 * @returns nome presentabile, altrimenti `null` (mai un'etichetta inventata)
 */
export function scuolaDaRiga(testo?: string | null, codice?: string | null): string | null {
  const riga = (testo ?? '').replace(/\s+/g, ' ').trim();
  if (riga.length < 6) return null;

  const cercato = (codice ?? '').toUpperCase().trim() || (RE_CODICE_MECCANOGRAFICO_RIGA.exec(riga.toUpperCase())?.[1] ?? '');
  if (!cercato) return null;

  const posizione = riga.toUpperCase().indexOf(cercato);
  if (posizione < 0) return null;

  const token = riga.split(' ');
  const indice = token.findIndex((t) => t.toUpperCase().includes(cercato));
  if (indice < 0) return null;

  return (
    migliorCandidato(finestra(token.slice(indice + 1), 'dopo')) ??
    migliorCandidato(finestra(token.slice(0, indice), 'prima'))
  );
}
