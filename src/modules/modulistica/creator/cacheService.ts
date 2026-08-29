/**
 * ScuoleRadar.it — Cache Service del ModuleCreator.
 *
 * Client tipizzato dell'Edge Function `genera-modulo`, con logica
 * cache-first e persistenza del profilo utente:
 *
 *  - `inviaIntervista` → intervista guidata dell'Archivista Capo: il server
 *                        fa una domanda alla volta (solo quelle strettamente
 *                        necessarie) finché il profilo del modulo non è univoco.
 *  - `cercaDocumento`  → ricerca nel catalogo + cache (compatibilità legacy).
 *  - `generaDocumento` → verifica PRIMA se l'impronta dell'intervista esiste
 *                        in `generated_modules` (hash SHA-256 server-side):
 *                        se presente restituisce il documento a costo API
 *                        zero; altrimenti genera con DeepSeek, salva in
 *                        cache e restituisce il documento.
 *  - `registraDownloadGenerato` / `registraDownloadCatalogo` → registra il
 *                        download nella tabella `user_saved_modules`.
 *  - `rimuoviDownload`, `elencaDownload`, `caricaDocumentoGenerato` →
 *                        gestione della tab "I miei Modelli Scaricati".
 */
import { supabase } from '@/lib/supabase';
import { escapeHtml } from './pdfGenerator';
import type { ModuloSalvatoDB } from '../types';

export interface CatalogoSuggerito {
  id: string;
  nome: string;
  tipo: string;
  descrizione: string;
}

export interface DomandaChiarimento {
  id: string;
  testo: string;
  opzioni: string[];
}

/** Passo della intervista dell'Archivista Capo (una domanda alla volta). */
export interface PassoIntervista {
  id: string;
  testo: string;
  opzioni: string[];
}

/** Profilo dell'intervista: chiave dimensione → valore (variante esatta). */
export type ProfiloIntervista = Record<string, string>;

/** Riga della tabella Supabase `generated_modules`. */
export interface DocumentoGenerato {
  id: string;
  query_hash: string;
  query: string;
  title: string;
  content_html: string;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type EsitoRicerca =
  | {
      esito: 'prosegui';
      catalogo: CatalogoSuggerito | null;
    }
  | {
      esito: 'chiarimento';
      motivo?: string;
      domande: DomandaChiarimento[];
      suggerimento: { id: string; title: string } | null;
    };

export interface EsitoGenera {
  esito: 'generato';
  cache: boolean;
  modulo: DocumentoGenerato;
}

/**
 * Esito dell'intervista guidata:
 *  - `domanda`  → il server chiede il prossimo passo (una domanda alla volta);
 *  - `ripeti`   → la risposta non è stata riconosciuta, il server ripropone;
 *  - `pronto`   → profilo completo; se `modulo` è presente è un cache-hit
 *                 (costo zero), altrimenti si deve chiamare `generaDocumento`.
 */
export type EsitoIntervista =
  | { esito: 'domanda' | 'ripeti'; passo: PassoIntervista }
  | {
      esito: 'pronto';
      profilo: ProfiloIntervista;
      modulo?: DocumentoGenerato | null;
      cache?: boolean;
      catalogo?: CatalogoSuggerito | null;
    };

type Invocazione<T> = { ok: true; dati: T } | { ok: false; errore: string };

/**
 * Invoca l'Edge Function `genera-modulo` con gestione errori uniforme.
 * Passa SEMPRE il token JWT della sessione (con tentativo di refresh se la
 * sessione risulta assente): così gli utenti autenticati non incappano mai
 * nell'errore "NON_AUTENTICATO".
 */
async function invoca<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<Invocazione<T>> {
  if (!supabase) {
    return {
      ok: false,
      errore:
        'Servizio non disponibile: mancano VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nel file .env.',
    };
  }
  // Sessione corrente + refresh automatico se il token è scaduto/perso.
  let sessione = (await supabase.auth.getSession()).data.session;
  if (!sessione) {
    const { data: rinfrescata } = await supabase.auth.refreshSession();
    sessione = rinfrescata.session ?? null;
  }
  if (!sessione) return { ok: false, errore: 'NON_AUTENTICATO' };

  const token = sessione.access_token;
  const { data, error } = await supabase.functions.invoke('genera-modulo', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    const payload = data as { errore?: string } | null;
    return {
      ok: false,
      errore: payload?.errore ?? error.message ?? 'Errore di comunicazione con il generatore.',
    };
  }
  const payload = data as { ok?: boolean; errore?: string } | null;
  if (!payload || payload.ok === false) {
    return { ok: false, errore: payload?.errore ?? 'Risposta inattesa dal generatore.' };
  }
  return { ok: true, dati: payload as T };
}

/* ------------------------------ Ricerca ------------------------------ */

/** Cerca il documento più adatto: catalogo + cache, con chiarimenti se ambigua. */
export async function cercaDocumento(
  query: string,
): Promise<{ ok: boolean; errore?: string; esito?: EsitoRicerca }> {
  const res = await invoca({ azione: 'ricerca', query });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true, esito: res.dati as unknown as EsitoRicerca };
}

