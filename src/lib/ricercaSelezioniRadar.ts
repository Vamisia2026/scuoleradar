/**
 * ScuoleRadar.it — RICERCA UNIFICATA di classi di concorso e competenze.
 *
 * Un solo motore di ricerca per il passo 3 del wizard Radar e per la sezione
 * «In cosa puoi lavorare» delle Preferenze: digitando **una** parola (es.
 * «Pedagogia») l'utente vede nello stesso elenco
 *   1. le CLASSI DI CONCORSO che rispondono per codice, denominazione o materia
 *      collegata;
 *   2. le COMPETENZE/LABORATORI extra (PNRR/PON) con quel nome;
 *   3. la possibilità di aggiungere la parola digitata come PAROLA CHIAVE
 *      personale (tag libero), quando non è già un elemento del catalogo.
 *
 * Modulo PURO: nessun accesso a stato, rete o localStorage. Le stesse funzioni
 * alimentano tutte le superfici, così i risultati sono sempre coerenti.
 */
import { classiConcorso, type ClasseConcorso } from '../data/classiConcorso';
import { materie, materieCompetenzeExtra, type Materia } from '../data/ordiniMaterie';
import { contieneClasse, normalizzaClasse } from './matchingEngine';

/** Natura di un suggerimento restituito dalla ricerca. */
export type TipoSuggerimento = 'classe' | 'competenza' | 'parola';

/** Voce della ricerca, pronta da mostrare e da applicare. */
export interface SuggerimentoSelezione {
  tipo: TipoSuggerimento;
  /** Codice della classe, id della materia oppure testo della parola chiave. */
  chiave: string;
  /** Testo principale mostrato all'utente. */
  etichetta: string;
  /** Riga secondaria (materie della classe, tipo di competenza…). */
  dettaglio: string;
  /** true quando l'elemento è già selezionato nel profilo. */
  selezionato: boolean;
}

/** Risultato della ricerca unificata, già raggruppato per la UI. */
export interface GruppiRicercaSelezioni {
  classi: SuggerimentoSelezione[];
  competenze: SuggerimentoSelezione[];
  /**
   * Voci da aggiungere come PAROLE CHIAVE personali: la query viene divisa sulle
   * virgole, quindi incollare «Intelligenza artificiale, Didattica digitale, Teatro»
   * produce TRE tag indipendenti (array vuoto quando non c'è nulla da aggiungere).
   */
  paroleChiave: string[];
  /** true quando la query è troppo corta per cercare (nessun risultato mostrato). */
  queryTroppoCorta: boolean;
}

/** Stato delle selezioni necessario a marcare i risultati come già scelti. */
export interface StatoSelezioniRicerca {
  classiCodici: readonly string[];
  materieId: readonly string[];
  materieCustom: readonly string[];
}

/** Numero massimo di risultati mostrati per gruppo (poi si affina la ricerca). */
export const LIMITE_RISULTATI_GRUPPO = 6;

/** Sotto questa lunghezza la ricerca non parte (evita liste inutili). */
export const MIN_CARATTERI_RICERCA = 2;

/** Testo normalizzato per il confronto: minuscolo, senza accenti, spazi e trattini. */
export function normalizzaTestoRicerca(testo: string): string {
  return (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]/g, '')
    .trim();
}

/** Etichetta leggibile di una materia di catalogo (id → nome). */
export function etichettaMateria(id: string): string {
  return materie.find((m) => m.id === id)?.nome ?? id;
}

/**
 * Divide un testo libero in PAROLE CHIAVE indipendenti.
 *
 * L'utente può scrivere o incollare più voci separate da **virgola** (o punto e
 * virgola): «Intelligenza artificiale, Didattica digitale, Teatro» diventa TRE tag
 * distinti, mai un'unica stringa incollata. Spazi normalizzati, voci vuote scartate
 * e duplicati rimossi (confronto senza accenti/maiuscole).
 */
export function separaParoleChiave(testo: string): string[] {
  const out: string[] = [];
  const visti = new Set<string>();
  for (const pezzo of (testo ?? '').split(/[,;]/)) {
    const voce = pezzo.trim().replace(/\s+/g, ' ');
    if (!voce) continue;
    const chiave = normalizzaTestoRicerca(voce);
    if (!chiave || visti.has(chiave)) continue;
    visti.add(chiave);
    out.push(voce);
  }
  return out;
}

