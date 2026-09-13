/**
 * ScuoleRadar.it — Parser Interpelli (FASE 1)
 *
 * Modulo puro e riutilizzabile: a partire da un avviso grezzo (titolo,
 * URL, provincia, testo di contesto) estrae:
 *   - la provincia REALE dell'istituto emittente (codice meccanografico o comune
 *     citato nel testo) — senza applicare fallback fissi su una provincia
 *     (l'ultima spiaggia è la provincia della fonte, che è dinamica);
 *   - il nome dell'istituto emittente, quando riconoscibile (altrimenti null);
 *   - le classi di concorso / sostegno via Regex (A-12, A-026, ADEE, AD24…)
 *   - la data di PUBBLICAZIONE (intestazione/contesto) e la SCADENZA REALE del
 *     bando, tenute DISTINTE: la data di pubblicazione non viene mai assegnata
 *     alla scadenza (nessuna inversione). La scadenza è estratta solo quando il
 *     testo la dichiara (parole chiave tipo "scadenza"/"entro"/"termine") oppure
 *     calcolata da un termine relativo ("entro N giorni dalla pubblicazione").
 *   - l'hash_id SHA-256 univoco (provincia|titolo|data) per l'upsert anti-duplicati
 *
 * Non dipende dalla rete né da Supabase: è testabile in isolamento.
 */

import { createHash } from 'node:crypto';
import { province } from '../data/province.ts';

/* ------------------------------- Tipi ------------------------------- */

export interface InterpelloInput {
  /** Titolo dell'avviso (es. "Interpello supplenza A-026 Matematica e fisica") */
  title: string;
  /** URL della fonte ufficiale */
  link: string | null;
  /**
   * URL alternativi trovati nella stessa voce (es. PDF/circolare/allegato oltre
   * alla pagina). Se presenti, il parser sceglie la fonte MIGLIORE (documento
   * specifico → pagina istituzionale → fallback all'ente). Opzionale.
   */
  linkCandidati?: (string | null)[];
  /** Codice provincia della FONTE (fallback usato solo se il testo non ne indica una). */
  provincia: string;
  /** Nome della sorgente (URL pagina / 'fixture') */
  source: string;
  /** Testo aggiuntivo (contesto HTML) usato per estrarre date e classi */
  corpo?: string;
  /** Data di SCADENZA già nota esplicitamente (es. attributo HTML), libera o ISO YYYY-MM-DD */
  dataNota?: string | null;
  /**
   * Data di PUBBLICAZIONE già nota (es. dall'intestazione/titolo del post o da un
   * attributo `<time datetime>`), libera o ISO YYYY-MM-DD. È distinta dalla scadenza.
   */
  dataPubblicazione?: string | null;
  /** Nome della scuola (se disponibile) */
  schoolName?: string | null;
  /** Codice meccanografico della scuola (se disponibile) */
  schoolCode?: string | null;
}

export interface InterpelloParsato {
  title: string;
  link: string | null;
  province: string;
  classCodes: string[];
  /** Data di PUBBLICAZIONE dell'avviso (ISO YYYY-MM-DD), se rilevata dall'intestazione/contesto */
  publishedAt: string | null;
  /** Data di SCADENZA reale (ISO YYYY-MM-DD): dichiarata nel bando o calcolata, altrimenti null */
  expirationDate: string | null;
  /** SHA256 di `provincia|titolo|data` — chiave anti-duplicato */
  hashId: string;
  source: string;
  schoolName: string | null;
  schoolCode: string | null;
  /** Materia/settore inferito quando manca la classe di concorso (es. "Matematica"). */
  materia: string | null;
  /** Email di candidatura trovata nel testo o nel link (`mailto:`), se presente. */
  contactEmail: string | null;
  /** Link candidati della voce (dettaglio + allegati) usati per l'arricchimento contatti. */
  linkCandidati?: string[];
}

/* --------------------- Regex per le classi di concorso --------------------- */

/**
 * Rileva i codici di classe di concorso:
 *  - formato classico: A-12, A-026, B-02, B-001
 *  - speciali sostegno: ADEE, ADSS, ADMM, AD24, ...
 *  - formato COMPATTO di alcune fonti: A042 → A-042; AB25, AH56, BA02, AR01 (validi)
 */
const RE_CLASSI = /\b(?:[A-Z]{1,2}-\d{2,3}|AD(?:[A-Z]{2,3}|\d{2}))\b/g;
/** 1 lettera + 3 cifre (A042, A040, A028) → normalizzato in A-042, A-040, A-028. */
const RE_CLASSE_COMPATTA_NUM = /\b([A-Z])(\d{3})\b/g;
/** 2 lettere + 2 cifre (AB25, AH56, AR01, BA02, BB02): già il codice reale. */
const RE_CLASSE_COMPATTA_ALFA = /\b([A-Z]{2}\d{2})\b/g;

export function rilevaClassi(testo: string): string[] {
  const t = (testo ?? '').toUpperCase();
  const trovate = new Set<string>(t.match(RE_CLASSI) ?? []);

  let m: RegExpExecArray | null;
  RE_CLASSE_COMPATTA_NUM.lastIndex = 0;
  while ((m = RE_CLASSE_COMPATTA_NUM.exec(t)) !== null) trovate.add(`${m[1]}-${m[2]}`);
  RE_CLASSE_COMPATTA_ALFA.lastIndex = 0;
  while ((m = RE_CLASSE_COMPATTA_ALFA.exec(t)) !== null) trovate.add(m[1]);

  // Esclude placeholder generici non informativi (AAAA, EEEE, …).
  trovate.delete('AAAA');
  trovate.delete('EEEE');
  return [...trovate];
}

/* ----------------- Materia/settore e contatto (dai dati reali) ----------------- */

/**
 * Mappa parola chiave → materia per inferire il settore di un generico "DOCENTE"
 * dai dati della fonte (es. titolo "Avviso per il conferimento di supplenza —
 * DOCENTE"). Ordine significativo: i pattern più specifici vengono PRIMA.
 */
const MATERIE_DA_TESTO: { re: RegExp; materia: string }[] = [
  { re: /sostegno|\badee\b|\badss\b|\badmm\b|\bad24\b/i, materia: 'Sostegno' },
  { re: /scienze?\s+motorie|educazione fisica|motor[ie]|sportiv/i, materia: 'Scienze motorie' },
  { re: /scienze?\s+umane|filosof|pedagogi|psicolog|diritto|economic/i, materia: 'Filosofia / Scienze umane' },
  { re: /matematic/i, materia: 'Matematica' },
  { re: /\bfisica\b/i, materia: 'Fisica' },
  { re: /scienz[ea]|biolog|chimic|geolog|naturali/i, materia: 'Scienze' },
  { re: /italian|letteratur|lettere|\bstori[ae]\b|\blatino\b|\bgreco\b/i, materia: 'Italiano / Storia / Lettere' },
  { re: /inglese|francese|spagnol|tedesc|lingua straniera|linguistico/i, materia: 'Lingue straniere' },
  { re: /informatic/i, materia: 'Informatica' },
  { re: /\barte\b|artistic|disegn|grafic/i, materia: 'Arte' },
  { re: /musica|musicale/i, materia: 'Musica' },
  { re: /religione|\birc\b/i, materia: 'Religione Cattolica' },
  { re: /tecnolog|elettronic|meccanic|elettrotecnic|\bedil|agrar/i, materia: 'Discipline tecniche' },
  { re: /\bprimaria\b|\binfanzia\b/i, materia: 'Scuola primaria/infanzia' },
  { re: /educatore|pedagogist/i, materia: 'Educatore' },
];