/* --------------------------- Intervista --------------------------- */

/**
 * Intervista guidata dell'Archivista Capo (una domanda alla volta).
 *
 * `risposte` è l'accumulo progressivo passo→risposta (testo libero o
 * opzione scelta). Il server fa una domanda per volta e, quando il profilo
 * è completo, risponde `pronto` (con cache-hit se l'impronta dell'intervista
 * è già in `generated_modules`).
 */
export async function inviaIntervista(
  query: string,
  risposte: Record<string, string>,
): Promise<{ ok: boolean; errore?: string; esito?: EsitoIntervista }> {
  const res = await invoca({ azione: 'intervista', query, risposte });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true, esito: res.dati as unknown as EsitoIntervista };
}

/* --------------------- Generazione cache-first --------------------- */

/**
 * Genera (o riusa dalla cache) il documento per la query.
 * Il controllo `generated_modules` avviene SERVER-SIDE tramite l'impronta
 * dell'intervista (profilo canonico SHA-256): se la stessa variante è già
 * stata generata, nessuna chiamata a DeepSeek.
 */
export async function generaDocumento(
  query: string,
  profilo?: ProfiloIntervista,
  catalogoId?: string,
): Promise<{ ok: boolean; errore?: string; esito?: EsitoGenera }> {
  const res = await invoca({ azione: 'genera', query, profilo, catalogoId });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true, esito: res.dati as unknown as EsitoGenera };
}

/* ------------------- Generazione locale (fallback) ------------------- */

/** Etichette leggibili delle dimensioni del profilo (per il contesto del documento). */
const ETICHETTE_PROFILO: Record<string, Record<string, string>> = {
  tipo: {
    sostegno: 'Richiesta di sostegno',
    pei: 'Documentazione PEI / inclusione',
    mad: 'Messa a disposizione (MAD)',
    supplenza: 'Domanda di supplenza',
    certificazione: 'Certificazione (L.104/1992)',
    autocertificazione: 'Autocertificazione titoli (DPR 445/2000)',
    lettera: 'Lettera di presentazione',
    mobilita: 'Mobilità / trasferimento',
    delega_privacy: 'Delega o consenso privacy',
    checklist: 'Checklist',
    iscrizione: 'Iscrizione',
  },
  ordine: {
    infanzia: "Scuola dell'Infanzia",
    primaria: 'Scuola Primaria',
    secondaria1: 'Scuola Secondaria di I Grado',
    secondaria2: 'Scuola Secondaria di II Grado',
    universita: 'Università',
    enti: 'Enti / Istituzioni',
    cpia: 'CPIA / educazione degli adulti',
    ata: 'Personale ATA',
  },
  scopo_sostegno: {
    richiesta: 'richiesta di accertamento e assegnazione del sostegno',
    incarico: 'disponibilità a un incarico di sostegno',
    pei: 'documentazione PEI',
    autonomia: 'assistente all’autonomia',
  },
  destinatario: {
    istituzione_scolastica: 'l’Istituzione Scolastica',
    npia_asl: 'la NPIA/ASL',
    comune: 'il Comune (Assistente all’Autonomia)',
  },
  regione: {
    speciale: 'Regione a Statuto Speciale (normativa locale)',
    nazionale: 'modello nazionale standard',
  },
};

