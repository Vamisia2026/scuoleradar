/**
 * ScuoleRadar.it — L'OROLOGIO DEL RADAR: quando lavora e quando riposa (§26.151).
 *
 * Il radar non gira più ventiquattro ore su ventiquattro: il ciclo della coda
 * (`coda-scansione.yml`) parte **dal lunedì al venerdì, dalle 08:00 alle 17:00**
 * (ora italiana), cioè quando gli uffici scolastici pubblicano. Fuori da quella
 * finestra non c'è nessun guasto da dichiarare: c'è un orario di lavoro.
 *
 * PERCHÉ UN MODULO A PARTE. Fino a §26.150 la telemetria conosceva una sola
 * domanda — «quanto è vecchio l'ultimo giro?» — e rispondeva sempre con la stessa
 * frase. Con la finestra le domande diventano due, e sono di natura diversa:
 *
 *   1. **che ora è, in Italia?** — non l'ora del browser (un insegnante in
 *      vacanza a Londra deve leggere lo stesso stato di chi è ad Asti);
 *   2. **quando riparte?** — «domattina alle 08:00» oppure «lunedì mattina»,
 *      perché venerdì sera il prossimo giro non è domani.
 *
 * L'orologio vive qui, in funzioni PURE: l'istante arriva come argomento, quindi
 * la guardia `npm run test:telemetria-scansione` misura le frasi su un calendario
 * fermo (venerdì 6 novembre 2026) e non sul giorno in cui gira la CI.
 *
 * LE COSTANTI SONO UN CONTRATTO COL WORKFLOW. `ORA_APERTURA` · `ORA_CHIUSURA` ·
 * `GIORNI_APERTURA` devono restare uguali al cron e al passo di controllo di
 * `.github/workflows/coda-scansione.yml`: se il worker cambia orario e queste tre
 * righe no, il banner direbbe «standby» sopra un radar che sta lavorando. La
 * guardia confronta i due file proprio per questo.
 *
 * FUSO. `Intl.DateTimeFormat` con `timeZone: 'Europe/Rome'` esplicito (l'unico
 * modo corretto di gestire l'ora legale: +1 d'inverno, +2 d'estate). Nessun
 * `NumberFormat`: i numeri si formattano a mano (`telemetriaScansioneCopy`), qui
 * serve solo il calendario.
 */

/** Fuso di riferimento del prodotto: l'ora italiana, sempre. */
export const FUSO_ITALIA = 'Europe/Rome';

/** Ora (0-23, italiana) in cui il radar comincia a controllare. */
export const ORA_APERTURA = 8;

/** Ora (0-23, italiana) in cui il radar smette: le 17:00 non fanno parte della finestra. */
export const ORA_CHIUSURA = 17;

/** Giorni aperti (1 = lunedì … 7 = domenica): solo i feriali. */
export const GIORNI_APERTURA: readonly number[] = [1, 2, 3, 4, 5];

/** Titolo del banner quando la finestra è chiusa (l'orario spiega il silenzio). */
export const TITOLO_STANDBY = 'Radar in standby festivo/notturno';

/** Formattatore unico (creato una volta: `formatToParts` a ogni lettura). */
const FORMATO = new Intl.DateTimeFormat('en-GB', {
  timeZone: FUSO_ITALIA,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
});

/** Nome inglese breve del giorno → numero italiano della settimana (lunedì = 1). */
const GIORNO_SETTIMANA: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** Data e ora italiane di un istante, tutte come numeri (nessuna stringa da interpretare). */
export interface OraItaliana {
  /** Giorno della settimana: 1 = lunedì … 7 = domenica. */
  giorno: number;
  anno: number;
  mese: number;
  data: number;
  ore: number;
  minuti: number;
  /** «14:06» — l'ora esatta già scritta. */
  testo: string;
}

