/**
 * ScuoleRadar.it — COME SI DICONO I NUMERI DEL BANNER (§26.149 · §26.150 · §26.151).
 *
 * Gemello di `telemetriaScansione`: là si decide **quando** dire una cosa (soglie, toni,
 * finestra di lavoro), qui si decide **come** dirla (migliaia, «700+», singolari, frasi).
 * Il distacco non è estetico: `npm run test:architettura` tiene i file sotto le 250 righe, e
 * un modulo che deve restare leggibile mentre cresce si spezza per responsabilità, non a
 * metà frase.
 *
 * §26.151 — IL REGISTRO È QUELLO DI UNA PERSONA, NON DI UN REFERTO. Fino a ieri il banner
 * diceva «1.284 pagine lette nelle ultime 24 ore · 512 fonti elaborate con successo»: vero,
 * misurato, e illeggibile per un insegnante che vuole sapere una cosa sola — *il radar sta
 * lavorando per me?* Le stesse misure, dette come le direbbe chi le ha fatte:
 *
 *   «Ultimo controllo: oggi alle 14:06 · 502 bacheche scolastiche controllate nelle ultime
 *    24 ore · 478 avvisi scartati perché fuori tema.»
 *
 * «Fonti elaborate» è sparito perché non è un fatto che riguardi chi legge: è un contatore di
 * pipeline. Restano le tre cose che si vedono dalla bacheca — **quante bacheche sono state
 * guardate**, **quanto rumore è stato buttato via**, **quante posizioni ci sono dentro**.
 *
 * REGOLA CHE VALE IN ENTRAMBI I MODULI: nessun numero inventato. Un campo non letto è `null` e
 * NON produce né una cifra né una rassicurazione — «0 avvisi scartati» su un dato assente
 * sarebbe la bugia più facile di questo banner. Le frasi restano una misura: la cifra si
 * arrotonda per difetto e si dichiara «+», non si gonfia.
 */
import { TITOLO_STANDBY, fraseStandby } from './finestraScansione';


/** Un numero in evidenza, già formattato: la UI non fa conti né separatori. */
export interface MisuraScansione {
  etichetta: string;
  valore: string;
}

/**
 * Migliaia all'italiana: `1284` → `1.284`.
 *
 * Non si usa `Intl.NumberFormat('it-IT')` perché il risultato dipende dai dati ICU della
 * macchina: su un Node con dati ridotti la stessa chiamata restituisce `1284`, quindi la
 * guardia sarebbe verde in locale e rossa in CI (o viceversa). I numeri qui sono conteggi
 * interi non negativi: l'inserimento del punto è deterministico e verificabile.
 */