/** Riferimenti normativi espliciti per tipologia di documento. */
const NORMATIVA_PER_TIPO: Record<string, string> = {
  sostegno: 'L. 104/1992, D.Lgs. 66/2017, D.M. 182/2020, D.I. 153/2023',
  pei: 'L. 104/1992, D.Lgs. 66/2017, D.M. 182/2020',
  certificazione: 'L. 104/1992, DPR 445/2000',
  mad: 'D.Lgs. 59/2017, O.M. 88/2024, DPR 445/2000',
  supplenza: 'D.Lgs. 59/2017, O.M. 88/2024',
  autocertificazione: 'DPR 445/2000',
  lettera: 'DPR 275/1999, D.Lgs. 297/1994',
  mobilita: 'L. 107/2015, CCNL Scuola',
  delega_privacy: 'Reg. UE 2016/679 (GDPR), D.Lgs. 196/2003',
  iscrizione: 'DPR 275/1999, CCNL Scuola',
  checklist: 'D.Lgs. 297/1994, L. 107/2015',
};
const NORMATIVA_DEFAULT = 'DPR 275/1999, DPR 445/2000, CCNL Scuola';

/** Titolo formale del documento per tipologia. */
const TITOLO_PER_TIPO: Record<string, string> = {
  sostegno: 'Modulo di richiesta di sostegno scolastico',
  pei: 'Piano Educativo Individualizzato (PEI) – modulo compilabile',
  mad: 'Domanda di messa a disposizione (MAD)',
  supplenza: 'Domanda di supplenza',
  certificazione: 'Richiesta di certificazione ai sensi della L. 104/1992',
  autocertificazione: 'Dichiarazione sostitutiva di certificazione (DPR 445/2000)',
  lettera: 'Lettera di presentazione',
  mobilita: 'Istanza di mobilità e trasferimento',
  delega_privacy: 'Delega e consenso al trattamento dei dati personali',
  iscrizione: 'Domanda di iscrizione',
  checklist: 'Checklist documentale',
};

type FamigliaDocumento = 'inclusione' | 'reclutamento' | 'generico';

function famigliaDi(profilo?: ProfiloIntervista): FamigliaDocumento {
  const tipo = profilo?.tipo;
  if (tipo === 'sostegno' || tipo === 'pei' || tipo === 'certificazione') return 'inclusione';
  if (tipo === 'mad' || tipo === 'supplenza') return 'reclutamento';
  return 'generico';
}

function etichettaProfilo(dimensione: string, valore: string): string {
  const label = ETICHETTE_PROFILO[dimensione]?.[valore];
  if (label) return label;
  return valore.replace(/[_-]+/g, ' ');
}

/** Oggetto professionale della richiesta (mai stringhe di debug). */
function descrizioneOggetto(query: string, profilo?: ProfiloIntervista): string {
  const parti: string[] = [];
  if (profilo?.tipo) parti.push(etichettaProfilo('tipo', profilo.tipo));
  if (profilo?.scopo_sostegno) parti.push(etichettaProfilo('scopo_sostegno', profilo.scopo_sostegno));
  if (profilo?.ordine) parti.push(`ordine di scuola: ${etichettaProfilo('ordine', profilo.ordine)}`);
  if (profilo?.destinatario) parti.push(`destinatario: ${etichettaProfilo('destinatario', profilo.destinatario)}`);
  if (profilo?.regione === 'speciale') parti.push('Regione a Statuto Speciale (verificare la normativa locale)');
  const contesto = parti.length > 0 ? ` — ${parti.join('; ')}` : '';
  return `${query}${contesto}`;
}


function guidaCompilazione(testo: string): string {
  return `<div class="guida-compilazione"><strong>Guida alla compilazione:</strong> ${testo}</div>`;
}

/** Cella compilabile vuota: solo una riga pulita per la scrittura a mano (nessun testo segnaposto). */
function campoScrittura(): string {
  return `<div class="campo-scrittura"></div>`;
}