/** Istante valido oppure `null`: una data illeggibile non manda in crash il banner. */
function istante(valore: Date | string | null | undefined): Date | null {
  if (valore instanceof Date) return Number.isNaN(valore.getTime()) ? null : valore;
  if (typeof valore !== 'string' || !valore) return null;
  const d = new Date(valore);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parti del formattatore, per nome (`year`, `month`, `hour`, `weekday`, …). */
function parti(d: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of FORMATO.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/**
 * Che ora è in Italia in un dato istante.
 *
 * Con un istante illeggibile si risponde con l'epoch (giovedì 1º gennaio 1970,
 * 01:00 italiane): una finestra CHIUSA, quindi «standby». È il ripiego più
 * onesto — dichiarare «in diretta» su un orologio rotto sarebbe l'unico errore
 * che questo modulo non deve poter fare.
 */
export function oraItaliana(adesso: Date = new Date()): OraItaliana {
  const d = istante(adesso) ?? new Date(0);
  const p = parti(d);
  return {
    giorno: GIORNO_SETTIMANA[p.weekday ?? ''] ?? 1,
    anno: Number(p.year),
    mese: Number(p.month),
    data: Number(p.day),
    ore: Number(p.hour),
    minuti: Number(p.minute),
    testo: `${p.hour}:${p.minute}`,
  };
}

/** La data italiana in forma confrontabile: «2026-11-06». */
export function giornoLocale(valore: Date | string | null | undefined): string | null {
  const d = istante(valore);
  if (!d) return null;
  const o = oraItaliana(d);
  const due = (n: number): string => String(n).padStart(2, '0');
  return `${o.anno}-${due(o.mese)}-${due(o.data)}`;
}

/** L'ora esatta italiana di un istante («14:06»), `null` se la data non si legge. */
export function oraEsatta(iso: string | null | undefined): string | null {
  const d = istante(iso);
  return d ? oraItaliana(d).testo : null;
}

/**
 * True se il radar sta lavorando: giorno feriale e ora dentro la finestra.
 * Le 17:00 in punto sono già chiuse (il ciclo delle 16:17 è l'ultimo della giornata).
 */
export function finestraAperta(adesso: Date = new Date()): boolean {
  const o = oraItaliana(adesso);
  return GIORNI_APERTURA.includes(o.giorno) && o.ore >= ORA_APERTURA && o.ore < ORA_CHIUSURA;
}

/** «08:00» — l'ora di apertura già scritta. */
const oraApertura = (): string => `${String(ORA_APERTURA).padStart(2, '0')}:00`;

/** Primo giorno feriale DOPO quello indicato (7 = domenica → 1 = lunedì). */
function prossimoFeriale(giorno: number): number {
  for (let salto = 1; salto <= 7; salto += 1) {
    const g = ((giorno - 1 + salto) % 7) + 1;
    if (GIORNI_APERTURA.includes(g)) return g;
  }
  return 1;
}

/**
 * QUANDO RIPARTE, in parole: «stamattina alle 08:00» (prima dell'apertura),
 * «domattina alle 08:00» (dopo la chiusura di un giorno feriale) oppure
 * «lunedì mattina alle 08:00» (venerdì sera, sabato e domenica).
 *
 * Il venerdì è il caso che rende necessaria questa funzione: dire «domattina»
 * sarebbe falso, perché di sabato il radar non lavora.
 */
export function fraseRipresa(adesso: Date = new Date()): string {
  const o = oraItaliana(adesso);
  if (o.ore < ORA_APERTURA && GIORNI_APERTURA.includes(o.giorno)) {
    return `stamattina alle ${oraApertura()}`;
  }
  return prossimoFeriale(o.giorno) === 1
    ? `lunedì mattina alle ${oraApertura()}`
    : `domattina alle ${oraApertura()}`;
}

/**
 * LA FRASE DELLO STANDBY: «Prossima scansione automatica domattina alle 08:00.»
 * `null` quando la finestra è aperta (in quel momento non c'è niente da annunciare).
 */
export function fraseStandby(adesso: Date = new Date()): string | null {
  if (finestraAperta(adesso)) return null;
  return `Prossima scansione automatica ${fraseRipresa(adesso)}.`;
}

/**
 * L'istante dell'ultimo controllo in parole: «oggi alle 14:06» oppure «ieri alle
 * 18:40» — le due forme in cui un orologio si legge davvero. Oltre il giorno
 * precedente si risponde `null` e il chiamante resta sulle ORE («30 ore fa»),
 * perché «due giorni fa» è l'unità di misura di un referto, non di un radar
 * (§26.150).
 */
export function quandoEsatto(
  iso: string | null | undefined,
  adesso: Date = new Date(),
): string | null {
  const d = istante(iso);
  if (!d) return null;
  const giorno = giornoLocale(d);
  const oggi = giornoLocale(adesso);
  if (!giorno || !oggi) return null;
  const ora = oraItaliana(d).testo;
  if (giorno === oggi) return `oggi alle ${ora}`;
  const ieri = giornoLocale(new Date((istante(adesso)?.getTime() ?? 0) - 86_400_000));
  if (giorno === ieri) return `ieri alle ${ora}`;
  return null;
}
