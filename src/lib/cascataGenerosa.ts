/**
 * ScuoleRadar.it — CASCATA GENEROSA (modulo PURO, direttiva 04/11/2026, §26.144).
 *
 * Da «GATEKEEPER» a «BUTTADENTRO». Fino al 03/11/2026 la bacheca decideva l'INGRESSO con una
 * catena di porte (classe esatta o vicina, conferma del motore, grado affine, serbatoio): una
 * riga che non passava una porta non entrava, e due terzi del database non arrivava mai a un
 * profilo. Oggi l'UNICO sbarramento rigido è la GEOGRAFIA (province scelte + raggio dei 60 km,
 * `lib/scalaParacadute`); tutto il resto è la FASCIA con cui una riga entra:
 *
 *   1. `merito`        — sostegno/alternativa/ATA nell'ordine scelto (90 propria · 86 vicina)
 *                        oppure classe agganciata ≥ 85 (esatta, affine, materia, stessa area);
 *   2. `tolleranza`    — grado affine 82 · 76 · 72 · 70 anche senza un ordine vicino: Inglese ↔
 *                        Lingue straniere, Matematica ↔ Fisica, Informatica ↔ laboratori;
 *   3. `riserva`       — sostegno/ATA di un ALTRO ordine (58 · 56, ATA 52 · 50) e classe che il
 *                        catalogo non riconosce (60): entrano d'ufficio, la classe non decide;
 *   4. `incompatibile` — l'unico scarto di MERITO: due temi riconosciuti che non si toccano
 *                        (Musica vs Spagnolo). Non è un punteggio basso: è un'assenza di ponte;
 *   5. `motore`        — profilo senza classi (solo competenze): decide la porta del motore.
 *
 * Il voto della card è `max(voto del motore, pavimento della cascata)`: un match già misurato non
 * si abbassa, si rialza solo ciò che il motore non sapeva leggere. La forbice visibile resta
 * 50-100, con la pillola azzurrino soft di `lib/compatibilita`: nessun contrassegno rosso o di
 * scarto in bacheca.
 *
 * Modulo PURO: nessuna rete, nessun `node:*`. Guardia: `npm run test:cascata` (in `npm test`).
 */
import { classeByCodice } from '../data/classiConcorso';
import type { OrdineScuola } from '../data/ordiniMaterie';
import { areeDi, areeInComune, ponteTraAree } from './areeDisciplinari';
import {
  PUNTEGGIO_GRADO_AFFINE_AREA,
  PUNTEGGIO_GRADO_AFFINE_MATERIA,
  PUNTEGGIO_GRADO_AFFINE_PONTE,
  eAvvisoAta,
  gradoAffine,
} from './gradiAffini';
import {
  avvisoDiSostegno,
  normalizzaClassi,
  ordineAvviso,
  type AvvisoCompatibilita,
  type ProfiloCompatibilita,
} from './matchingEngine';
import {
  PENALITA_CLASSE_STESSA_AREA,
  PUNTEGGIO_CLASSE_ESATTA,
  etichettaClasse,
  punteggioClasse,
} from './punteggioClasse';
import { alternativaReligione, type StatoProvinciaScala } from './scalaParacadute';
/** Sostegno/alternativa nell'ordine scelto: 90 nella provincia, 86 entro il raggio. */
export const PUNTEGGIO_MERITO_SOSTEGNO = 90;
export const PUNTEGGIO_MERITO_SOSTEGNO_VICINO = 86;
/** Sostegno/alternativa di un ALTRO ordine: 58 nella provincia, 56 entro il raggio. */
export const PUNTEGGIO_RISERVA_SOSTEGNO = 58;
export const PUNTEGGIO_RISERVA_SOSTEGNO_VICINO = 56;
/** ATA di un altro ordine: 52 nella provincia, 50 entro il raggio. */
export const PUNTEGGIO_RISERVA_ATA = 52;
export const PUNTEGGIO_RISERVA_ATA_VICINO = 50;
/** Avviso con una classe che il catalogo non riconosce: entra, da verificare. */
export const PUNTEGGIO_RISERVA_CLASSE_IGNOTA = 60;
/** Soglia del match di classe «pieno»: da qui in su la riga è merito (85, §26.120). */
export const SOGLIA_MERITO_CLASSE = PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_STESSA_AREA;