function voceCrocetta(testo: string): string {
  return `<p class="voce"><span class="casella"></span>${escapeHtml(testo)}</p>`;
}

function sezioneCrocette(titolo: string, voci: string[], guida?: string): string {
  const bloccoGuida = guida ? guidaCompilazione(guida) : '';
  return `<h2>${escapeHtml(titolo)}</h2>${bloccoGuida}<div class="crocette">${voci.map(voceCrocetta).join('')}</div>`;
}

function boxScrittura(titolo: string, guida?: string, alta = false): string {
  const bloccoGuida = guida ? guidaCompilazione(guida) : '';
  return `<h2>${escapeHtml(titolo)}</h2>${bloccoGuida}<div class="scrittura-mano${alta ? ' scrittura-mano--alta' : ''}"></div>`;
}

function tabellaFirme(guida?: string): string {
  /** Una riga della tabella firme: Ruolo · Nome e Cognome (in stampatello) · Firma autografa. */
  const riga = (ruolo: string): string =>
    `<tr>
      <td>${escapeHtml(ruolo)}</td>
      <td><div class="riga-firma"></div></td>
      <td><div class="riga-firma"></div></td>
    </tr>`;

  const righe = [
    riga('Dirigente Scolastico'),
    riga('Docenti del Consiglio di Classe / Team docenti'),
    // Almeno 8 righe dedicate ai membri del Consiglio di Classe / Team docenti.
    ...Array.from({ length: 7 }, () => riga('')),
    riga('Docente di sostegno'),
    riga('Specialista ASL / Terapista'),
    riga('Genitori / Tutori'),
  ].join('');

  const bloccoGuida = guida ? guidaCompilazione(guida) : '';
  return `<h2>Firme</h2>${bloccoGuida}
    <table class="tabella-firme">
      <thead>
        <tr>
          <th style="width:34%">Ruolo</th>
          <th style="width:33%">Nome e Cognome (in stampatello)</th>
          <th style="width:33%">Firma autografa</th>
        </tr>
      </thead>
      <tbody>${righe}</tbody>
    </table>`;
}

/** Spazio per il sigillo dell'istituzione e le iniziali di convalida. */
function bloccoConvalida(): string {
  return `<div class="convalida">
    <p><strong>Convalida dell'Istituzione Scolastica</strong> — spazio per il sigillo e le iniziali di convalida.</p>
    <div class="riga-firma"></div>
    <p>Luogo e data di protocollo:</p>
    ${campoScrittura()}
    <p>Firma del funzionario incaricato:</p>
    ${campoScrittura()}
  </div>`;
}

function intestazioneIstituzionale(normativa: string, tipo: string): string {
  const fonte =
    tipo === 'sostegno' || tipo === 'pei'
      ? 'Modello conforme alle Linee Guida MIM — D.Lgs. 66/2017, D.M. 182/2020'
      : 'Modello conforme alle Linee Guida del Ministero dell\u2019Istruzione e del Merito';
  return `<table class="intestazione-formale">
    <tr>
      <td class="campo-etichetta">Istituto Scolastico</td>
      <td>${campoScrittura()}${campoScrittura()}</td>
      <td class="campo-etichetta">Anno Scolastico</td>
      <td><span class="casella"></span> 2025/2026</td>
    </tr>
    <tr>
      <td class="campo-etichetta">Protocollo n.</td>
      <td>${campoScrittura()}</td>
      <td class="campo-etichetta">Data</td>
      <td>${campoScrittura()}</td>
    </tr>
  </table>
  <p class="riferimento-normativo"><strong>${escapeHtml(fonte)}</strong><br/>Riferimenti normativi: ${escapeHtml(normativa)}</p>`;
}

