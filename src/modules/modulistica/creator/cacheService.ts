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
import {
  macroAreeModulistica,
  type DocumentoModulistica,
  type SottoCategoriaModulistica,
} from '@/data/moduli';

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
  autocertificazione: 'D.P.R. 28 dicembre 2000, n. 445 (artt. 46 e 47)',
  lettera: 'DPR 275/1999, D.Lgs. 297/1994',
  mobilita: 'L. 107/2015, CCNL Scuola',
  delega_privacy: 'Reg. UE 2016/679 (GDPR), D.Lgs. 196/2003',
  iscrizione: 'L. 241/1990, D.P.R. 275/1999, Circolare ministeriale iscrizioni MIM',
  checklist: 'D.Lgs. 297/1994, L. 107/2015',
  biblioteca: 'DPR 275/1999, L. 145/2018',
  extracurricolari: 'D.Lgs. 81/2008, art. 42-bis D.L. 69/2013',
  assistenza_comune: 'L. 104/1992, D.Lgs. 66/2017, D.I. 153/2023',
  uscite_didattiche: 'D.P.R. 249/1998, D.Lgs. 297/1994',
  scrutini: 'D.P.R. 122/2009, D.Lgs. 62/2017',
  mensa: 'D.Lgs. 297/1994, D.M. 62/2022',
  crediti_formativi: "D.P.R. 122/2009, P.T.O.F. d'Istituto, OM di riferimento per gli esami di Stato",
  pdp_bes: 'L. 170/2010, Direttiva 27/12/2012',
  ricorso_reclamo: 'L. 241/1990, D.Lgs. 104/2010',
  delega_famiglia: 'L. 172/2017, DPR 445/2000, L. 241/1990',
  istruzione_parentale: 'L. 107/2015, D.Lgs. 62/2017, DPR 275/1999',
  permesso_orario: 'DPR 249/1998, DPR 275/1999',
  esonero_motoria: 'D.M. 9/1990, D.Lgs. 62/2017',
  accesso_atti: 'L. 241/1990, D.Lgs. 104/2010',
  consenso_foto: 'Reg. UE 2016/679 (GDPR), D.Lgs. 196/2003',
  borsa_studio: 'D.Lgs. 63/2017, DPCM 159/2013, bandi regionali EDISU/DSU/ALISEO',
  ricorso_borsa: 'L. 241/1990, DPCM 159/2013, bando regionale per il diritto allo studio',
  isee_universita: 'DPR 445/2000, DPCM 159/2013 (ISEE)',
  riduzione_contributi: 'L. 232/2016, DPCM 159/2013, regolamento tasse dell\u2019Ateneo',
  contributo_straordinario: 'L. 232/2016, regolamento dell\u2019ente per il diritto allo studio',
  integrativo_erasmus: 'Reg. UE 1288/2013, programmi Erasmus+ / mobilità internazionale',
  collaborazioni_studentesche: 'L. 390/1991, DPCM 9/4/2001 (200 ore studentesche)',
  esenzione_tasse: 'L. 232/2016, DPCM 159/2013, regolamento tasse dell\u2019Ateneo',
  laurea: 'D.M. 270/2004, regolamento d\u2019Ateneo',
  schede_osservazione: 'D.Lgs. 65/2017, Indicazioni Nazionali 2012',
  progetto_continuita: 'D.Lgs. 65/2017, P.T.O.F.',
  servizi_prepost: 'D.Lgs. 297/1994, regolamento d\u2019Istituto',
  rinuncia_iscrizione: 'DPR 275/1999, regolamento d\u2019Istituto',
  certificazione_competenze: 'D.M. 742/2017, D.Lgs. 62/2017',
  piano_personalizzato: 'D.Lgs. 62/2017, D.M. 742/2017',
  progetti_fondi: 'D.M. 170/2022 (PNRR), avvisi PON/POR',
  liberatoria_sport: 'D.Lgs. 81/2008, DPR 567/1996',
  cambio_sezione: 'DPR 275/1999, regolamento d\u2019Istituto',
  assemblea_studenti: 'DPR 567/1996, DPR 249/1998',
  esonero_tasse: 'L. 107/2015, DPR 567/1996, regolamento contributi d\u2019Istituto',
  ammissione_esami: 'D.Lgs. 62/2017, O.M. esami di Stato',
  crediti_scolastici: 'D.P.R. 122/2009, D.Lgs. 62/2017, P.T.O.F.',
  certificato_diploma: 'DPR 445/2000, D.Lgs. 62/2017',
  relazione_finale: 'D.I. 182/2020, L. 170/2010',
  trasporto_protetto: 'L. 104/1992, D.Lgs. 66/2017',
  protocollo_intesa: 'L. 104/1992, D.Lgs. 66/2017, D.Lgs. 267/2000',
  patrocinio_locali: 'DPR 275/1999, D.Lgs. 267/2000, regolamento d\u2019Istituto',
  convenzione_pcto: 'D.Lgs. 77/2005, L. 107/2015',
  segnalazione_anomalia: 'L. 241/1990, regolamento d\u2019Istituto',
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
  biblioteca: 'Modulo di Adesione / Prestito Biblioteca Scolastica',
  extracurricolari: 'Autorizzazione e Adesione Attività Extracurricolari (Sport / Teatro / Musica)',
  assistenza_comune: 'Richiesta di Assistenza Specialistica e Autonomia (Ente Locale)',
  uscite_didattiche: 'Autorizzazione e Consenso Informato Uscita Didattica / Viaggio di Istruzione',
  scrutini: 'Verbale / Scheda di Valutazione Periodica e Scrutini',
  mensa: 'Modulo di Richiesta / Modifica Servizio Ristorazione Scolastica',
  crediti_formativi: 'Richiesta di Riconoscimento Crediti Formativi — Scuola Secondaria di II Grado',
  pdp_bes: 'Piano Didattico Personalizzato (PDP) / Scheda BES — Secondaria II Grado',
  ricorso_reclamo: 'Modulo di Reclamo / Ricorso Amministrativo',
  delega_famiglia: 'Delega Ritiro Alunno / Autorizzazione Uscita Autonoma',
  istruzione_parentale: 'Comunicazione di Istruzione Parentale',
  permesso_orario: 'Richiesta Permesso Orario / Uscita Anticipata',
  esonero_motoria: 'Richiesta Esonero Scienze Motorie',
  accesso_atti: 'Richiesta di Accesso agli Atti (L. 241/1990)',
  consenso_foto: 'Consenso Trattamento Immagini e Riprese Video',
  borsa_studio: 'Domanda di Borsa di Studio (EDISU / ALISEO / DSU)',
  ricorso_borsa: 'Richiesta Riesame / Ricorso Graduatoria Borse di Studio',
  isee_universita: 'Dichiarazione ISEE per l\u2019Università',
  riduzione_contributi: 'Richiesta Ricalcolo / Riduzione Contributo Unico',
  contributo_straordinario: 'Richiesta Contributo Straordinario per Disagio Economico',
  integrativo_erasmus: 'Richiesta Borsa Integrativa Erasmus / Mobilità Internazionale',
  collaborazioni_studentesche: 'Domanda Collaborazioni Studentesche (200 ore / Tutorato)',
  esenzione_tasse: 'Richiesta Esenzione / Riduzione Tasse Universitarie',
  laurea: 'Domanda di Laurea / Proclamazione',
  schede_osservazione: 'Scheda di Osservazione delle Competenze — Scuola dell\u2019Infanzia',
  progetto_continuita: 'Adesione Progetto Continuità Nido-Infanzia',
  servizi_prepost: 'Richiesta Servizio Pre / Post Scuola',
  rinuncia_iscrizione: 'Rinuncia / Ritiro Iscrizione',
  certificazione_competenze: 'Certificazione delle Competenze (D.M. 742/2017)',
  piano_personalizzato: 'Piano di Studio Personalizzato',
  progetti_fondi: 'Adesione Progetti PON / POR / PNRR',
  liberatoria_sport: 'Liberatoria Attività Sportive',
  cambio_sezione: 'Richiesta Cambio Sezione / Indirizzo',
  assemblea_studenti: 'Istanza di Assemblea di Classe / Istituto',
  esonero_tasse: 'Richiesta Esonero Tasse Scolastiche / Contributi',
  ammissione_esami: 'Domanda di Ammissione agli Esami di Stato',
  crediti_scolastici: 'Richiesta Riconoscimento Crediti Scolastici / Formativi',
  certificato_diploma: 'Richiesta Certificato Sostitutivo Diploma',
  relazione_finale: 'Relazione Finale PEI / PDP',
  trasporto_protetto: 'Richiesta Trasporto Scolastico Protetto',
  protocollo_intesa: 'Protocollo di Intesa ASL / Comune',
  patrocinio_locali: 'Richiesta Patrocinio / Uso Locali Scolastici',
  convenzione_pcto: 'Convenzione PCTO / Tirocinio',
  segnalazione_anomalia: 'Segnalazione Anomalie del Servizio',
};

