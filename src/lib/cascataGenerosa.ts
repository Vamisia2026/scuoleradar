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
 * §26.145 — LA DISTANZA DAL PROFILO. La fascia dice PERCHÉ la riga entra; il voto dice QUANTO
 * somiglia al profilo, e da qui in poi lo dice davvero: `lib/distanzaProfilo` toglie −25% e −55%
 * per l'ordine di scuola lontano, −40% per un posto di sostegno fuori dalle proprie classi e
 * −40% alle categorie d'emergenza (ATA, CPIA, serali, PON) non scelte, aggiunge +18% nella
 * provincia principale e dichiara «Fondo Convento / Ripiego» ciò che finisce sotto 20. Con una
 * penalità il voto diventa un TETTO (`tetto`): il `max(voto del motore, pavimento)` di
 * `bachecaInterpelli` non può più rialzarlo. §26.148 — al TERZO gradino di ordine non c'è voto:
 * la voce esce con `escluso` e la bacheca non la mostra (infanzia per chi cerca le superiori).
 *
 * Modulo PURO: nessuna rete, nessun `node:*`. Guardia: `npm run test:cascata` (in `npm test`).
 */
import type { OrdineScuola } from '../data/ordiniMaterie';
import { applicaDistanza } from './distanzaProfilo';
import { eAvvisoAta, gradoAffine } from './gradiAffini';
import {
  avvisoDiSostegno,
  normalizzaClassi,
  ordineAvviso,
  type AvvisoCompatibilita,
  type ProfiloCompatibilita,
} from './matchingEngine';
import { incompatibilitaSemantica, ponteTolleranza } from './ponteDisciplinare';
import {
  PENALITA_CLASSE_STESSA_AREA,
  PUNTEGGIO_CLASSE_ESATTA,
  etichettaClasse,
  punteggioClasse,
} from './punteggioClasse';
import { alternativaReligione, type StatoProvinciaScala } from './scalaParacadute';

/**
 * Il PONTE DISCIPLINARE vive in `lib/ponteDisciplinare` dallo 05/11/2026 (la cascata era al
 * tetto delle 250 righe): qui resta il contratto pubblico, così chi legge la cascata trova le
 * due funzioni dove le ha sempre trovate.
 */
export { incompatibilitaSemantica, ponteTolleranza };

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
  /** §26.145 — punti percentuali tolti dalla DISTANZA DAL PROFILO (0 = nessuna). */
  penalita: number;
  /** §26.145 — punti percentuali aggiunti dal BONUS di provincia principale (0 = nessuno). */
  bonus: number;
  /** §26.145 — true = voto sotto la soglia del fondo: la card la dichiara «Fondo Convento». */
  fondo: boolean;
  /**
   * §26.148 — true = SBARRATA: l'ordine è al terzo gradino (infanzia ↔ superiori) e la riga
   * non entra in bacheca. Non è un voto basso: è un altro mestiere, e `punteggio` vale 0.
   */
  escluso: boolean;
  /**
   * §26.145 — true = una penalità ha già abbassato il voto: è un TETTO, il motore non
   * può rialzarlo (`bachecaInterpelli`). Senza questo flag la correzione sarebbe aggirata
   * dal `max(voto del motore, pavimento)` che tiene alti i match veri.
   */
  tetto: boolean;
}
/** True se l'avviso cade nella provincia dell'utente (o il profilo non ne dichiara). */
function inProvincia(provincia: StatoProvinciaScala): boolean {
  return provincia === 'propria' || provincia === 'non-applicabile';
}

/**
 * §26.145 — VESTE una voce della cascata con la DISTANZA DAL PROFILO: bonus di prossimità,
 * penalità di ordine di scuola e di posto di sostegno, soglia del fondo. Un solo punto di
 * passaggio: nessuna uscita della cascata può «scordarsi» la correzione, e la fascia (il
 * PERCHÉ la riga entra) resta distinta dal voto (QUANTO somiglia al profilo).
 */
