/**
 * ScuoleRadar.it — Dipartimento CFU · SourceRegistry test.
 *
 * Dimostra che:
 *  A. registrando DINAMICAMENTE una Source e le sue Rule, queste sono
 *     immediatamente disponibili al lookup per dominio (nessun if normativo);
 *  B. regole/sorgenti con stato PROPOSED/UNCERTAIN (o catena mancante)
 *     degradano a MANUAL_VERIFICATION_REQUIRED senza MAI lanciare eccezioni.
 */
import {
  creaEvidence,
  creaProposition,
  creaRelation,
  creaRule,
  creaSource,
  dominioClasseConcorso,
  dominioClasseLaurea,
  type Proposition,
  type Relation,
  type Rule,
  type Source,
  type StatoCatena,
} from '../traceability/traceabilityChain';
import { creaSourceRegistry, type SourceRegistry } from '../traceability/sourceRegistry';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

/* ------------------------------ Hash dimostrativi ------------------------------ */

const HASH_SORGENTE_ATTIVA = '11'.repeat(32);
const HASH_SORGENTE_PROPOSED = '22'.repeat(32);
const HASH_SORGENTE_UNCERTAIN = '33'.repeat(32);
const HASH_SORGENTE_REGOLA_PROPOSED = '44'.repeat(32);
const HASH_SORGENTE_NON_REGISTRATA = '55'.repeat(32);

/* ------------------------------ Catena A (tutto ACTIVE) ------------------------------ */

function costruisciCatenaAttiva(): {
  fonte: Source;
  proposizione: Proposition;
  relazione: Relation;
  regola: Rule;
} {
  const fonte = creaSource({
    id: 'src-demo-A11-ACTIVE',
    hash: HASH_SORGENTE_ATTIVA,
    autorita: 'MIM',
    titolo: 'Decreto dimostrativo (classe A-11 / LM-14)',
    tipoDocumento: 'decreto-ministeriale',
    pubblicazione: { riferimento: 'Test-only — nessuna norma' },
    stato: 'ACTIVE',
  });
  const evidenza = creaEvidence({
    id: 'ev-demo-A11',
    sourceHash: fonte.hash,
    testo: 'almeno 24 CFU tra L-FIL-LET/04 e L-FIL-LET/05',
    coordinate: { pagina: 1, riga: 3 },
    stato: 'ACTIVE',
  });
  const proposizione = creaProposition({
    id: 'prop-demo-A11',
    contenutoAtomico: 'Servono almeno 24 CFU tra L-FIL-LET/04 e L-FIL-LET/05.',
    evidenze: [evidenza],
    stato: 'ACTIVE',
  });
  const relazione = creaRelation({
    id: 'rel-demo-A11',
    tipo: 'APPLIES_FROM',
    soggetto: { tipo: 'proposition', id: proposizione.id },
    oggetto: { tipo: 'contesto', id: 'procedure-demo' },
    evidenze: [evidenza],
    stato: 'ACTIVE',
  });
  const regola = creaRule({
    id: 'rule-demo-A11-LM14',
    proposizioneId: proposizione.id,
    vincolo: {
      tipo: 'gruppoSsdMinCfu',
      ssd: ['L-FIL-LET/04', 'L-FIL-LET/05'],
      minCfu: 24,
    },
    dominii: [dominioClasseConcorso('A-11'), dominioClasseLaurea('LM-14')],
    stato: 'ACTIVE',
  });
  return { fonte, proposizione, relazione, regola };
}

/* ------------------------------ Catene parametrizzate (stati variabili) ------------------------------ */