type FamigliaDocumento = 'inclusione' | 'istanza' | 'ambito' | 'reclutamento' | 'generico';

function famigliaDi(profilo?: ProfiloIntervista): FamigliaDocumento {
  const tipo = profilo?.tipo;
  // PEI completo → 2 pagine; sostegno / certificazione L.104 → istanze snelle da 1 pagina.
  if (tipo === 'pei') return 'inclusione';
  if (tipo === 'sostegno' || tipo === 'certificazione') return 'istanza';
  // Categorie tematiche dedicate (biblioteca, sport/teatro/musica, assistenza Comune,
  // uscite didattiche, scrutini, mensa, crediti formativi).
  if (
    tipo === 'biblioteca' ||
    tipo === 'extracurricolari' ||
    tipo === 'assistenza_comune' ||
    tipo === 'uscite_didattiche' ||
    tipo === 'scrutini' ||
    tipo === 'mensa' ||
    tipo === 'crediti_formativi' ||
    tipo === 'pdp_bes' ||
    tipo === 'ricorso_reclamo' ||
    tipo === 'delega_famiglia' ||
    tipo === 'istruzione_parentale' ||
    tipo === 'permesso_orario' ||
    tipo === 'esonero_motoria' ||
    tipo === 'accesso_atti' ||
    tipo === 'consenso_foto' ||
    tipo === 'borsa_studio' ||
    tipo === 'ricorso_borsa' ||
    tipo === 'isee_universita' ||
    tipo === 'riduzione_contributi' ||
    tipo === 'contributo_straordinario' ||
    tipo === 'integrativo_erasmus' ||
    tipo === 'collaborazioni_studentesche' ||
    tipo === 'esenzione_tasse' ||
    tipo === 'laurea' ||
    tipo === 'schede_osservazione' ||
    tipo === 'progetto_continuita' ||
    tipo === 'servizi_prepost' ||
    tipo === 'rinuncia_iscrizione' ||
    tipo === 'certificazione_competenze' ||
    tipo === 'piano_personalizzato' ||
    tipo === 'progetti_fondi' ||
    tipo === 'liberatoria_sport' ||
    tipo === 'cambio_sezione' ||
    tipo === 'assemblea_studenti' ||
    tipo === 'esonero_tasse' ||
    tipo === 'ammissione_esami' ||
    tipo === 'crediti_scolastici' ||
    tipo === 'certificato_diploma' ||
    tipo === 'relazione_finale' ||
    tipo === 'trasporto_protetto' ||
    tipo === 'protocollo_intesa' ||
    tipo === 'patrocinio_locali' ||
    tipo === 'convenzione_pcto' ||
    tipo === 'segnalazione_anomalia'
  ) {
    return 'ambito';
  }
  if (tipo === 'mad' || tipo === 'supplenza') return 'reclutamento';
  return 'generico';
}

function etichettaProfilo(dimensione: string, valore: string): string {
  const label = ETICHETTE_PROFILO[dimensione]?.[valore];
  if (label) return label;
  return valore.replace(/[_-]+/g, ' ');
}

/** Eliminato: nessun box "Guida alla compilazione" (documento compatto, note a piè di pagina). */
function guidaCompilazione(_testo: string): string {
  return '';
}

/** Cella compilabile vuota: solo una riga pulita per la scrittura a mano (nessun testo segnaposto). */
function campoScrittura(): string {
  return `<div class="campo-scrittura"></div>`;
}

/** Riga "etichetta → campo" (layout a 2 colonne: etichetta stretta, campo ampio con riga sottile). */
function rigaAnagrafica(etichetta: string, campo: string): string {
  return `<tr>
      <td class="campo-etichetta">${escapeHtml(etichetta)}</td>
      <td class="campo-compilazione">${campo}</td>
    </tr>`;
}

