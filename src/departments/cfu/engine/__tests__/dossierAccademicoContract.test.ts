/**
 * ScuoleRadar.it — Dipartimento CFU · CONTRATTO Fascicolo Accademico (fasi 6-6.5).
 *
 * Verifica i soli FATTI DI CONTRATTO, senza alcuna logica nuova:
 *  - la normalizzazione NON distrugge i dati originali (grezzo, provenienza,
 *    confidenza, stato, nota, evidenza fisica, input di deduplica);
 *  - un dato INFERITO resta marcato come tale; la conferma dell'utente lo rende
 *    DICHIARATO (mai «verificato») e la storia resta completa;
 *  - la provenienza del titolo è allineata a quella degli esami;
 *  - il fascicolo persistente compone documenti (con stato di conservazione),
 *    titoli, esami e discrepanze (non risolte o risolte, con le evidenze intatte).
 *
 * ⚠️ Nessun algoritmo di estrazione/deduplica/discrepanza/retention è implementato qui.
 */
import { normalizzaEsame, normalizzaTitolo } from '../normalizer';
import { eseguiPipelineUniversale } from '../pipeline/pipeline';
import {
  assert,
  conteggioAsserzioni,
  esameMock,
  EXAMS_COMPLETI,
  inputMock,
  regolaMock,
  shaFixture,
  TITOLO_MOCK,
} from './universalPipelineFixtures';
import type {
  AmbiguitaIdentita,
  DiscrepanzaDato,
  DocumentoCaricato,
  DossierAccademico,
  EsameCanonico,
  Provenienza,
  TitoloAccademicoCanonico,
} from '../types';

/** Esame con SSD STIMATO da una regola (nessuna evidenza nel documento). */
function esameConSsdInferito(): EsameCanonico {
  const provenienza: Provenienza[] = [
    {
      fonte: { documentId: 'doc-1', pagina: 2, riga: 7, testo: 'Analisi Matematica I — 12 CFU' },
      confidenza: 0.6,
      metodo: 'ocr',
      stato: 'estratto',
      campo: 'denominazione',
      nota: 'riga letta dal libretto, SSD non stampato',
    },
    {
      confidenza: 0.6,
      metodo: 'inferenza',
      stato: 'inferito',
      campo: 'ssd',
      nota: 'stima dal nome insegnamento (regola lessicale, NON normativa)',
    },
  ];
  return {
    ...esameMock('inf-1', 'X-TEST/01', 12),
    ssdOrigine: null,
    codice: 'X-TEST-101',
    periodo: '1° semestre',
    istituzione: 'Università TEST',
    provenienza,
  };
}

/* ------------------- 1. La normalizzazione non distrugge l'originale ------------------- */

function testNormalizzazioneConservativa(): void {
  const originale = esameConSsdInferito();
  const canonico = normalizzaEsame(originale);

  assert(canonico.cfu === originale.cfu, 'CFU grezzo conservato');
  // GAP DOCUMENTATO (docs/CFU_FASCICOLO_ACCADEMICO_SPEC.md §2): il normalizer
  // valorizza `ssdOrigine` col primo codice disponibile (`ssdOrigine` → `ssd` → `gsd`),
  // quindi per un SSD STIMATO l'origine diventa indistinguibile da un codice
  // dichiarato. Il contratto (provenienza con `stato: 'inferito'` e `campo`) consente
  // di correggerlo quando il motore leggerà lo stato del dato.
  assert(canonico.ssdOrigine === 'X-TEST/01', 'gap documentato: ssdOrigine assorbe il codice stimato (nessuna evidenza nel documento)');
  assert(canonico.ssd === 'X-TEST/01', 'SSD canonico presente (stima riconoscibile)');
  assert(canonico.provenienza.length === 2 && canonico.provenienza[0]!.fonte?.riga === 7, 'provenienza e riferimento fisico (pagina/riga/testo) conservati');
  assert(canonico.provenienza[0]!.stato === 'estratto' && canonico.provenienza[1]!.stato === 'inferito', 'stato epistemico distinto per campo (estratto vs inferito)');
  assert(canonico.provenienza[1]!.nota?.includes('NON normativa') === true, 'la spiegazione della stima resta allegata al dato');
  assert(canonico.provenienza[1]!.campo === 'ssd' && canonico.provenienza[1]!.confidenza === 0.6, 'campo e confidenza del dato inferito conservati');
  assert(canonico.codice === 'X-TEST-101' && canonico.periodo === '1° semestre' && canonico.istituzione === 'Università TEST', 'input di deduplica (codice, periodo, istituzione) conservati dalla normalizzazione');
  assert(canonico.manualVerified === undefined, 'una stima NON è mai verificata');
  console.log('  ✓ Normalizzazione conservativa: grezzo, provenienza, stato, campo, confidenza, dedup.');
}

