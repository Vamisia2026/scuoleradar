/**
 * Verifica il GATE dei nomi d'istituto delle viste pubbliche
 * (`src/lib/nomeIstituto.ts` + le superfici di vetrina di `src/lib/liveBoard.ts`).
 *
 * Direttiva cliente 28/09/2026: nella colonna «Scuola & Città» non finisce MAI un
 * codice amministrativo o una stringa grezza («EEEE | A246», «AAAA | A246»,
 * «BA02 | AR04») né un'etichetta di posto/materia: se il nome non è risolvibile in
 * chiaro la riga non entra in vetrina. I casi qui elencati sono i valori REALI
 * trovati in `interpelli` (dump di classi, «Conversazione in lingua straniera»,
 * «Esiti assegnazione sede», «timbro_…») più quelli citati dal cliente.
 *
 * Uso: npm run test:nome-istituto (incluso in `npm test`)
 */
import {
  nomePresentabileRiga,
  rigaPresentabileVetrina,
  titoloLeggibile,
} from '../src/lib/liveBoard.ts';
import { nomeIstitutoPresentabile } from '../src/lib/nomeIstituto.ts';
import { codiciSostegno } from '../src/data/classiConcorso.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const FUTURO = '2099-12-31';

console.log('— Gate: codici amministrativi e stringhe grezze MAI in vetrina —');
check('«EEEE | A246» (esempio cliente) non è un nome di scuola', null, nomeIstitutoPresentabile('EEEE | A246'));
check('«AAAA | A246» (esempio cliente) non è un nome di scuola', null, nomeIstitutoPresentabile('AAAA | A246'));
check('«EEEE» da solo non è un nome', null, nomeIstitutoPresentabile('EEEE'));
check('«A-48 | AA-22 | AM22 | A-30» → nessun nome', null, nomeIstitutoPresentabile('A-48 | AA-22 | AM22 | A-30'));
check('dump di classi col sostegno → nessun nome', null, nomeIstitutoPresentabile('EEEE | ADEE | Alternativa IRC | ADMM'));
check('etichetta di materia → nessun nome', null, nomeIstitutoPresentabile('Conversazione in lingua straniera'));
check('«Scuola primaria posto Montessori» → nessun nome', null, nomeIstitutoPresentabile('Scuola primaria posto Montessori'));
check('atto amministrativo → nessun nome', null, nomeIstitutoPresentabile('Esiti assegnazione sede'));
check('ufficio scolastico → non è un istituto', null, nomeIstitutoPresentabile('USR Piemonte'));
check('artefatto «timbro_…» → nessun nome', null, nomeIstitutoPresentabile('timbro_protocollo_interpello_COSMA_-'));
check('sigla di plesso «PRIMARIA-signed» → nessun nome', null, nomeIstitutoPresentabile('PRIMARIA-signed'));
check('codice col trattino dentro un testo → nessun nome', null, nomeIstitutoPresentabile('I.C. A-48 Carducci'));

console.log('\n— Gate: i nomi REALI passano (e la coda di procedura si taglia) —');
check('«Liceo Statale A. Monti»', 'Liceo Statale A. Monti', nomeIstitutoPresentabile('Liceo Statale A. Monti'));
check('«IC Carducci»', 'IC Carducci', nomeIstitutoPresentabile('IC Carducci'));
check("sigla puntata «I.I.S. 'L. Gigli'»", "I.I.S. 'L. Gigli'", nomeIstitutoPresentabile("I.I.S. 'L. Gigli'"));
check('prefisso romano «III IC Ricci Curbastro»', 'III IC Ricci Curbastro', nomeIstitutoPresentabile('III IC Ricci Curbastro'));
check('civico con numero («I.C. Castiglione 1»)', 'I.C. Castiglione 1', nomeIstitutoPresentabile('I.C. Castiglione 1'));
check(
  'coda di procedura tagliata',
  'IC ALBIGNASEGO',
  nomeIstitutoPresentabile('IC ALBIGNASEGO Interpello per copertura posti sostegno primaria'),
);
check(
  'coda di procedura tagliata (nome con sigla puntata)',
  'I.C. Ferruccio Ulivi',
  nomeIstitutoPresentabile('I.C. Ferruccio Ulivi – interpello preventivo primaria sostegno'),
);
check('dump + nome dentro → si salva il nome', 'Liceo Monti', nomeIstitutoPresentabile('EEEE | A246 | Liceo Monti'));
check(
  '«Corso» è una VIA nel nome («I.C. CUNEO CORSO SOLERI»): non si taglia lì',
  'I.C. CUNEO CORSO SOLERI',
  nomeIstitutoPresentabile('I.C. CUNEO CORSO SOLERI'),
);
check(
  '«corso di formazione» è PROCEDURA: il nome si taglia lì',
  'IC ALBIGNASEGO',
  nomeIstitutoPresentabile('IC ALBIGNASEGO corso di formazione per esperti'),
);
console.log('\n— Sigle di sostegno: solo `AD…`, mai un toponimo di 4 lettere —');
/** «ASTI» ha la stessa forma A+?+2 lettere: il vecchio pattern la scartava come sostegno. */
check('«I.C. VILLAFRANCA D ASTI» è un nome (non una sigla di sostegno)', 'I.C. VILLAFRANCA D ASTI', nomeIstitutoPresentabile('I.C. VILLAFRANCA D ASTI'));
check('«IC Carducci Asti» resta un nome', 'IC Carducci Asti', nomeIstitutoPresentabile('IC Carducci Asti'));
check(
  'tutte le sigle di sostegno del catalogo restano SCARTATE',
  [],
  codiciSostegno.filter((c) => nomeIstitutoPresentabile(c) !== null),
);
check(
  'una sigla di sostegno dentro un testo continua a scartare il nome',
  null,
  nomeIstitutoPresentabile('I.C. X Asti ADEE'),
);

console.log('\n— Titolo di vetrina: mai un dump di codici al posto del testo —');
check('titolo fatto di soli codici → niente sottotitolo', null, titoloLeggibile('ADEE | A042 | AAAA | ADAA | EEEE | A042 | ADMM'));
check('titolo leggibile → ripulito', 'Interpello per supplenza A-022', titoloLeggibile('Interpello per supplenza A-022 |'));

console.log('\n— Responso della prova: stessa regola della bacheca —');
const rigaProva = (school_name: string | null, title: string) => ({
  id: 'p',
  title,
  school_name,
  province: 'TO',
  expiration_date: FUTURO,
});
check('titolo-dump e nessuna scuola → fuori dalla vetrina', false, rigaPresentabileVetrina(rigaProva(null, 'ADEE | EEEE | A042')));
check('scuola reale → dentro', true, rigaPresentabileVetrina(rigaProva('IC Carducci', 'ADEE | EEEE | A042')));
check('titolo leggibile senza scuola → dentro', true, rigaPresentabileVetrina(rigaProva(null, 'Interpello per supplenza A-022')));
check(
  'ente emittente come etichetta (mai un codice di provincia)',
  'USP Torino',
  nomePresentabileRiga(rigaProva(null, 'Avviso USP Asti — graduatoria provinciale')),
);

console.log(errori === 0 ? '\n✅ NOMI ISTITUTO: nessun problema' : `\n❌ NOMI ISTITUTO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