/** 3-4 righe guida visibili per la scrittura a mano (div vuoti con bordo orizzontale sottile). */
function righeScrittura(quante = 4): string {
  return `<div class="righe-scrittura">${Array.from({ length: quante }, () => '<div></div>').join('')}</div>`;
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

/**
 * BLOCCO FIRME UNICO (Single Sign Box):
 * UN solo contenitore a 2 colonne affiancate — a sinistra la chiusura del
 * richiedente (Luogo e Data + Firma), a destra lo spazio riservato alla
 * Scuola (solo N° Protocollo / Data / Timbro, NIENTE seconda firma di un
 * funzionario). Riduce l'altezza del ~50% rispetto ai vecchi due box.
 */
function bloccoConvalidaUnico(nota?: string): string {
  const bloccoNota = nota ? `<p class="micro-copy">${escapeHtml(nota)}</p>` : '';
  return `${bloccoNota}
    <div class="blocco-convalida-unico">
      <div class="chiusura-documento">
        <p class="titolo-chiusura">Luogo e Data</p>
        <p>Luogo e data: <span class="riga-firma"></span></p>
        <p>Firma del richiedente (leggibile): <span class="riga-firma"></span></p>
      </div>
      <div class="protocollo-scuola">
        <p class="titolo-chiusura">Riservato all'Ufficio di Protocollo</p>
        <p>N° Prot. / Data / Timbro: <span class="riga-firma"></span></p>
      </div>
    </div>`;
}

function intestazioneIstituzionale(): string {
  return `<table class="intestazione-formale">
    ${rigaAnagrafica('Istituto Scolastico', campoScrittura() + campoScrittura())}
    ${rigaAnagrafica('Anno Scolastico', '20____ / 20____')}
    ${rigaAnagrafica('Protocollo n.', campoScrittura())}
    ${rigaAnagrafica('Data', campoScrittura())}
  </table>`;
}

function quadroAnagrafico(famiglia: FamigliaDocumento, tipo: string): string {
  if (famiglia === 'ambito' && tipo === 'crediti_formativi') {
    // Crediti formativi (secondaria II grado): anagrafica essenziale per l'istanza.
    return `<h2>Quadro anagrafico dell'alunno/a</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Nome e Cognome', campoScrittura())}
        ${rigaAnagrafica('Classe / Sezione', campoScrittura())}
        ${rigaAnagrafica('Indirizzo di studio', campoScrittura())}
      </table>`;
  }
  if (famiglia === 'ambito' && tipo === 'pdp_bes') {
    return `<h2>Quadro anagrafico dell'alunno/a</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Nome e Cognome', campoScrittura())}
        ${rigaAnagrafica('Classe / Sezione', campoScrittura())}
        ${rigaAnagrafica('Referente BES / Coordinatore', campoScrittura())}
      </table>`;
  }
  if (famiglia === 'ambito' && tipo === 'ricorso_reclamo') {
    return `<h2>Quadro anagrafico del richiedente</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Nome e Cognome', campoScrittura())}
        ${rigaAnagrafica('Qualifica (Genitore / Studente maggiorenne)', campoScrittura())}
        ${rigaAnagrafica('Contatto (telefono / email)', campoScrittura())}
      </table>`;
  }
  if (famiglia === 'ambito' && tipo === 'delega_famiglia') {
    return `<h2>Quadro del genitore delegante</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Nome e Cognome', campoScrittura())}
        ${rigaAnagrafica('Contatto (telefono / email)', campoScrittura())}
      </table>`;
  }
  if (
    famiglia === 'ambito' &&
    (tipo === 'uscite_didattiche' ||
      tipo === 'permesso_orario' ||
      tipo === 'esonero_motoria' ||
      tipo === 'consenso_foto' ||
      tipo === 'istruzione_parentale')
  ) {
    // Quadro anagrafico COMPATTO (3 righe) per uscite e documenti famiglia:
    // evita lo straripamento su pagina 2 delle sezioni finali.
    return `<h2>Quadro anagrafico dell'alunno/a</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Nome e Cognome', campoScrittura())}
        ${rigaAnagrafica('Classe / Sezione', campoScrittura())}
        ${rigaAnagrafica('Genitore / esercente la responsabilità genitoriale', campoScrittura())}
      </table>`;
  }
  if (famiglia === 'ambito' && tipo === 'accesso_atti') {
    return `<h2>Quadro anagrafico del richiedente</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Nome e Cognome', campoScrittura())}
        ${rigaAnagrafica('Qualifica (Genitore / Studente maggiorenne)', campoScrittura())}
        ${rigaAnagrafica('Contatto (telefono / email)', campoScrittura())}
      </table>`;
  }
  if (
    famiglia === 'ambito' &&
    (tipo === 'borsa_studio' ||
      tipo === 'ricorso_borsa' ||
      tipo === 'isee_universita' ||
      tipo === 'riduzione_contributi' ||
      tipo === 'contributo_straordinario' ||
      tipo === 'integrativo_erasmus' ||
      tipo === 'collaborazioni_studentesche' ||
      tipo === 'esenzione_tasse' ||
      tipo === 'laurea')
  ) {
    // Quadro anagrafico universitario compatto (matricola + corso).
    const rigaExtra =
      tipo === 'borsa_studio'
        ? rigaAnagrafica('ISEE (valore in euro)', campoScrittura())
        : tipo === 'laurea'
          ? rigaAnagrafica('Relatore / correlatore', campoScrittura())
          : '';
    return `<h2>Quadro anagrafico dello studente</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Nome e Cognome', campoScrittura())}
        ${rigaAnagrafica('Matricola', campoScrittura())}
        ${rigaAnagrafica('Corso di laurea', campoScrittura())}
        ${rigaExtra}
      </table>`;
  }
  if (
    famiglia === 'ambito' &&
    (tipo === 'schede_osservazione' ||
      tipo === 'progetto_continuita' ||
      tipo === 'servizi_prepost' ||
      tipo === 'rinuncia_iscrizione' ||
      tipo === 'certificazione_competenze' ||
      tipo === 'piano_personalizzato' ||
      tipo === 'progetti_fondi' ||
      tipo === 'liberatoria_sport' ||
      tipo === 'esonero_tasse')
  ) {
    // Quadro anagrafico dell'alunno compatto per i moduli scuola/famiglia.
    return `<h2>Quadro anagrafico dell'alunno/a</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Nome e Cognome', campoScrittura())}
        ${rigaAnagrafica('Classe / Sezione', campoScrittura())}
        ${rigaAnagrafica('Genitore / esercente la responsabilità genitoriale', campoScrittura())}
      </table>`;
  }
  if (
    famiglia === 'ambito' &&
    (tipo === 'cambio_sezione' ||
      tipo === 'assemblea_studenti' ||
      tipo === 'ammissione_esami' ||
      tipo === 'crediti_scolastici' ||
      tipo === 'certificato_diploma' ||
      tipo === 'trasporto_protetto')
  ) {
    // Quadro anagrafico dello studente per carriera ed esami.
    return `<h2>Quadro anagrafico dello studente</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Nome e Cognome', campoScrittura())}
        ${rigaAnagrafica('Classe / Sezione / Indirizzo', campoScrittura())}
        ${rigaAnagrafica('Contatto (telefono / email)', campoScrittura())}
      </table>`;
  }
  if (
    famiglia === 'ambito' &&
    (tipo === 'protocollo_intesa' ||
      tipo === 'patrocinio_locali' ||
      tipo === 'convenzione_pcto' ||
      tipo === 'segnalazione_anomalia')
  ) {
    // Quadro anagrafico del richiedente / ente per i moduli "Enti e Territorio".
    return `<h2>Quadro anagrafico del richiedente / Ente</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Nome e Cognome / Ragione sociale', campoScrittura())}
        ${rigaAnagrafica('Qualifica / Referente', campoScrittura())}
        ${rigaAnagrafica('Contatto (telefono / email)', campoScrittura())}
      </table>`;
  }
  if (famiglia === 'reclutamento') {
    return `<h2>Quadro anagrafico del richiedente</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Cognome e Nome', campoScrittura())}
        ${rigaAnagrafica('Codice Fiscale', campoScrittura())}
        ${rigaAnagrafica('Data e luogo di nascita', campoScrittura())}
        ${rigaAnagrafica('Residenza', campoScrittura())}
        ${rigaAnagrafica('Titolo di studio', campoScrittura())}
        ${rigaAnagrafica('Classe di concorso', campoScrittura())}
        ${rigaAnagrafica('Contatto (email / telefono)', campoScrittura())}
        ${rigaAnagrafica('Scuola destinataria', campoScrittura())}
      </table>`;
  }
  if (famiglia === 'istanza' || famiglia === 'ambito') {
    // Istanza di sostegno / certificazione L.104 / categorie tematiche:
    // anagrafica dell'alunno essenziale (niente GLO/ASL).
    return `<h2>Quadro anagrafico dell\u2019alunno/a</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Cognome e Nome dell\u2019alunno/a', campoScrittura())}
        ${rigaAnagrafica('Codice Fiscale', campoScrittura())}
        ${rigaAnagrafica('Data e luogo di nascita', campoScrittura())}
        ${rigaAnagrafica('Residenza', campoScrittura())}
        ${rigaAnagrafica('Classe / Sezione', campoScrittura())}
        ${rigaAnagrafica('Istituto di appartenenza', campoScrittura())}
        ${rigaAnagrafica('Genitore / esercente la responsabilità genitoriale', campoScrittura())}
      </table>`;
  }
  if (famiglia === 'inclusione') {
    // Inclusione/PEI: GLO e referente ASL sono pertinenti.
    return `<h2>Quadro anagrafico dell\u2019alunno/a</h2>
      <table class="quadro-anagrafico">
        ${rigaAnagrafica('Cognome e Nome dell\u2019alunno/a', campoScrittura())}
        ${rigaAnagrafica('Codice Fiscale', campoScrittura())}
        ${rigaAnagrafica('Data e luogo di nascita', campoScrittura())}
        ${rigaAnagrafica('Residenza', campoScrittura())}
        ${rigaAnagrafica('Classe / Sezione', campoScrittura())}
        ${rigaAnagrafica('Istituto di appartenenza', campoScrittura())}
        ${rigaAnagrafica('Consiglio di Classe / GLO', campoScrittura())}
        ${rigaAnagrafica('Referente ASL / Specialista', campoScrittura())}
      </table>`;
  }
  // Generico/MAD: solo i dati essenziali del richiedente (niente GLO/ASL).
  return `<h2>Quadro anagrafico del richiedente</h2>
    <table class="quadro-anagrafico">
      ${rigaAnagrafica('Cognome e Nome', campoScrittura())}
      ${rigaAnagrafica('Codice Fiscale', campoScrittura())}
      ${rigaAnagrafica('Data e luogo di nascita', campoScrittura())}
      ${rigaAnagrafica('Residenza', campoScrittura())}
      ${rigaAnagrafica('Contatto (email / telefono)', campoScrittura())}
    </table>`;
}

function sezioniContesto(_profilo?: ProfiloIntervista): string {
  // Blocco "Contesto della richiesta" rimosso: il titolo del documento riporta già
  // tipo e ordine di scuola, senza metadati ridondanti nel corpo.
  return '';
}



/** Sezioni del documento formale, alternate a [BOX GUIDA] e [SPAZIO DI SCRITTURA]. */
function costruisciSezioni(famiglia: FamigliaDocumento, tipo: string): string[] {
  if (famiglia === 'istanza') {
    // Istanza amministrativa (sostegno / certificazione L.104): oggetto + documenti da allegare.
    // Nessun riquadro didattico (strumenti compensativi, misure dispensative…): solo PEI.
    return [
      `<h2>Oggetto della richiesta</h2>
      <p class="formula-dichiarazione">Richiesta di attivazione delle misure di sostegno scolastico e inclusione ai sensi della L. 104/1992 e D.Lgs. 66/2017.</p>`,
      `<h2>Documenti allegati</h2>
      <div class="crocette">
        <p class="voce"><span class="casella"></span>Verbale di accertamento dell'handicap (L. 104/1992)</p>
        <p class="voce"><span class="casella"></span>Profilo di Funzionamento / Diagnosi Funzionale</p>
        <p class="voce"><span class="casella"></span>Copia del documento di riconoscimento del richiedente</p>
      </div>`,
    ];
  }
  if (famiglia === 'ambito') {
    // Categorie tematiche dedicate (biblioteca, sport/teatro/musica, assistenza Comune).
    if (tipo === 'biblioteca') {
      return [
        `<h2>Sezione Servizi</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Prestito libri</p>
          <p class="voce"><span class="casella"></span>Progetto lettura</p>
          <p class="voce"><span class="casella"></span>Donazione libri</p>
        </div>`,
        `<h2>Dichiarazione di responsabilità</h2>
        <p class="formula-dichiarazione">Il/La sottoscritto/a dichiara di assumersi la responsabilità della cura dei volumi presi in prestito e di restituirli integri entro i termini concordati.</p>
        ${righeScrittura(3)}`,
      ];
    }
    if (tipo === 'extracurricolari') {
      return [
        `<h2>Selezione Attività</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Laboratorio Teatrale</p>
          <p class="voce"><span class="casella"></span>Attività Sportive / Tornei</p>
          <p class="voce"><span class="casella"></span>Progetto Musicale</p>
        </div>`,
        `<h2>Consensi e requisiti</h2>
        <p class="formula-dichiarazione">Consenso alla partecipazione alle uscite e alle attività programmate; allegare il certificato medico sportivo non agonistico.</p>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Consenso alle uscite / trasferte</p>
          <p class="voce"><span class="casella"></span>Certificato medico sportivo non agonistico allegato</p>
        </div>`,
      ];
    }
    if (tipo === 'uscite_didattiche') {
      return [
        `<h2>Dettagli dell'uscita</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Meta / destinazione', campoScrittura())}
          ${rigaAnagrafica('Data e orario di partenza / rientro', campoScrittura())}
          ${rigaAnagrafica('Quota di partecipazione', campoScrittura())}
        </table>`,
        `<h2>Consenso dei genitori</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Consenso alla partecipazione all'uscita didattica</p>
          <p class="voce"><span class="casella"></span>Rinuncia alla partecipazione</p>
        </div>`,
        `<h2>Note allergie / farmaci</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'scrutini') {
      return [
        `<h2>Consiglio di Classe / Interclasse</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Classe / Sezione', campoScrittura())}
          ${rigaAnagrafica('Coordinatore / Presidente', campoScrittura())}
          ${rigaAnagrafica('Data dello scrutinio', campoScrittura())}
        </table>`,
        `<h2>Ordine del giorno</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Approvazione voti</p>
          <p class="voce"><span class="casella"></span>Giudizi sintetici</p>
          <p class="voce"><span class="casella"></span>Certificazione delle competenze</p>
        </div>`,
        `<h2>Griglia esiti per disciplina</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Disciplina 1', campoScrittura())}
          ${rigaAnagrafica('Disciplina 2', campoScrittura())}
          ${rigaAnagrafica('Disciplina 3', campoScrittura())}
          ${rigaAnagrafica('Disciplina 4', campoScrittura())}
        </table>`,
        `<h2>Firme del Consiglio</h2>
        <div class="firme-ruoli">
          <p>Docente Segretario: <span class="riga-firma"></span></p>
          <p>Dirigente Scolastico: <span class="riga-firma"></span></p>
        </div>`,
      ];
    }
    if (tipo === 'mensa') {
      return [
        `<h2>Tipologia richiesta</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Iscrizione al servizio</p>
          <p class="voce"><span class="casella"></span>Rinuncia al servizio</p>
          <p class="voce"><span class="casella"></span>Dieta speciale etico-religiosa o sanitaria (allegare certificato medico)</p>
        </div>`,
        `<h2>Dati di fatturazione / Comune</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Intestatario / fatturazione', campoScrittura())}
          ${rigaAnagrafica('Comune / Ente gestore', campoScrittura())}
        </table>`,
      ];
    }
    if (tipo === 'crediti_formativi') {
      return [
        `<h2>Dettaglio Attività / Credito</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Sportiva</p>
          <p class="voce"><span class="casella"></span>Volontariato</p>
          <p class="voce"><span class="casella"></span>Lingue / Certificazioni</p>
          <p class="voce"><span class="casella"></span>Musica</p>
          <p class="voce"><span class="casella"></span>Altro (specificare)</p>
        </div>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Ente / Associazione erogatore', campoScrittura())}
          ${rigaAnagrafica('Ore complessive svolte', campoScrittura())}
          ${rigaAnagrafica('Periodo di svolgimento', campoScrittura())}
        </table>`,
        `<h2>Documentazione allegata</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Attestato / Certificazione rilasciato dall'Ente</p>
          <p class="voce"><span class="casella"></span>Relazione sull'attività svolta</p>
        </div>`,
      ];
    }
    if (tipo === 'pdp_bes') {
      return [
        `<h2>Tipologia BES / DSA</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>DSA (L. 170/2010 con diagnosi)</p>
          <p class="voce"><span class="casella"></span>BES (svantaggio socio-economico / linguistico / culturale)</p>
          <p class="voce"><span class="casella"></span>Altro</p>
        </div>`,
        `<h2>Misure Compensative &amp; Dispensative</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Tempi aggiuntivi</p>
          <p class="voce"><span class="casella"></span>Uso della calcolatrice</p>
          <p class="voce"><span class="casella"></span>Mappe concettuali</p>
          <p class="voce"><span class="casella"></span>Dispensa dalla lettura ad alta voce</p>
          <p class="voce"><span class="casella"></span>Valutazione personalizzata</p>
        </div>`,
        `<h2>Patto con la Famiglia</h2>
        <div class="firme-ruoli">
          <p>Coordinatore di classe: <span class="riga-firma"></span></p>
          <p>Famiglia / Genitore: <span class="riga-firma"></span></p>
          <p>Dirigente Scolastico: <span class="riga-firma"></span></p>
        </div>`,
      ];
    }
    if (tipo === 'ricorso_reclamo') {
      return [
        `<h2>Oggetto del Reclamo</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Contestazione valutazione / voto</p>
          <p class="voce"><span class="casella"></span>Anomalia servizio / organizzazione scolastica</p>
          <p class="voce"><span class="casella"></span>"Inosservanza del regolamento d'Istituto"</p>
          <p class="voce"><span class="casella"></span>Altro</p>
        </div>`,
        `<h2>Descrizione dei fatti e motivazioni</h2>
        ${righeScrittura(4)}`,
        `<h2>Richiesta</h2>
        <p class="formula-dichiarazione">Si richiede il riesame in autotutela del provvedimento ai sensi della L. 241/1990 e la relativa comunicazione degli esiti.</p>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'delega_famiglia') {
      return [
        `<h2>Tipo di richiesta</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Delega al ritiro dell'alunno da parte di terzi</p>
          <p class="voce"><span class="casella"></span>"Autorizzazione all'uscita autonoma (L. 172/2017)"</p>
          <p class="voce"><span class="casella"></span>Accesso agli atti</p>
        </div>`,
        `<h2>Dati del delegato</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Nome e Cognome del delegato', campoScrittura())}
          ${rigaAnagrafica("Documento d'identità (tipo e n.)", campoScrittura())}
        </table>`,
        `<h2>Allegati</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>"Copia del documento d'identità del delegante"</p>
          <p class="voce"><span class="casella"></span>"Copia del documento d'identità del delegato"</p>
        </div>`,
      ];
    }
    if (tipo === 'istruzione_parentale') {
      return [
        `<h2>Oggetto</h2>
        <p class="formula-dichiarazione">Comunicazione dell'intenzione di avvalersi dell'istruzione parentale ai sensi del D.Lgs. 62/2017 e del DPR 275/1999 per l'anno scolastico ______.</p>`,
        `<h2>Periodo di riferimento</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Anno scolastico', campoScrittura())}
          ${rigaAnagrafica('Inizio / fine del periodo', campoScrittura())}
        </table>`,
        `<h2>Dichiarazione dell'esercente la responsabilità genitoriale</h2>
        <p class="formula-dichiarazione">Il/La sottoscritto/a, consapevole delle responsabilità e delle sanzioni penali stabilite dall'art. 76 del D.P.R. 445/2000 per le false attestazioni e le dichiarazioni mendaci, dichiara sotto la propria responsabilità di aver comunicato tempestivamente la scelta alla scuola.</p>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'permesso_orario') {
      return [
        `<h2>Tipologia di permesso</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Entrata posticipata</p>
          <p class="voce"><span class="casella"></span>Uscita anticipata</p>
          <p class="voce"><span class="casella"></span>Assenza breve</p>
        </div>`,
        `<h2>Dettagli orari</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Data / Giorni', campoScrittura())}
          ${rigaAnagrafica('Orario ingresso / uscita', campoScrittura())}
        </table>`,
        `<h2>Motivazione</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Motivi familiari</p>
          <p class="voce"><span class="casella"></span>Motivi di salute</p>
          <p class="voce"><span class="casella"></span>Trasporti / impegni extrascolastici</p>
          <p class="voce"><span class="casella"></span>Altro (specificare)</p>
        </div>`,
      ];
    }
    if (tipo === 'esonero_motoria') {
      return [
        `<h2>Tipologia di esonero</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Esonero totale</p>
          <p class="voce"><span class="casella"></span>Esonero parziale</p>
          <p class="voce"><span class="casella"></span>Esonero temporaneo</p>
        </div>`,
        `<h2>Periodo richiesto</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Dal', campoScrittura())}
          ${rigaAnagrafica('Al', campoScrittura())}
        </table>`,
        `<h2>Certificato medico</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Certificato del medico di medicina generale allegato</p>
          <p class="voce"><span class="casella"></span>Certificato specialistico allegato</p>
        </div>`,
      ];
    }
    if (tipo === 'accesso_atti') {
      return [
        `<h2>Documenti richiesti</h2>
        ${righeScrittura(2)}`,
        `<h2>Modalità di accesso</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Visione degli atti</p>
          <p class="voce"><span class="casella"></span>Copia semplice</p>
          <p class="voce"><span class="casella"></span>Copia autentica</p>
        </div>`,
        `<h2>Motivazione</h2>
        <p class="formula-dichiarazione">Richiesta di accesso ai documenti amministrativi ai sensi dell'art. 22 della L. 241/1990 e del D.Lgs. 104/2010, al fine di tutelare la propria posizione giuridica soggettiva.</p>
        ${righeScrittura(1)}`,
      ];
    }
    if (tipo === 'consenso_foto') {
      return [
        `<h2>Consenso</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Consenso al trattamento e alla pubblicazione di immagini / riprese video</p>
          <p class="voce"><span class="casella"></span>Nessun consenso alla pubblicazione</p>
        </div>`,
        `<h2>Finalità e ambiti di utilizzo</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Sito web della scuola</p>
          <p class="voce"><span class="casella"></span>Pagine social dell'Istituto</p>
          <p class="voce"><span class="casella"></span>Giornalino / materiali informativi</p>
          <p class="voce"><span class="casella"></span>Eventi e manifestazioni scolastiche</p>
        </div>`,
        `<h2>Revoca</h2>
        <p class="formula-dichiarazione">Il consenso può essere revocato in ogni momento con comunicazione scritta alla scuola; i dati saranno trattati ai sensi del Reg. UE 2016/679 (GDPR).</p>`,
      ];
    }
    if (tipo === 'borsa_studio') {
      return [
        `<h2>Bando e Ente erogatore</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>EDISU</p>
          <p class="voce"><span class="casella"></span>ALISEO</p>
          <p class="voce"><span class="casella"></span>DSU / altro ente regionale</p>
        </div>`,
        `<h2>Requisiti</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Iscritto/a regolarmente al corso</p>
          <p class="voce"><span class="casella"></span>ISEE entro i limiti del bando</p>
          <p class="voce"><span class="casella"></span>Requisiti di merito (CFU) maturati</p>
        </div>`,
        `<h2>Dichiarazioni</h2>
        <p class="formula-dichiarazione">Il/La sottoscritto/a, consapevole delle responsabilità e delle sanzioni penali stabilite dall'art. 76 del D.P.R. 445/2000, dichiara sotto la propria responsabilità la veridicità dei dati e dei requisiti dichiarati ai fini del bando.</p>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'ricorso_borsa') {
      return [
        `<h2>Oggetto del ricorso</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Contestazione graduatoria provvisoria</p>
          <p class="voce"><span class="casella"></span>Contestazione graduatoria definitiva</p>
          <p class="voce"><span class="casella"></span>Mancata ammissione alla borsa</p>
          <p class="voce"><span class="casella"></span>Rideterminazione dell'importo</p>
        </div>`,
        `<h2>Motivazioni</h2>
        ${righeScrittura(4)}`,
        `<h2>Richiesta</h2>
        <p class="formula-dichiarazione">Si richiede il riesame in autotutela del provvedimento ai sensi della L. 241/1990 e la nuova valutazione della posizione nella graduatoria.</p>
        ${righeScrittura(1)}`,
      ];
    }
    if (tipo === 'isee_universita') {
      return [
        `<h2>Valore ISEE</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Valore ISEE (in euro)', campoScrittura())}
          ${rigaAnagrafica('Anno di riferimento', campoScrittura())}
        </table>`,
        `<h2>Dichiarazione</h2>
        <p class="formula-dichiarazione">Il/La sottoscritto/a, consapevole delle responsabilità e delle sanzioni penali stabilite dall'art. 76 del D.P.R. 445/2000, dichiara sotto la propria responsabilità la veridicità del valore ISEE e dei dati dichiarati.</p>
        ${righeScrittura(2)}`,
        `<h2>Documenti allegati</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Attestazione ISEE / DSU</p>
          <p class="voce"><span class="casella"></span>Copia del documento di riconoscimento</p>
        </div>`,
      ];
    }
    if (tipo === 'riduzione_contributi') {
      return [
        `<h2>Motivo della richiesta</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Variazione del valore ISEE</p>
          <p class="voce"><span class="casella"></span>Errore nel calcolo del contributo</p>
          <p class="voce"><span class="casella"></span>Sopravvenienza di condizioni economiche</p>
          <p class="voce"><span class="casella"></span>Altro (specificare)</p>
        </div>`,
        `<h2>Riferimenti del versamento</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Contributo unico versato (euro)', campoScrittura())}
          ${rigaAnagrafica('Data di versamento', campoScrittura())}
        </table>`,
        `<h2>Documentazione allegata</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Nuova attestazione ISEE</p>
          <p class="voce"><span class="casella"></span>Ricevuta di pagamento</p>
          <p class="voce"><span class="casella"></span>Autocertificazione dei fatti dichiarati</p>
        </div>`,
      ];
    }
    if (tipo === 'contributo_straordinario') {
      return [
        `<h2>Motivo del disagio economico</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Perdita del lavoro / cassa integrazione</p>
          <p class="voce"><span class="casella"></span>Eventi di salute gravi in famiglia</p>
          <p class="voce"><span class="casella"></span>Altre situazioni di difficoltà economica</p>
        </div>`,
        `<h2>Descrizione della situazione</h2>
        ${righeScrittura(3)}`,
        `<h2>Documentazione allegata</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Documentazione comprovante la situazione</p>
          <p class="voce"><span class="casella"></span>Attestazione ISEE aggiornata</p>
        </div>`,
      ];
    }
    if (tipo === 'integrativo_erasmus') {
      return [
        `<h2>Programma di mobilità</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Erasmus+ Studio</p>
          <p class="voce"><span class="casella"></span>Erasmus+ Traineeship</p>
          <p class="voce"><span class="casella"></span>Mobilità extra UE</p>
        </div>`,
        `<h2>Destinazione e periodo</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Ateneo di destinazione', campoScrittura())}
          ${rigaAnagrafica('Paese', campoScrittura())}
          ${rigaAnagrafica('Periodo (dal / al)', campoScrittura())}
        </table>`,
        `<h2>Integrazione richiesta</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Importo borsa base (euro)', campoScrittura())}
          ${rigaAnagrafica('Importo integrativo richiesto (euro)', campoScrittura())}
        </table>`,
      ];
    }
    if (tipo === 'collaborazioni_studentesche') {
      return [
        `<h2>Tipologia di collaborazione</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Collaborazione 200 ore (part-time studentesco)</p>
          <p class="voce"><span class="casella"></span>Tutorato retribuito</p>
          <p class="voce"><span class="casella"></span>Altro (specificare)</p>
        </div>`,
        `<h2>Area di interesse</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Biblioteca</p>
          <p class="voce"><span class="casella"></span>Laboratori informatici / scientifici</p>
          <p class="voce"><span class="casella"></span>Segreterie e uffici</p>
          <p class="voce"><span class="casella"></span>Servizi agli studenti</p>
        </div>`,
        `<h2>Disponibilità oraria</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Ore settimanali disponibili', campoScrittura())}
          ${rigaAnagrafica('Fascia oraria preferita', campoScrittura())}
        </table>`,
      ];
    }
    if (tipo === 'esenzione_tasse') {
      return [
        `<h2>Tipologia di agevolazione</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Esenzione totale per fascia ISEE</p>
          <p class="voce"><span class="casella"></span>Riduzione del contributo per fascia ISEE</p>
          <p class="voce"><span class="casella"></span>Esonero per merito</p>
          <p class="voce"><span class="casella"></span>Rateizzazione del contributo</p>
        </div>`,
        `<h2>Riferimenti</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Valore ISEE (in euro)', campoScrittura())}
          ${rigaAnagrafica('Contributo / rata da applicare', campoScrittura())}
        </table>`,
        `<h2>Dichiarazioni</h2>
        <p class="formula-dichiarazione">Il/La sottoscritto/a, consapevole delle responsabilità e delle sanzioni penali stabilite dall'art. 76 del D.P.R. 445/2000, dichiara sotto la propria responsabilità la veridicità dei dati e dei requisiti dichiarati ai fini dell'agevolazione.</p>
        ${righeScrittura(1)}`,
      ];
    }
    if (tipo === 'laurea') {
      return [
        `<h2>Tipo di richiesta</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Ammissione alla seduta di laurea</p>
          <p class="voce"><span class="casella"></span>Proclamazione</p>
          <p class="voce"><span class="casella"></span>Deposito tesi</p>
        </div>`,
        `<h2>Sessione di laurea</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Sessione di laurea', campoScrittura())}
          ${rigaAnagrafica('Data seduta (se nota)', campoScrittura())}
        </table>`,
        `<h2>Tesi</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Titolo della tesi', campoScrittura())}
          ${rigaAnagrafica('Relatore / correlatore', campoScrittura())}
        </table>`,
      ];
    }
    if (tipo === 'schede_osservazione') {
      return [
        `<h2>Area di competenza osservata</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Autonomia e identità</p>
          <p class="voce"><span class="casella"></span>Relazione e socialità</p>
          <p class="voce"><span class="casella"></span>Comunicazione e linguaggio</p>
          <p class="voce"><span class="casella"></span>Motorio-prassica</p>
          <p class="voce"><span class="casella"></span>Cognitiva e logico-matematica</p>
        </div>`,
        `<h2>Osservazione</h2>
        ${righeScrittura(3)}`,
        `<h2>Esiti e orientamenti didattici</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'progetto_continuita') {
      return [
        `<h2>Attività proposte</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Laboratori condivisi</p>
          <p class="voce"><span class="casella"></span>Incontri con le famiglie</p>
          <p class="voce"><span class="casella"></span>Open day / scuola aperta</p>
        </div>`,
        `<h2>Consenso alla partecipazione</h2>
        <p class="formula-dichiarazione">Consenso alla partecipazione del bambino alle attività del progetto continuità nido-infanzia e al trattamento dei dati per le finalità del progetto.</p>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Consenso alla partecipazione</p>
          <p class="voce"><span class="casella"></span>Consenso a foto / materiali del progetto</p>
        </div>`,
        `<h2>Note</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'servizi_prepost') {
      return [
        `<h2>Servizio richiesto</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Pre-scuola</p>
          <p class="voce"><span class="casella"></span>Post-scuola</p>
          <p class="voce"><span class="casella"></span>Pre e post-scuola</p>
        </div>`,
        `<h2>Orari</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Ingresso pre-scuola', campoScrittura())}
          ${rigaAnagrafica('Uscita post-scuola', campoScrittura())}
          ${rigaAnagrafica('Giorni di frequenza', campoScrittura())}
        </table>`,
        `<h2>Note / esigenze particolari</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'rinuncia_iscrizione') {
      return [
        `<h2>Motivo della rinuncia</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Trasferimento in altra città</p>
          <p class="voce"><span class="casella"></span>Cambio di istituto</p>
          <p class="voce"><span class="casella"></span>Scelta di istruzione parentale</p>
          <p class="voce"><span class="casella"></span>Altro (specificare)</p>
        </div>`,
        `<h2>Decorrenza</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Data di decorrenza', campoScrittura())}
          ${rigaAnagrafica('Data di ultima frequenza', campoScrittura())}
        </table>`,
        `<h2>Restituzione documenti</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Pagelle / documenti di valutazione</p>
          <p class="voce"><span class="casella"></span>Certificati e attestati</p>
          <p class="voce"><span class="casella"></span>Documenti personali dell'alunno</p>
        </div>`,
      ];
    }
    if (tipo === 'certificazione_competenze') {
      return [
        `<h2>Competenze certificate</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Comunicazione nella madrelingua</p>
          <p class="voce"><span class="casella"></span>Comunicazione in lingue straniere</p>
          <p class="voce"><span class="casella"></span>Competenza matematica e scientifica</p>
          <p class="voce"><span class="casella"></span>Competenza digitale</p>
          <p class="voce"><span class="casella"></span>Imparare a imparare</p>
        </div>`,
        `<h2>Livelli</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>In via di prima acquisizione</p>
          <p class="voce"><span class="casella"></span>Base</p>
          <p class="voce"><span class="casella"></span>Intermedio</p>
          <p class="voce"><span class="casella"></span>Avanzato</p>
        </div>`,
        `<h2>Note</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'piano_personalizzato') {
      return [
        `<h2>Ambito di personalizzazione</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Didattica disciplinare</p>
          <p class="voce"><span class="casella"></span>Metodo di studio</p>
          <p class="voce"><span class="casella"></span>Tempi e modalità di verifica</p>
          <p class="voce"><span class="casella"></span>Strumenti e materiali</p>
        </div>`,
        `<h2>Interventi previsti</h2>
        ${righeScrittura(3)}`,
        `<h2>Verifica e monitoraggio</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'progetti_fondi') {
      return [
        `<h2>Progetto di riferimento</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Titolo del progetto', campoScrittura())}
          ${rigaAnagrafica('Avviso / bando (PON, POR, PNRR)', campoScrittura())}
        </table>`,
        `<h2>Consenso alla partecipazione</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Consenso alla frequenza delle attività</p>
          <p class="voce"><span class="casella"></span>Consenso al trattamento dei dati (GDPR)</p>
        </div>`,
        `<h2>Note</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'liberatoria_sport') {
      return [
        `<h2>Attività sportiva</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Tornei interni</p>
          <p class="voce"><span class="casella"></span>Campionati studenteschi</p>
          <p class="voce"><span class="casella"></span>Attività motoria extracurricolare</p>
        </div>`,
        `<h2>Consenso e dichiarazioni</h2>
        <p class="formula-dichiarazione">Consenso alla partecipazione alle attività sportive e dichiarazione di essere a conoscenza dei rischi connessi, con esonero di responsabilità dell'Istituzione per comportamenti non conformi alle indicazioni dei docenti.</p>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Certificato medico non agonistico allegato</p>
        </div>`,
        `<h2>Note</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'cambio_sezione') {
      return [
        `<h2>Tipo di richiesta</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Cambio sezione</p>
          <p class="voce"><span class="casella"></span>Cambio indirizzo di studio</p>
          <p class="voce"><span class="casella"></span>Cambio corso</p>
        </div>`,
        `<h2>Motivazione</h2>
        ${righeScrittura(3)}`,
        `<h2>Disponibilità</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Accettazione degli orari della nuova sezione</p>
          <p class="voce"><span class="casella"></span>Disponibilità a trasferirsi in altra sede</p>
        </div>`,
      ];
    }
    if (tipo === 'assemblea_studenti') {
      return [
        `<h2>Tipo di assemblea</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Assemblea di classe</p>
          <p class="voce"><span class="casella"></span>Assemblea d'Istituto</p>
        </div>`,
        `<h2>Oggetto e ordine del giorno</h2>
        ${righeScrittura(3)}`,
        `<h2>Richiedenti</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Numero di studenti richiedenti', campoScrittura())}
          ${rigaAnagrafica('Portavoce / referente', campoScrittura())}
        </table>`,
      ];
    }
    if (tipo === 'esonero_tasse') {
      return [
        `<h2>Motivo dell'esonero</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Condizioni economiche (ISEE)</p>
          <p class="voce"><span class="casella"></span>Esonero per merito</p>
          <p class="voce"><span class="casella"></span>Esonero per disabilità</p>
          <p class="voce"><span class="casella"></span>Altro (specificare)</p>
        </div>`,
        `<h2>Riferimenti</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Valore ISEE (in euro)', campoScrittura())}
          ${rigaAnagrafica('Contributi versati / rate', campoScrittura())}
        </table>`,
        `<h2>Dichiarazioni</h2>
        <p class="formula-dichiarazione">Il/La sottoscritto/a, consapevole delle responsabilità e delle sanzioni penali stabilite dall'art. 76 del D.P.R. 445/2000, dichiara sotto la propria responsabilità la veridicità dei dati e dei requisiti dichiarati ai fini dell'esonero.</p>
        ${righeScrittura(1)}`,
      ];
    }
    if (tipo === 'ammissione_esami') {
      return [
        `<h2>Tipo di esame</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Esame di Stato del I ciclo</p>
          <p class="voce"><span class="casella"></span>Esame di Stato del II ciclo</p>
          <p class="voce"><span class="casella"></span>Esame di idoneità</p>
        </div>`,
        `<h2>Candidato</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica("Candidato interno / esterno", campoScrittura())}
          ${rigaAnagrafica("Sede d'esame", campoScrittura())}
        </table>`,
        `<h2>Requisiti</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Requisiti di frequenza maturati</p>
          <p class="voce"><span class="casella"></span>Crediti / voti maturati</p>
          <p class="voce"><span class="casella"></span>Documentazione allegata</p>
        </div>`,
      ];
    }
    if (tipo === 'crediti_scolastici') {
      return [
        `<h2>Tipologia di credito</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Credito scolastico</p>
          <p class="voce"><span class="casella"></span>Credito formativo (attività esterne)</p>
          <p class="voce"><span class="casella"></span>Credito per certificazioni</p>
        </div>`,
        `<h2>Dettaglio dell'attività</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Ente / istituzione erogatrice', campoScrittura())}
          ${rigaAnagrafica('Ore / periodi', campoScrittura())}
          ${rigaAnagrafica('Attestato / documentazione', campoScrittura())}
        </table>`,
        `<h2>Richiesta di riconoscimento</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'certificato_diploma') {
      return [
        `<h2>Documento richiesto</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Certificato di diploma / qualifica</p>
          <p class="voce"><span class="casella"></span>Certificato sostitutivo</p>
          <p class="voce"><span class="casella"></span>Copia conforme all'originale</p>
        </div>`,
        `<h2>Riferimenti</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Anno di conseguimento', campoScrittura())}
          ${rigaAnagrafica('Istituzione scolastica', campoScrittura())}
        </table>`,
        `<h2>Dichiarazione</h2>
        <p class="formula-dichiarazione">Il/La sottoscritto/a, consapevole delle responsabilità e delle sanzioni penali stabilite dall'art. 76 del D.P.R. 445/2000, dichiara sotto la propria responsabilità la veridicità dei dati indicati.</p>
        ${righeScrittura(1)}`,
      ];
    }
    if (tipo === 'relazione_finale') {
      return [
        `<h2>Esiti del percorso</h2>
        ${righeScrittura(3)}`,
        `<h2>Obiettivi raggiunti / da rivedere</h2>
        ${righeScrittura(2)}`,
        `<h2>Proposte per il successivo anno</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'trasporto_protetto') {
      return [
        `<h2>Tipologia di trasporto</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Scuolabus con assistente dedicato</p>
          <p class="voce"><span class="casella"></span>Trasporto individuale</p>
          <p class="voce"><span class="casella"></span>Trasporto accompagnato da personale</p>
        </div>`,
        `<h2>Dati del percorso</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Luogo di partenza', campoScrittura())}
          ${rigaAnagrafica('Orario andata / ritorno', campoScrittura())}
          ${rigaAnagrafica('Accompagnatore / assistente', campoScrittura())}
        </table>`,
        `<h2>Note sanitarie / esigenze</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'protocollo_intesa') {
      return [
        `<h2>Oggetto del protocollo</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Assistenza specialistica</p>
          <p class="voce"><span class="casella"></span>Assistenza educativa</p>
          <p class="voce"><span class="casella"></span>Interventi sanitari / riabilitativi</p>
        </div>`,
        `<h2>Parti coinvolte</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica("Ente / Istituzione", campoScrittura())}
          ${rigaAnagrafica("Referente dell'accordo", campoScrittura())}
        </table>`,
        `<h2>Durata e risorse</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica("Durata dell'intesa", campoScrittura())}
          ${rigaAnagrafica('Risorse previste', campoScrittura())}
        </table>`,
      ];
    }
    if (tipo === 'patrocinio_locali') {
      return [
        `<h2>Tipo di richiesta</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Patrocinio dell'iniziativa</p>
          <p class="voce"><span class="casella"></span>Uso dei locali scolastici</p>
          <p class="voce"><span class="casella"></span>Sponsorizzazione</p>
        </div>`,
        `<h2>Iniziativa</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica("Titolo dell'iniziativa", campoScrittura())}
          ${rigaAnagrafica('Data / periodo', campoScrittura())}
          ${rigaAnagrafica('Luogo', campoScrittura())}
        </table>`,
        `<h2>Impegni e responsabilità</h2>
        ${righeScrittura(2)}`,
      ];
    }
    if (tipo === 'convenzione_pcto') {
      return [
        `<h2>Tipo di convenzione</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>PCTO (ex alternanza scuola-lavoro)</p>
          <p class="voce"><span class="casella"></span>Tirocinio curriculare</p>
          <p class="voce"><span class="casella"></span>Stage estivo</p>
        </div>`,
        `<h2>Dati dell'azienda / ente</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Ragione sociale', campoScrittura())}
          ${rigaAnagrafica('Sede', campoScrittura())}
          ${rigaAnagrafica('Tutore aziendale', campoScrittura())}
        </table>`,
        `<h2>Periodo e orari</h2>
        <table class="quadro-anagrafico">
          ${rigaAnagrafica('Inizio / fine', campoScrittura())}
          ${rigaAnagrafica('Orario settimanale', campoScrittura())}
        </table>`,
      ];
    }
    if (tipo === 'segnalazione_anomalia') {
      return [
        `<h2>Oggetto della segnalazione</h2>
        <div class="crocette">
          <p class="voce"><span class="casella"></span>Servizio mensa</p>
          <p class="voce"><span class="casella"></span>Trasporto scolastico</p>
          <p class="voce"><span class="casella"></span>Pulizia e manutenzione</p>
          <p class="voce"><span class="casella"></span>Organizzazione didattica</p>
        </div>`,
        `<h2>Descrizione dell'anomalia</h2>
        ${righeScrittura(3)}`,
        `<h2>Richiesta</h2>
        <p class="formula-dichiarazione">Si richiede l'intervento di verifica e la comunicazione degli esiti ai sensi della L. 241/1990.</p>
        ${righeScrittura(1)}`,
      ];
    }
    // assistenza_comune: servizi dell'Ente Locale.
    return [
      `<h2>Dettaglio del servizio richiesto</h2>
      <div class="crocette">
        <p class="voce"><span class="casella"></span>Assistenza all'autonomia e comunicazione</p>
        <p class="voce"><span class="casella"></span>Trasporto scolastico dedicato</p>
        <p class="voce"><span class="casella"></span>Assistenza mensa</p>
      </div>`,
      `<h2>Documenti allegati</h2>
      <div class="crocette">
        <p class="voce"><span class="casella"></span>Verbale di accertamento dell'handicap (L. 104/1992)</p>
        <p class="voce"><span class="casella"></span>PEI / CIS</p>
      </div>`,
    ];
  }
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
        'Tipologia di disabilità (L. 104/1992)',
        [
          'Disabilità sensoriale (visiva / uditiva)',
          'Disabilità motoria',
          'Disabilità intellettiva',
          'Disturbo dello spettro autistico',
          'Altro (specificare)',
        ],
        'Barrare la tipologia di disabilità come indicata dalla certificazione e dalla diagnosi funzionale (L. 104/1992).',
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
    ];
  }
  if (famiglia === 'reclutamento') {
    return [
      `<div class="griglia-2">
        <div>
          ${sezioneCrocette(
            'Tipologia di contratto richiesta',
            [
              'Supplenza breve / fino al termine delle lezioni',
              'Supplenza annuale',
              'Incarico a tempo determinato',
              'Messa a disposizione (MAD)',
            ],
            'Barrare la tipologia di incarico richiesta secondo le vigenti disposizioni ministeriali (O.M. 88/2024).',
          )}
        </div>
        <div>
          ${sezioneCrocette(
            'Disponibilità oraria',
            ['Tempo pieno', 'Part-time (indicare le ore)', 'Solo mattino', 'Solo pomeriggio'],
          )}
        </div>
      </div>`,
      `<h2>Oggetto e Motivazione della Richiesta</h2>
      ${righeScrittura(4)}`,
    ];
  }
  // Dichiarazioni sostitutive (DPR 445/2000): formula giuridica standard, niente crocette.
  if (tipo === 'autocertificazione') {
    return [
      `<h2>Dichiarazione</h2>
      <p class="formula-dichiarazione">Il/La sottoscritto/a, consapevole delle responsabilità e delle sanzioni penali stabilite dall'art. 76 del D.P.R. 445/2000 per le false attestazioni e le dichiarazioni mendaci, dichiara sotto la propria responsabilità:</p>
      ${righeScrittura(4)}`,
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
    `<h2>Oggetto e Motivazione della Richiesta</h2>
      ${righeScrittura(4)}`,
  ];
}

function costruisciModuloFormale(
  query: string,
  profilo?: ProfiloIntervista,
): string {
  const tipo = profilo?.tipo ?? '';
  const famiglia = famigliaDi(profilo);
  const normativa = NORMATIVA_PER_TIPO[tipo] ?? NORMATIVA_DEFAULT;

  const sezioni: string[] = costruisciSezioni(famiglia, tipo);

  // Micro-copy informativo sopra le firme (umano, senza gergo burocratico).
  const microCopy =
    famiglia === 'inclusione'
      ? 'Da sottoscrivere a cura del richiedente / componenti del GLO. Allegare eventuale documentazione integrativa.'
      : 'Da sottoscrivere a cura del richiedente. Allegare eventuale documentazione integrativa.';

  // Nota normativa pulita in calce (niente citazioni duplicate).
  const notaNormativa =
    tipo === 'pei'
      ? 'Modello conforme ai modelli nazionali PEI (D.M. 182/2020, D.Lgs. 66/2017, L. 104/1992). Documento scaricato gratuitamente da ScuoleRadar.it.'
      : famiglia === 'istanza'
        ? 'Modello conforme al D.Lgs. 66/2017, D.M. 182/2020 e D.I. 153/2023. Documento scaricato gratuitamente da ScuoleRadar.it.'
        : `Modello conforme alle Linee Guida del Ministero dell\u2019Istruzione e del Merito. Riferimenti normativi: ${normativa}. Documento scaricato gratuitamente da ScuoleRadar.it.`;

  // Il titolo del documento riporta già tipo e ordine di scuola: niente "Oggetto
  // della richiesta" ridondante né blocco "Contesto della richiesta" (metadati AI
  // non esposti nel corpo). Si procede dritti al quadro anagrafico.
  return `
    ${intestazioneIstituzionale()}
    ${quadroAnagrafico(famiglia, tipo)}
    ${sezioni.join('\n')}
    <div class="blocco-firme">
      ${bloccoConvalidaUnico(microCopy)}
    </div>
    <p class="nota-normativa">${escapeHtml(notaNormativa)}</p>
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

/**
 * Ricerca LOCALE nel catalogo `moduli.ts` (fallback offline / edge function
 * `genera-modulo` non raggiungibile). Ritorna il documento più pertinente
 * alla query o null se non c'è un match sufficiente.
 */
export function trovaModuloLocale(query: string): DocumentoModulistica | null {
  const q = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const parole = q.split(/\s+/).filter((w) => w.length >= 3);
  if (parole.length === 0) return null;

  let best: DocumentoModulistica | null = null;
  let bestScore = 0;

  const punteggio = (testo: string, nelNome: boolean): number => {
    const t = testo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let score = 0;
    for (const w of parole) {
      if (t.includes(w)) score += nelNome ? 3 : 1;
    }
    if (nelNome) {
      // Penalità per parole del NOME estranee alla query: evita che titoli
      // lunghi e generici ("Domanda di passaggio di corso…") battano quelli
      // pertinenti a parità di punteggio.
      for (const w of t.split(/\s+/).filter((x) => x.length >= 3)) {
        if (!parole.includes(w)) score -= 1;
      }
      // Bonus: la query intera compare nel nome → match diretto fortissimo.
      if (parole.length >= 2 && t.includes(q)) score += 5;
    }
    return score;
  };

  const visita = (nodo: SottoCategoriaModulistica) => {
    for (const doc of nodo.documenti ?? []) {
      const score =
        punteggio(doc.nome, true) + punteggio(`${doc.nome} ${doc.descrizione}`, false);
      if (score > bestScore) {
        bestScore = score;
        best = doc;
      }
    }
    for (const sotto of nodo.sotto ?? []) visita(sotto);
  };

  for (const area of macroAreeModulistica) {
    for (const sotto of area.sotto) visita(sotto);
  }
  return bestScore >= 1 ? best : null;
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

