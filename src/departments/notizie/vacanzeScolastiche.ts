/**
 * Notizie · vacanze scolastiche (calendario di riferimento dell'hero).
 *
 * Estratto da `components/NotizieHero.tsx`: data della Pasqua (algoritmo di
 * Meeus/Jones/Butcher), differenza in GIORNI CIVILI tra due date e conto alla
 * rovescia delle prossime vacanze. Tutte le date sono locali a mezzanotte: i
 * confronti non subiscono offset di fuso orario né cambi di ora legale.
 */

/** Esito del conto alla rovescia mostrato sotto il widget Scadenze. */
export interface ContoVacanze {
  /** true tra il 30 giugno e il 31 agosto: il conteggio viene nascosto. */
  estate: boolean;
  /** Giorni civili che mancano alle prossime vacanze. */
  giorni: number;
  /** Nome delle vacanze imminenti (es. «vacanze di Natale»). */
  nome: string;
}

/**
 * Data della Pasqua (Calendario gregoriano) — algoritmo di Meeus/Jones/Butcher.
 * Ritorna un Date locale a mezzanotte: nessuna ambiguità di fuso orario.
 */
export function dataPasqua(anno: number): Date {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = aprile
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anno, mese - 1, giorno);
}

/**
 * Differenza in GIORNI CIVILI tra due Date locali a mezzanotte.
 * Il confronto avviene tramite `Date.UTC(anno, mese, giorno)`: immune ai
 * cambi di ora legale (DST) e a qualsiasi offset di fuso orario.
 */
function giorniCiviliTra(dal: Date, al: Date): number {
  const base = Date.UTC(dal.getFullYear(), dal.getMonth(), dal.getDate());
  const arrivo = Date.UTC(al.getFullYear(), al.getMonth(), al.getDate());
  return Math.round((arrivo - base) / 86_400_000);
}

/**
 * Conto alla rovescia per le vacanze scolastiche, basato sulla data odierna:
 *   - 30 giu → 31 ago : ESTATE → il conteggio è nascosto (box solo scadenza)
 *   - 1 set → 22 dic  : "XX giorni alle vacanze di Natale"
 *   - 23 dic → Pasqua : "XX giorni alle vacanze di Pasqua"
 *   - Pasqua → 29 giu : "XX giorni alle vacanze estive"
 * Tutte le date sono locali a mezzanotte (`new Date(anno, mese, giorno)`):
 * nessuno spostamento di fuso orario nei confronti tra date.
 */
export function prossimeVacanze(oggi: Date): ContoVacanze {
  const anno = oggi.getFullYear();
  const inizioEstate = new Date(anno, 5, 30); // 30 giugno
  const fineEstate = new Date(anno, 7, 31); // 31 agosto

  // Estate (30 giu – 31 ago): il conteggio viene nascosto, box solo scadenza.
  if (
    oggi.getTime() >= inizioEstate.getTime() &&
    oggi.getTime() <= fineEstate.getTime()
  ) {
    return { estate: true, giorni: 0, nome: '' };
  }

  const natale = new Date(anno, 11, 23); // inizio vacanze di Natale
  const primoSettembre = new Date(anno, 8, 1);
  const primoGiornoEstate = new Date(anno, 5, 30); // primo giorno di vacanze estive
  let pasqua = dataPasqua(anno);

  let target: Date;
  let nome: string;

  if (oggi.getTime() >= natale.getTime()) {
    // 23 dic → 31 dic: la prossima Pasqua è quella della stagione successiva.
    pasqua = dataPasqua(anno + 1);
    target = pasqua;
    nome = 'vacanze di Pasqua';
  } else if (oggi.getTime() >= primoSettembre.getTime()) {
    // 1 set → 22 dic: vacanze di Natale.
    target = natale;
    nome = 'vacanze di Natale';
  } else if (oggi.getTime() >= pasqua.getTime()) {
    // Pasqua → 29 giu: vacanze estive (inizio 30 giugno).
    target = primoGiornoEstate;
    nome = 'vacanze estive';
  } else {
    // 1 gen → (Pasqua - 1): vacanze di Pasqua.
    target = pasqua;
    nome = 'vacanze di Pasqua';
  }

  // Differenza in giorni civili tra due mezzanotte locali: nessun offset di
  // fuso orario, nessun errore di arrotondamento DST.
  const giorni = Math.max(0, giorniCiviliTra(oggi, target));
  return { estate: false, giorni, nome };
}