/* ------------- 1b. Conferma dell'utente: dichiarato, mai «verificato» ------------- */

function testConfermaUtente(): void {
  // L'utente accetta la proposta di SSD: il fatto diventa DICHIARATO dall'utente.
  // `verificato` resta riservato a un controllo su evidenza/autorità: la storia
  // completa (stima + conferma) rimane nell'elenco delle provenienze.
  const confermato: EsameCanonico = {
    ...esameConSsdInferito(),
    provenienza: [
      ...esameConSsdInferito().provenienza,
      {
        confidenza: 1,
        metodo: 'manuale',
        stato: 'dichiarato',
        campo: 'ssd',
        nota: 'conferma dell’utente su proposta automatica',
      },
    ],
  };
  const canonico = normalizzaEsame(confermato);
  const ultimaProvenienza = canonico.provenienza[canonico.provenienza.length - 1]!;
  assert(canonico.provenienza.length === 3, 'la provenienza conserva la storia completa del fatto');
  assert(ultimaProvenienza.stato === 'dichiarato' && ultimaProvenienza.metodo === 'manuale', 'la conferma dell’utente è un dato DICHIARATO, non una verifica');
  assert(canonico.provenienza.some((voce) => voce.stato === 'inferito'), 'la stima originale resta tracciata insieme alla conferma');
  assert(canonico.manualVerified === undefined, 'la conferma dell’utente non promuove a «verificato»');
  console.log('  ✓ Inferenza → conferma utente: dichiarato, mai verificato automaticamente.');
}

/* ------------------- 2. Un dato inferito non diventa mai verificato ------------------- */

function testInferitoMaiVerificato(sha: string): void {
  const esami = [...EXAMS_COMPLETI.filter((esame) => esame.ssd !== 'X-TEST/01'), esameConSsdInferito()];
  const risultato = eseguiPipelineUniversale(inputMock([regolaMock(sha)], { esami }));
  const esame = risultato.dati.esami.find((voce) => voce.id === 'inf-1')!;

  assert(esame.manualVerified === undefined, 'la stima non imposta mai il flag di verifica');
  assert(esame.provenienza.some((voce) => voce.stato === 'inferito' && voce.campo === 'ssd'), 'la stima attraversa la pipeline con il proprio stato e il campo coperto');
  assert(esame.provenienza.some((voce) => voce.stato === 'estratto'), 'l’evidenza documentale resta visibile accanto alla stima');
  // COMPORTAMENTO ATTUALE (gap dichiarato in docs/CFU_FASCICOLO_ACCADEMICO_SPEC.md):
  // il solver non legge ancora `stato`/`confidenza`, quindi conta l’SSD stimato come
  // se fosse dichiarato. Il contratto è pronto; l’uso prudente è la fase successiva.
  assert(
    risultato.stato === 'ELIGIBLE',
    `gap documentato: il motore non usa ancora lo stato del dato (stato ${risultato.stato})`,
  );
  const valutazioneSingolo = risultato.valutazioniRequisito.find((voce) =>
    voce.requisitoId.includes('v-T-singolo'),
  )!;
  assert(valutazioneSingolo.datiUsati.includes('inf-1'), 'l’esame stimato resta tracciato fra i dati usati dal requisito');
  console.log('  ✓ Dato inferito: marcato, tracciato e mai promosso a verificato.');
}

/* ---------------------- 3. Provenienza del titolo (allineamento) ---------------------- */

function testProvenienzaTitolo(): void {
  const titolo: TitoloAccademicoCanonico = {
    ...TITOLO_MOCK,
    provenienza: [
      {
        fonte: { documentId: 'doc-1', pagina: 1, riga: 3, testo: 'Classe LM-99-TEST' },
        confidenza: 0.9,
        metodo: 'ocr',
        stato: 'estratto',
        campo: 'classe',
      },
    ],
  };
  const canonico = normalizzaTitolo(titolo);
  assert(canonico.provenienza?.length === 1 && canonico.provenienza[0]!.campo === 'classe', 'la provenienza del titolo sopravvive alla normalizzazione');
  assert(canonico.raw !== undefined, 'il payload originale del titolo è conservato');
  console.log('  ✓ Provenienza del titolo allineata a quella degli esami.');
}


