/**
 * ScuoleRadar.it — Scadenze LEGACY di `interpelli`: normalizzazione PURA.
 *
 * Il vecchio table-reporter scriveva la scadenza in `deadline` (TEXT) con forme
 * miste; la colonna canonica è `expiration_date` (timestamptz). Qui vivono le
 * regole di lettura di quel testo, SENZA I/O: le usa
 * `scripts/allinea-scadenze-interpelli.ts` per riempire la colonna canonica con
 * la stessa semantica del blocco SQL della migrazione
 * `20261015120000_allinea_deadline_expiration_interpelli.sql` — stesse forme
 * riconosciute e stesso rifiuto delle date impossibili: ciò che non si sa
 * leggere resta INTATTO (meglio un vuoto dichiarato che una data falsa).
 *
 * Forme riconosciute:
 *   1. ISO      `2026-09-30` — cast stretto: il 31/02 NON passa;
 *   2. troncata `26-09-30`   — anno 2000 + YY (un vecchio `slice(2,10)`);
 *   3. estesa   `30/09/2026`, `24/9/2026`, `21-09-2026`, `30.09.2026`.
 *
 * Guardia: `npm run test:scadenze`.
 */

/** Le colonne della riparazione: id, specchio legacy, colonna canonica. */
export interface RigaScadenza {
  id: string;
  deadline: string | null;
  expiration_date: string | null;
}

/**
 * Data di calendario ESISTENTE: rifiuta il 31/02 e i mesi fuori scala, proprio
 * come `make_date` nel blocco SQL (che su una data impossibile solleva).
 */
export function dataValida(anno: number, mese: number, giorno: number): boolean {
  if (!Number.isInteger(anno) || anno < 1900 || anno > 2200) return false;
  if (!Number.isInteger(mese) || mese < 1 || mese > 12) return false;
  if (!Number.isInteger(giorno) || giorno < 1 || giorno > 31) return false;
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  return (
    d.getUTCFullYear() === anno && d.getUTCMonth() === mese - 1 && d.getUTCDate() === giorno
  );
}

/** `2026-09-30` da anno, mese, giorno (già validati). */
export function isoDa(anno: number, mese: number, giorno: number): string {
  const due = (n: number) => String(n).padStart(2, '0');
  return `${anno}-${due(mese)}-${due(giorno)}`;
}

/**
 * Normalizza una scadenza della colonna legacy in ISO `YYYY-MM-DD`, oppure
 * `null` se la forma non è riconoscibile (la riga resta intatta, come nel SQL).
 */
export function normalizzaScadenza(valore?: string | null): string | null {
  const testo = (valore ?? '').trim();
  if (!testo) return null;

  // 1) già ISO: il cast è STRETTO (una data impossibile non passa).
  const iso = testo.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const anno = Number(iso[1]);
    const mese = Number(iso[2]);
    const giorno = Number(iso[3]);
    return dataValida(anno, mese, giorno) ? testo : null;
  }

  // 2) anno-troncato dello storico: '26-09-30' = 2026-09-30.
  const breve = testo.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (breve) {
    const anno = 2000 + Number(breve[1]);
    const mese = Number(breve[2]);
    const giorno = Number(breve[3]);
    return dataValida(anno, mese, giorno) ? isoDa(anno, mese, giorno) : null;
  }

  // 3) giorno-prima: 30/09/2026, 24/9/2026, 21-09-2026, 30.09.2026.
  const esteso = testo.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (esteso) {
    const giorno = Number(esteso[1]);
    const mese = Number(esteso[2]);
    const anno = Number(esteso[3]);
    return dataValida(anno, mese, giorno) ? isoDa(anno, mese, giorno) : null;
  }

  return null;
}

/** Raggruppa le righe da riparare per valore ISO: un UPDATE per DATA. */
export interface Piano {
  /** iso => id delle righe con la canonica NULLA: da riempire (e normalizzare). */
  daRiempire: Map<string, string[]>;
  /** iso => id delle righe con la canonica già piena: solo il testo legacy. */
  daNormalizzare: Map<string, string[]>;
  /** Valori che non si sanno leggere: restano intatti (mai una data indovinata). */
  scartate: string[];
}

/**
 * Costruisce il piano di riparazione. Una riga già a posto (ISO in entrambe le
 * colonne) NON entra nel piano: nessuna scrittura inutile.
 */
export function costruisciPiano(righe: readonly RigaScadenza[]): Piano {
  const piano: Piano = { daRiempire: new Map(), daNormalizzare: new Map(), scartate: [] };

  for (const riga of righe) {
    const iso = normalizzaScadenza(riga.deadline);
    if (!iso) {
      piano.scartate.push(`${riga.id} = "${String(riga.deadline)}"`);
      continue;
    }
    const giaPiena = Boolean(riga.expiration_date);
    if (giaPiena && riga.deadline === iso) continue;

    const mappa = giaPiena ? piano.daNormalizzare : piano.daRiempire;
    const lista = mappa.get(iso) ?? [];
    lista.push(riga.id);
    mappa.set(iso, lista);
  }

  return piano;
}

/** Spezza un elenco di id in lotti (URL di query corte e prevedibili). */
export function aLotti(ids: readonly string[], perLotto: number): string[][] {
  const lotti: string[][] = [];
  for (let i = 0; i < ids.length; i += perLotto) lotti.push(ids.slice(i, i + perLotto));
  return lotti;
}

/** Quante righe tocca un piano (riempimenti + normalizzazioni). */
export function righeDelPiano(piano: Piano): { daRiempire: number; daNormalizzare: number } {
  const somma = (m: Map<string, string[]>) => [...m.values()].reduce((n, l) => n + l.length, 0);
  return { daRiempire: somma(piano.daRiempire), daNormalizzare: somma(piano.daNormalizzare) };
}

