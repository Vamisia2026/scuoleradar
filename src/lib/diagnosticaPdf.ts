/**
 * ScuoleRadar.it — PERCHÉ UN PDF APERTO NON DIVENTA UN RECORD (§26.128).
 *
 * Perché esiste: il 31/10/2026 il giro di fondo ha aperto **1.131** PDF, ne ha
 * letti **1.130** con del testo e solo **16** hanno dichiarato una scadenza. Il
 * riepilogo diceva quei tre numeri e nient'altro, quindi «0 record» non
 * distingueva tre cause diversissime: il documento NON È LEGGIBILE (scansione,
 * CID senza `/ToUnicode`, viewer), il documento è leggibile ma NON È UN
 * INTERPELLO (graduatoria, circolare, gara), il documento È un interpello e la
 * data c'è ma è PASSATA o oltre l'orizzonte di ingestione.
 *
 * Un contatore dice «quanti», non «perché»: qui ogni PDF aperto finisce in UNO
 * secchio solo e i secchi sommano al totale. La classificazione del «senza
 * scadenza» non è nuova — è `causaSenzaScadenza` (§26.118), la stessa del
 * censimento delle voci d'elenco, applicata all'intestazione del documento;
 * l'orizzonte è quello dell'ingestione (`GIORNI_ORIZZONTE_INGESTIONE`, §26.75).
 *
 * REGOLE · `illeggibile` = meno di `MINIMO_LETTERE` lettere o densità sotto
 * `MINIMO_DENSITA_ALFABETICA` (un testo di byte CID non è un documento letto, e
 * chiamarlo «senza scadenza» nasconderebbe il difetto vero) · `passata` = il
 * termine è prima di oggi · `oltre_orizzonte` = il termine supera i giorni
 * dell'ingestione (refuso d'anno o fine incarico, §26.114) · `senza_scadenza` =
 * nessuna data qualificata, con la causa di §26.118 (contorno: `a_revoca`,
 * `indice`, `amministrativo`, `archivio`, `data_passata`; oppure la fascia
 * opaca `non_dichiarata`, l'unica che merita una lettura) · `valida` = il
 * documento basta a nascere riga (titolo e codice meccanografico restano i gate
 * del runner, non del PDF).
 *
 * Modulo PURO: nessuna rete, nessun `node:*`, nessun «adesso» implicito —
 * l'orologio è un parametro. Guardia: `npm run test:diagnostica-pdf` (incluso
 * in `npm test`).
 */

import {
  ETICHETTA_CAUSA,
  causaSenzaScadenza,
  type CausaSenzaScadenza,
} from './motivoSenzaScadenza.ts';
import { GIORNI_ORIZZONTE_INGESTIONE } from './scadenza.ts';

/** Sotto queste lettere il testo non è un documento: è un residuo di decodifica. */
export const MINIMO_LETTERE = 40;
/** Quota minima di lettere sui caratteri visibili perché il testo si legga. */
export const MINIMO_DENSITA_ALFABETICA = 0.35;
/**
 * Quanti caratteri di TESTA si guardano per dire che cosa è il documento. Un
 * avviso vero cita «graduatoria», «decreto» o «circolare» a metà pagina: se la
 * causa si leggesse sul corpo intero, `archivio` si mangerebbe quasi ogni PDF e
 * il censimento non distinguerebbe più niente. La domanda è «che atto è», e a
 * quella risponde l'intestazione (`intestazioneDaDocumento`), non il documento.
 */
export const CARATTERI_ESTRATTO = 200;


/** I cinque secchi in cui finisce un PDF aperto. */
export type EsitoPdf = 'illeggibile' | 'senza_scadenza' | 'passata' | 'oltre_orizzonte' | 'valida';

/** Ciò che il runner sa di un PDF appena aperto. */
export interface LetturaPdf {
  /** Testo estratto (`estraiTestoPdf`): vuoto = non estratto. */
  testo?: string | null;
  /** Scadenza dichiarata (`scadenzaDaTesto`): `null` = nessun termine. */
  deadline?: string | null;
  /** Titolo leggibile (intestazione o nome del file). */
  titolo?: string | null;
  /** Indirizzo del documento: serve alla classificazione della causa. */
  url?: string | null;
}