function costruisciCatenaConStato(opzioni: {
  hash: string;
  prefisso: string;
  statoFonte: StatoCatena;
  statoRegola: StatoCatena;
}): { fonte: Source; proposizione: Proposition; regola: Rule } {
  const fonte = creaSource({
    id: `src-demo-${opzioni.prefisso}`,
    hash: opzioni.hash,
    autorita: 'MIM',
    titolo: `Decreto dimostrativo ${opzioni.prefisso}`,
    tipoDocumento: 'decreto-ministeriale',
    pubblicazione: { riferimento: 'Test-only — nessuna norma' },
    stato: opzioni.statoFonte,
  });
  const evidenza = creaEvidence({
    id: `ev-demo-${opzioni.prefisso}`,
    sourceHash: fonte.hash,
    testo: `requisito dimostrativo ${opzioni.prefisso}`,
    coordinate: { pagina: 1, riga: 1 },
    stato: 'ACTIVE',
  });
  const proposizione = creaProposition({
    id: `prop-demo-${opzioni.prefisso}`,
    contenutoAtomico: `Requisito dimostrativo ${opzioni.prefisso}.`,
    evidenze: [evidenza],
    stato: 'ACTIVE',
  });
  const regola = creaRule({
    id: `rule-demo-${opzioni.prefisso}`,
    proposizioneId: proposizione.id,
    vincolo: { tipo: 'singoloSsdMinCfu', ssd: 'L-FIL-LET/04', minCfu: 12 },
    dominii: [dominioClasseConcorso('A-11')],
    stato: opzioni.statoRegola,
  });
  return { fonte, proposizione, regola };
}

/* ------------------------------ Test ------------------------------ */

