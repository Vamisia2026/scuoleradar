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
 *      marcatore di posto/procedura/materia (`Ferruccio Ulivi`, `Curbastro`…);
 *   3. nessun CODICE (classe di concorso, sostegno, meccanografico, token misto
 *      lettere+cifre) e nessuna sequenza di 3+ cifre;
 *   4. il testo oltre il primo marcatore di procedura viene TAGLIATO
 *      («IC ALBIGNASEGO Interpello per copertura posti» → «IC ALBIGNASEGO»).
 */

/** Parole che, DA SOLE, non identificano una scuola (né una denominazione). */
const PAROLE_GENERICHE = new Set([
  'scuola', 'scuole', 'istituto', 'istituzione', 'liceo', 'licei', 'secondaria',
  'primaria', 'infanzia', 'posta', 'posto', 'docente', 'docenti', 'un', 'uno', 'una',
  'interpello', 'interpelli', 'avviso', 'avvisi', 'bando', 'bandi', 'selezione',
  'selezioni', 'esperto', 'esperti', 'personale', 'ata', 'supplenza', 'supplenze',
  'classe', 'classi', 'cattedra', 'cattedre', 'di', 'del', 'della', 'delle', 'dei',
  'degli', 'il', 'lo', 'la', 'le', 'gli', 'i', 'a', 'al', 'alla', 'allo', 'ai', 'e',
  'ed', 'per', 'con', 'su', 'in', 'da', 'dal', 'dai', 'non', 'comune', 'grado', 'nel',
  'nella', 'nello', 'nelle', 'presso', 'tra', 'fra', 'sul', 'sulla', 'sezione',
  'sezioni', 'plesso', 'statale', 'paritaria', 'pubblica', 'nazionale', 'indirizzo',
  'primo', 'prima', 'secondo', 'seconda', 'terzo', 'terza', 'quarto', 'quinto',
  'sesto', 'settimo', 'ottavo', 'nono', 'decimo', 'sostegno',
]);

/** Sigle d'istituto REALI (mai codici di classe): valgono come TESTA del nome. */
const SIGLE_ISTITUTO = new Set([
  'ic', 'iis', 'isis', 'isiss', 'iiss', 'iss', 'itis', 'ipsia', 'ipsas', 'itc',
  'ite', 'itg', 'itn', 'iti', 'ips', 'itas', 'ipssar', 'ipsseoa', 'cpia', 'its',
  'ls', 'lss', 'lsp', 'lc', 'lsc', 'lg', 'lsg', 'sm', 'dds', 'cd', 'dd', 'liceo',
  'licei', 'istituto', 'istituti', 'istituzione', 'convitto', 'collegio',
  'educandato', 'comprensivo', 'omnicomprensivo', 'scuola', 'scuole', 'liceale',
]);

/** Numeri romani: prefissi legittimi del nome («III IC Ricci Curbastro»). */
const NUMERI_ROMANI = new Set([
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii',
]);

/**
 * Marcatori di POSTO/PROCEDURA/MATERIA: presenti negli avvisi, MAI nel nome di un
 * istituto. Da qui in poi il testo è procedura: si taglia.
 */
const MARCATORI = new Set([
  'posto', 'posti', 'supplenza', 'supplenze', 'interpello', 'interpelli',
  'nterpello', 'avviso', 'avvisi', 'bando', 'bandi', 'selezione', 'selezioni',
  'graduatoria', 'graduatorie', 'esito', 'esiti', 'assegnazione', 'assegnazioni',
  'immissione', 'immissioni', 'procedura', 'procedure', 'preferenza', 'preferenze',
  'espressione', 'disponibilita', 'incarico', 'incarichi', 'timbro', 'firmato',
  'signed', 'protocollo', 'personale', 'docente', 'docenti', 'dsga', 'corso',
  'corsi', 'coordinatore', 'formatore', 'formatori', 'gps', 'fascia', 'ruolo',
  'sede', 'sedi', 'metodo', 'materia', 'materie', 'sostegno', 'lingua', 'lingue',
  'conversazione', 'strumento', 'motoria', 'religione', 'alternativa', 'ordinanza',
  'decreto', 'rettifica', 'proroga', 'integrazione', 'riapertura', 'reclutamento',
  'conferimento', 'nomina', 'individuazione', 'lettera', 'lettere', 'comma', 'art',
  'nota', 'scelta', 'provincia', 'regione', 'regionale', 'provinciale',
  'territoriale', 'ambito', 'orario', 'ore', 'elenco', 'elenchi', 'indice',
]);

/**
 * Azioni amministrative degli avvisi: un testo che COMINCIA così è il corpo
 * dell'avviso, non il nome di una scuola («Interpello per la copertura…»).
 */
const AZIONI_AVVISO =
  /^(?:interpello|nterpello|avviso|bando|selezione|graduatoria|esito|decreto|rettifica|riapertura|integrazione|proroga|nomina|conferimento|procedura|mobilit[àa]|reclutamento|disponibilit[àa]|manifestazione|annotazione|dal|dall|fino|entro|decorrenza|termine)(?![a-zà-ù])/i;

/** Codici amministrativi: meccanografico, sigla di sostegno, sigla ripetuta. */
const RE_MECCANOGRAFICO = /^[A-Z]{2}[A-Z]{2}\d{5}[A-Z0-9]$/;
/**
 * Sigla di sostegno: SEMPRE `AD…` — «in Italia ogni classe di sostegno inizia per
 * `AD`, quindi il pattern è chiuso» (`data/classiConcorso.ts`). Il vecchio
 * `A[DS][A-Z]{2}` scartava nomi veri che contengono toponimi da 4 lettere
 * («ASTI» = A+S+TI, «ADRO», «ASIA»): «I.C. VILLAFRANCA D'ASTI» non entrava in
 * vetrina per colpa di una sigla di sostegno che non esiste.
 */
const RE_SIGLA_SOSTEGNO = /^AD(?:[A-Z]{2,3}|\d{2})$/;
const RE_SIGLA_RIPETUTA = /^([A-Z])\1{3}$/;
/** Codice di classe con il trattino, che la tokenizzazione spezzerebbe («A-48»). */
const RE_TRATTINO_CODICE = /(?:^|\s)[A-Z]{1,2}-\d{2,4}(?:\s|$)/;

/** Token del testo (le sigle puntate «I.I.S.» diventano «i», «i», «s»). */
function tokenizza(testo: string): string[] {
  return testo.split(/[^A-Za-zÀ-ÿ0-9]+/).filter(Boolean);
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

/** Nome d'istituto di UN frammento (già separato dai dump), altrimenti `null`. */
function nomeDaFrammento(frammento: string): string | null {
  const base = frammento.replace(/\s+/g, ' ').trim();
  if (base.length < 4 || /\d{3,}/.test(base)) return null;
  if (RE_TRATTINO_CODICE.test(base)) return null;
  const tagliato = tagliaAllaProcedura(base);
  if (!tagliato || AZIONI_AVVISO.test(tagliato)) return null;
  const tokens = tokenizza(tagliato);
  if (tokens.some(eCodiceAmministrativo)) return null;
  if (!contieneTesta(tokens) || !tokens.some(eDenominazione)) return null;
  return tagliato;
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