/* ---------------------- 4. Fascicolo multi-documento (contratto) ---------------------- */

function testFascicoloMultiDocumento(): void {
  const documenti: DocumentoCaricato[] = [
    {
      documentId: 'doc-1',
      tipo: 'libretto-o-transcript',
      nome: 'libretto.pdf',
      formato: 'pdf',
      ricevutoIl: '2026-03-01T10:00:00.000Z',
      pagine: 4,
      improntaSha256: 'a'.repeat(64),
      esitoEstrazione: 'estratto',
      conservazione: 'originale',
    },
    {
      documentId: 'doc-2',
      tipo: 'certificazione',
      nome: 'certificato.pdf',
      formato: 'pdf',
      ricevutoIl: '2026-03-02T09:30:00.000Z',
      pagine: 2,
      improntaSha256: 'b'.repeat(64),
      esitoEstrazione: 'parziale',
      conservazione: 'soli-dati',
    },
  ];
  // Stesso esame in due documenti con CFU diversi: discrepanza NON risolta
  // (entrambe le evidenze restano; nessuna gerarchia di fonti automatica).
  const discrepanza: DiscrepanzaDato = {
    chiaveLogica: 'esame::analisi-matematica-i',
    campo: 'cfu',
    valori: [
      { valore: '6', documentId: 'doc-1', confidenza: 0.9 },
      { valore: '9', documentId: 'doc-2', confidenza: 0.7 },
    ],
    stato: 'non-risolta',
  };
  // Identità non decidibile fra due evidenze (fase 6.7): NON si fonde e NON si duplica.
  const identitaAmbigua: AmbiguitaIdentita = {
    chiaveLogica: 'esame::storia-moderna',
    evidenze: ['esame-doc1-r7', 'esame-doc2-r3'],
    motivo: 'stesso nome e ateneo ma CFU 6 vs 9: nessuna prova sufficiente per associare',
    stato: 'da-rivedere',
  };
  const dossier: DossierAccademico = {
    documenti,
    titoli: [{ ...TITOLO_MOCK, provenienza: [{ confidenza: 0.8, metodo: 'ocr', stato: 'estratto' }] }],
    esami: [esameConSsdInferito()],
    discrepanze: [discrepanza],
    ambiguitaIdentita: [identitaAmbigua],
  };

  assert(dossier.documenti.length === 2, 'più documenti nello stesso fascicolo');
  assert(dossier.titoli.length === 1, 'uno o più titoli nel fascicolo');
  assert(dossier.documenti.every((documento) => documento.improntaSha256 !== null && documento.ricevutoIl > ''), 'ogni documento ha impronta e data di ricezione (ganci di retention)');
  assert(dossier.discrepanze[0]!.valori.map((valore) => valore.documentId).join('|') === 'doc-1|doc-2', 'ogni valore in conflitto conserva il documento che lo dichiara');
  assert(dossier.discrepanze[0]!.stato === 'non-risolta', 'nessuna risoluzione automatica delle discrepanze');
  assert(dossier.documenti.some((documento) => documento.conservazione === 'soli-dati'), 'un documento può vivere come «soli dati» (originale eliminato) mantenendo i derivati');
  const risolta: DiscrepanzaDato = { ...discrepanza, stato: 'risolta' };
  assert(risolta.stato === 'risolta' && risolta.valori.length === 2, 'anche dopo la decisione le due evidenze restano conservate');
  assert(dossier.esami[0]!.provenienza[1]!.stato === 'inferito', 'il fascicolo conserva lo stato del dato di ogni fatto');
  assert(dossier.ambiguitaIdentita.length === 1 && dossier.ambiguitaIdentita[0]!.stato === 'da-rivedere', 'identità ambigua rappresentata: nessuna associazione silenziosa');
  assert(dossier.ambiguitaIdentita[0]!.evidenze.length === 2, 'entrambe le evidenze restano elencate (nessuna fusione distruttiva)');
  console.log('  ✓ Fascicolo persistente: documenti, titoli, fatti, discrepanze, identità ambigue.');
}

/* ------------------------------ Runner ------------------------------ */

async function main(): Promise<void> {
  console.log('Contratto Fascicolo Accademico — provenienza e stato del dato (nessuna logica nuova)');
  const sha = await shaFixture();
  testNormalizzazioneConservativa();
  testConfermaUtente();
  testInferitoMaiVerificato(sha);
  testProvenienzaTitolo();
  testFascicoloMultiDocumento();
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});

