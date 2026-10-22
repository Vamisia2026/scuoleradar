/**
 * ScuoleRadar.it — Nomi d'istituto PRESENTABILI (modulo puro, senza dipendenze).
 *
 * Direttiva cliente 28/09/2026: in una vista pubblica la colonna «Scuola & Città»
 * mostra SOLO il nome reale e leggibile dell'istituto («Liceo Statale A. Monti»,
 * «IC Carducci»). È severamente vietato mostrare codici amministrativi o stringhe
 * grezze («EEEE | A246», «AAAA | A246», «BA02 | AR04»): se il nome non è
 * risolvibile in chiaro, la riga non entra nella vetrina.
 *
 * `nomeIstitutoPresentabile` accetta una stringa solo se ha:
 *   1. una TESTA d'istituto — sigla (`IC`, `I.I.S.`, `ITIS`, `CPIA`…) o parola di
 *      tipo scuola (`Liceo`, `Istituto`, `Convitto`, `Comprensivo`…);
 *   2. una DENOMINAZIONE — almeno un nome proprio che non sia generico né un
 *      marcatore di posto/procedura/materia (`Ferruccio Ulivi`, `Curbastro`…) oppure
 *      un numero/ordinale (`Comprensivo 7`, `2° Circolo`, `V Circolo`);
 *   3. nessun CODICE (classe di concorso, sostegno, meccanografico, token misto
 *      lettere+cifre) e nessuna sequenza di 3+ cifre;
 *   4. il testo oltre il primo marcatore di procedura viene TAGLIATO
 *      («IC ALBIGNASEGO Interpello per copertura posti» → «IC ALBIGNASEGO»).
 */

// Il VOCABOLARIO (parole generiche, sigle d'istituto, marcatori di procedura,
// codici amministrativi e apertura delle sigle incollate) vive in
// `nomeIstitutoVocabolario.ts`: qui restano solo le REGOLE del gate.
import {
  AZIONI_AVVISO,
  MARCATORI,
  NUMERI_ROMANI,
  ORDINALI_PAROLA,
  PAROLE_GENERICHE,
  RE_MECCANOGRAFICO,
  RE_SIGLA_RIPETUTA,
  RE_SIGLA_SOSTEGNO,
  RE_TRATTINO_CODICE,
  SIGLE_ISTITUTO,
  apriSigleIncollate,
} from './nomeIstitutoVocabolario.ts';

/** Token del testo (le sigle puntate «I.I.S.» diventano «i», «i», «s»). */
function tokenizza(testo: string): string[] {
  return testo.split(/[^A-Za-zÀ-ÿ0-9]+/).filter(Boolean);
}

/** True se il nome è di un CIRCOLO numerato a parole («Ottavo Circolo»). */
function eCircoloNumerato(tokens: string[]): boolean {
  const circolo = tokens.some((t) => /^circol[oi]$/i.test(t));
  return circolo && tokens.some((t) => ORDINALI_PAROLA.has(t.toLowerCase()));
}

/**
 * True se il token è un CODICE amministrativo (mai un nome): token misto
 * lettere+cifre (`A246`, `A042`, `AA56`, `9H`), sigla di sostegno (`ADEE`,
 * `ADSS`), sigla ripetuta (`EEEE`, `AAAA`) o codice meccanografico
 * (`BSIS02900X`). Le SIGLE d'istituto e i numeri romani non sono codici, e una
 * cifra isolata non basta a scartare un nome (`I.C. Castiglione 1`).
 */
function eCodiceAmministrativo(token: string): boolean {
  const low = token.toLowerCase();
  if (SIGLE_ISTITUTO.has(low) || NUMERI_ROMANI.has(low)) return false;
  if (/\d/.test(token) && /[A-Za-zÀ-ÿ]/.test(token)) return true;
  const up = token.toUpperCase();
  return RE_MECCANOGRAFICO.test(up) || RE_SIGLA_SOSTEGNO.test(up) || RE_SIGLA_RIPETUTA.test(up);
}

/** True se il testo dichiara COSA è l'istituto (sigla o parola di tipo scuola). */
function contieneTesta(tokens: string[]): boolean {
  for (let i = 0; i < tokens.length; i += 1) {
    for (let l = 1; l <= 4 && i + l <= tokens.length; l += 1) {
      if (SIGLE_ISTITUTO.has(tokens.slice(i, i + l).join('').toLowerCase())) return true;
    }
  }
  return false;
}

/** True se il token può essere la DENOMINAZIONE (il nome proprio) dell'istituto. */
function eDenominazione(token: string): boolean {
  if (token.length < 3 || /\d/.test(token)) return false;
  const low = token.toLowerCase();
  return (
    !PAROLE_GENERICHE.has(low) &&
    !SIGLE_ISTITUTO.has(low) &&
    !NUMERI_ROMANI.has(low) &&
    !MARCATORI.has(low)
  );
}

/**
 * True se il token è una DENOMINAZIONE NUMERALE: moltissimi istituti si chiamano
 * con un numero o un ordinale — «Istituto Comprensivo 7», «2° Circolo»,
 * «D.D. 2^ CIRCOLO "COMPAROZZI"», «V Circolo» (fonti Liguria/Umbria, §26.72).
 * La cifra NON è un codice: vale solo insieme a una TESTA (`contieneTesta`),
 * quindi non apre la porta a dump di classi e codici.
 */
function eDenominazioneNumerale(token: string): boolean {
  if (/^\d{1,2}[°º^]?$/.test(token)) return true;
  return NUMERI_ROMANI.has(token.toLowerCase());
}

