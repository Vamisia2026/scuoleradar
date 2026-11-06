/**
 * ScuoleRadar.it — LA DISTANZA DAL PROFILO (modulo PURO, direttiva 05/11/2026, §26.145).
 *
 * PERCHÉ ESISTE. La cascata generosa (§26.144) ha aperto la bacheca a tutto ciò che è
 * geograficamente pertinente, e ha lasciato al VOTO il compito di dire quanto una riga
 * somigli al profilo. Il risultato, misurato il 05/11/2026 su un profilo Lingue +
 * secondaria di II grado: «Sostegno infanzia» entrava al 88-93% perché il motore — che
 * misura ordine, classe e provincia come MODALI in media ponderata — non ha nessuna
 * parola per dire «questo non c'entra». Per un docente che non ha mai chiesto il
 * sostegno né l'infanzia quel numero è un falso positivo, non un suggerimento.
 *
 * Qui vivono le tre correzioni, e sono MOLTIPLICATIVE: una penalità non si compensa con
 * un'altra modale alta, perché non è una preferenza — è una distanza.
 *
 *   1. **ORDINE DI SCUOLA** — la distanza si misura sulla sequenza vera
 *      (`SEQUENZA_ORDINI`, `lib/punteggioOrdine`), un gradino per volta:
 *          stesso ordine            →  nessuna penalità
 *          1 gradino (Superiori→Medie, Medie→Primaria)  →  −25%
 *          2 gradini (Superiori→Primaria)               →  −55%
 *          3 gradini (Superiori→Infanzia)               →  SBARRAMENTO: la riga non entra
 *      La scala è SIMMETRICA (una maestra dell'infanzia che riceve le superiori sbarra
 *      le superiori) e non si applica a ciò che è fuori sequenza (ATA, CPIA, serali,
 *      PON) né quando l'ordine non è dichiarato: un dato assente non è un giudizio (mai
 *      un falso negativo per un'informazione che la fonte non pubblica).
 *
 *   2. **TIPOLOGIA DEL POSTO** — un avviso di SOSTEGNO proposto a chi cerca una
 *      MATERIA (nessuna classe `AD…` fra le proprie, `profiloAderisceSostegno`) paga
 *      una penalità secca del −40%: l'area sostegno resta un'opportunità (§26.45), ma
 *      non è la cattedra che l'utente sta cercando.
 *
 *   3. **BONUS DI PROSSIMITÀ** — se l'avviso è nella provincia PRINCIPALE del Radar
 *      (`provinciaPrincipale`, la prima scelta dell'utente) vale +18% di prossimità.
 *      Il bonus si applica PRIMA delle penalità, così non resuscita una riga che il
 *      profilo non copre: è un criterio d'ordine, non un salvacondotto. E vale SOLO sotto
 *      `SOGLIA_BONUS_PROVINCIA` (70): sopra, il match è già deciso dal merito e 18 punti
 *      regalati appiattirebbero 82 e 90 sullo stesso 100.
 *
 *   4. **CATEGORIE DI EMERGENZA** — ATA, CPIA, serali e PON non scelti dall'utente pagano
 *      −40% (`lib/sbarramentoOrdine`): tollerati dentro il perimetro, ma in fondo alla
 *      bacheca, perché sono il ripiego di sopravvivenza e non il mestiere. Il bonus di
 *      provincia li rende «un po' meno ripiego» dove costa meno spostarsi, non li salva.
 *
 * Risultato sotto `SOGLIA_FONDO_CONVENTO` (20) = «Fondo Convento / Ripiego»: la riga
 * resta in bacheca — è nella zona dell'utente — ma in coda e dichiarata (`stileMatch`).
 * Fanno eccezione le righe SBARRATE (terzo gradino di ordine, `escluso`): quelle non
 * restano affatto, perché non sono un voto basso ma un altro mestiere (§26.148).
 *
 * Modulo PURO: nessuna rete, nessun `node:*`, orologio mai letto.
 * Guardia: `npm run test:distanza` (incluso in `npm test`).
 */
import type { OrdineScuola } from '../data/ordiniMaterie';
import { ETICHETTA_FONDO_CONVENTO, SOGLIA_FONDO_CONVENTO } from './compatibilita';
import {
  avvisoDiSostegno,
  ordineAvviso,
  profiloAderisceSostegno,
  type AvvisoCompatibilita,
  type ProfiloCompatibilita,
} from './matchingEngine';
import { normalizzaProvincia } from './prossimitaGeografica';
import { distanzaOrdini, etichettaOrdine } from './punteggioOrdine';
import { provinciaPrincipale } from './provinceRadar';
import { penalitaEmergenza, sbarramentoOrdine } from './sbarramentoOrdine';

/** Il voto pieno: il tetto che nessuna penalità e nessun bonus possono superare. */
export const PUNTEGGIO_TETTO = 100;
/** Il minimo di una riga ammessa: sotto non c'è un voto, c'è un errore. */
export const PUNTEGGIO_MINIMO = 1;