function testRegistry(): void {
  const registro: SourceRegistry = creaSourceRegistry();

  /* A. Ingestione dinamica → immediatamente disponibile al lookup (nessun if). */
  const catenaAttiva = costruisciCatenaAttiva();
  const esitoCatalogo = registro.registraCatalogo({
    fonti: [catenaAttiva.fonte],
    proposizioni: [catenaAttiva.proposizione],
    relazioni: [catenaAttiva.relazione],
    regole: [catenaAttiva.regola],
  });
  assert(
    esitoCatalogo.fonti === 1 &&
      esitoCatalogo.proposizioni === 1 &&
      esitoCatalogo.relazioni === 1 &&
      esitoCatalogo.regole === 1,
    'registro popolato con tutte e quattro le entità',
  );
  assert(registro.getSource(HASH_SORGENTE_ATTIVA) === catenaAttiva.fonte, 'getSource ritrova la stessa istanza');
  assert(
    registro.getProposition(catenaAttiva.proposizione.id) === catenaAttiva.proposizione,
    'getProposition ok',
  );
  assert(registro.getRelation(catenaAttiva.relazione.id) === catenaAttiva.relazione, 'getRelation ok');
  assert(registro.getRule(catenaAttiva.regola.id) === catenaAttiva.regola, 'getRule ok');

  const lookupClasse = registro.cercaPerClasseConcorso('A-11');
  assert(lookupClasse.regoleAttive.length === 1, 'regola appena ingerita subito attiva (A-11)');
  assert(lookupClasse.regoleAttive[0]!.id === catenaAttiva.regola.id, 'regola attiva corretta');
  assert(lookupClasse.verificaManualeRichiesta === false, 'nessuna verifica manuale richiesta');
  const lookupLaurea = registro.cercaPerClasseLaurea('LM-14');
  assert(lookupLaurea.regoleAttive.length === 1, 'stessa regola attiva per la classe di laurea LM-14');

  /* B. Source PROPOSED → la regola NON è attiva; il lookup segnala MANUAL. */
  const catenaProposta = costruisciCatenaConStato({
    hash: HASH_SORGENTE_PROPOSED,
    prefisso: 'proposed',
    statoFonte: 'PROPOSED',
    statoRegola: 'ACTIVE',
  });
  assert(registro.registraSource(catenaProposta.fonte).registrata, 'source PROPOSED registrata');
  assert(registro.registraProposition(catenaProposta.proposizione).registrata, 'proposition registrata');
  assert(registro.registraRule(catenaProposta.regola).registrata, 'rule registrata dinamicamente');

  const esitoProposed = registro.cercaPerClasseConcorso('A-11');
  assert(esitoProposed.totaleRegoleTrovate === 2, 'entrambe le regole A-11 trovate');
  assert(esitoProposed.regoleAttive.length === 1, 'solo la regola ACTIVE resta attiva');
  assert(esitoProposed.regoleAttive[0]!.id === catenaAttiva.regola.id, 'la regola ACTIVE non è nascosta');
  assert(esitoProposed.verificaManualeRichiesta === true, 'PROPOSED ⇒ verifica manuale richiesta');
  assert(
    esitoProposed.incertezze.some((inc) => inc.motivo.includes('stato PROPOSED')),
    'motivo del blocco cita lo stato PROPOSED',
  );

  /* C. Source UNCERTAIN → stesso fallback di sicurezza. */
  const catenaIncerte = costruisciCatenaConStato({
    hash: HASH_SORGENTE_UNCERTAIN,
    prefisso: 'uncertain',
    statoFonte: 'UNCERTAIN',
    statoRegola: 'ACTIVE',
  });
  registro.registraCatalogo({
    fonti: [catenaIncerte.fonte],
    proposizioni: [catenaIncerte.proposizione],
    regole: [catenaIncerte.regola],
  });
  const esitoIncerte = registro.cercaPerClasseConcorso('A-11');
  assert(esitoIncerte.verificaManualeRichiesta === true, 'UNCERTAIN ⇒ verifica manuale richiesta');
  assert(esitoIncerte.regoleAttive.length === 1, 'nessuna regola incerta esposta come attiva');
  assert(
    esitoIncerte.incertezze.some((inc) => inc.motivo.includes('stato UNCERTAIN')),
    'motivo del blocco cita lo stato UNCERTAIN',
  );

  /* D. Rule PROPOSED con Source attiva → blocca la sola regola, non le altre. */
  const catenaRegolaProposta = costruisciCatenaConStato({
    hash: HASH_SORGENTE_REGOLA_PROPOSED,
    prefisso: 'rule-proposed',
    statoFonte: 'ACTIVE',
    statoRegola: 'PROPOSED',
  });
  registro.registraCatalogo({
    fonti: [catenaRegolaProposta.fonte],
    proposizioni: [catenaRegolaProposta.proposizione],
    regole: [catenaRegolaProposta.regola],
  });
  const esitoRegolaProposta = registro.cercaPerClasseConcorso('A-11');
  assert(
    esitoRegolaProposta.incertezze.some((inc) => inc.ruleId === catenaRegolaProposta.regola.id),
    'la regola PROPOSED è tra le incertezze',
  );
  assert(
    esitoRegolaProposta.regoleAttive.length === 1 &&
      esitoRegolaProposta.regoleAttive[0]!.id === catenaAttiva.regola.id,
    'le regole attive esistenti non vengono inquinate',
  );


  /* E. Catena mancante (proposizione o Source assente) → fail-safe MANUAL, mai eccezioni. */
  const regolaOrfana: Rule = creaRule({
    id: 'rule-orphan-proposition',
    proposizioneId: 'prop-mai-registrata',
    vincolo: { tipo: 'singoloSsdMinCfu', ssd: 'L-FIL-LET/05', minCfu: 12 },
    dominii: [dominioClasseConcorso('A-11')],
    stato: 'ACTIVE',
  });
  assert(registro.registraRule(regolaOrfana).registrata, 'rule orfana registrata');

  const evidenzaSenzaFonte = creaEvidence({
    id: 'ev-senza-source',
    sourceHash: HASH_SORGENTE_NON_REGISTRATA,
    testo: 'requisito con Source assente',
    coordinate: { pagina: 1, riga: 1 },
    stato: 'ACTIVE',
  });
  const proposizioneSenzaFonte = creaProposition({
    id: 'prop-senza-fonte',
    contenutoAtomico: 'Requisito dimostrativo senza Source registrata.',
    evidenze: [evidenzaSenzaFonte],
    stato: 'ACTIVE',
  });
  const regolaSenzaFonte: Rule = creaRule({
    id: 'rule-senza-fonte',
    proposizioneId: proposizioneSenzaFonte.id,
    vincolo: { tipo: 'singoloSsdMinCfu', ssd: 'L-FIL-LET/05', minCfu: 6 },
    dominii: [dominioClasseConcorso('A-11')],
    stato: 'ACTIVE',
  });
  assert(registro.registraProposition(proposizioneSenzaFonte).registrata, 'proposition senza fonte registrata');
  assert(registro.registraRule(regolaSenzaFonte).registrata, 'rule senza fonte registrata');

  const esitoFailSafe = registro.cercaPerClasseConcorso('A-11');
  assert(esitoFailSafe.verificaManualeRichiesta === true, 'catene mancanti ⇒ MANUAL (nessuna eccezione)');
  assert(
    esitoFailSafe.incertezze.some((inc) => inc.ruleId === regolaOrfana.id),
    'rule con proposizione mancante segnalata',
  );
  assert(
    esitoFailSafe.incertezze.some((inc) => inc.ruleId === regolaSenzaFonte.id),
    'rule con Source mancante segnalata',
  );
  assert(
    esitoFailSafe.incertezze.some((inc) => inc.motivo.includes('non registrata')),
    "motivo cita l'anello mancante della catena",
  );
  const analisiOrfana = registro.analizzaRegola(regolaOrfana.id);
  assert(analisiOrfana.trovata && !analisiOrfana.attiva, 'analizzaRegola fail-safe sulla rule orfana');
  assert(registro.getRule('rule-mai-iscritta') === undefined, 'getter su id assente ⇒ undefined (no throw)');

  /* F. Dominio senza regole e duplicati → comportamento prevedibile. */
  const esitoVuoto = registro.cercaPerClasseConcorso('A-99');
  assert(esitoVuoto.totaleRegoleTrovate === 0 && esitoVuoto.regoleAttive.length === 0, 'dominio vuoto senza errori');
  assert(esitoVuoto.verificaManualeRichiesta === false, 'dominio vuoto ≠ verifica manuale');
  const duplicatoRule = registro.registraRule(catenaAttiva.regola);
  assert(
    duplicatoRule.registrata === false && duplicatoRule.motivo === 'gia-presente',
    'duplicato rule rifiutato',
  );
  const duplicatoSource = registro.registraSource(catenaAttiva.fonte);
  assert(
    duplicatoSource.registrata === false && duplicatoSource.motivo === 'gia-presente',
    'duplicato source rifiutato',
  );

  const conteggi = registro.conteggi();
  assert(conteggi.fonti === 4, 'fonti registrate = 4');
  assert(conteggi.regole === 6, 'regole registrate = 6');
  assert(conteggi.relazioni === 1, 'relazioni registrate = 1');
  assert(conteggi.proposizioni === 5, 'proposizioni registrate = 5');

  const esitoFinale = registro.cercaPerClasseConcorso('A-11');
  console.log('  ✓ Ingestione dinamica: nuova Source+Rule subito disponibile al lookup.');
  console.log(
    '  ✓ Lookup A-11:',
    `trovate=${esitoFinale.totaleRegoleTrovate}`,
    `attive=${esitoFinale.regoleAttive.length}`,
    `MANUAL=${esitoFinale.verificaManualeRichiesta}`,
  );
  console.log('  ✓ Fallback di sicurezza attivo per PROPOSED/UNCERTAIN e catene mancanti.');
  console.log('  ✓ Nessun condizionale normativo: selezione solo via dominii/stati.');
}

console.log('SourceRegistry — ingestione dinamica e fallback MANUAL_VERIFICATION_REQUIRED');
testRegistry();
console.log(`\nTutti i ${conteggioAssert} assert sono passati.`);