function voce(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
  fascia: FasciaCascata,
  canale: CanaleCascata,
  punteggio: number,
  etichetta: string,
): VoceCascata {
  const distanza = applicaDistanza(punteggio, profilo, avviso);
  return {
    fascia,
    canale,
    punteggio: distanza.punteggio,
    penalita: distanza.penalita,
    bonus: distanza.bonus,
    fondo: distanza.fondo,
    escluso: distanza.escluso,
    // §26.148 — una riga SBARRATA non è un tetto: non c'è voto da difendere, la riga esce.
    tetto: !distanza.escluso && distanza.penalita > 0,
    etichetta: [etichetta, distanza.motivo].filter(Boolean).join(' · '),
  };
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

/**
 * LA CASCATA: la fascia con cui un avviso GEOGRAFICAMENTE PERTINENTE entra in bacheca.
 *
 * `provincia` arriva già decisa dal perimetro (`lib/scalaParacadute`): qui non si esclude
 * nessuno per geografia. Due soli esiti negativi, tutti dichiarati: `incompatibile` (un'assenza
 * di ponte, §26.144) e `escluso` (il terzo gradino di ordine, §26.148). Ordine dei giudizi (uno
 * solo, nessuna eccezione nascosta):
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
    const etichetta = `classe di concorso: ${etichettaClasse(esatta)}`;
    return voce(profilo, avviso, 'merito', 'classe', PUNTEGGIO_CLASSE_ESATTA, etichetta);
  }

  // 1) SOSTEGNO · ALTERNATIVA ALLA RELIGIONE · ATA — d'ufficio, senza classe.
  const ata = eAvvisoAta(avviso);
  if (ata || avvisoDiSostegno(avviso) || alternativaReligione(avviso)) {
    const canale: CanaleCascata = ata ? 'ata' : 'sostegno';
    const nome = ata ? 'bando per il personale ATA' : 'sostegno / alternativa alla Religione';
    const proprio = inProvincia(provincia);
    if (ordineScelto(profilo, avviso)) {
      const punteggio = proprio ? PUNTEGGIO_MERITO_SOSTEGNO : PUNTEGGIO_MERITO_SOSTEGNO_VICINO;
      return voce(profilo, avviso, 'merito', canale, punteggio, `${nome}: ordine di scuola che hai scelto`);
    }
    const riserva = ata
      ? proprio ? PUNTEGGIO_RISERVA_ATA : PUNTEGGIO_RISERVA_ATA_VICINO
      : proprio ? PUNTEGGIO_RISERVA_SOSTEGNO : PUNTEGGIO_RISERVA_SOSTEGNO_VICINO;
    const etichetta = `${nome}: entra d'ufficio, fuori dall'ordine di scuola che hai scelto`;
    return voce(profilo, avviso, 'riserva', canale, riserva, etichetta);
  }

  // 2) PROFILO SENZA CLASSI — solo competenze e parole chiave: decide il motore.
  if (classiProfilo.length === 0) {
    return voce(profilo, avviso, 'motore', 'nessuno', 0, '');
  }

  // 3) CLASSE AGGANCIATA — esatta, affine, materia coperta o stessa area: è merito.
  const classe = punteggioClasse(profilo, avviso);
  if (classe !== null && classe.punteggio >= SOGLIA_MERITO_CLASSE) {
    return voce(profilo, avviso, 'merito', 'classe', classe.punteggio, classe.motivo);
  }

  // 4) GRADO AFFINE — la materia o l'area si toccano e l'ordine di scuola è vicino.
  const grado = gradoAffine(profilo, avviso);
  if (grado) {
    return voce(profilo, avviso, 'tolleranza', 'affine', grado.punteggio, grado.etichetta);
  }

  // 5) PONTE DISCIPLINARE — la stessa area, anche senza un ordine di scuola vicino.
  const ponte = ponteTolleranza(profilo, avviso);
  if (ponte) {
    return voce(profilo, avviso, 'tolleranza', 'affine', ponte.punteggio, ponte.etichetta);
  }

  // 7) INCOMPATIBILITÀ EVIDENTE — due temi noti che non si toccano: l'unico scarto.
  if (incompatibilitaSemantica(profilo, avviso)) {
    return voce(profilo, avviso, 'incompatibile', 'nessuno', 0, '');
  }

  // 6) CLASSE NON RICONOSCIUTA — il catalogo non sa dire di che cosa parla: si tiene.
  const etichetta = 'classe non riconosciuta: entra d’ufficio, da verificare';
  return voce(profilo, avviso, 'riserva', 'classe', PUNTEGGIO_RISERVA_CLASSE_IGNOTA, etichetta);
}
