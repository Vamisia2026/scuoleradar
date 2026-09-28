/**
 * ScuoleRadar.it — Dipartimento Notizie · STANDARD EDITORIALE (aggregatore).
 *
 * Riferimento permanente: docs/BLOG_EDITORIAL_GUIDELINES.md
 *
 * Punto d'ingresso del dizionario editoriale: unisce i blocchi tematici
 * (`standardTemiPersonale.ts`, `standardTemiDidattica.ts`) e il lessico
 * condiviso (`lessicoScuola.ts`) con la matrice di scoring e gli helper usati
 * da `relevanceEngine.ts`.
 *
 * MACRO-AREE COPERTE (scuola a 360 gradi, non solo interpelli):
 *  1. normativa, concorsi e reclutamento (interpelli, supplenze, MAD, GPS/GAE/GI,
 *     convocazioni, concorsi, PNRR ed esperti PNRR, vincoli di mobilità,
 *     immissioni in ruolo, anno di prova, transizione scuola);
 *  2. personale ATA e segreterie (collaboratori scolastici, assistenti
 *     amministrativi e tecnici, DSGA, graduatorie e terza fascia ATA, carrelli
 *     di lavoro, organico di fatto e di diritto);
 *  3. istruzione degli adulti (CPIA, percorsi di secondo livello, corsi serali);
 *  4. formazione, titoli e CFU (TFA sostegno, 24/30/60 CFU, classi di concorso,
 *     titoli di accesso, aggiornamento professionale, carta del docente, welfare
 *     scolastico e polizza sanitaria);
 *  5. pedagogia, filosofia e riferimenti culturali per ordine di scuola
 *     (Montessori, Dewey, Piaget, Vygotskij, Malaguzzi, Diderot per
 *     infanzia/primaria; Don Milani, Gramsci, Bruner per la secondaria di I
 *     grado; Kant, Hegel, Marx, Nietzsche, Popper per la secondaria di II grado);
 *  6. innovazione didattica e strumenti (STEAM, coding, robotica educativa,
 *     PNSD, intelligenza artificiale, PCTO, debate) e inclusione (BES, DSA, PEI,
 *     PDP, GLO, sostegno).
 *
 * REGOLA D'ORO (invariata): la copertura lessicale NON abbassa il filtro. I temi
 * culturali/didattici sono `autosufficiente: false` e `fattoConcreto: true`:
 * nessun webinar, convegno o comunicato entra in bacheca solo perché cita
 * Montessori o il coding.
 *
 * Modulo PURO: nessuna dipendenza dalla rete né da Node.
 */
import { TEMI_PERSONALE, type TemaOperativo } from './standardTemiPersonale';
import { TEMI_DIDATTICA } from './standardTemiDidattica';

export { AREE_TEMATICHE } from './standardTemiPersonale';
export type { TemaOperativo } from './standardTemiPersonale';

/** Allow-list completa, già in ordine di priorità di categorizzazione. */
export const TEMI_OPERATIVI: TemaOperativo[] = [...TEMI_PERSONALE, ...TEMI_DIDATTICA];

/**
 * MATRICE DI SCORING (0-100): priorità di un articolo per categoria.
 * I valori dei temi storici sono INVARIATI (nessuna regressione sul feed già
 * pubblicato); le voci legacy restano mappate perché arrivano anche da
 * `PAROLE_CATEGORIA` e dai dati d'archivio. Le aree culturali/didattiche stanno
 * in basso: informano, ma non scavalcano mai un provvedimento operativo.
 */
export const PESI_CATEGORIA: Record<string, number> = {
  GPS: 95,
  Concorsi: 90,
  Sostegno: 88,
  'Reclutamento e Ruolo': 87,
  'Assegnazioni Provvisorie': 86,
  Mobilità: 85,
  CCNL: 84,
  ATA: 84,
  Pensioni: 82,
  Supplenze: 80,
  PNRR: 80,
  Welfare: 80,
  Organico: 79,
  Graduatorie: 78,
  Formazione: 78,
  Sicurezza: 76,
  'Ricostruzione Carriera': 76,
  'Riconoscimento Titoli': 74,
  'Innovazione Digitale': 72,
  Scadenze: 72,
  'Istruzione Adulti': 71,
  Normativa: 70,
  Scuole: 70,
  Didattica: 68,
  Pedagogia: 66,
};

/**
 * CATEGORIE CHE ESIGONO UN FATTO CONCRETO: si pubblicano solo se la voce ha una
 * scadenza reale o un canale ufficiale di domanda/candidatura. È la cintura di
 * sicurezza per i temi culturali e didattici (pedagogia, didattica, innovazione
 * digitale): senza un fatto concreto restano fuori, come i comunicati.
 */
export const CATEGORIE_CON_FATTO_CONCRETO: string[] = TEMI_OPERATIVI.filter(
  (t) => t.fattoConcreto,
).map((t) => t.categoria);

/** Tutti i temi riconosciuti LESSICALMENTE nel testo (audit e guardie). */
export function temiDalTesto(testo: string): TemaOperativo[] {
  const t = (testo ?? '').replace(/\s+/g, ' ').toLowerCase();
  if (!t) return [];
  return TEMI_OPERATIVI.filter((tema) => tema.parole.some((p) => t.includes(p)));
}

/** Macro-aree coinvolte dal testo (senza duplicati), per audit e reportistica. */
export function areeTematicheDalTesto(testo: string): string[] {
  return [...new Set(temiDalTesto(testo).map((t) => t.area))];
}
