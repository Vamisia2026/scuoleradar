/**
 * ScuoleRadar.it — GRADI AFFINI E SERBATOIO DI DEFAULT (modulo PURO, §26.141).
 *
 * «Trovare è più importante che scartare» (direttiva 03/11/2026): le regole della
 * bacheca non cambiano, cambia ciò che NON si butta via. Due gradini DICHIARATI.
 *
 * ── 1. GRADO AFFINE (`gradoAffine`) — 82 · 76 · 72 · 70 ─────────────────────
 * Un titolo o un ordine AFFINE non è un match, ma non è nemmeno rumore: materia
 * coperta dalle proprie classi o stesse aree **82**; aree AFFINI (ponte curato) **76**;
 * aree contaminate **72**; avviso senza classe in un ordine pari o adiacente **70**.
 * Fuori restano i casi che restano fuori per una ragione: un'altra materia nello
 * stesso ordine (la «classe estranea» di §26.120), un ordine non adiacente, e il
 * sostegno/ATA che hanno il loro canale. Il grado NON esclude: alza solo il
 * PAVIMENTO del punteggio (chi sta sotto 70 finisce nella scorta, non fuori), e un
 * match già da 85 in su non viene declassato.
 *
 * ── 2. SERBATOIO DI DEFAULT (`voceSerbatoio`) — 58 · 52 ────────────────────
 * Personale ATA e sostegno di un ALTRO ordine, **nelle province scelte**: le
 * opportunità di paracadute che garantiscono una bacheca mai vuota. Non entrano mai
 * come merito — la bacheca le mette SOLO nella scorta e il paracadute «5»
 * (§26.106) le porta in vetrina, dichiarate `ripiego`. Non scavalcano il divieto di
 * §26.125 (sostegno fuori dalle province scelte) e non sostituiscono un match vero.
 *
 * ── 3. BACHECA SCARSA (`bachecaScarsa`) ───────────────────────────────────
 * Sotto `MINIMO_MATCH_PIENI` (3) opportunità di qualità la vetrina NON si gonfia: lo
 * dice all'utente con una frase rassicurante e una strada (allargare il profilo).
 *
 * Nessun database, nessuna rete: si prova senza browser.
 * Guardia: `npm run test:gradi-affini` (inclusa in `npm test`).
 */
import { classeByCodice } from '../data/classiConcorso';
import { areeDi, areeInComune, ponteTraAree } from './areeDisciplinari';
import { SOGLIA_COMPATIBILITA_ARANCIO } from './compatibilita';
import {
  avvisoDiSostegno,
  materiaCompatibileConClassi,
  normalizzaClassi,
  ordineAvviso,
  profiloAderisceSostegno,
  sostegnoPertinente,
  type AvvisoCompatibilita,
  type ProfiloCompatibilita,
} from './matchingEngine';
import { ordiniAdiacenti } from './punteggioOrdine';
import {
  PENALITA_CLASSE_STESSA_AREA,
  PUNTEGGIO_CLASSE_ESATTA,
  punteggioClasse,
} from './punteggioClasse';
import { dichiaraPersonaleAta, eCodiceAta } from './profiliAta';
import { punteggioProvincia } from './prossimitaGeografica';

/** Gradi affini: materia coperta dalle proprie classi (o aree che si toccano). */
export const PUNTEGGIO_GRADO_AFFINE_MATERIA = 82;
/** Gradi affini: aree disciplinari AFFINI (ponte curato, §`areeDisciplinari`). */
export const PUNTEGGIO_GRADO_AFFINE_PONTE = 76;
/** Gradi affini: aree contaminate (si toccano senza essere la stessa famiglia). */
export const PUNTEGGIO_GRADO_AFFINE_AREA = 72;
/** Gradi affini: nessuna classe nell'avviso, ordine di scuola vicino al proprio. */
export const PUNTEGGIO_GRADO_AFFINE_ORDINE = 70;
/** Serbatoio: sostegno di un altro ordine di scuola, nella propria provincia. */
export const PUNTEGGIO_SERBATOIO_SOSTEGNO = 58;
/** Serbatoio: personale ATA (collaboratori, assistenti, DSGA), nella propria provincia. */
export const PUNTEGGIO_SERBATOIO_ATA = 52;