function quadroAnagrafico(famiglia: FamigliaDocumento): string {
  if (famiglia === 'reclutamento') {
    return `<h2>Quadro anagrafico del richiedente</h2>
      <table class="quadro-anagrafico">
        <tr>
          <td class="campo-etichetta">Cognome e Nome</td><td>${campoScrittura()}</td>
          <td class="campo-etichetta">Codice Fiscale</td><td>${campoScrittura()}</td>
        </tr>
        <tr>
          <td class="campo-etichetta">Data e luogo di nascita</td><td>${campoScrittura()}</td>
          <td class="campo-etichetta">Residenza</td><td>${campoScrittura()}</td>
        </tr>
        <tr>
          <td class="campo-etichetta">Titolo di studio / abilitazione</td><td>${campoScrittura()}</td>
          <td class="campo-etichetta">Classe di concorso</td><td>${campoScrittura()}</td>
        </tr>
        <tr>
          <td class="campo-etichetta">Contatto (email / telefono)</td><td>${campoScrittura()}</td>
          <td class="campo-etichetta">Scuola destinataria</td><td>${campoScrittura()}</td>
        </tr>
      </table>`;
  }
  return `<h2>Quadro anagrafico dell’alunno/a</h2>
    <table class="quadro-anagrafico">
      <tr>
        <td class="campo-etichetta">Cognome e Nome dell’alunno/a</td><td>${campoScrittura()}</td>
        <td class="campo-etichetta">Codice Fiscale</td><td>${campoScrittura()}</td>
      </tr>
      <tr>
        <td class="campo-etichetta">Data e luogo di nascita</td><td>${campoScrittura()}</td>
        <td class="campo-etichetta">Residenza</td><td>${campoScrittura()}</td>
      </tr>
      <tr>
        <td class="campo-etichetta">Classe / Sezione</td><td>${campoScrittura()}</td>
        <td class="campo-etichetta">Istituto di appartenenza</td><td>${campoScrittura()}</td>
      </tr>
      <tr>
        <td class="campo-etichetta">Consiglio di Classe / GLO</td><td>${campoScrittura()}</td>
        <td class="campo-etichetta">Referente ASL / Specialista</td><td>${campoScrittura()}</td>
      </tr>
    </table>`;
}

function sezioniContesto(profilo?: ProfiloIntervista): string {
  const parti: string[] = [];
  if (profilo?.ordine) parti.push(voceCrocetta(`Ordine di scuola: ${etichettaProfilo('ordine', profilo.ordine)}`));
  if (profilo?.destinatario) parti.push(voceCrocetta(`Destinatario: ${etichettaProfilo('destinatario', profilo.destinatario)}`));
  if (profilo?.regione === 'speciale') parti.push(voceCrocetta('Regione a Statuto Speciale – verificare la normativa locale'));
  return parti.length > 0 ? `<h2>Contesto della richiesta</h2><div class="crocette">${parti.join('')}</div>` : '';
}