/** Verdetto su UNA lettura: lo stesso testo riceve sempre lo stesso verdetto. */
export interface DiagnosiPdf {
  esito: EsitoPdf;
  leggibile: boolean;
  lettere: number;
  densita: number;
  /** Valorizzata solo per `senza_scadenza` (altrimenti `null`). */
  causa: CausaSenzaScadenza | null;
}

/**
 * Il contatore del giro: ogni PDF aperto in un secchio solo, così
 * `aperti = leggibili + illeggibili` e
 * `conScadenza = passate + oltreOrizzonte + valide`.
 * `oltreTetto` sono i file scartati PRIMA della lettura (dimensione): senza
 * questo numero i secchi non tornerebbero e lo scarto resterebbe invisibile.
 */
export interface ContatorePdf {
  aperti: number;
  oltreTetto: number;
  conTesto: number;
  conScadenza: number;
  leggibili: number;
  illeggibili: number;
  passate: number;
  oltreOrizzonte: number;
  valide: number;
  motivi: Record<CausaSenzaScadenza, number>;
}

/** Le cause nell'ordine dichiarato da `motivoSenzaScadenza` (log e test). */
export const ORDINE_CAUSE: ReadonlyArray<CausaSenzaScadenza> = [
  'a_revoca', 'indice', 'amministrativo', 'archivio', 'data_passata', 'non_dichiarata',
];

/** Lettere vere (accenti compresi), non cifre e non punteggiatura. */
const RE_LETTERA = /[A-Za-zÀ-ÖØ-öø-ÿ]/g;

/** Quante LETTERE contiene il testo. */
export function contaLettere(testo?: string | null): number {
  return ((testo ?? '').match(RE_LETTERA) ?? []).length;
}

/**
 * Densità alfabetica: lettere sui caratteri VISIBILI (spazi esclusi). Un testo
 * vero sta sopra 0,7; una tabella di date e voti sta sotto 0,2; un flusso CID
 * decodificato male resta basso con pochissime lettere.
 */
export function densitaAlfabetica(testo?: string | null): number {
  let visibili = 0;
  for (const carattere of testo ?? '') {
    if (!/\s/.test(carattere)) visibili += 1;
  }
  if (visibili === 0) return 0;
  return contaLettere(testo) / visibili;
}

/**
 * True se il testo estratto è un DOCUMENTO leggibile: abbastanza lettere E
 * densità sufficiente. Servono entrambe: «40 lettere affogate in 400 cifre» è
 * una tabella, non un avviso.
 */
export function testoLeggibile(testo?: string | null): boolean {
  return (
    contaLettere(testo) >= MINIMO_LETTERE &&
    densitaAlfabetica(testo) >= MINIMO_DENSITA_ALFABETICA
  );
}