/** Come la riga si è guadagnata la bacheca. */
export type FasciaCascata = 'merito' | 'tolleranza' | 'riserva' | 'incompatibile' | 'motore';
/** Canale che ha deciso la fascia (per conti, log e tooltip). */
export type CanaleCascata = 'sostegno' | 'ata' | 'classe' | 'affine' | 'nessuno';
/** Voce della cascata: fascia, canale, pavimento del punteggio e motivo leggibile. */
export interface VoceCascata {
  fascia: FasciaCascata;
  canale: CanaleCascata;
  punteggio: number;
  /** Motivo scritto nel tooltip della card (`''` = niente da dichiarare). */
  etichetta: string;
}
/** True se l'avviso cade nella provincia dell'utente (o il profilo non ne dichiara). */
function inProvincia(provincia: StatoProvinciaScala): boolean {
  return provincia === 'propria' || provincia === 'non-applicabile';
}

/** True se l'ordine dell'avviso è fra quelli SCELTI (profilo senza ordini = nessun vincolo). */
function ordineScelto(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): boolean {
  const ordini: readonly OrdineScuola[] = (profilo.ordini ?? []).filter(Boolean);
  if (ordini.length === 0) return true;
  const ordine = ordineAvviso(avviso);
  return ordine !== null && ordini.includes(ordine);
}

/** Denominazione + materie di una classe del catalogo (`[]` = codice sconosciuto). */
function materieDi(codice: string): string[] {
  const classe = classeByCodice(codice);
  return classe ? [classe.denominazione, ...classe.materie] : [];
}

/** Testo su cui si cercano i temi: titolo, materia e classi dell'avviso. */
function testoAvviso(avviso: AvvisoCompatibilita): string {
  const classi = (avviso.classi ?? []).flatMap((c) => {
    const proprie = materieDi(c);
    return proprie.length > 0 ? proprie : [c];
  });
  return [avviso.titolo, avviso.materia, ...classi].filter(Boolean).join(' ');
}

/** Testo delle PROPRIE classi (denominazioni + materie del catalogo). */
const testoClassi = (classi: readonly string[]): string => classi.flatMap(materieDi).join(' ');

/**
 * PONTE DISCIPLINARE senza il vincolo dell'ordine di scuola (`null` = nessun ponte): la stessa
 * scala del grado affine (82 area comune · 76 ponte affine · 72 contaminata) applicata anche
 * quando l'avviso non dichiara un ordine vicino. La semantica non si riscrive: si toglie un
 * requisito che non è merito.
 */
export function ponteTolleranza(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): { punteggio: number; etichetta: string } | null {
  const areeProfilo = areeDi(testoClassi(normalizzaClassi(profilo.classi)));
  const areeAvviso = areeDi(testoAvviso(avviso));
  const comuni = areeInComune(areeProfilo, areeAvviso);
  if (comuni.length > 0) {
    return {
      punteggio: PUNTEGGIO_GRADO_AFFINE_MATERIA,
      etichetta: `tolleranza ampia: stessa area disciplinare (${comuni.join(', ')})`,
    };
  }
  const ponte = ponteTraAree(areeProfilo, areeAvviso);
  if (!ponte) return null;
  return {
    punteggio: ponte.livello === 'affine' ? PUNTEGGIO_GRADO_AFFINE_PONTE : PUNTEGGIO_GRADO_AFFINE_AREA,
    etichetta: `tolleranza ampia: area ${ponte.livello} (${ponte.etichetta})`,
  };
}

/**
 * INCOMPATIBILITÀ SEMANTICA EVIDENTE — l'unica ragione di scarto di merito. Serve un tema
 * riconosciuto da ENTRAMBE le parti: se il catalogo non sa dire di che cosa parlano le classi
 * dell'avviso (o le proprie), non si giudica e la riga resta (buttadentro). Con due temi noti,
 * nessuna area in comune e nessun ponte, l'avviso parla d'altro: è il caso «Musica vs Spagnolo».
 */
export function incompatibilitaSemantica(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): boolean {
  const areeProfilo = areeDi(testoClassi(normalizzaClassi(profilo.classi)));
  const areeAvviso = areeDi(testoAvviso(avviso));
  if (areeProfilo.size === 0 || areeAvviso.size === 0) return false;
  return areeInComune(areeProfilo, areeAvviso).length === 0 && ponteTraAree(areeProfilo, areeAvviso) === null;
}

/**
 * LA CASCATA: la fascia con cui un avviso GEOGRAFICAMENTE PERTINENTE entra in bacheca.
 *
 * `provincia` arriva già decisa dal perimetro (`lib/scalaParacadute`): qui non si esclude
 * nessuno per geografia — l'unico esito negativo è `incompatibile`, cioè un'assenza di ponte
 * dichiarata. Ordine dei giudizi (uno solo, nessuna eccezione nascosta):
 *
 *   0. **classe ESATTA** — il match pieno vince su tutto: anche un profilo ATA col suo codice
 *      resta al 100, e un avviso di sostegno con una classe `AD…` propria è un match vero;
 *   1. **sostegno · alternativa alla Religione · ATA** — d'ufficio: ordine scelto → merito
 *      90/86, altro ordine → riserva 58/56 (ATA 52/50);
 *   2. **profilo senza classi** → `motore` (decide il jolly/le competenze, §26.63 · §26.64);
 *   3. **classe agganciata (≥ 85)** → merito; 4. **grado affine** → 82 · 76 · 72 · 70;
 *   5. **ponte disciplinare** → stessa scala senza il vincolo dell'ordine;
 *   6. **incompatibilità evidente** → l'unico «fuori»; 7. **classe ignota** → riserva 60.
 */