export function migliaia(valore: number): string {
  return String(valore).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * LA CIFRA «PROVA DI LAVORO»: `712` → `700+`, `1.284` → `1.200+`, `48` → `48`.
 *
 * Il «+» è un arrotondamento PER DIFETTO alla centinaia: è sempre vero (712 opportunità sono
 * davvero «700 e più»), non è mai un numero inventato e resta leggibile a colpo d'occhio.
 * Sotto le 200 unità non si arrotonda: «150+» direbbe meno del numero che abbiamo misurato.
 */
export function almenoCentinaia(valore: number): string {
  if (!Number.isFinite(valore) || valore < 200) return migliaia(valore);
  return `${migliaia(Math.floor(valore / 100) * 100)}+`;
}

/** «502 bacheche scolastiche controllate nelle ultime 24 ore» — il lavoro del radar. */
export function fraseBacheche(n: number | null): string | null {
  if (n === null) return null;
  if (n === 0) return 'nessuna bacheca scolastica controllata nelle ultime 24 ore';
  return n === 1
    ? '1 bacheca scolastica controllata nelle ultime 24 ore'
    : `${migliaia(n)} bacheche scolastiche controllate nelle ultime 24 ore`;
}

/**
 * «478 avvisi scartati perché fuori tema» — il filtro che lavora per chi legge.
 *
 * Il numero è cumulativo (`discovered_links` in stato di scarto: pagine vuote, domini spenti,
 * circolari sulla mensa), quindi la frase non gli appende «oggi»: direbbe una cosa falsa.
 * «Perché fuori tema» è la ragione vera dello scarto, non un'etichetta tecnica.
 */
export function fraseScartati(n: number | null): string | null {
  if (n === null) return null;
  if (n === 0) return 'nessun avviso scartato';
  return n === 1
    ? '1 avviso scartato perché fuori tema'
    : `${migliaia(n)} avvisi scartati perché fuori tema`;
}

/** «1.200+ posizioni attive» — le opportunità vere che il radar ha in archivio. */
export function frasePosizioni(n: number | null): string | null {
  if (n === null) return null;
  if (n === 0) return 'nessuna posizione attiva in archivio';
  return n === 1 ? '1 posizione attiva' : `${almenoCentinaia(n)} posizioni attive`;
}

/**
 * I NUMERI CHE LA BACHECA HA MISURATO, già normalizzati per chi scrive le frasi.
 * `controllo` è l'istante leggibile («oggi alle 14:06»), `trascorso` la sola durata
 * («30 ore»): sono due modi di dire lo stesso tempo e servono a frasi diverse.
 */
export interface DatiBanner {
  controllo: string | null;
  trascorso: string | null;
  bacheche: number | null;
  scartati: number | null;
  posizioni: number | null;
  province: number | null;
  adesso: Date;
}

/** Le tre righe del banner: il tono lo sceglie `telemetriaScansione`, qui c'è solo il testo. */
export interface TestiBanner {
  badge: string;
  titolo: string;
  dettaglio: string;
}

/**
 * LA FRASE DI CONTROLLO: «Ultimo controllo: oggi alle 14:06. 502 bacheche scolastiche
 * controllate nelle ultime 24 ore · 478 avvisi scartati perché fuori tema.»
 *
 * L'ordine non è casuale — prima *quando*, poi *quanto*: la domanda d'ingresso è «è vivo?»,
 * e l'orologio risponde in tre parole. Se un campo manca, la sua metà di frase sparisce in
 * silenzio (nessun «0», nessun «n.d.»): meglio una riga più corta che una riga inventata.
 */
function dettaglioLavoro(d: DatiBanner): string {
  const parti = [fraseBacheche(d.bacheche), fraseScartati(d.scartati)].filter(
    (p): p is string => Boolean(p),
  );
  const ultimo = d.controllo ? `Ultimo controllo: ${d.controllo}.` : '';
  const corpo = parti.length > 0 ? `${maiuscola(parti.join(' · '))}.` : '';
  return (
    [ultimo, corpo].filter(Boolean).join(' ') ||
    'Il radar non ha ancora numeri da mostrare per questo giro.'
  );
}

/**
 * I numeri in evidenza: solo ciò che è stato MISURATO, con l'etichetta che userebbe un
 * insegnante. «Posizioni selezionate» e non «avvisi attivi»: il radar non conta le righe del
 * database, conta le opportunità che ha scelto di mostrare.
 */
export function compilaMisure(d: DatiBanner): readonly MisuraScansione[] {
  const misure: MisuraScansione[] = [];
  if (d.bacheche !== null) {
    misure.push({ etichetta: 'Bacheche controllate', valore: migliaia(d.bacheche) });
  }
  if (d.scartati !== null) {
    misure.push({ etichetta: 'Avvisi scartati', valore: migliaia(d.scartati) });
  }
  if (d.posizioni !== null) {
    misure.push({ etichetta: 'Posizioni selezionate', valore: almenoCentinaia(d.posizioni) });
  }
  return misure;
}

/** Il radar ha appena chiuso un giro: la notizia è che è vivo, e cosa ne è uscito. */
export function testiInDiretta(d: DatiBanner): TestiBanner {
  const posizioni = frasePosizioni(d.posizioni);
  return {
    badge: 'IN DIRETTA',
    titolo: posizioni
      ? `Il radar ha appena finito un giro · ${posizioni}`
      : 'Il radar ha appena finito un giro',
    dettaglio: dettaglioLavoro(d),
  };
}

/** Giro recente (entro le 24 ore), finestra aperta: il radar sta lavorando adesso. */
export function testiOperativo(d: DatiBanner): TestiBanner {
  return {
    badge: 'OPERATIVO',
    titolo:
      d.province === null
        ? 'Il radar sta controllando le bacheche'
        : `Il radar sta controllando le bacheche di ${d.province} province`,
    dettaglio: dettaglioLavoro(d),
  };
}

/**
 * Finestra APERTA ma nessun giro da oltre un giorno: qui il silenzio è un guasto, non un
 * orario — e la frase lo dice senza allarmare («riprende al prossimo giro», che è vero).
 */
export function testiInAttesa(d: DatiBanner): TestiBanner {
  return {
    badge: 'IN ATTESA',
    titolo: d.trascorso ? `Nessun controllo da ${d.trascorso}` : 'Il radar è fermo da un po’',
    dettaglio: [
      dettaglioLavoro(d),
      'Il radar controlla dal lunedì al venerdì, dalle 08:00 alle 17:00: il prossimo giro automatico è in arrivo.',
    ].join(' '),
  };
}

/** Nessun ciclo registrato e finestra aperta: primo avvio, non guasto. */
export function testiAvvio(): TestiBanner {
  return {
    badge: 'AL PRIMO GIRO',
    titolo: 'Il radar si sta avviando',
    dettaglio:
      'Nessun controllo registrato finora: qui sotto ci sono le opportunità già in archivio. Il primo giro automatico parte al più presto, dal lunedì al venerdì fra le 08:00 e le 17:00.',
  };
}

/**
 * STANDBY — l'orario di lavoro del radar, detto in modo che non sembri un guasto.
 * «Prossima scansione automatica domattina alle 08:00.» Il *quando* non è una frase fissa:
 * il venerdì sera, di sabato e di domenica diventa «lunedì mattina» (`fraseStandby`).
 */
export function testiStandby(d: DatiBanner): TestiBanner {
  const bacheche = fraseBacheche(d.bacheche);
  const ultimo = d.controllo
    ? `Ultimo controllo: ${d.controllo}.`
    : 'Nessun controllo registrato finora.';
  return {
    badge: 'STANDBY',
    titolo: TITOLO_STANDBY,
    dettaglio: [
      fraseStandby(d.adesso) ?? 'Scansione automatica al prossimo giro feriale.',
      ultimo,
      bacheche ? `${maiuscola(bacheche)}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

/** Prima lettera maiuscola (il dettaglio è una frase, non una lista di frammenti). */
export const maiuscola = (testo: string): string => testo.charAt(0).toUpperCase() + testo.slice(1);
