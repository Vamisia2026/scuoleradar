/**
 * Notizie · vacanze scolastiche (calendario di riferimento dell'hero).
 *
 * Estratto da `components/NotizieHero.tsx`: data della Pasqua (algoritmo di
 * Meeus/Jones/Butcher), differenza in GIORNI CIVILI tra due date e conto alla
 * rovescia delle prossime vacanze. Tutte le date sono locali a mezzanotte: i
 * confronti non subiscono offset di fuso orario né cambi di ora legale.
 *
 * CONTO ALLA ROVESCIA DINAMICO (§26.98). Il numero in pagina non è più un valore
 * calcolato una volta e poi congelato (il «56 giorni» fermo per giorni): questo
 * modulo è PURO e riceve l'istante corrente a ogni chiamata, mentre l'hero lo
 * richiama al montaggio, ogni minuto (con timer riallineato alla mezzanotte) e
 * al ritorno sulla scheda (`visibilitychange`, `focus`, `pageshow`). La data di
 * riferimento è quella UFFICIALE del calendario scolastico — il **23 dicembre
 * dell'anno scolastico in corso** (`inizioVacanzeNatale`) — e viaggia dentro
 * l'esito (`dataTarget`, ISO) così la pagina può dichiararla nel tooltip.
 */

/** Esito del conto alla rovescia mostrato sotto il widget Scadenze. */
export interface ContoVacanze {
  /** true tra il 30 giugno e il 31 agosto: il conteggio viene nascosto. */
  estate: boolean;
  /** Giorni civili che mancano alle prossime vacanze. */
  giorni: number;
  /** Nome delle vacanze imminenti (es. «vacanze di Natale»). */
  nome: string;
  /**
   * Data ISO (`YYYY-MM-DD`) del primo giorno di vacanza contato; `null` in
   * estate, quando il conteggio è nascosto. Non si ricava nel componente: la
   * stessa data che produce i giorni si dichiara in pagina.
   */
  dataTarget: string | null;
  /** Anno di INIZIO dell'anno scolastico di riferimento (2026 = 2026/2027). */
  annoScolastico: number;
}

/** Giorno d'inizio delle vacanze di Natale (calendario scolastico italiano). */
export const GIORNO_INIZIO_VACANZE_NATALE = 23;

/** Mese d'inizio delle vacanze di Natale (11 = dicembre, `Date` è 0-based). */
const MESE_DICEMBRE = 11;

/**
 * Anno di INIZIO dell'anno scolastico corrente: da settembre a dicembre è
 * l'anno solare in corso, da gennaio ad agosto è quello precedente. È l'ancora
 * che rende «23 dicembre dell'anno scolastico in corso» una data sola.
 */
export function annoScolasticoCorrente(oggi: Date): number {
  return oggi.getMonth() >= 8 ? oggi.getFullYear() : oggi.getFullYear() - 1;
}

/** Primo giorno delle vacanze di Natale: 23 dicembre dell'anno scolastico. */
export function inizioVacanzeNatale(annoScolastico: number): Date {
  return new Date(annoScolastico, MESE_DICEMBRE, GIORNO_INIZIO_VACANZE_NATALE);
}

/** Data ISO LOCALE `YYYY-MM-DD`: `toISOString` sposterebbe il giorno su UTC. */
function isoLocale(d: Date): string {
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mese}-${giorno}`;
}

/** Nomi dei mesi per la data leggibile del tooltip. */
const MESI_ITALIANI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/**
 * Data ISO → «23 dicembre 2026» (per il tooltip del conteggio). Stringa vuota
 * se la data manca o non è leggibile: mai un segnaposto inventato.
 */
export function dataLungaIt(iso: string | null): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const mese = MESI_ITALIANI[Number(m[2]) - 1];
  if (!mese) return '';
  return `${Number(m[3])} ${mese} ${m[1]}`;
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
 *   - 1 set → 22 dic  : "XX giorni alle vacanze di Natale" (23 dicembre)
 *   - 23 dic → Pasqua : "XX giorni alle vacanze di Pasqua"
 *   - Pasqua → 29 giu : "XX giorni alle vacanze estive" (30 giugno)
 * Tutte le date sono locali a mezzanotte (`new Date(anno, mese, giorno)`):
 * nessuno spostamento di fuso orario nei confronti tra date.
 *
 * L'ANCORA È L'ANNO SCOLASTICO, non l'anno solare: il 23 dicembre che conta è
 * quello dell'anno scolastico in corso (`inizioVacanzeNatale`), così a gennaio
 * il conteggio non salta all'anno successivo e a settembre non guarda indietro.
 * `dataTarget` dichiara la data esatta usata per i giorni.
 */
export function prossimeVacanze(oggi: Date): ContoVacanze {
  const annoScuola = annoScolasticoCorrente(oggi);
  const inizioEstate = new Date(oggi.getFullYear(), 5, 30); // 30 giugno
  const fineEstate = new Date(oggi.getFullYear(), 7, 31); // 31 agosto

  // Estate (30 giu – 31 ago): il conteggio viene nascosto, box solo scadenza.
  if (
    oggi.getTime() >= inizioEstate.getTime() &&
    oggi.getTime() <= fineEstate.getTime()
  ) {
    return {
      estate: true,
      giorni: 0,
      nome: '',
      dataTarget: null,
      annoScolastico: annoScuola,
    };
  }

  const natale = inizioVacanzeNatale(annoScuola); // 23 dicembre dell'anno scolastico
  // Pasqua della SECONDA parte dell'anno scolastico (marzo/aprile successivi):
  // è la stessa per il 23 dicembre e per gennaio, quindi non serve più il ramo
  // «anno + 1» che due anni fa slittava di una stagione.
  const pasqua = dataPasqua(annoScuola + 1);
  const fineAnno = new Date(annoScuola + 1, 5, 30); // 30 giugno: vacanze estive

  let target: Date;
  let nome: string;

  if (oggi.getTime() < natale.getTime()) {
    // 1 set → 22 dic: vacanze di Natale.
    target = natale;
    nome = 'vacanze di Natale';
  } else if (oggi.getTime() < pasqua.getTime()) {
    // 23 dic → giorno prima di Pasqua: vacanze di Pasqua.
    target = pasqua;
    nome = 'vacanze di Pasqua';
  } else {
    // Pasqua → 29 giu: vacanze estive (inizio 30 giugno).
    target = fineAnno;
    nome = 'vacanze estive';
  }

  // Differenza in giorni civili tra due mezzanotte locali: nessun offset di
  // fuso orario, nessun errore di arrotondamento DST.
  const giorni = Math.max(0, giorniCiviliTra(oggi, target));
  return {
    estate: false,
    giorni,
    nome,
    dataTarget: isoLocale(target),
    annoScolastico: annoScuola,
  };
}