/**
 * «corso»/«corsi» sono PROCEDURA solo in un sintagma preciso («corso di
 * formazione»): nel nome di un istituto sono spesso una VIA
 * («I.C. CUNEO CORSO SOLERI»). Tagliare lì produrrebbe un nome troncato e
 * potenzialmente sbagliato, quindi si taglia solo davanti a queste continuazioni.
 */
const RE_PROCEDURA_CORSO = /\bcors[io]\s+(?:di|per|in|singol[oi]|serale|abbandon[oi]|integrazione)\b/i;

/**
 * True se il token apre la PROCEDURA (e quindi chiude il nome). Vale per i
 * marcatori ordinari e, in più, per `corso`/`corsi` solo nel sintagma di procedura.
 */
function eMarcatore(token: string, testo: string): boolean {
  const low = token.toLowerCase();
  if (!MARCATORI.has(low)) return false;
  if (low === 'corso' || low === 'corsi') return RE_PROCEDURA_CORSO.test(testo);
  return true;
}

/**
 * Taglia il testo al PRIMO marcatore di posto/procedura/materia: «IC ALBIGNASEGO
 * Interpello per la copertura posti» → «IC ALBIGNASEGO». `null` quando il
 * marcatore è in testa (testo tutto di procedura: nessun nome da salvare).
 */
function tagliaAllaProcedura(testo: string): string | null {
  const tenute: string[] = [];
  for (const parte of testo.split(/(\s+)/)) {
    if (parte.trim()) {
      const parole = parte.split(/[^A-Za-zÀ-ÿ0-9]+/).filter(Boolean);
      if (parole.some((p) => eMarcatore(p, testo))) break;
    }
    tenute.push(parte);
  }
  const tagliato = tenute.join('').replace(/[\s,;:.\-–—|]+$/, '').trim();
  return tagliato.length >= 4 ? tagliato : null;
}

/**
 * SEGNAPOSTO gestiti che NON sono un nome d'istituto (§26.77, 22/10/2026).
 *
 * Direttiva cliente: in nessuna superficie pubblica deve comparire il badge/testo
 * «Scuola non specificata / Più plessi». Quel testo è una DICHIARAZIONE di dato
 * mancante, non una denominazione: se arriva in `school_name` il gate lo rifiuta,
 * così la riga del tabellone ricade sul nome ricavato dal titolo e — quando non
 * esiste — resta fuori (`lib/liveBoard.preparaRigheBoard`). Il confronto ignora
 * accenti, maiuscole e separatori: «SCUOLA NON SPECIFICATA / PIÙ PLESSI», «Scuola
 * non specificata - Piu plessi» e la sola prima metà sono lo stesso segnaposto.
 */
const SEGNAPOSTO =
  /^(?:scuola|istituto)\s+non\s+specificat[oa](?:\s*[/·|\-–—]?\s*pi[uù]\s+plessi)?$/;

/** True se il testo (o il frammento) è un segnaposto gestito, mai un nome. */
function eSegnaposto(testo: string): boolean {
  const normalizzato = testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return SEGNAPOSTO.test(normalizzato);
}

/** Nome d'istituto di UN frammento (già separato dai dump), altrimenti `null`. */
function nomeDaFrammento(frammento: string): string | null {
  const base = frammento.replace(/\s+/g, ' ').trim();
  if (base.length < 4 || /\d{3,}/.test(base)) return null;
  // Prima di ogni altra regola: un segnaposto non è un istituto, nemmeno se ha
  // una parola «da nome» («Plessi», «Specificata»).
  if (eSegnaposto(base)) return null;
  if (RE_TRATTINO_CODICE.test(base)) return null;
  const tagliato = tagliaAllaProcedura(base);
  if (!tagliato || AZIONI_AVVISO.test(tagliato)) return null;
  // §26.73: le fonti scrivono spesso la sigla INCOLLATA al nome («IISLAGRANGIA»,
  // «CPIA2AL»): si apre prima di leggere, così la testa torna riconoscibile.
  const aperto = apriSigleIncollate(tagliato);
  const tokens = tokenizza(aperto);
  if (tokens.some(eCodiceAmministrativo)) return null;
  if (!contieneTesta(tokens)) return null;
  // Denominazione: nome proprio, NUMERO/ordinale («Istituto Comprensivo 7»,
  // «V Circolo») o ordinale a parole accanto a `circolo` («Ottavo Circolo»).
  // La cifra conta solo con una testa presente: da sola resta un codice.
  const haDenominazione =
    tokens.some(eDenominazione) ||
    tokens.some(eDenominazioneNumerale) ||
    eCircoloNumerato(tokens);
  if (!haDenominazione) return null;
  return aperto;
}

/**
 * Nome d'istituto PRESENTABILE in una vista pubblica, altrimenti `null`.
 * Scarta i codici amministrativi («EEEE | A246», «AAAA | A246», «BA02 | AR04»),
 * le etichette di posto/materia («Conversazione in lingua straniera», «Scuola
 * primaria posto Montessori») e gli atti amministrativi («Esiti assegnazione
 * sede»). Un dump separato da `|` si salva solo se UN frammento è davvero un nome
 * («Liceo Monti | Asti» → «Liceo Monti»).
 */
export function nomeIstitutoPresentabile(testo?: string | null): string | null {
  const grezzo = (testo ?? '').replace(/\s+/g, ' ').trim();
  if (grezzo.length < 4) return null;
  if (!grezzo.includes('|')) return nomeDaFrammento(grezzo);
  for (const frammento of grezzo.split('|')) {
    const nome = nomeDaFrammento(frammento.trim());
    if (nome) return nome;
  }
  return null;
}