/** Assemblea il documento formale completo (2-3+ pagine A4). */
/** Sezioni del documento formale, alternate a [BOX GUIDA] e [SPAZIO DI SCRITTURA]. */
function costruisciSezioni(famiglia: FamigliaDocumento): string[] {
  if (famiglia === 'inclusione') {
    return [
      sezioneCrocette(
        'Area di intervento',
        [
          'Sostegno alla didattica',
          'Assistenza specialistica',
          'Assistenza all’autonomia e alla comunicazione',
          'Supporto psicologico / educativo',
          'Progettazione e coordinamento (GLO)',
        ],
        'Barrare le aree di intervento previste nel PEI (Quadro Operativo ICF, D.M. 182/2020): didattica, autonomia, comunicazione, relazioni e supporto specialistico.',
      ),
      sezioneCrocette(
        'Tipologia di disabilità / BES / DSA (barrare)',
        [
          'Disabilità sensoriale (visiva / uditiva)',
          'Disabilità motoria',
          'Disabilità intellettiva',
          'Disturbo dello spettro autistico',
          'DSA (L. 170/2010)',
          'BES (Direttiva 27/12/2012)',
          'Altro (specificare)',
        ],
        'Barrare la tipologia di disabilità/BES/DSA come indicata dalla certificazione e dalla diagnosi funzionale; per i DSA fare riferimento alla L. 170/2010.',
      ),
      sezioneCrocette(
        'Strumenti compensativi adottati',
        [
          'Sintesi vocale / testo digitale',
          'Tabelle e formulari',
          'Mappe concettuali',
          'Calcolatrice',
          'Registratore / software di dettatura',
          'Altri strumenti (specificare)',
        ],
        'Indicare qui le misure compensative adottate ai sensi della L. 170/2010 e del D.Lgs. 66/2017 (sintesi vocale, mappe, formulari, calcolatrice…).',
      ),
      sezioneCrocette(
        'Misure dispensative adottate',
        [
          'Dispensa dalla lettura ad alta voce',
          'Dispensa dai tempi standard',
          'Riduzione delle prove scritte',
          'Valutazione personalizzata',
          'Altro (specificare)',
        ],
        'Indicare qui le misure dispensative adottate ai sensi della L. 170/2010; specificare modalità e tempi di verifica e valutazione.',
      ),
      boxScrittura(
        'Relazione iniziale / osservazioni',
        'Descrivere la situazione di partenza dell\u2019alunno/a: osservazioni iniziali, certificazioni presentate (L. 104/1992), bisogni educativi emersi e risorse disponibili.',
        true,
      ),
      boxScrittura(
        'Obiettivi disciplinari e di autonomia',
        'Indicare gli obiettivi educativi e didattici del PEI (D.M. 182/2020), distinguendo apprendimento, autonomia personale e sociale, comunicazione e relazioni.',
      ),
      boxScrittura(
        'Modifiche programmatiche',
        'Riportare le modifiche alla programmazione di classe, le strategie di verifica e i criteri di valutazione previsti dal PEI.',
      ),
      boxScrittura(
        'Interventi specialistici (ASL / Terapisti)',
        'Indicare gli interventi dell\u2019assistente specialistico/educatore, le risorse dell\u2019ASL e i rapporti con il referente sanitario (specialista di riferimento).',
      ),
      tabellaFirme(
        'Il documento va firmato da tutti i componenti del GLO ai sensi del D.M. 182/2020; allegare le eventuali dichiarazioni dei genitori.',
      ),
    ];
  }
  if (famiglia === 'reclutamento') {
    return [
      sezioneCrocette(
        'Tipologia di contratto richiesta',
        [
          'Supplenza breve / fino al termine delle lezioni',
          'Supplenza annuale',
          'Incarico a tempo determinato',
          'Messa a disposizione (MAD)',
        ],
        'Barrare la tipologia di incarico richiesta secondo le vigenti disposizioni ministeriali (O.M. 88/2024).',
      ),
      sezioneCrocette(
        'Disponibilità oraria',
        ['Tempo pieno', 'Part-time (indicare le ore)', 'Solo mattino', 'Solo pomeriggio'],
      ),
      boxScrittura('Motivazione della domanda'),
      boxScrittura('Esperienze professionali maturate', undefined, true),
      boxScrittura('Note e disponibilità aggiuntive'),
      tabellaFirme(
        'Il documento va sottoscritto e protocollato presso la scuola destinataria; allegare i documenti di identità e i titoli dichiarati.',
      ),
    ];
  }
  return [
    sezioneCrocette(
      'Oggetto della richiesta (barrare)',
      [
        'Documentazione anagrafica',
        'Privacy e consensi',
        'Richiesta di servizi',
        'Autocertificazione',
        'Altra istanza (specificare)',
      ],
      'Barrare l\u2019oggetto della richiesta; per le autocertificazioni fare riferimento al DPR 445/2000.',
    ),
    boxScrittura('Descrizione della richiesta', undefined, true),
    boxScrittura('Motivazioni e note'),
    boxScrittura(
      'Documentazione allegata',
      'Elenco della documentazione allegata in copia conforme all\u2019originale (DPR 445/2000).',
    ),
    tabellaFirme('Il documento va sottoscritto e protocollato; allegare un documento di identità valido.'),
  ];
}

