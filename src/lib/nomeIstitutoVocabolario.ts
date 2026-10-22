/**
 * ScuoleRadar.it — VOCABOLARIO dei nomi d'istituto (modulo puro, senza dipendenze).
 *
 * Qui vivono i FATTI lessicali del gate `nomeIstituto.ts`: quali parole non
 * identificano una scuola, quali sigle valgono come testa, quali marcatori chiudono
 * il nome e come si aprono le sigle che le fonti incollano («IISLAGRANGIA»).
 * Modulo separato per rispettare il limite di 300 righe per file
 * (`docs/MODULAR_ARCHITECTURE.md`, E-DIM) senza comprimere la documentazione.
 */

/**
 * Parole che, DA SOLE, non identificano una scuola (né una denominazione).
 *
 * §26.73 (16/10/2026) — GATE AMMORBIDITO (finding aperto §26.71: 169 opportunità con
 * scadenza vera respinte dal gate): le sigle e le abbreviazioni che le FONTI usano davvero
 * (`SMS`, `IS`, `IT`, `ICS`, `I.S.`, `IST.`, `COMPR.`, `D.D.`) e le denominazioni NUMERALI
 * a parole (`Ottavo Circolo`) non fanno più cadere un nome vero. Le regole sono dichiarate
 * in `SIGLE_ISTITUTO` e `apriSigleIncollate`.
 */
export const PAROLE_GENERICHE = new Set([
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
  // Descrivono la SCUOLA, non la nominano: senza un nome proprio una riga come
  // «Circolo Didattico» resta fuori vetrina.
  'didattico', 'didattici',
]);

/** Sigle d'istituto REALI (mai codici di classe): valgono come TESTA del nome.
 *
 * Aggiunte del 15/10/2026 (§26.72 — fonti Liguria e Umbria): le sigle BREVI e le
 * forme usate dai portali regionali — `I.S.`, `I.O.`, `S.M.S.`, `ISA`, `Circolo`,
 * `Materna` («I.O. "ROSSELLI-RASETTI"», «D.D. 2^ CIRCOLO "COMPAROZZI"»,
 * «ISA 23 IC LEVANTO»). Restano escluse da `eDenominazione`, quindi NON possono
 * fare da nome proprio: una riga con la sola testa («Circolo Didattico») continua
 * a non essere presentabile.
 */
export const SIGLE_ISTITUTO = new Set([
  'ic', 'iis', 'isis', 'isiss', 'iiss', 'iss', 'itis', 'ipsia', 'ipsas', 'itc',
  'ite', 'itg', 'itn', 'iti', 'ips', 'itas', 'ipssar', 'ipsseoa', 'cpia', 'its',
  'ls', 'lss', 'lsp', 'lc', 'lsc', 'lg', 'lsg', 'sm', 'dds', 'cd', 'dd', 'liceo',
  'licei', 'istituto', 'istituti', 'istituzione', 'convitto', 'collegio',
  'educandato', 'comprensivo', 'omnicomprensivo', 'scuola', 'scuole', 'liceale',
  'is', 'io', 'sms', 'isa', 'circolo', 'circoli', 'materna', 'materne',
  // §26.73 (16/10/2026) — ABBREVIAZIONI delle FONTI e teste COMPOSTE, dalle righe
  // reali scartate dal gate: «ICS CARDUCCI», «IST. COMPR. CURIONI», «IT DA VINCI»,
  // «I grado Faustini – Frank – Nicolini», «DIREZIONE DIDATTICA VALENZA». Valgono
  // come TESTA (cosa è l'istituto), mai come denominazione: «ISTITUTO COMPRENSIVO»
  // da solo resta fuori vetrina.
  'ics', 'ist', 'compr', 'it', 'igrado', 'iigrado', 'direzionedidattica',
]);

/** Numeri romani: prefissi legittimi del nome («III IC Ricci Curbastro»). */
export const NUMERI_ROMANI = new Set([
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii',
]);

/**
 * Marcatori di POSTO/PROCEDURA/MATERIA: presenti negli avvisi, MAI nel nome di un
 * istituto. Da qui in poi il testo è procedura: si taglia.
 */
