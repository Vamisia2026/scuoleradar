/**
 * ScuoleRadar.it — RICERCA UNIFICATA di classi di concorso e competenze.
 *
 * Un solo motore di ricerca per il passo 3 del wizard Radar e per la sezione
 * «In cosa puoi lavorare» delle Preferenze: digitando **una** parola (es.
 * «Pedagogia») l'utente vede nello stesso elenco
 *   1. le CLASSI DI CONCORSO che rispondono per codice, denominazione o materia
 *      collegata;
 *   2. le COMPETENZE/LABORATORI (PNRR/PON) con quel nome **o CORRELATE** al
 *      concetto cercato: «Inglese» aggancia anche CLIL ed educazione linguistica,
 *      «Coding» anche robotica e competenze digitali (`CORRELAZIONI_MATERIE`);
 *   3. la possibilità di aggiungere la parola digitata come PAROLA CHIAVE
 *      personale (tag libero), quando non è già un elemento del catalogo.
 *
 * Modulo PURO: nessun accesso a stato, rete o localStorage. Le stesse funzioni
 * alimentano tutte le superfici, così i risultati sono sempre coerenti.
 */
import { classiConcorso, type ClasseConcorso } from '../data/classiConcorso';
import { materieRicercabili, type Materia } from '../data/ordiniMaterie';
import { contieneClasse, normalizzaClasse } from './matchingEngine';
import {
  etichettaMateria,
  materiaCorrelata,
  materiaRisponde,
  materieCorrelate,
  normalizzaTestoRicerca,
  ordineRisponde,
  separaParoleChiave,
} from './ricercaTesto';

// Regole di confronto testo ↔ catalogo (normalizzazione, materie correlate,
// ordine di scuola, parole chiave): definite UNA volta in `ricercaTesto.ts` e
// ri-esportate da qui perché i consumatori continuino a importarle da un unico
// modulo — un solo punto di verità, mai due copie divergenti.
export { etichettaMateria, materieCorrelate, normalizzaTestoRicerca, separaParoleChiave };

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

/**
 * TOLLERANZA DI SCRITTURA del CODICE di classe: `a19` ≡ `A19` ≡ `A-19` ≡ `a-19`
 * ≡ `A_19` ≡ `A.19` ≡ `A-019` ≡ `A019` ≡ `  a 19  `, confrontati su stringhe
 * normalizzate (minuscolo, senza spazi/trattini/accenti): la casella di ricerca
 * non resta mai vuota per una differenza di formato.
 */
export function classeRispondeAQuery(codice: string | null | undefined, query: string): boolean {
  const q = normalizzaTestoRicerca(query);
  if (!q) return true;
  const canonico = normalizzaTestoRicerca(normalizzaClasse(codice));
  return canonico.includes(q) || canonico.includes(normalizzaTestoRicerca(normalizzaClasse(query)));
}

/**
 * True se la classe risponde alla query: codice (in qualsiasi formato),
 * denominazione, materia collegata oppure ordine di scuola («CPIA», «adulti»).
 */
export function classeCorrispondeAQuery(
  classe: { codice: string; denominazione: string; materie?: readonly string[]; ordine?: string },
  query: string,
): boolean {
  const q = normalizzaTestoRicerca(query);
  if (!q) return true;
  if (classeRispondeAQuery(classe.codice, query)) return true;
  if (normalizzaTestoRicerca(classe.denominazione).includes(q)) return true;
  if (ordineRisponde(classe.ordine, q)) return true;
  return (classe.materie ?? []).some((id) => materiaRisponde(id, q));
}

/**
 * Classi di concorso che rispondono alla query: codice (anche `a18` per `A-18`),
 * denominazione oppure MATERIA COLLEGATA (`c.materie`, anche CORRELATA: «Inglese»
 * aggancia le classi su CLIL/educazione linguistica). Con query vuota restituisce
 * l'intero catalogo (la lista è poi limitata in altezza dalla UI).
 */
export function cercaClassiDiConcorso(query: string, limite = 60): ClasseConcorso[] {
  const q = normalizzaTestoRicerca(query);
  if (!q) return classiConcorso.slice(0, limite);
  const correlate = materieCorrelate(query);
  const out: ClasseConcorso[] = [];
  for (const c of classiConcorso) {
    const codiceOk = classeRispondeAQuery(c.codice, query);
    const denominazioneOk = normalizzaTestoRicerca(c.denominazione).includes(q);
    const ordineOk = ordineRisponde(c.ordine, q);
    const materiaOk = (c.materie ?? []).some(
      (id) => materiaRisponde(id, q) || materiaCorrelata(id, correlate),
    );
    if (codiceOk || denominazioneOk || ordineOk || materiaOk) {
      out.push(c);
      if (out.length >= limite) break;
    }
  }
  return out;
}

/**
 * Competenze/laboratori che rispondono alla query: competenze extra PNRR/PON,
 * discipline curricolari proposte dai bandi («Lingua inglese», «Educazione
 * motoria e sportiva») e — con l'aggancio ESTESO — le competenze CORRELATE al
 * concetto cercato («Inglese» → CLIL, educazione linguistica). Le altre
 * discipline curricolari restano fuori: sono già coperte dalle classi di concorso.
 */
export function cercaCompetenzeExtra(query: string, limite = 40): Materia[] {
  const q = normalizzaTestoRicerca(query);
  const catalogo = materieRicercabili();
  if (!q) return catalogo.slice(0, limite);
  const correlate = materieCorrelate(query);
  return catalogo
    .filter((m) => normalizzaTestoRicerca(m.nome).includes(q) || materiaCorrelata(m.id, correlate))
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
  // già presenti nel profilo e quelle che il catalogo già offre come competenza
  // (per NOME VISIBILE — «Lingua inglese» → `linguainglese` — o per id — `inglese`):
  // lì basta il click sul risultato.
  const chiaviCatalogo = new Set(
    materieRicercabili().flatMap((m) => [
      normalizzaTestoRicerca(m.nome),
      normalizzaTestoRicerca(m.id),
    ]),
  );
  const tagsPresenti = new Set(stato.materieCustom.map((t) => normalizzaTestoRicerca(t)));
  const paroleChiave = separaParoleChiave(testo).filter((voce) => {
    const chiave = normalizzaTestoRicerca(voce);
    return !tagsPresenti.has(chiave) && !chiaviCatalogo.has(chiave);
  });

  return { classi, competenze, paroleChiave, queryTroppoCorta: false };
}

/**
 * RICERCA delle sole COMPETENZE e PAROLE CHIAVE — nessuna classe di concorso.
 *
 * È il campo della colonna di DESTRA delle Preferenze («In cosa puoi lavorare,
 * oltre la tua classe di concorso?»): le classi restano nel campo dedicato a
 * SINISTRA («Classi di concorso»), così i due campi non si sovrappongono e non
 * restituiscono gli stessi risultati. Stesso motore, stesso formato e stesso
 * raggruppamento della ricerca unificata: si limita a scartare il gruppo
 * `classi`, quindi `competenze` e `paroleChiave` sono identiche a quelle del
 * wizard (una sola implementazione, mai due copie divergenti).
 */
export function cercaCompetenzeParole(
  query: string,
  stato: StatoSelezioniRicerca,
  limite = LIMITE_RISULTATI_GRUPPO,
): GruppiRicercaSelezioni {
  const gruppi = cercaSelezioniRadar(query, stato, limite);
  return { ...gruppi, classi: [] };
}
