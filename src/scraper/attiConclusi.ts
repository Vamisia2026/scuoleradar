/**
 * ScuoleRadar.it — ATTI CONCLUSI: la procedura è chiusa, non è un'opportunità (§26.115).
 *
 * Perché esiste. L'albo di una scuola pubblica due cose molto diverse con lo
 * stesso formato: il BANDO (a cui un docente si candida) e l'ATTO che chiude il
 * bando — la graduatoria, l'esito, la nomina dell'assegnatario, il contratto
 * firmato, il decreto di aggiudicazione. L'elenco le espone di fianco, con lo
 * stesso peso visivo, e una riga intitolata «Nomina supplente A022» finiva in
 * bacheca come se ci si potesse ancora candidare: il candidato apriva il
 * documento e trovava il nome di un altro.
 *
 * LA REGOLA (due gradini, entrambi dichiarati)
 *  1. **IN TESTA** — il titolo *comincia* con l'atto: «Graduatoria provvisoria…»,
 *     «Esiti…», «Nomina…», «Contratto…», «Decreto…», «Pubblicazione della
 *     graduatoria…». La pubblicazione È l'atto: nessuna parola di apertura la
 *     salva.
 *  2. **NEL TITOLO, ma solo senza apertura** — l'atto è nominato più avanti
 *     («… a seguito di aggiudicazione», «… esiti pubblicati») e il titolo non
 *     dichiara un'apertura (`interpello`, `bando`, `selezione`, `candidature`,
 *     `domande`, `manifestazione di interesse`, `messa a disposizione`,
 *     `incarico`, `conferimento`). Così **un interpello che parla di
 *     graduatorie resta ammesso** (§26.47: una riga genuina non si scarta).
 *
 * «INDIVIDUAZIONE» È UNA PAROLA ONESTA. Il reclutamento PNRR di esperti si
 * intitola «Avviso di individuazione di esperti»: è un bando aperto. Diventa un
 * atto concluso solo quando l'oggetto è la PERSONA o il contraente
 * («individuazione del docente», «individuazione dell'aggiudicatario»).
 *
 * Il CORPO non entra nel giudizio: un bando vero cita spesso «graduatorie di
 * istituto» e «contratti» nel testo. L'atto concluso si annuncia nel titolo,
 * come per il rumore amministrativo (`noiseFilter.ts`: «il titolo è l'atto»).
 *
 * Modulo PURO: zero import, nessuna rete, nessun `node:*`.
 * Guardia: `npm run test:purghe-ingestione` (incluso in `npm test`).
 */

/** Tipo di atto riconosciuto: serve ai log e alla guardia, non all'utente. */
export type TipoAttoConcluso =
  | 'graduatoria'
  | 'esito'
  | 'nomina'
  | 'contratto'
  | 'aggiudicazione'
  | 'individuazione'
  | 'verbale'
  | 'decreto';

/** Esito del giudizio su un titolo (`concluso: false` = si decide a valle). */
export interface ValutazioneAttoConcluso {
  concluso: boolean;
  tipo: TipoAttoConcluso | null;
  /** Formula leggibile del motivo (finisce nei log e nel motivo di scarto). */
  motivo: string | null;
}

/**
 * L'atto è la PRIMA parola del titolo. «Pubblicazione» conta solo se introduce
 * un atto (`pubblicazione della graduatoria`) e non un bando («pubblicazione
 * dell'avviso di interpello» — quello è un'apertura).
 */