export const MARCATORI = new Set([
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
export const AZIONI_AVVISO =
  /^(?:interpello|nterpello|avviso|bando|selezione|graduatoria|esito|decreto|rettifica|riapertura|integrazione|proroga|nomina|conferimento|procedura|mobilit[àa]|reclutamento|disponibilit[àa]|manifestazione|annotazione|dal|dall|fino|entro|decorrenza|termine)(?![a-zà-ù])/i;

/** Codici amministrativi: meccanografico, sigla di sostegno, sigla ripetuta. */
export const RE_MECCANOGRAFICO = /^[A-Z]{2}[A-Z]{2}\d{5}[A-Z0-9]$/;
/**
 * Sigla di sostegno: SEMPRE `AD…` — «in Italia ogni classe di sostegno inizia per
 * `AD`, quindi il pattern è chiuso» (`data/classiConcorso.ts`). Il vecchio
 * `A[DS][A-Z]{2}` scartava nomi veri che contengono toponimi da 4 lettere
 * («ASTI» = A+S+TI, «ADRO», «ASIA»): «I.C. VILLAFRANCA D'ASTI» non entrava in
 * vetrina per colpa di una sigla di sostegno che non esiste.
 */
export const RE_SIGLA_SOSTEGNO = /^AD(?:[A-Z]{2,3}|\d{2})$/;
export const RE_SIGLA_RIPETUTA = /^([A-Z])\1{3}$/;
/** Codice di classe con il trattino, che la tokenizzazione spezzerebbe («A-48»). */
export const RE_TRATTINO_CODICE = /(?:^|\s)[A-Z]{1,2}-\d{2,4}(?:\s|$)/;

/**
 * Ordinali a PAROLA («Ottavo Circolo»): valgono come denominazione solo accanto a
 * `circolo`, altrimenti restano generici — «Scuola secondaria di primo grado» non è
 * il nome di un istituto.
 */
export const ORDINALI_PAROLA = new Set(
  'primo secondo terzo quarto quinto sesto settimo ottavo nono decimo'.split(' '),
);

/**
 * Sigle che le FONTI incollano al nome o alla cifra: «IISLAGRANGIA»,
 * «ICFRANCESCONEGRI», «CPIA3», «CPIA2AL». `it`/`is`/`io` sono ESCLUSE di proposito:
 * aprirebbero parole comuni («ITALIA» → «IT ALIA»).
 */
export const PREFISSI_INCOLLATI = new Set([
  'ic', 'iis', 'isis', 'isiss', 'iiss', 'iss', 'itis', 'ipsia', 'ipsas', 'ipssar',
  'ipsseoa', 'ips', 'itc', 'ite', 'itg', 'iti', 'its', 'ls', 'lss', 'lsp', 'lc',
  'lsc', 'lg', 'lsg', 'sm', 'dds', 'cd', 'dd', 'ist', 'isa', 'sms', 'cpia',
]);

/** Apre la sigla incollata di UN token; il resto del token resta com'è. */
function apriToken(token: string): string {
  const low = token.toLowerCase();
  // Una testa o una parola di procedura non si spezza: «ISTITUTO» non è «IST ITUTO».
  if (SIGLE_ISTITUTO.has(low) || PAROLE_GENERICHE.has(low) || MARCATORI.has(low)) return token;
  const conCifra = /^([A-Za-zÀ-ÿ]{2,6})(\d{1,2})([A-Za-z]{0,4})$/.exec(token);
  if (conCifra && PREFISSI_INCOLLATI.has(conCifra[1].toLowerCase())) {
    return [conCifra[1], conCifra[2], conCifra[3]].filter(Boolean).join(' ');
  }
  for (let l = Math.min(6, token.length - 4); l >= 2; l -= 1) {
    const prefisso = token.slice(0, l);
    if (PREFISSI_INCOLLATI.has(prefisso.toLowerCase())) return `${prefisso} ${token.slice(l)}`;
  }
  return token;
}

/**
 * Apre le sigle scritte INCOLLATE al nome (§26.73): «IISLAGRANGIA» → «IIS LAGRANGIA»,
 * «CPIA2AL» → «CPIA 2 AL». Serve solo a riconoscere la testa: nessun codice
 * amministrativo viene aperto (la whitelist esclude i prefissi dei meccanografici).
 */
export function apriSigleIncollate(testo: string): string {
  return testo.replace(/[A-Za-zÀ-ÿ0-9]+/g, apriToken);
}