/** Sotto questo numero di match «pieni» la vetrina si dichiara scarsa. */
export const MINIMO_MATCH_PIENI = 3;

/**
 * La frase della bacheca scarsa (copy ESATTO della direttiva 03/11/2026). Non promette
 * nulla e non si scusa: dice cosa c'è (le opportunità trovate oggi) e cosa si può fare
 * (allargare la ricerca). Il testo vive qui, non nel JSX, così la guardia lo legge.
 */
export const CONSIGLIO_BACHECA_SCARSA =
  'Le opportunità che abbiamo trovato per te oggi. Allarga la ricerca per intercettare più opportunità.';

/** Come si è guadagnata la riga il suo gradino. */
export type TipoGradoAffine = 'materia' | 'ponte' | 'ordine';

/** Esito del grado affine: punteggio del gradino + motivo leggibile. */
export interface GradoAffine {
  punteggio: number;
  tipo: TipoGradoAffine;
  etichetta: string;
}

/** Serbatoio ammesso: profili non docenti (ATA) o sostegno d'altro ordine. */
export type TipoSerbatoio = 'ata' | 'sostegno';

/** Voce del serbatoio di default: punteggio di paracadute + motivo leggibile. */
export interface VoceSerbatoio {
  punteggio: number;
  tipo: TipoSerbatoio;
  etichetta: string;
}

/** Testo su cui si cercano i ponti: titolo, materia e denominazioni delle classi. */
function testoAvviso(avviso: AvvisoCompatibilita): string {
  const classi = (avviso.classi ?? []).flatMap((codice) => {
    const classe = classeByCodice(codice);
    return classe ? [classe.denominazione, ...classe.materie] : [codice];
  });
  return [avviso.titolo, avviso.materia, ...classi].filter(Boolean).join(' ');
}

/** Testo delle PROPRIE classi (denominazioni + materie del catalogo). */
function testoClassi(classi: readonly string[]): string {
  return classi
    .flatMap((codice) => {
      const classe = classeByCodice(codice);
      return classe ? [classe.denominazione, ...classe.materie] : [];
    })
    .join(' ');
}

/**
 * True se l'avviso è un bando per il personale ATA: codice del catalogo
 * (`ATA-AA`/`ATA-AT`/`ATA-CS`) oppure prosa che nomina profili o famiglia ATA
 * (l'unica verità è `lib/profiliAta`, §26.126 — nessuna copia delle regex).
 */
export function eAvvisoAta(avviso: AvvisoCompatibilita): boolean {
  if ((avviso.classi ?? []).some((codice) => eCodiceAta(codice))) return true;
  return dichiaraPersonaleAta(`${avviso.titolo ?? ''} ${avviso.materia ?? ''}`);
}

/**
 * GRADO AFFINE dell'avviso rispetto al profilo (`null` = nessun grado: la riga
 * resta alle regole di sempre).
 *
 * Ordine dei giudizi: profilo con classi E ordini dichiarati → il sostegno e l'ATA
 * hanno un altro canale → un match da 85 in su è già in bacheca → il ponte di
 * ORDINE deve esistere (stesso ordine o adiacente) → poi la forza del ponte:
 * materia coperta / aree che si toccano (82), altrimenti avviso senza classe (72).
 */