const ATTI_IN_TESTA: ReadonlyArray<{ re: RegExp; tipo: TipoAttoConcluso }> = [
  { re: /^graduatori[ae]\b/i, tipo: 'graduatoria' },
  { re: /^esit[oi]\b|^risultanz[ae]\b/i, tipo: 'esito' },
  { re: /^verbale\b/i, tipo: 'verbale' },
  { re: /^nomin(?:a|e|i)\b|^nominativ[ao]\b/i, tipo: 'nomina' },
  // «Individuazione» in testa è un atto SOLO con l'oggetto-persona: «Individuazione
  // di esperti» è il bando PNRR, non un esito.
  {
    re: /^individuazion[ei]\s+(?:del|dello|della|dei|degli|delle|dell['’])\b/i,
    tipo: 'individuazione',
  },
  { re: /^contratt[oi]\b/i, tipo: 'contratto' },
  { re: /^aggiudicazion[ei]\b|^aggiudicatari[oi]\b/i, tipo: 'aggiudicazione' },
  { re: /^decreto\b|^determin[ae]\b/i, tipo: 'decreto' },
  { re: /^approvazion[ei]\b/i, tipo: 'decreto' },
  { re: /^annullament[oi]\b|^revoca\b|^rettifica\b|^archiviazione\b/i, tipo: 'decreto' },
  { re: /^elenco\s+(?:degli\s+|dei\s+|delle\s+)?ammess[ie]\b|^ammess[ie]\b/i, tipo: 'esito' },
  {
    re: /^pubblicazion[ei]\b[\s\S]{0,60}?\b(?:graduatori[ae]|esit[oi]|aggiudicazion[ei]|nomin(?:a|e)|verbale|contratt[oi])\b/i,
    tipo: 'esito',
  },
];

/** L'atto è nominato nel titolo (vale solo se il titolo non dichiara un'apertura). */
const ATTI_NEL_TITOLO: ReadonlyArray<{ re: RegExp; tipo: TipoAttoConcluso }> = [
  { re: /\bgraduatori[ae]\b/i, tipo: 'graduatoria' },
  { re: /\besit[oi]\b|\brisultanz[ae]\b/i, tipo: 'esito' },
  { re: /\bverbale\b/i, tipo: 'verbale' },
  { re: /\bnomin(?:a|e|i|he)\b|\bnominativ[ao]\b/i, tipo: 'nomina' },
  { re: /\bcontratt[oi]\b/i, tipo: 'contratto' },
  { re: /\baggiudicazion[ei]\b|\baggiudicatari[oi]\b|\baggiudicat[ao]\b/i, tipo: 'aggiudicazione' },
  // «Individuazione» da sola NON basta: «individuazione di esperti» è un bando.
  { re: /\bindividuazion[ei]\s+(?:del|dello|della|dei|degli|delle|dell['’])\b/i, tipo: 'individuazione' },
];

/**
 * Parole che dichiarano un'APERTURA: se ci sono, il titolo sta annunciando una
 * procedura a cui candidarsi e un «graduatoria» citato non lo chiude.
 */
const APERTURA =
  /\b(?:interpell|supplenz|band[oi]\b|selezion|candidatur|domand|manifestazion|messa\s+a\s+disposizione|disponibilit|reclutament|incaric|conferiment|assunzion|avviso\s+pubblico)/i;

/** Titolo compatto: spazi normalizzati, nessun carattere di controllo. */
function compatto(titolo?: string | null): string {
  return (titolo ?? '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Formula del motivo, una sola per tutti i chiamanti. */
function motivo(tipo: TipoAttoConcluso): string {
  return `atto concluso (${tipo}): la procedura non è più aperta`;
}

/**
 * Giudizio su UN titolo. `concluso: false` non significa «opportunità»: significa
 * che questo modulo non ha nulla da dire e decide il resto del filtro.
 */
export function valutaAttoConcluso(titolo?: string | null): ValutazioneAttoConcluso {
  const t = compatto(titolo);
  if (!t) return { concluso: false, tipo: null, motivo: null };

  for (const atto of ATTI_IN_TESTA) {
    if (atto.re.test(t)) return { concluso: true, tipo: atto.tipo, motivo: motivo(atto.tipo) };
  }

  // Gradino 2: un'apertura dichiarata protegge il titolo per intero.
  if (APERTURA.test(t)) return { concluso: false, tipo: null, motivo: null };
  for (const atto of ATTI_NEL_TITOLO) {
    if (atto.re.test(t)) return { concluso: true, tipo: atto.tipo, motivo: motivo(atto.tipo) };
  }
  return { concluso: false, tipo: null, motivo: null };
}

/** Scorciatoia booleana: true se il titolo annuncia un atto concluso. */
export function eAttoConcluso(titolo?: string | null): boolean {
  return valutaAttoConcluso(titolo).concluso;
}