/** true se la materia (o la sua etichetta) risponde alla query normalizzata. */
function materiaRisponde(id: string, q: string): boolean {
  return normalizzaTestoRicerca(id).includes(q) || normalizzaTestoRicerca(etichettaMateria(id)).includes(q);
}

/**
 * Classi di concorso che rispondono alla query: codice (anche `a18` per `A-18`),
 * denominazione oppure MATERIA COLLEGATA (`c.materie`). Con query vuota restituisce
 * l'intero catalogo (la lista è poi limitata in altezza dalla UI).
 */
export function cercaClassiDiConcorso(query: string, limite = 60): ClasseConcorso[] {
  const q = normalizzaTestoRicerca(query);
  if (!q) return classiConcorso.slice(0, limite);
  const out: ClasseConcorso[] = [];
  for (const c of classiConcorso) {
    const codiceOk = normalizzaTestoRicerca(normalizzaClasse(c.codice)).includes(q);
    const denominazioneOk = normalizzaTestoRicerca(c.denominazione).includes(q);
    const materiaOk = (c.materie ?? []).some((id) => materiaRisponde(id, q));
    if (codiceOk || denominazioneOk || materiaOk) {
      out.push(c);
      if (out.length >= limite) break;
    }
  }
  return out;
}

/**
 * Competenze/laboratori EXTRA (PNRR/PON) che rispondono alla query. Le discipline
 * curricolari restano fuori: sono già coperte dalle classi di concorso.
 */
export function cercaCompetenzeExtra(query: string, limite = 40): Materia[] {
  const q = normalizzaTestoRicerca(query);
  if (!q) return materieCompetenzeExtra().slice(0, limite);
  return materieCompetenzeExtra()
    .filter((m) => normalizzaTestoRicerca(m.nome).includes(q))
    .slice(0, limite);
}

/**
 * RICERCA UNIFICATA (una sola funzione per wizard e Preferenze): classi +
 * competenze + eventuale parola chiave. La parola chiave viene proposta solo se
 * la query ha almeno `MIN_CARATTERI_RICERCA` caratteri, non coincide già con una
 * competenza del catalogo e non è già tra i tag personali dell'utente.
 */
export function cercaSelezioniRadar(
  query: string,
  stato: StatoSelezioniRicerca,
  limite = LIMITE_RISULTATI_GRUPPO,
): GruppiRicercaSelezioni {
  const testo = (query ?? '').trim();
  const q = normalizzaTestoRicerca(testo);
  if (q.length < MIN_CARATTERI_RICERCA) {
    return { classi: [], competenze: [], paroleChiave: [], queryTroppoCorta: true };
  }

  const classi: SuggerimentoSelezione[] = cercaClassiDiConcorso(testo, 200)
    .slice(0, limite)
    .map((c) => ({
      tipo: 'classe' as const,
      chiave: c.codice,
      etichetta: `${c.codice} – ${c.denominazione}`,
      dettaglio: (c.materie ?? []).map(etichettaMateria).join(', '),
      selezionato: contieneClasse([...stato.classiCodici], c.codice),
    }));

  const competenze: SuggerimentoSelezione[] = cercaCompetenzeExtra(testo, 200)
    .slice(0, limite)
    .map((m) => ({
      tipo: 'competenza' as const,
      chiave: m.id,
      etichetta: m.nome,
      dettaglio: 'Competenza / laboratorio da esperto',
      selezionato: stato.materieId.includes(m.id),
    }));

  // Parole chiave: OGNI voce separata da virgola è un tag a sé. Si scartano quelle
  // già presenti nel profilo e quelle che coincidono esattamente con una competenza
  // del catalogo (lì basta il click sul risultato).
  const nomiCompetenze = new Set(materieCompetenzeExtra().map((m) => normalizzaTestoRicerca(m.nome)));
  const tagsPresenti = new Set(stato.materieCustom.map((t) => normalizzaTestoRicerca(t)));
  const paroleChiave = separaParoleChiave(testo).filter((voce) => {
    const chiave = normalizzaTestoRicerca(voce);
    return !tagsPresenti.has(chiave) && !nomiCompetenze.has(chiave);
  });

  return { classi, competenze, paroleChiave, queryTroppoCorta: false };
}