/** `AAAA-MM-GG` (anche con orario in coda): è la forma di `scadenzaDaTesto`. */
const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** Il giorno di `oggi` come `AAAA-MM-GG` (ora locale: è l'orologio del giro). */
function giornoIso(oggi: Date): string {
  const anno = oggi.getFullYear();
  const mese = String(oggi.getMonth() + 1).padStart(2, '0');
  const giorno = String(oggi.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

/** Il giorno `iso` spostato di `giorni` (aritmetica su UTC, nessun fuso). */
function isoPiuGiorni(iso: string, giorni: number): string {
  const [anno, mese, giorno] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(anno, mese - 1, giorno));
  data.setUTCDate(data.getUTCDate() + giorni);
  return data.toISOString().slice(0, 10);
}

/**
 * Il verdetto su una lettura, con la causa quando la data non c'è. L'ordine è
 * deliberato: prima la leggibilità (senza testo non si classifica nulla), poi
 * la data, poi il contorno.
 */
export function analizzaPdf(lettura: LetturaPdf, oggi: Date = new Date()): DiagnosiPdf {
  const testo = lettura.testo ?? '';
  const lettere = contaLettere(testo);
  const densita = densitaAlfabetica(testo);
  const leggibile = testoLeggibile(testo);
  const base = { leggibile, lettere, densita };
  if (!leggibile) return { ...base, esito: 'illeggibile', causa: null };
  const trovata = (lettura.deadline ?? '').trim();
  if (!RE_ISO.test(trovata)) {
    // §26.128 — la CAUSA si legge sull'intestazione (`CARATTERI_ESTRATTO`), non sul
    // corpo: la regola di §26.118 è nata per una riga d'elenco, non per un
    // documento di duecento righe che cita la graduatoria a metà pagina.
    const causa = causaSenzaScadenza(
      { titolo: lettura.titolo, url: lettura.url, testo: testo.slice(0, CARATTERI_ESTRATTO) },
      oggi,
    );
    return { ...base, esito: 'senza_scadenza', causa };
  }
  const giorno = trovata.slice(0, 10);
  if (giorno < giornoIso(oggi)) return { ...base, esito: 'passata', causa: null };
  if (giorno > isoPiuGiorni(giornoIso(oggi), GIORNI_ORIZZONTE_INGESTIONE)) {
    return { ...base, esito: 'oltre_orizzonte', causa: null };
  }
  return { ...base, esito: 'valida', causa: null };
}

/** Un contatore a zero, con tutte le sei cause presenti (nessun `undefined`). */
export function nuovoContatorePdf(): ContatorePdf {
  return {
    aperti: 0, oltreTetto: 0, conTesto: 0, conScadenza: 0, leggibili: 0,
    illeggibili: 0, passate: 0, oltreOrizzonte: 0, valide: 0,
    motivi: {
      a_revoca: 0, indice: 0, amministrativo: 0, archivio: 0, data_passata: 0, non_dichiarata: 0,
    },
  };
}

/**
 * Registra UNA lettura nel contatore del giro e restituisce il verdetto. Muta
 * l'accumulatore ma resta deterministico: stessa `lettura` + stesso `oggi`.
 */
export function registraPdf(
  contatore: ContatorePdf,
  lettura: LetturaPdf,
  oggi: Date = new Date(),
): DiagnosiPdf {
  const diagnosi = analizzaPdf(lettura, oggi);
  contatore.aperti += 1;
  if ((lettura.testo ?? '').trim()) contatore.conTesto += 1;
  if ((lettura.deadline ?? '').trim()) contatore.conScadenza += 1;
  if (diagnosi.leggibile) contatore.leggibili += 1;
  else contatore.illeggibili += 1;
  if (diagnosi.esito === 'passata') contatore.passate += 1;
  else if (diagnosi.esito === 'oltre_orizzonte') contatore.oltreOrizzonte += 1;
  else if (diagnosi.esito === 'valida') contatore.valide += 1;
  else if (diagnosi.causa) contatore.motivi[diagnosi.causa] += 1;
  return diagnosi;
}

/** Quanti PDF non hanno dichiarato un termine (somma delle sei cause). */
export function senzaScadenza(contatore: ContatorePdf): number {
  return ORDINE_CAUSE.reduce((totale, causa) => totale + contatore.motivi[causa], 0);
}

/**
 * Le righe del riepilogo finale. `[]` quando il giro non ha aperto PDF (né
 * scartato file per dimensione): nessuna riga vuota nei log dei giri d'elenco.
 */
export function righeRiepilogoPdf(contatore: ContatorePdf): string[] {
  if (contatore.aperti + contatore.oltreTetto === 0) return [];
  const senza = senzaScadenza(contatore);
  return [
    `PDF aperti: ${contatore.aperti} · leggibili: ${contatore.leggibili} · ` +
      `illeggibili: ${contatore.illeggibili} · non aperti per dimensione: ${contatore.oltreTetto}`,
    `PDF con scadenza dichiarata: ${contatore.conScadenza} · valide: ${contatore.valide} · ` +
      `passate: ${contatore.passate} · oltre ${GIORNI_ORIZZONTE_INGESTIONE} giorni: ${contatore.oltreOrizzonte}`,
    `PDF senza scadenza: ${senza} → ` +
      ORDINE_CAUSE.map(
        (causa) => `${ETICHETTA_CAUSA[causa]} ${contatore.motivi[causa]}`,
      ).join(' · '),
  ];
}