/**
 * PENALITÀ per GRADO DI DISTANZA fra l'ordine chiesto e quello dell'avviso:
 * l'indice è il numero di gradini (`distanzaOrdini`), il valore i punti percentuali
 * tolti. La direttiva del 05/11/2026 fissa Medie −25, Primarie −55 per chi cerca le
 * superiori: sono i gradini 1 e 2 di questa scala. Il gradino 3 non è uno sconto ma
 * uno SBARRAMENTO (`DISTANZA_SBARRAMENTO`, §26.148): −100% = «non c'è un voto», e la
 * riga esce dalla bacheca invece di finire in coda con l'1% addosso.
 */
export const PENALITA_PER_GRADO_ORDINE: readonly number[] = [0, 25, 55, 100];
/** Penalità secca del posto di SOSTEGNO per chi cerca una materia. */
export const PENALITA_POSTO_SOSTEGNO = 40;
/** Bonus della provincia PRINCIPALE del Radar (la prima scelta dell'utente). */
export const BONUS_PROVINCIA_PRINCIPALE = 18;
/**
 * SOGLIA DEL BONUS DI PROSSIMITÀ — sotto questo voto il bonus vale, da qui in su NO.
 * Perché: fra 70 e 100 il match è già misurato dal merito (classe, grado affine) e
 * regalare 18 punti appiattirebbe 82 e 90 sullo stesso 100, cancellando la differenza
 * fra «classe agganciata» e «stessa area». Il bonus è un criterio per le righe di
 * RISERVA (50-60: sostegno d'altro ordine, ATA, classe ignota), dove la vicinanza è
 * l'unica cosa che può far preferire una riga all'altra.
 */
export const SOGLIA_BONUS_PROVINCIA = 70;

/**
 * Un aggiustamento del voto: `punti` è NEGATIVO per le penalità e POSITIVO per il
 * bonus, sempre in punti percentuali. `motivo` è la frase già pronta per il tooltip
 * (`''` = niente da dichiarare).
 */
export interface Aggiustamento {
  punti: number;
  motivo: string;
}

/** Aggiustamento nullo: nessuna distanza da dichiarare. */
const NESSUNO: Aggiustamento = { punti: 0, motivo: '' };

/**
 * PENALITÀ DI ORDINE DI SCUOLA (§26.145) — la distanza fra l'ordine chiesto e quello
 * che l'avviso dichiara, misurata sulla sequenza scolastica. Dal terzo gradino il valore è
 * −100%: non è uno sconto, è lo SBARRAMENTO di `lib/sbarramentoOrdine` (§26.148) — il
 * consumatore vero è `applicaDistanza`, che esce prima ancora di scontare.
 *
 * Non si applica quando il dato manca (profilo senza ordini, avviso che non lo dice)
 * o quando l'ordine è fuori sequenza: in quei casi la scala non esiste e la riga non
 * paga una distanza inventata.
 */
export function penalitaOrdineDiScuola(
  profilo: Pick<ProfiloCompatibilita, 'ordini'>,
  avviso: AvvisoCompatibilita,
): Aggiustamento {
  const chiesti = (profilo.ordini ?? []).filter(Boolean);
  if (chiesti.length === 0) return NESSUNO;
  const ordine = ordineAvviso(avviso);
  if (!ordine) return NESSUNO;
  const distanze = chiesti.map((o) => distanzaOrdini(o, ordine)).filter((d) => d >= 0);
  if (distanze.length === 0) return NESSUNO;
  // Con più ordini scelti vale il più VICINO: chi ha scelto anche la primaria non paga
  // una distanza che il suo profilo copre.
  const distanza = Math.min(...distanze);
  if (distanza === 0) return NESSUNO;
  const gradi = Math.min(distanza, PENALITA_PER_GRADO_ORDINE.length - 1);
  const punti = PENALITA_PER_GRADO_ORDINE[gradi];
  const riferimento = chiesti.find((o) => distanzaOrdini(o, ordine) === distanza) ?? chiesti[0];
  return {
    punti: -punti,
    motivo:
      `ordine di scuola distante (${etichettaOrdine(riferimento as OrdineScuola)} → ` +
      `${etichettaOrdine(ordine)}): −${punti}%`,
  };
}

/**
 * PENALITÀ DI TIPOLOGIA DEL POSTO (§26.145) — il SOSTEGNO proposto a chi cerca una
 * materia. Un profilo con una classe `AD…` propria non paga nulla: per lui il sostegno
 * È la cattedra (e la classe esatta resta un match pieno).
 */
export function penalitaPostoSostegno(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): Aggiustamento {
  if (profiloAderisceSostegno(profilo)) return NESSUNO;
  if (!avvisoDiSostegno(avviso)) return NESSUNO;
  return {
    punti: -PENALITA_POSTO_SOSTEGNO,
    motivo: `posto di sostegno fuori dalle tue classi: −${PENALITA_POSTO_SOSTEGNO}%`,
  };
}