/**
 * Inferisce la materia/settore da un titolo/contesto generico: serve a NON
 * mostrare la sola etichetta "Docente". Ritorna null se non riconoscibile.
 */
export function inferisciMateria(testo: string): string | null {
  const t = (testo ?? '').trim();
  if (!t) return null;
  for (const { re, materia } of MATERIE_DA_TESTO) {
    if (re.test(t)) return materia;
  }
  return null;
}

/** Riconosce un indirizzo email (con TLD) nel testo o in un link `mailto:`. */
const RE_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

/** Regex GLOBALE per raccogliere TUTTE le email di un testo. */
const RE_EMAIL_G = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** Entità HTML dei caratteri chiave di un'email (chiocciola, punto, trattino). */
const ENTITA_EMAIL: [RegExp, string][] = [
  [/&#0*64;|&#x0*40;|&commat;/gi, '@'],
  [/&#0*46;|&#x0*2e;|&period;|&dot;/gi, '.'],
  [/&#0*45;|&#x0*2d;/gi, '-'],
  [/&#0*95;|&#x0*5f;/gi, '_'],
];

/**
 * De-offusca gli indirizzi tipici delle TABELLE e delle pagine scolastiche:
 *   "segreteria [at] scuola.edu.it", "protocollo (at) scuola (dot) it",
 *   "info at scuola dot it", "nome &#64; scuola &#46; it", "&commat;".
 * Le varianti con spazi sono applicate SOLO quando il contesto è già di tipo
 * email (un token prima e un dominio/TLD dopo), per non toccare la prosa
 * italiana ("punto di vista", "at" inglese…).
 */
export function deoffuscaEmail(testo?: string | null): string {
  let t = testo ?? '';
  for (const [re, chr] of ENTITA_EMAIL) t = t.replace(re, chr);
  // Simboli tra parentesi/quadre, con eventuali SPAZI attorno (" [at] ", " (dot) ").
  t = t.replace(/\s*[[({]\s*(?:at|chiocciola|at-sign)\s*[\])}]\s*/gi, '@');
  t = t.replace(/\s*[[({]\s*(?:dot|punto)\s*[\])}]\s*/gi, '.');
  // Varianti testuali: prima "dot/punto" (forma il dominio), poi "at/chiocciola".
  // Servono un token prima e un TLD/dominio dopo → la prosa italiana resta intatta.
  // Il ciclo copre le CATENE ("scuola dot edu dot it").
  for (let i = 0; i < 4; i += 1) {
    const prima = t;
    t = t.replace(/\b([a-z0-9._%+-]+)\s+(?:dot|punto)\s+([a-z]{2,})\b/gi, '$1.$2');
    if (t === prima) break;
  }
  t = t.replace(/\b([a-z0-9._%+-]+)\s+(?:at|chiocciola)\s+([a-z0-9-]+(?:\.[a-z]{2,})+)\b/gi, '$1@$2');
  return t;
}

/**
 * TLD "primari" usati dalle fonti scolastiche. Servono a riparare gli indirizzi
 * in cui una parola successiva resta INCOLLATA al dominio perché nell'HTML il
 * testo era spezzato (es. `emailusp.mc@istruzione.it` + "posta" →
 * `…@istruzione.itposta`). Si tronca SOLO verso questi TLD: nel dubbio l'indirizzo
 * resta invariato (non inventiamo domini).
 */
const TLD_PRIMARI = ['com', 'edu', 'gov', 'org', 'net', 'it', 'eu'];

/** Ripara il TLD quando una parola è rimasta incollata al dominio. */
export function normalizzaTldEmail(email: string): string {
  const e = (email ?? '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  const dominio = e.slice(at + 1);
  const parti = dominio.split('.');
  if (parti.length < 2) return e;
  const ultimo = parti[parti.length - 1] ?? '';
  if (TLD_PRIMARI.includes(ultimo)) return e;
  const tld = TLD_PRIMARI.find((t) => ultimo.length > t.length && ultimo.startsWith(t));
  if (!tld) return e; // TLD sconosciuto: nessuna modifica
  parti[parti.length - 1] = tld;
  return `${e.slice(0, at + 1)}${parti.join('.')}`;
}

/** Tutti gli indirizzi email di un testo (univoci, minuscoli, senza punteggiatura finale). */
export function estraiEmails(testo?: string | null): string[] {
  const unici = new Set<string>();
  for (const m of deoffuscaEmail(testo).matchAll(RE_EMAIL_G)) {
    const email = normalizzaTldEmail(m[0].replace(/[.,;:]+$/, ''));
    if (email.includes('@')) unici.add(email);
  }
  return [...unici];
}

/**
 * Email di candidatura per l'invio delle domande, se presente nella fonte:
 *   · `mailto:` nel link dell'avviso;
 *   · altrimenti il PRIMO indirizzo email nel testo (best-effort, senza scoring).
 * Per la scelta "intelligente" tra più indirizzi usa `estraiEmailScuola`.
 */
export function estraiEmail(link?: string | null, testo?: string | null): string | null {
  const daLink = (link ?? '').trim();
  if (/^mailto:/i.test(daLink)) {
    const email = daLink.slice(7).split(/[?;,]/)[0]?.trim() ?? '';
    if (RE_EMAIL.test(email)) return email;
  }
  const m = (testo ?? '').match(RE_EMAIL);
  return m ? m[0].replace(/[.,;:]+$/, '') : null;
}

/**
 * Email ISTITUZIONALE/PEC "forte": dominio affidabile (`.edu.it`, `istruzione.it`,
 * `pec.istruzione.it`). È il segnale più forte di una casella scolastica.
 */
export const RE_EMAIL_SCUOLA =
  /\b[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9.-]+\.edu\.it|[A-Za-z0-9.-]+\.gov\.it|[A-Za-z0-9.-]+\.edu|pec\.istruzione\.it|istruzione\.it)\b/i;

/** Etichette tipiche di un dominio scolastico (es. `iclorenzini.edu.it`, `iisverdi.it`). */
const RE_DOMINIO_SCUOLA =
  /(^|\.)(ic|ics|cd|sm|scuola|scuole|istitut|istcomp|iis|ips|ipsia|itc|itg|itis|itn|ipsct|liceo|licei|convitto|cpia|lgs|lgt|direzionedidattica)[a-z0-9-]*\./i;

/** Parole/etichette tipiche di una casella scolastica (segreteria, protocollo…). */
const RE_LOCAL_SCUOLA =
  /(^|[._-])(ic|ics|cd|sm|scuola|istituto|iis|ips|ipsia|itc|itg|itis|liceo|licei|convitto|cpia|segreteria|protocollo|direzione|dirigenza|presidenza|amministrazione|urp|personale|didattica|docenti|studenti|alunni|info|segr)/i;

/** Domini personali/generici: esistono nei testi ma NON sono la casella di candidatura. */
const RE_DOMINIO_GENERICO =
  /(gmail|googlemail|libero|hotmail|outlook|live|yahoo|virgilio|tiscali|alice|icloud|me\.com|proton|pm\.me)/i;

export interface ContestoEmailScuola {
  /** Codice meccanografico della scuola (per correlare l'email all'istituto). */
  schoolCode?: string | null;
  /** Nome della scuola (per correlare l'email all'istituto). */
  schoolName?: string | null;
}

/** Token significativi del nome scuola (esclude le parole generiche). */
function tokenNomeScuola(nome?: string | null): string[] {
  const GENERICHE = new Set([
    'liceo', 'licei', 'istituto', 'scuola', 'scuole', 'comprensivo', 'comprensiva',
    'statale', 'superiore', 'superiori', 'tecnico', 'tecnica', 'professionale',
    'primaria', 'secondaria', 'grado', 'dell', 'della', 'delle', 'degli', 'istruzione',
  ]);
  return (nome ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERICHE.has(t));
}

/**
 * Punteggio di pertinenza scolastica di un'email (più alto = più probabile che
 * sia la casella giusta per candidarsi). Serve a scegliere tra più indirizzi.
 */
export function punteggioEmailScuola(email: string, ctx: ContestoEmailScuola = {}): number {
  const e = (email ?? '').toLowerCase();
  const at = e.indexOf('@');
  if (at < 1) return -Infinity;
  const local = e.slice(0, at);
  const dominio = e.slice(at + 1);
  let p = 0;

  if (RE_EMAIL_SCUOLA.test(e)) p += 50; // .edu.it / .gov.it / .edu / istruzione.it / pec.istruzione.it
  if (RE_DOMINIO_SCUOLA.test(dominio)) p += 30; // dominio tipo ic/iis/liceo…
  if (/\.gov\.it$/.test(dominio)) p += 30; // dominio pubblico affidabile
  if (RE_LOCAL_SCUOLA.test(local)) p += 15; // casella tipo segreteria/protocollo/ic…
  if (/(segreteria|protocollo|direzione|dirigenza|presidenza|amministrazione|urp|personale|segr)/.test(local)) p += 10;
  if (/pec\./.test(dominio)) p += 5;

  // Correlazione diretta con l'istituto (codice meccanografico / nome).
  const codice = (ctx.schoolCode ?? '').trim().toLowerCase();
  if (codice && (e.includes(codice) || dominio.includes(codice))) p += 60;
  for (const tk of tokenNomeScuola(ctx.schoolName)) {
    if (dominio.includes(tk) || local.includes(tk)) {
      p += 25;
      break;
    }
  }

  // Rumore: caselle personali/generiche non sono l'indirizzo di candidatura.
  if (RE_DOMINIO_GENERICO.test(dominio)) p -= 40;
  return p;
}

/**
 * Email di candidatura della scuola scelta tra PIÙ fonti (mai inventata):
 *   · `mailto:` nel link;
 *   · TUTTE le email del testo (non solo la prima);
 *   · preferenza per domini/caselle scolastiche e per l'istituto (codice/nome).
 * Restituisce `null` SOLO se non esiste alcun indirizzo → "Email non disponibile".
 */
export function estraiEmailScuola(
  link?: string | null,
  testo?: string | null,
  ctx: ContestoEmailScuola = {},
): string | null {
  const candidati = new Set<string>();
  const daLink = (link ?? '').trim();
  if (/^mailto:/i.test(daLink)) {
    const email = daLink.slice(7).split(/[?;,]/)[0]?.trim().toLowerCase() ?? '';
    if (RE_EMAIL.test(email)) candidati.add(email);
  }
  for (const email of estraiEmails(testo)) candidati.add(email);
  if (candidati.size === 0) return null;

  let migliore: string | null = null;
  let migliorPunteggio = -Infinity;
  for (const email of candidati) {
    const p = punteggioEmailScuola(email, ctx);
    if (p > migliorPunteggio) {
      migliorPunteggio = p;
      migliore = email;
    }
  }
  return migliore;
}

/**
 * Codice meccanografico della scuola (es. `BSIS02900X`), se presente nel testo.
 * Serve a RICONOSCERE il portale/le pagine istituzionali legate alla scuola.
 */
const RE_CODICE_MECCANOGRAFICO = /\b([A-Z]{2}[A-Z0-9]{4}\d{3}[A-Z0-9])\b/i;

/** Estrae il codice meccanografico dal testo (mai inventato), altrimenti null. */
export function estraiCodiceMeccanografico(testo?: string | null): string | null {
  const m = (testo ?? '').match(RE_CODICE_MECCANOGRAFICO);
  return m ? m[1].toUpperCase() : null;
}

/* ------------------- Validazione fonte (anti-mock / anti-dummy) ------------------- */

/**
 * Segnali di URL NON reale: mock, placeholder, ambienti di test/locali.
 * Applicato alla FONTE (URL) per rifiutare dati fittizi o di prova.
 */
const RE_SEGNALE_URL =
  /(example\.(com|org|net)|localhost|127\.0\.0\.1|0\.0\.0\.0|:5173|:3000|:8080|mockup|\bmock\b|\bsample\b|\bdummy\b|placeholder|\bfixture\b|esempio|\btest\b|\bdemo\b)/i;

/** Segnali di test/mock nel TITOLO (set ristretto, per evitare falsi positivi). */
const RE_SEGNALE_TITOLO =
  /(example\.(com|org|net)|\bmock\b|\bsample\b|\bdummy\b|placeholder|\bfixture\b|esempio)/i;

/** Piattaforme NON istituzionali: social, hosting/blog generici, URL shortener. */
const RE_HOST_NON_ISTITUZIONALE =
  /(facebook|instagram|twitter|(^|\.)x\.com|linkedin|t\.me|telegram|pinterest|whatsapp|youtube|(^|\.)google\.|altervista|blogspot|wordpress\.com|wixsite|iubenda|freepik|bit\.ly|tinyurl)/i;

/* ------------- Fallback istituzionale dell'ente (USP/USR/Scuola) ------------- */

/**
 * Pagine istituzionali di fallback per REGIONE (Ufficio Scolastico Regionale),
 * usate SOLO quando non esiste un link specifico/verificato dell'avviso.
 *
 * ⚠️ Solo URL UFFICIALI VERIFICATI: se una regione non è mappata non si inventa
 * nulla → si resta sul link specifico (o l'avviso viene scartato a monte). Lo
 * scraper testa comunque a runtime ogni URL (verificaLink): nessun link rotto
 * viene mai persistito. Per aggiungere una regione: verificare prima la URL.
 */
export const REGIONI_USR: Record<string, string> = {
  Piemonte: 'https://www.istruzionepiemonte.it/',
  Veneto: 'https://www.istruzioneveneto.gov.it/',
  'Emilia-Romagna': 'https://www.istruzioneer.gov.it/',
  Liguria: 'https://www.istruzioneliguria.it/',
  Sicilia: 'https://www.usr-sicilia.it/',
};

/** Suffissi di host riconosciuti come istituzionali (Pubblica Amministrazione/scuola). */
const RE_HOST_ISTITUZIONALE = /(\.edu\.it|\.istruzione\.it|\.gov\.it)$/i;

/** Host degli enti mappati non coperti dai suffissi (es. istruzionepiemonte.it). */
const HOST_ENTI_MAPPATI = new Set<string>(
  Object.values(REGIONI_USR)
    .map((u) => {
      try {
        return new URL(u).host.toLowerCase();
      } catch {
        return '';
      }
    })
    .filter(Boolean),
);

/** True se l'host dell'URL è quello di un ente istituzionale (USP/USR/Scuola). */
export function eHostIstituzionale(url?: string | null): boolean {
  let host = '';
  try {
    host = new URL((url ?? '').trim()).host.toLowerCase();
  } catch {
    return false;
  }
  return RE_HOST_ISTITUZIONALE.test(host) || HOST_ENTI_MAPPATI.has(host);
}

/**
 * True se l'URL è accettabile come FALLBACK all'ente: http(s), host istituzionale
 * (anche la radice del dominio, es. `https://www.istruzionepiemonte.it/`) e
 * nessun segnale di mock/segnaposto. NON è un social né un aggregatore.
 */
export function eFonteEnte(url?: string | null): boolean {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  if (RE_SEGNALE_URL.test(u)) return false;
  return eHostIstituzionale(u);
}

/** Pagina istituzionale dell'ente competente per una provincia, se mappata. */
export function urlIstituzionaleEnte(provincia: string): string | null {
  const codice = (provincia ?? '').trim().toUpperCase();
  const regione = province.find((p) => p.codice === codice)?.regione;
  return regione ? (REGIONI_USR[regione] ?? null) : null;
}

/** True se l'URL punta a un DOCUMENTO specifico (PDF, circolare, allegato, upload). */
export function eUrlDocumento(url?: string | null): boolean {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    const p = new URL(u);
    const path = `${p.pathname}${p.search}`.toLowerCase();
    return /(\.pdf|\.docx?|\.odt|allegato|circolare|documento|protocollo|wp-content\/uploads)/i.test(path);
  } catch {
    return false;
  }
}

/**
 * Sceglie la fonte MIGLIORE per l'interpello:
 *   1. documento specifico (PDF/circolare/allegato) verificato;
 *   2. pagina istituzionale specifica (preferendo quella legata alla scuola);
 *   3. qualsiasi pagina specifica verificata;
 *   4. fallback: pagina istituzionale generica dell'ente (USP/USR), se mappata;
 *   5. `null` (nessun link inventato: l'avviso viene scartato a monte).
 */
export function scegliUrlFonte(
  candidati: Array<string | null | undefined>,
  ctx: { provincia: string; schoolCode?: string | null } = { provincia: '' },
): string | null {
  const validi = [...new Set(candidati.map((c) => (c ?? '').trim()).filter(Boolean))].filter((c) =>
    eSorgenteVerificata(c),
  );

  const documento = validi.find((c) => eUrlDocumento(c));
  if (documento) return documento;

  const codice = (ctx.schoolCode ?? '').trim().toUpperCase();
  const dellaScuola = codice
    ? validi.find((c) => eHostIstituzionale(c) && c.toUpperCase().includes(codice))
    : undefined;
  if (dellaScuola) return dellaScuola;

  const istituzionale = validi.find((c) => eHostIstituzionale(c));
  if (istituzionale) return istituzionale;

  if (validi.length > 0) return validi[0];

  return urlIstituzionaleEnte(ctx.provincia);
}

/**
 * True se l'URL è una FONTE ufficiale VERIFICABILE:
 *   · http(s) valido;
 *   · nessun segnale di mock/test/placeholder;
 *   · host NON su piattaforme non istituzionali;
 *   · deep-link (non la sola root del dominio).
 */
export function eSorgenteVerificata(url?: string | null): boolean {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  if (RE_SEGNALE_URL.test(u)) return false;
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return false;
  }
  if (RE_HOST_NON_ISTITUZIONALE.test(parsed.host)) return false;
  // Deve rimandare a una pagina/documento specifico (non la homepage del dominio).
  if (parsed.pathname === '/' && !parsed.search) return false;
  return true;
}

export interface EsitoVerificaAvviso {
  ok: boolean;
  /** Motivo del rifiuto (undefined se ok). */
  motivo?: string;
}

/**
 * Verifica un avviso PRIMA del salvataggio: rifiuta titoli vuoti/troppo corti,
 * titoli con segnali di test/mock e fonti non ufficiali/non verificabili.
 * Regola anti-dummy della pipeline di ingestione.
 *
 * `fonteEnte` = true quando il link è il FALLBACK istituzionale dell'ente
 * (USP/USR): in quel caso è ammessa anche la radice del dominio (es.
 * `https://www.istruzionepiemonte.it/`), che `eSorgenteVerificata` rifiuta.
 */
export function verificaAvviso(a: {
  title?: string | null;
  link?: string | null;
  fonteEnte?: boolean;
}): EsitoVerificaAvviso {
  const titolo = (a.title ?? '').trim();
  if (titolo.length < 8) return { ok: false, motivo: 'titolo troppo corto' };
  if (RE_SEGNALE_TITOLO.test(titolo)) return { ok: false, motivo: 'titolo con segnali test/mock' };
  const url = (a.link ?? '').trim();
  if (!url) return { ok: false, motivo: 'fonte mancante' };
  const valida = a.fonteEnte ? eFonteEnte(url) : eSorgenteVerificata(url);
  if (!valida) return { ok: false, motivo: 'fonte non ufficiale/non verificabile' };
  return { ok: true };
}

/**
 * Categoria dell'opportunità rilevata dal testo (copre tutte le tipologie
 * gestite dallo scraper): Interpelli/Supplenze, PON, POR, PNRR e bandi per
 * esperti (ricerca esperti / selezione esperti).
 */
export function rilevaCategoriaAvviso(testo: string): string {
  const t = testo.toLowerCase();
  // Priorità per specificità: PNRR > PON > POR > Esperti > Interpelli > Bandi.
  // Copre sia gli acronimi (PNRR / PON / POR) sia le denominazioni complete
  // (Next Generation EU, Programma Operativo Nazionale/Regionale, FSE, FESR).
  if (/\bpnrr\b|next generation eu|missione 4/.test(t)) return 'PNRR';
  if (/\bpon\b|programma operativo nazionale|\bfse\b/.test(t)) return 'PON';
  if (/\bpor\b|programma operativo regionale|\bfesr\b/.test(t)) return 'POR';
  if (/espert|reclutamento/.test(t)) return 'Bando Esperti';
  if (/interpell|supplenz/.test(t)) return 'Interpello / Supplenza';
  if (/bando|avviso|pubblicazione|selezione|incarico|procedura|manifestazione di interesse/.test(t)) {
    return 'Bando / Avviso';
  }
  return 'Altro';
}

/**
 * True se il contesto di un link/avviso sembra un'opportunità da intercettare.
 * Copre TUTTE le tipologie gestite dallo scraper: interpelli/supplenze, bandi,
 * avvisi, pubblicazioni, selezioni di esperti (ricerca esperti / selezione
 * esperti) e i fondi PON / POR / PNRR (es. "Bando per esperto esterno PNRR").
 */
export function sembraOpportunita(contesto: string): boolean {
  // Copre TUTTE le tipologie gestite: interpelli/supplenze, bandi/avvisi,
  // selezioni di esperti (ricerca esperti / reclutamento esperti) e i fondi
  // PON / POR / PNRR, anche con le denominazioni estese (FSE, FESR,
  // Programma Operativo, Next Generation EU).
  return /interpell|supplenz|avviso|bando|pubblicazione|selezione|espert|pnrr|next generation eu|pon\b|por\b|fse\b|fesr\b|programma operativo|fondi strutturali|incarico|procedura|manifestazione di interesse|finanziamento/i.test(
    contesto,
  );
}

/* ------------------------------- Date ------------------------------- */

const MESI_IT: Record<string, string> = {
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06',
  luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12',
};

function pad(n: string): string {
  return n.padStart(2, '0');
}

/** Converte una data già in formato ISO (YYYY-MM-DD) nell'intervallo valido, oppure null. */
function validaIso(data: string): string | null {
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, anno, mese, giorno] = m;
  if (Number(mese) < 1 || Number(mese) > 12) return null;
  if (Number(giorno) < 1 || Number(giorno) > 31) return null;
  return `${anno}-${mese}-${giorno}`;
}

/** Formato numerico italiano gg/mm/aaaa, gg-mm-aaaa o gg.mm.aaaa → YYYY-MM-DD. */
export function normalizzaDataNumerica(testo: string): string | null {
  const match = testo.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (!match) return null;
  const [, gg, mm, aa] = match;
  const anno = aa.length === 2 ? `20${aa}` : aa;
  return validaIso(`${anno}-${pad(mm)}-${pad(gg)}`);
}

/** Formato testuale italiano "22 agosto 2026" → YYYY-MM-DD. */
export function normalizzaDataTestuale(testo: string): string | null {
  const m = testo
    .toLowerCase()
    .match(
      /\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b/,
    );
  if (!m) return null;
  return validaIso(`${m[3]}-${MESI_IT[m[2]]}-${pad(m[1])}`);
}

/** Normalizza un valore di data (ISO, testuale italiano o numerico gg/mm/aaaa) in YYYY-MM-DD. */
export function normalizzaData(valore?: string | null): string | null {
  const v = (valore ?? '').trim();
  if (!v) return null;
  return (
    validaIso(v) ??
    normalizzaDataTestuale(v) ??
    normalizzaDataNumerica(v) ??
    raccogliDate(v)[0]?.iso ??
    null
  );
}

/** Una data trovata nel testo, con la posizione del match (per l'analisi del contesto). */
interface DataRilevata {
  iso: string;
  index: number;
  length: number;
}

const RE_DATA_TESTUALE =
  /\b(\d{1,2})\s*(?:°|º)?\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\b/gi;
const RE_DATA_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const RE_DATA_NUMERICA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g;

/** Raccoglie TUTTE le date del testo (testuali, ISO e numeriche), con la loro posizione. */
export function raccogliDate(testo: string): DataRilevata[] {
  const trovate: DataRilevata[] = [];
  let m: RegExpExecArray | null;

  RE_DATA_TESTUALE.lastIndex = 0;
  while ((m = RE_DATA_TESTUALE.exec(testo)) !== null) {
    const iso = validaIso(`${m[3]}-${MESI_IT[m[2].toLowerCase()]}-${pad(m[1])}`);
    if (iso) trovate.push({ iso, index: m.index, length: m[0].length });
  }
  RE_DATA_ISO.lastIndex = 0;
  while ((m = RE_DATA_ISO.exec(testo)) !== null) {
    const iso = validaIso(m[0]);
    if (iso) trovate.push({ iso, index: m.index, length: m[0].length });
  }
  RE_DATA_NUMERICA.lastIndex = 0;
  while ((m = RE_DATA_NUMERICA.exec(testo)) !== null) {
    const anno = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = validaIso(`${anno}-${pad(m[2])}-${pad(m[1])}`);
    if (iso) trovate.push({ iso, index: m.index, length: m[0].length });
  }

  trovate.sort((a, b) => a.index - b.index);
  // Scarta i match sovrapposti (es. una sottostringa già riconosciuta da un altro pattern).
  const filtrate: DataRilevata[] = [];
  for (const d of trovate) {
    const precedente = filtrate[filtrate.length - 1];
    if (precedente && d.index < precedente.index + precedente.length) continue;
    filtrate.push(d);
  }
  return filtrate;
}

/**
 * Parole chiave che qualificano una data come SCADENZA. Devono PRECEDERE la data
 * ("Scadenza: 15/09/2026", "entro il 12/09/2026", "termine presentazione domande: …"):
 * così una data di pubblicazione in testa al post NON viene mai scambiata per scadenza.
 */
const RE_CONTESTO_SCADENZA =
  /scadenz|scade|scadut|\bentro\b|\btermine\b|presentazion|presentare|domand|candidatur|istanz|non oltre|ultimo|ricezion|riceviment|\binvio\b|trasmis|\boffert|compilazion|manifestazion|fino al|entro e non oltre|\bore\s(?:[01]?\d|2[0-3])(?::\d{2})?\b/i;

/** Parole chiave che qualificano una data come PUBBLICAZIONE. */
const RE_CONTESTO_PUBBLICAZIONE =
  /pubblicat|pubblicazion|in data|del giorno|data di|caricat|aggiornat/i;

/** Termine relativo: "entro 7 giorni (dalla pubblicazione)". */
const RE_SCADENZA_RELATIVA =
  /(?:entro|termine(?:\s+di)?|non oltre|fino\s+a)\s+(?:i\s+|le\s+)?(\d{1,3})\s*(?:giorni|gg)\b/i;

/** Somma N giorni a una data ISO (YYYY-MM-DD). */
function aggiungiGiorni(iso: string, giorni: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/** Prima data preceduta (entro 45 caratteri) da un contesto che soddisfa `re`. */
function estraiDataConContesto(testo: string, re: RegExp): string | null {
  for (const d of raccogliDate(testo)) {
    const prima = testo.slice(Math.max(0, d.index - 45), d.index);
    if (re.test(prima)) return d.iso;
  }
  return null;
}

/**
 * SCADENZA dichiarata: la parola chiave può precedere la data ("scadenza 12/09/2026",
 * "entro il 12/09/2026", "entro le ore 12:00 del 15/09") oppure seguirla
 * ("12/09/2026 – termine di presentazione"). Guarda ~70 caratteri PRIMA e ~40 DOPO,
 * così cattura anche i bandi con frasi lunghe o date in testa.
 */
function estraiDataScadenzaConContesto(testo: string): string | null {
  for (const d of raccogliDate(testo)) {
    const prima = testo.slice(Math.max(0, d.index - 70), d.index);
    const dopo = testo.slice(d.index + d.length, d.index + d.length + 40);
    if (RE_CONTESTO_SCADENZA.test(prima) || RE_CONTESTO_SCADENZA.test(dopo)) return d.iso;
  }
  return null;
}

/** Data di pubblicazione ESPLICITAMENTE qualificata nel testo (solo contesto). */
function estraiDataPubblicazioneDaContesto(testo: string): string | null {
  return estraiDataConContesto(testo, RE_CONTESTO_PUBBLICAZIONE);
}

/**
 * Estrae la data di PUBBLICAZIONE dall'intestazione/titolo o dal contesto:
 *   1) data preceduta da una parola chiave di pubblicazione ("pubblicato il …");
 *   2) altrimenti, per un testo BREVE (intestazione/titolo) senza indizi di
 *      scadenza, la prima data è la pubblicazione del post.
 */
export function estraiDataPubblicazione(testo: string): string | null {
  const esplicita = estraiDataPubblicazioneDaContesto(testo);
  if (esplicita) return esplicita;
  const compatto = (testo ?? '').replace(/\s+/g, ' ').trim();
  if (compatto.length > 0 && compatto.length <= 80 && !RE_CONTESTO_SCADENZA.test(compatto)) {
    return raccogliDate(compatto)[0]?.iso ?? null;
  }
  return null;
}

/**
 * Estrae la SCADENZA REALE del bando, SENZA inversioni:
 *   1) una data dichiarata come scadenza ("scadenza", "entro", "termine", "domande", …);
 *   2) altrimenti un termine relativo ("entro 7 giorni") calcolato dalla pubblicazione.
 * Se il bando non dichiara la scadenza ritorna null: NON si riusa la pubblicazione.
 */
export function estraiDataScadenza(
  testo: string,
  pubblicazione: string | null = null,
): string | null {
  const dichiarata = estraiDataScadenzaConContesto(testo);
  if (dichiarata) return dichiarata;

  const relativa = (testo ?? '').match(RE_SCADENZA_RELATIVA);
  if (relativa && pubblicazione) return aggiungiGiorni(pubblicazione, Number(relativa[1]));
  return null;
}

/* ------------------------------- Hashing ------------------------------- */

/** SHA256 di `provincia|titolo|data` — chiave univoca anti-duplicati. */
export function generaHashId(province: string, title: string, data: string | null): string {
  const payload = `${province}|${title.trim()}|${data ?? ''}`;
  return createHash('sha256').update(payload).digest('hex');
}

/* -------------------- Provincia & scuola dai dati reali -------------------- */

/** Minuscole e senza accenti, coi separatori preservati (confini di parola verificabili). */
function senzaAccenti(testo: string): string {
  return (testo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Codici provincia validi (107) — serve a convalidare i codici meccanografici. */
const CODICI_PROVINCIA = new Set(province.map((p) => p.codice));

/** Nomi provincia normalizzati, dal più lungo al più corto (match più specifico prima). */
const NOMI_PROVINCIA = province
  .map((p) => ({ chiave: senzaAccenti(p.nome).replace(/[^a-z0-9]+/g, ' ').trim(), codice: p.codice }))
  .sort((a, b) => b.chiave.length - a.chiave.length);

/**
 * Alias città → codice per i territori il cui capoluogo non coincide col nome
 * della provincia nel dataset (es. "Forlì-Cesena" → la città è Forlì;
 * "Verbano-Cusio-Ossola" → la città è Verbania).
 */
const ALIAS_CITTA: { chiave: string; codice: string }[] = [
  { chiave: 'aosta', codice: 'AO' },
  { chiave: 'cesena', codice: 'FC' },
  { chiave: 'carrara', codice: 'MS' },
  { chiave: 'andria', codice: 'BT' },
  { chiave: 'trani', codice: 'BT' },
  { chiave: 'urbino', codice: 'PU' },
  { chiave: 'verbania', codice: 'VB' },
];

/** Nomi che da soli sono anche parole comuni: ammessi solo in contesto locativo. */
const CITTA_AMBIGUE = new Set(['prato', 'massa']);

const CANDIDATI_CITTA = [...NOMI_PROVINCIA, ...ALIAS_CITTA];

/** Locuzioni che introducono il comune dell'istituto ("di Milano", "— Bergamo", ", Pavia"). */
const PREPOSIZIONI_CITTA = 'di|del|dello|della|dei|degli|delle|presso|in|a|ad|nel|nella';

/** Pattern regex (su testo normalizzato) per il nome di un comune. */
function regexCitta(chiave: string, locativo: boolean): RegExp {
  const nome = chiave.replace(/ /g, '[^a-z0-9]+');
  if (!locativo) return new RegExp(`(?:^|[^a-z0-9])${nome}(?![a-z0-9])`);
  // Il boundary serve solo al ramo "preposizione": punteggiatura e trattini
  // sono già di per sé non alfanumerici e non possono stare dentro una parola.
  return new RegExp(
    `(?:(?:^|[^a-z0-9])(?:${PREPOSIZIONI_CITTA})\\s+|[,\\;:\\u2013\\u2014-]+\\s*)${nome}(?![a-z0-9])`,
  );
}

/** Provincia dal codice meccanografico della scuola (es. "MIIC81200P" → "MI"). */
export function estraiProvinciaDaCodiceScuola(codice?: string | null): string | null {
  const c = (codice ?? '').trim().toUpperCase();
  const m = c.match(/^([A-Z]{2})[A-Z]{2}\d{5}/);
  return m && CODICI_PROVINCIA.has(m[1]) ? m[1] : null;
}

/**
 * Estrae il codice provincia dell'istituto emittente dai dati REALI dell'avviso:
 *   1. codice meccanografico della scuola (es. "MIIC81200P" → "MI");
 *   2. comune in contesto locativo ("di Milano", "— Bergamo", ", Pavia");
 *   3. comune "distintivo" come parola a sé stante.
 * Nessuna deduzione creativa: se non c'è un indizio affidabile ritorna null
 * (decide il chiamante; il fallback NON è mai una provincia fissa).
 */
export function estraiProvincia(testo: string): string | null {
  const t = senzaAccenti(testo).trim();
  if (!t) return null;

  const mecc = t.match(/\b([a-z]{2})[a-z]{2}\d{5}\b/);
  if (mecc && CODICI_PROVINCIA.has(mecc[1].toUpperCase())) return mecc[1].toUpperCase();

  for (const { chiave, codice } of CANDIDATI_CITTA) {
    if (regexCitta(chiave, true).test(t)) return codice;
  }
  for (const { chiave, codice } of CANDIDATI_CITTA) {
    if (chiave.length < 4 || CITTA_AMBIGUE.has(chiave)) continue;
    if (regexCitta(chiave, false).test(t)) return codice;
  }
  return null;
}

/** True se la stringa è (solo) il nome di un comune/provincia, non un istituto. */
function eNomeCitta(testo: string): boolean {
  const chiave = senzaAccenti(testo).replace(/[^a-z0-9]+/g, ' ').trim();
  if (!chiave) return false;
  return CANDIDATI_CITTA.some((c) => c.chiave === chiave);
}

/** Keyword che designano un istituto scolastico. */
const RE_TIPO_SCUOLA =
  /\b(?:i\.?\s?c\.?|istituto\s+comprensivo|istituto\s+(?:tecnico|professionale)|istituto|liceo|convitto|cpia|scuola(?:\s+(?:primaria|secondaria(?:\s+di\s+(?:i|ii)\s+grado)?|dell'infanzia|materna|media))?|direzione\s+didattica|iis|itis|itc|itg|ipsia|ipsct|ipss)\b/i;

/** Candidati che sono solo la tipologia, senza il nome proprio dell'istituto. */
const SCUOLE_GENERICHE = new Set([
  'istituto', 'liceo', 'scuola', 'convitto', 'cpia', 'iis', 'ic', 'i c',
  'scuola primaria', 'scuola secondaria', 'scuola media', 'scuola materna',
  "scuola dell'infanzia", 'scuola secondaria di i grado', 'scuola secondaria di ii grado',
  'direzione didattica', 'istituto comprensivo', 'istituto tecnico', 'istituto professionale',
  'liceo scientifico', 'liceo classico', 'liceo linguistico', 'liceo artistico',
  'liceo delle scienze umane', 'liceo sportivo', 'liceo musicale',
]);

/** Rifinisce un candidato istituto: taglia classi/parentesi e scarta i generici. */
function pulisciScuola(grezzo: string): string | null {
  let s = (grezzo ?? '').replace(/\s+/g, ' ').trim();
  s = (s.split(/[,;|(]/)[0] ?? s).trim();
  s = s.replace(/[\s\-–—.,;:]+$/, '').trim();
  if (s.length < 3 || s.length > 90) return null;
  if (/\d/.test(s)) return null; // numeri ⇒ classe di concorso / codice, non un nome
  if (/^visualizza/i.test(s)) return null; // etichetta generica della fonte
  if (!/[a-zà-ÿ]/.test(s)) return null; // solo sigle/codici (es. "EEEE", "ADEE | EEEE")
  const chiave = senzaAccenti(s).replace(/[^a-z0-9]+/g, ' ').trim();
  if (SCUOLE_GENERICHE.has(chiave)) return null;
  if (eNomeCitta(s)) return null; // è una città, non una scuola
  if (!/[a-z]/i.test(s)) return null;
  return s;
}

/**
 * Estrae il nome dell'istituto emittente dal titolo/contesto dell'avviso.
 * Se non è riconoscibile con affidabilità ritorna null (nessuna deduzione creativa).
 */
export function estraiScuola(testo: string): string | null {
  const t = (testo ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;

  const match = RE_TIPO_SCUOLA.exec(t);
  if (match) {
    const candidato = pulisciScuola(t.slice(match.index));
    if (candidato) return candidato;
  }

  // Fallback: solo con un trattino lungo (l'ultimo blocco è di norma la scuola).
  const parti = t.split(/[—–]/);
  if (parti.length < 2) return null;
  return pulisciScuola((parti[parti.length - 1] ?? '').trim());
}

/* -------------------- Ente emittente (USP / USR / Ambito) -------------------- */

export type TipoEnte = 'USR' | 'USP' | 'MIM';

/** Ente emittente riconosciuto (ufficio scolastico / ministero). */
export interface EnteEmittente {
  /** Nome canonico da mostrare (es. "USP Macerata", "USR Piemonte"). */
  nome: string;
  tipo: TipoEnte;
}

/** Regioni italiane (dai dati province), dal nome più lungo al più corto. */
const REGIONI_ITALIA = [...new Set(province.map((p) => p.regione))].sort(
  (a, b) => b.length - a.length,
);

/** Nome provincia completo dal codice (es. "MC" → "Macerata"). */
function nomeProvinciaDaCodice(codice?: string | null): string | null {
  const c = (codice ?? '').trim().toUpperCase();
  return province.find((p) => p.codice === c)?.nome ?? null;
}

/** Regione dal codice provincia (es. "MC" → "Marche"). */
function regioneDaCodice(codice?: string | null): string | null {
  const c = (codice ?? '').trim().toUpperCase();
  return province.find((p) => p.codice === c)?.regione ?? null;
}

/** Diciture che designano un Ufficio Scolastico Regionale (su testo normalizzato). */
const RE_ENTE_USR = /\busr\b|ufficio scolastico regionale|direzione generale regionale/;
/** Diciture che designano un Ufficio Scolastico Territoriale/Provinciale o un Ambito. */
const RE_ENTE_USP =
  /ufficio scolastico (?:territoriale|provinciale)|\busp\b|ambito territoriale|\bambito di\b|\buat\b|\bat di\b/;
/** Uffici numerati ("Ufficio IV", "Ufficio V"): competenza provinciale. */
const RE_ENTE_UFFICIO_NUM = /\bufficio\s+(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\b/;
/** Ministero dell'Istruzione e del Merito. */
const RE_ENTE_MIM = /ministero dell'?istruzione|\bmim\b/;

/** True se la stringa contiene una dicitura di ufficio scolastico (USP/USR). */
export function eDicituraEnte(testo?: string | null): boolean {
  const tn = senzaAccenti(testo ?? '');
  return RE_ENTE_USR.test(tn) || RE_ENTE_USP.test(tn) || RE_ENTE_UFFICIO_NUM.test(tn);
}

/**
 * Estrae l'ENTE EMITTENTE (USP / USR / Ambito / MIM) da titolo/contesto quando
 * l'avviso non fa capo a un singolo istituto:
 *   1. USR → "Ufficio Scolastico Regionale per …" / "USR …" (regione esplicita o dedotta);
 *   2. USP → "USP di …", "Ufficio Scolastico Territoriale/Provinciale di …",
 *      "Ambito Territoriale di …" (città esplicita o provincia associata);
 *   3. Ufficio numerato ("Ufficio IV") → USP della provincia associata;
 *   4. MIM → Ministero dell'Istruzione e del Merito.
 * Nessuna invenzione: ritorna `null` se non c'è alcun indizio di ufficio.
 */
export function estraiEnteEmittente(
  testo: string,
  provincia?: string | null,
): EnteEmittente | null {
  const t = (testo ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const tn = senzaAccenti(t);
  const provinciaNome = nomeProvinciaDaCodice(provincia);
  const regioneProv = regioneDaCodice(provincia);

  // 1) USR — Ufficio Scolastico Regionale.
  if (RE_ENTE_USR.test(tn)) {
    const regione = REGIONI_ITALIA.find((r) => tn.includes(senzaAccenti(r))) ?? regioneProv ?? null;
    if (regione) return { nome: `USR ${regione}`, tipo: 'USR' };
  }

  // 2) USP / Ambito — ufficio territoriale/provinciale.
  if (RE_ENTE_USP.test(tn)) {
    const frammento =
      tn.match(
        /(?:ufficio scolastico (?:territoriale|provinciale)|\busp\b|ambito territoriale|\bambito di\b|\buat\b|\bat di\b)\s*(?:di|per|del|dello|della|dei|degli|delle|–|-|:)?\s*([a-z0-9 ]{3,40})/,
      )?.[1] ?? '';
    const codiceCitta = frammento ? estraiProvincia(frammento) : null;
    const nome = nomeProvinciaDaCodice(codiceCitta) ?? provinciaNome;
    if (nome) return { nome: `USP ${nome}`, tipo: 'USP' };
  }

  // 3) Ufficio numerato ("Ufficio IV"): lo USP competente è quello della provincia.
  if (RE_ENTE_UFFICIO_NUM.test(tn) && provinciaNome) {
    return { nome: `USP ${provinciaNome}`, tipo: 'USP' };
  }

  // 4) Ministero (MIM).
  if (RE_ENTE_MIM.test(tn)) {
    return { nome: "Ministero dell'Istruzione e del Merito", tipo: 'MIM' };
  }

  return null;
}

/* ------------------------------- Parser ------------------------------- */

/**
 * Parsa un avviso grezzo in un `InterpelloParsato` completo:
 * provincia e istituto REALI, data di PUBBLICAZIONE e SCADENZA REALE (distinte),
 * classi di concorso e hash_id univoco.
 */
export function parseInterpello(input: InterpelloInput): InterpelloParsato {
  const testoCompleto = `${input.title} ${input.corpo ?? ''}`;

  // Data di PUBBLICAZIONE: prima un valore esplicito (intestazione/<time>), poi il
  // contesto ("pubblicato il …"). La pubblicazione non è MAI usata come scadenza.
  const publishedAt =
    normalizzaData(input.dataPubblicazione) ??
    estraiDataPubblicazioneDaContesto(testoCompleto);

  // SCADENZA reale: un hint esplicito, oppure una data dichiarata nel bando, oppure
  // un termine relativo calcolato dalla pubblicazione. Altrimenti null (no inversioni).
  const expirationDate =
    normalizzaData(input.dataNota) ??
    estraiDataScadenza(testoCompleto, publishedAt);

  // Codice meccanografico della scuola: dal campo esplicito, altrimenti estratto
  // dal testo. Serve a RICONOSCERE le pagine istituzionali legate alla scuola.
  const codiceScuola =
    input.schoolCode?.trim() || estraiCodiceMeccanografico(testoCompleto) || null;

  // Provincia REALE dell'istituto: prima dal titolo, poi dal contesto, poi dal
  // codice meccanografico; solo come ultima spiaggia la provincia della fonte
  // (dinamica — mai una provincia fissa tipo Torino).
  const provincia =
    estraiProvincia(input.title) ??
    estraiProvincia(testoCompleto) ??
    estraiProvinciaDaCodiceScuola(codiceScuola) ??
    input.provincia.trim().toUpperCase();

  // Scuola emittente: dal campo esplicito, altrimenti estratta dal titolo/contesto.
  const scuola = input.schoolName?.trim() || estraiScuola(input.title) || estraiScuola(testoCompleto);

  // ENTE EMITTENTE (USP/USR/Ambito): usato quando NON c'è un singolo istituto o
  // quando il nome "scuola" è in realtà un ufficio. Canonicalizza la dicitura
  // (es. "USP di Macerata" → "USP Macerata") così "Scuola non indicata" resta
  // l'ultima ratio assoluta.
  const ente = estraiEnteEmittente(testoCompleto, provincia);
  const scuolaSembraUfficio = scuola ? eDicituraEnte(scuola) : false;
  const intestatario =
    scuola && !scuolaSembraUfficio ? scuola : (ente?.nome ?? scuola ?? null);

  // Classi di concorso esplicite (A-12, ADEE…); se assenti, inferisci la
  // materia/settore dal testo per non mostrare la sola etichetta "Docente".
  const classCodes = rilevaClassi(testoCompleto);
  const materia =
    classCodes.length > 0 ? null : inferisciMateria(`${input.title} ${input.corpo ?? ''}`);

  // FONTE: preferisce il documento specifico (PDF/circolare/allegato), poi la
  // pagina istituzionale specifica, quindi il fallback all'ente (USP/USR/Scuola).
  const link = scegliUrlFonte([...(input.linkCandidati ?? []), input.link], {
    provincia,
    schoolCode: codiceScuola,
  });

  // Tutti i link candidati della voce (per l'arricchimento contatti a valle).
  const linkCandidati = [
    ...new Set(
      [...(input.linkCandidati ?? []), input.link].map((c) => (c ?? '').trim()).filter(Boolean),
    ),
  ];

  // Email di candidatura della scuola: `mailto:` nel link oppure TUTTE le email
  // del testo (non solo la prima), scelte per pertinenza scolastica e per
  // correlazione con l'istituto (codice meccanografico/nome). Nessuna email è
  // mai inventata: se assente resta `null` → "Email non disponibile".
  const contactEmail = estraiEmailScuola(link, testoCompleto, {
    schoolCode: codiceScuola,
    schoolName: scuola || null,
  });

  return {
    title: input.title.trim(),
    link,
    province: provincia,
    classCodes,
    publishedAt,
    expirationDate,
    // L'hash resta ancorato alla provincia della FONTE: identità stabile nel tempo.
    hashId: generaHashId(input.provincia, input.title, expirationDate),
    source: input.source,
    schoolName: intestatario,
    schoolCode: codiceScuola,
    materia,
    contactEmail,
    linkCandidati,
  };
}