export function voceCascata(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
  provincia: StatoProvinciaScala,
): VoceCascata {
  const classiProfilo = normalizzaClassi(profilo.classi);
  const classiAvviso = normalizzaClassi(avviso.classi);
  // 0) CLASSE ESATTA — il match pieno vince su tutto: anche sul canale sostegno/ATA,
  // così chi ha una classe `AD…` propria (o un profilo ATA col suo codice) resta al 100.
  const esatta = classiAvviso.find((codice) => classiProfilo.includes(codice));
  if (esatta) {
    return {
      fascia: 'merito',
      canale: 'classe',
      punteggio: PUNTEGGIO_CLASSE_ESATTA,
      etichetta: `classe di concorso: ${etichettaClasse(esatta)}`,
    };
  }

  // 1) SOSTEGNO · ALTERNATIVA ALLA RELIGIONE · ATA — d'ufficio, senza classe.
  const ata = eAvvisoAta(avviso);
  if (ata || avvisoDiSostegno(avviso) || alternativaReligione(avviso)) {
    const canale: CanaleCascata = ata ? 'ata' : 'sostegno';
    const nome = ata ? 'bando per il personale ATA' : 'sostegno / alternativa alla Religione';
    const proprio = inProvincia(provincia);
    if (ordineScelto(profilo, avviso)) {
      return {
        fascia: 'merito',
        canale,
        punteggio: proprio ? PUNTEGGIO_MERITO_SOSTEGNO : PUNTEGGIO_MERITO_SOSTEGNO_VICINO,
        etichetta: `${nome}: ordine di scuola che hai scelto`,
      };
    }
    const riserva = ata
      ? proprio ? PUNTEGGIO_RISERVA_ATA : PUNTEGGIO_RISERVA_ATA_VICINO
      : proprio ? PUNTEGGIO_RISERVA_SOSTEGNO : PUNTEGGIO_RISERVA_SOSTEGNO_VICINO;
    return {
      fascia: 'riserva',
      canale,
      punteggio: riserva,
      etichetta: `${nome}: entra d'ufficio, fuori dall'ordine di scuola che hai scelto`,
    };
  }

  // 2) PROFILO SENZA CLASSI — solo competenze e parole chiave: decide il motore.
  if (classiProfilo.length === 0) {
    return { fascia: 'motore', canale: 'nessuno', punteggio: 0, etichetta: '' };
  }

  // 3) CLASSE AGGANCIATA — esatta, affine, materia coperta o stessa area: è merito.
  const classe = punteggioClasse(profilo, avviso);
  if (classe !== null && classe.punteggio >= SOGLIA_MERITO_CLASSE) {
    return { fascia: 'merito', canale: 'classe', punteggio: classe.punteggio, etichetta: classe.motivo };
  }

  // 4) GRADO AFFINE — la materia o l'area si toccano e l'ordine di scuola è vicino.
  const grado = gradoAffine(profilo, avviso);
  if (grado) {
    return { fascia: 'tolleranza', canale: 'affine', punteggio: grado.punteggio, etichetta: grado.etichetta };
  }

  // 5) PONTE DISCIPLINARE — la stessa area, anche senza un ordine di scuola vicino.
  const ponte = ponteTolleranza(profilo, avviso);
  if (ponte) {
    return { fascia: 'tolleranza', canale: 'affine', punteggio: ponte.punteggio, etichetta: ponte.etichetta };
  }

  // 7) INCOMPATIBILITÀ EVIDENTE — due temi noti che non si toccano: l'unico scarto.
  if (incompatibilitaSemantica(profilo, avviso)) {
    return { fascia: 'incompatibile', canale: 'nessuno', punteggio: 0, etichetta: '' };
  }

  // 6) CLASSE NON RICONOSCIUTA — il catalogo non sa dire di che cosa parla: si tiene.
  return {
    fascia: 'riserva',
    canale: 'classe',
    punteggio: PUNTEGGIO_RISERVA_CLASSE_IGNOTA,
    etichetta: 'classe non riconosciuta: entra d’ufficio, da verificare',
  };
}