/**
 * BONUS DI PROSSIMITÀ (§26.145) — l'avviso è nella provincia PRINCIPALE del Radar.
 * La principale è la prima della selezione (`provinciaPrincipale`): il confronto è
 * normalizzato (AT ≡ at), così un formato diverso non spegne il bonus.
 *
 * `base` è il voto di partenza: da `SOGLIA_BONUS_PROVINCIA` in su il bonus non si applica.
 */
export function bonusProssimita(
  profilo: Pick<ProfiloCompatibilita, 'province'>,
  avviso: AvvisoCompatibilita,
  base: number,
): Aggiustamento {
  if (base >= SOGLIA_BONUS_PROVINCIA) return NESSUNO;
  const principale = normalizzaProvincia(provinciaPrincipale(profilo.province ?? []) ?? '');
  const provincia = normalizzaProvincia(avviso.province ?? '');
  if (!principale || !provincia || principale !== provincia) return NESSUNO;
  return {
    punti: BONUS_PROVINCIA_PRINCIPALE,
    motivo: `provincia principale (${principale}): +${BONUS_PROVINCIA_PRINCIPALE}% di prossimità`,
  };
}

/** Esito della distanza: il voto aggiustato e TUTTO ciò che lo ha aggiustato. */
export interface EsitoDistanza {
  /** Voto finale (1-100), oppure il `base` intatto se non c'era nulla da aggiustare. */
  punteggio: number;
  /** Punti percentuali TOLTI dalle penalità (0 = nessuna). */
  penalita: number;
  /** Punti percentuali AGGIUNTI dal bonus (0 = nessuno). */
  bonus: number;
  /** true = il voto è sotto `SOGLIA_FONDO_CONVENTO`: riga di fondo, non un match. */
  fondo: boolean;
  /**
   * §26.148 — true = SBARRATA: l'ordine è al terzo gradino, la riga non si mostra affatto.
   * `punteggio` vale allora 0 e `penalita` 100: non è un numero da leggere, è un'assenza.
   */
  escluso: boolean;
  /** Frasi per il tooltip, già unite (`''` = niente da dichiarare). */
  motivo: string;
}

/**
 * Applica la DISTANZA DAL PROFILO a un voto della cascata (§26.145 · §26.148).
 *
 * Prima lo SBARRAMENTO — che non è un numero: al terzo gradino di ordine la riga esce e non
 * c'è voto da calcolare — poi il BONUS di prossimità, poi le PENALITÀ in SUCCESSIONE
 * MOLTIPLICATIVA (mai sommate: due distanze insieme pesano più di una sola). Così il caso
 * «sostegno infanzia per chi cerca Lingue alle superiori» non è un 9% in fondo alla pagina:
 * è una riga che non c'è. Quello che resta: sostegno alle medie → 58 → +18 = 76 → −40% posto
 * = 46 → −25% ordine = 34. Il bonus è un criterio d'ordine, non un salvacondotto (non vale
 * sopra `SOGLIA_BONUS_PROVINCIA`), e un voto `0` (fascia `incompatibile`/`motore`) non si
 * tocca: non c'è nulla da aggiustare, e un `1` inventerebbe un match che non esiste.
 */
export function applicaDistanza(
  base: number,
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): EsitoDistanza {
  const stop = sbarramentoOrdine(profilo, avviso);
  if (stop.escluso) {
    return { punteggio: 0, penalita: 100, bonus: 0, fondo: false, escluso: true, motivo: stop.motivo };
  }
  const intatto: EsitoDistanza = {
    punteggio: base, penalita: 0, bonus: 0, fondo: false, escluso: false, motivo: '',
  };
  if (!(base > 0)) return intatto;
  const bonus = bonusProssimita(profilo, avviso, base);
  const ordine = penalitaOrdineDiScuola(profilo, avviso);
  const posto = penalitaPostoSostegno(profilo, avviso);
  const emergenza = penalitaEmergenza(profilo, avviso);
  const sconti = [ordine.punti, posto.punti, emergenza.punti];
  const conBonus = Math.min(PUNTEGGIO_TETTO, base + bonus.punti);
  const scontato = Math.round(sconti.reduce((acc, punti) => acc * (1 + punti / 100), conBonus));
  const punteggio = Math.max(PUNTEGGIO_MINIMO, Math.min(PUNTEGGIO_TETTO, scontato));
  const fondo = punteggio < SOGLIA_FONDO_CONVENTO;
  const motivi = [ordine.motivo, posto.motivo, emergenza.motivo, bonus.motivo].filter(Boolean);
  if (fondo) motivi.push(`${ETICHETTA_FONDO_CONVENTO}: fuori dal profilo (${punteggio}%)`);
  return {
    punteggio,
    penalita: -sconti.reduce((acc, punti) => acc + punti, 0),
    bonus: bonus.punti,
    fondo,
    escluso: false,
    motivo: motivi.join(' · '),
  };
}