export function gradoAffine(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): GradoAffine | null {
  const classiProfilo = normalizzaClassi(profilo.classi);
  const ordini = (profilo.ordini ?? []).filter(Boolean);
  if (classiProfilo.length === 0 || ordini.length === 0) return null;
  if (avvisoDiSostegno(avviso) || eAvvisoAta(avviso)) return null;

  const classe = punteggioClasse(profilo, avviso);
  if (classe === null) return null;
  if (classe.punteggio >= PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_STESSA_AREA) return null;

  const ordine = ordineAvviso(avviso);
  if (!ordine) return null;
  const adiacente = ordini.some((proprio) => proprio === ordine || ordiniAdiacenti(proprio, ordine));
  if (!adiacente) return null;

  const areeProfilo = areeDi(testoClassi(classiProfilo));
  const areeAvviso = areeDi(testoAvviso(avviso));
  const comuni = areeInComune(areeProfilo, areeAvviso);
  const ponte = ponteTraAree(areeProfilo, areeAvviso);
  // PAVIMENTO PROPORZIONALE: più il ponte è forte, più il grado vale.
  if (materiaCompatibileConClassi(avviso.materia, classiProfilo) || comuni.length > 0) {
    const prova = comuni.length > 0 ? comuni.join(', ') : (avviso.materia ?? '').trim();
    return {
      punteggio: PUNTEGGIO_GRADO_AFFINE_MATERIA,
      tipo: 'materia',
      etichetta: `grado affine: materia coperta dalle tue classi${prova ? ` (${prova})` : ''}`,
    };
  }
  if (ponte) {
    const affine = ponte.livello === 'affine';
    return {
      punteggio: affine ? PUNTEGGIO_GRADO_AFFINE_PONTE : PUNTEGGIO_GRADO_AFFINE_AREA,
      tipo: 'ponte',
      etichetta: `grado affine: area ${affine ? 'affine' : 'contaminata'} (${ponte.etichetta})`,
    };
  }

  const classiAvviso = normalizzaClassi(avviso.classi);
  if (classiAvviso.length === 0) {
    return {
      punteggio: PUNTEGGIO_GRADO_AFFINE_ORDINE,
      tipo: 'ordine',
      etichetta: 'grado affine: nessuna classe indicata, ordine di scuola vicino al tuo',
    };
  }
  return null;
}

/**
 * SERBATOIO DI DEFAULT dell'avviso (`null` = non è una voce di paracadute).
 *
 * Regole dichiarate: il profilo ha delle classi, la provincia dell'avviso è una
 * delle SUE (non «vicina»: un paracadute a sessanta chilometri non serve), non
 * c'è una classe in comune e — per il sostegno — il motore non lo ammette già
 * (se lo ammette è un suggerimento extra a 60, e resta il suo).
 */
export function voceSerbatoio(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): VoceSerbatoio | null {
  const classiProfilo = normalizzaClassi(profilo.classi);
  if (classiProfilo.length === 0) return null;
  if (punteggioProvincia(profilo.province, avviso.province).stato !== 'propria') return null;

  const classiAvviso = normalizzaClassi(avviso.classi);
  if (classiAvviso.some((codice) => classiProfilo.includes(codice))) return null;

  if (avvisoDiSostegno(avviso)) {
    if (profiloAderisceSostegno(profilo)) return null;
    if (sostegnoPertinente(profilo, avviso)) return null;
    return {
      punteggio: PUNTEGGIO_SERBATOIO_SOSTEGNO,
      tipo: 'sostegno',
      etichetta: 'sostegno di un altro ordine di scuola, nella tua provincia (paracadute)',
    };
  }

  if (eAvvisoAta(avviso)) {
    return {
      punteggio: PUNTEGGIO_SERBATOIO_ATA,
      tipo: 'ata',
      etichetta: 'bando per personale ATA, nella tua provincia (paracadute)',
    };
  }
  return null;
}

/** Riga minima per il giudizio «bacheca scarsa» (Interpello è compatibile). */
export interface RigaBacheca {
  compatibilita?: number | null;
  ripiego?: boolean;
}

/**
 * True se la lista mostrata ha meno di `minimo` match PIENI (≥ soglia arancio e
 * non di ripiego). Una lista vuota non è «scarsa»: è vuota, e la pagina lo dice
 * con il suo stato dedicato.
 */
export function bachecaScarsa(
  lista: readonly RigaBacheca[],
  minimo: number = MINIMO_MATCH_PIENI,
): boolean {
  if (lista.length === 0) return false;
  const pieni = lista.filter(
    (voce) =>
      voce.ripiego !== true &&
      typeof voce.compatibilita === 'number' &&
      voce.compatibilita >= SOGLIA_COMPATIBILITA_ARANCIO,
  ).length;
  return pieni < minimo;
}