function costruisciModuloFormale(
  query: string,
  profilo?: ProfiloIntervista,
): string {
  const tipo = profilo?.tipo ?? '';
  const famiglia = famigliaDi(profilo);
  const normativa = NORMATIVA_PER_TIPO[tipo] ?? NORMATIVA_DEFAULT;
  const oggetto = descrizioneOggetto(query, profilo);

  const sezioni: string[] = costruisciSezioni(famiglia);

  return `
    ${intestazioneIstituzionale(normativa, tipo)}
    <p><strong>Oggetto della richiesta:</strong> ${escapeHtml(oggetto)}</p>
    ${quadroAnagrafico(famiglia)}
    ${sezioniContesto(profilo)}
    ${sezioni.join('\n')}
    ${bloccoConvalida()}
    <p class="fonte-notizia">Modello conforme alle Linee Guida del Ministero dell\u2019Istruzione e del Merito. Documento scaricato gratuitamente da ScuoleRadar.it</p>
  `;
}
/**
 * Genera LOCALMENTE un documento UFFICIALE completo (2-3 pagine A4) quando il
 * servizio di generazione non è raggiungibile. Il layout segue l'anatomia del
 * documento scolastico formale: intestazione istituzionale, quadro anagrafico,
 * sezioni a crocette, ampi box di scrittura a mano e tabella firme.
 */
export function creaDocumentoLocale(
  query: string,
  profilo?: ProfiloIntervista,
  catalogoId?: string,
): DocumentoGenerato {
  const tipo = profilo?.tipo ?? '';
  const base = TITOLO_PER_TIPO[tipo] ?? ((query ?? '').trim() || 'Modulo ufficiale');
  const ordine = profilo?.ordine ? ` – ${etichettaProfilo('ordine', profilo.ordine)}` : '';
  const titolo = `${base}${ordine}`;

  return {
    id: '',
    query_hash: `locale:${Date.now()}`,
    query,
    title: titolo,
    content_html: costruisciModuloFormale(query, profilo),
    meta: {
      locale: true,
      ...(profilo ? { profilo } : {}),
      ...(catalogoId ? { catalogo_id: catalogoId } : {}),
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/* ------------------- Persistenza (user_saved_modules) ------------------- */

async function registra(body: {
  module_key: string;
  module_source: 'generated' | 'catalogo';
  title: string;
  tipo: string;
}): Promise<{ ok: boolean; errore?: string }> {
  const res = await invoca({ azione: 'salva', ...body });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true };
}

/** Registra il download di un documento generato nel profilo dell'utente. */
export async function registraDownloadGenerato(
  modulo: DocumentoGenerato,
): Promise<{ ok: boolean; errore?: string }> {
  if (!modulo.id) {
    return {
      ok: false,
      errore: 'Documento non persistibile: la cache del generatore non è configurata.',
    };
  }
  return registra({
    module_key: `gen:${modulo.id}`,
    module_source: 'generated',
    title: modulo.title,
    tipo: 'HTML/PDF',
  });
}

/** Registra il download di un modulo del catalogo nel profilo dell'utente. */
export async function registraDownloadCatalogo(m: {
  id: string;
  nome: string;
  tipo: string;
}): Promise<{ ok: boolean; errore?: string }> {
  return registra({
    module_key: `cat:${m.id}`,
    module_source: 'catalogo',
    title: m.nome,
    tipo: m.tipo,
  });
}

/** Rimuove un download registrato (user_saved_modules). */
export async function rimuoviDownload(moduleKey: string): Promise<{ ok: boolean; errore?: string }> {
  const res = await invoca({ azione: 'rimuovi', module_key: moduleKey });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true };
}

/** Elenca i moduli salvati dell'utente (tab "I miei Modelli Scaricati"). */
export async function elencaDownload(): Promise<{
  ok: boolean;
  errore?: string;
  moduli?: ModuloSalvatoDB[];
}> {
  const res = await invoca<{ moduli?: ModuloSalvatoDB[] }>({ azione: 'miei' });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true, moduli: res.dati.moduli ?? [] };
}

/** Legge un documento generato dalla cache (lettura pubblica diretta). */
export async function caricaDocumentoGenerato(id: string): Promise<DocumentoGenerato | null> {
  if (!supabase || !id) return null;
  const { data } = await supabase
    .from('generated_modules')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as DocumentoGenerato | null) ?? null;
}

