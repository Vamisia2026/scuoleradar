/**
 * GUARDIA · GERARCHIA DEL RECAPITO DI CANDIDATURA (§26.116).
 *
 * Blocca le promesse di prodotto che fanno perdere le candidature quando
 * vengono violate:
 *   1. la scala è quella dichiarata — PEO → segreteria → dirigenza → generica →
 *      PEC → dominio esterno, e la PEC non è MAI primaria;
 *   2. tra più candidati vince il rango migliore, un indirizzo OSSERVATO batte
 *      una RICOSTRUZIONE (convenzione MIM) e la fonte resta davanti a parità;
 *   3. l'aggiornamento della riga segue la stessa scala: si riempie un buco, si
 *      sostituisce una PEC/casella personale, non si abbassa mai un recapito
 *      buono e una ricostruzione non sale sopra un dato osservato;
 *   4. le etichette della natura sono quelle mostrate all'utente (mai un codice).
 *
 * Uso: npm run test:contatti
 */
import {
  ETICHETTA_NATURA,
  RANGO_CONTATTO,
  eAggiornamentoContatto,
  eContattoPrimario,
  etichettaContatto,
  naturaContatto,
  rangoContatto,
  scegliContatto,
} from '../src/lib/gerarchiaContatti.ts';
import { arricchisciDaAnagrafica } from '../src/lib/anagraficaScuole.ts';
import type { IndiceAnagrafica } from '../src/lib/anagraficaIndice.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. La scala: PEO → segreteria → dirigenza → generica → PEC → esterno —');
check(
  'ranghi dichiarati (1 = migliore)',
  { peo: 1, segreteria: 2, dirigenza: 3, istituto: 4, pec: 5, esterno: 6 },
  RANGO_CONTATTO,
);
check('PEO ministeriale: codice@istruzione.it', 'peo', naturaContatto('BSIS02900X@Istruzione.IT'));
check('segreteria / didattica', 'segreteria', naturaContatto('segreteria@icgigli.edu.it'));
check('didattica è segreteria', 'segreteria', naturaContatto('didattica@icgigli.edu.it'));
check('protocollo è segreteria', 'segreteria', naturaContatto('protocollo@icgigli.edu.it'));
check('DSGA è segreteria (non dirigenza)', 'segreteria', naturaContatto('dsga@icgigli.edu.it'));
check('dirigente → dirigenza', 'dirigenza', naturaContatto('dirigente@liceogigli.edu.it'));
check('presidenza → dirigenza', 'dirigenza', naturaContatto('presidenza@liceogigli.edu.it'));
check('casella generica → istituto', 'istituto', naturaContatto('info@icgigli.edu.it'));
check('PEC dal dominio', 'pec', naturaContatto('bsis02900x@pec.istruzione.it'));
check(
  "PEC riconosciuta anche dall'etichetta del dominio",
  'pec',
  naturaContatto('segreteria@postacert.istruzione.it'),
);
check('dominio personale → esterno', 'esterno', naturaContatto('prof.rossi@gmail.com'));
check(
  'una casella «segreteria» su gmail resta esterna (mai recapito scolastico)',
  'esterno',
  naturaContatto('segreteria.icgigli@gmail.com'),
);
check("valore che non è un'email → nessuna natura", null, naturaContatto('scrivi alla segreteria'));
check('stringa vuota → nessuna natura', null, naturaContatto('   '));
check('email senza dominio valido → nessuna natura', null, naturaContatto('a@localhost'));

console.log('\n— 2. Primari e ripieghi —');
check('PEO è primaria', true, eContattoPrimario('bsis02900x@istruzione.it'));
check('segreteria è primaria', true, eContattoPrimario('segreteria@icgigli.edu.it'));
check('casella generica è primaria', true, eContattoPrimario('info@icgigli.edu.it'));
check('la PEC NON è primaria', false, eContattoPrimario('bsis02900x@pec.istruzione.it'));
check('un dominio personale NON è primario', false, eContattoPrimario('prof.rossi@gmail.com'));

console.log('\n— 3. Scelta tra più candidati —');
check(
  'la PEO batte la segreteria',
  { email: 'bsis02900x@istruzione.it', natura: 'peo', provenienza: 'storico' },
  scegliContatto([
    { email: 'segreteria@icgigli.edu.it', provenienza: 'fonte' },
    { email: 'bsis02900x@istruzione.it', provenienza: 'storico' },
  ]),
);
check(
  'la segreteria batte la casella generica',
  { email: 'segreteria@icgigli.edu.it', natura: 'segreteria', provenienza: 'fonte' },
  scegliContatto([
    { email: 'info@icgigli.edu.it', provenienza: 'anagrafica' },
    { email: 'segreteria@icgigli.edu.it', provenienza: 'fonte' },
  ]),
);
check(
  "la PEC entra solo quando non c'è una casella reale",
  { email: 'bsis02900x@pec.istruzione.it', natura: 'pec', provenienza: 'fonte' },
  scegliContatto([
    { email: 'bsis02900x@pec.istruzione.it', provenienza: 'fonte' },
    { email: '', provenienza: 'storico' },
  ]),
);
check(
  'osservata batte ricostruita a parità di natura',
  'segreteria@icgigli.edu.it',
  scegliContatto([
    { email: 'segreteria@icgigli.edu.it', provenienza: 'fonte' },
    { email: 'bsis02900x@istruzione.it', provenienza: 'convenzione', derivato: true },
  ])?.email,
);
check(
  'nessun candidato valido → null (nessun indirizzo inventato)',
  null,
  scegliContatto([{ email: null, provenienza: 'fonte' }, { email: 'boh', provenienza: 'storico' }]),
);

console.log('\n— 4. Aggiornamento della riga (arricchimento opportunistico) —');
check('buco da riempire', true, eAggiornamentoContatto(null, 'segreteria@icgigli.edu.it'));
check(
  'PEC sostituita da una casella reale',
  true,
  eAggiornamentoContatto('bsis02900x@pec.istruzione.it', 'bsis02900x@istruzione.it'),
);
check(
  'casella generica promossa a segreteria',
  true,
  eAggiornamentoContatto('info@icgigli.edu.it', 'segreteria@icgigli.edu.it'),
);
check(
  'dominio personale sostituito dalla PEO',
  true,
  eAggiornamentoContatto('prof.rossi@gmail.com', 'bsis02900x@istruzione.it'),
);
check(
  'mai un peggioramento (segreteria → casella generica)',
  false,
  eAggiornamentoContatto('segreteria@icgigli.edu.it', 'info@icgigli.edu.it'),
);
check(
  'una ricostruzione non sale sopra un recapito osservato',
  false,
  eAggiornamentoContatto('segreteria@icgigli.edu.it', 'bsis02900x@istruzione.it', {
    derivato: true,
  }),
);
check(
  "contratto «fill-only» dell'anagrafica: un primario non si tocca",
  false,
  eAggiornamentoContatto('segreteria@icgigli.edu.it', 'bsis02900x@istruzione.it', {
    soloNonPrimari: true,
  }),
);
check(
  'contratto «fill-only»: la PEC invece si completa',
  true,
  eAggiornamentoContatto('bsis02900x@pec.istruzione.it', 'bsis02900x@istruzione.it', {
    soloNonPrimari: true,
  }),
);
check(
  'nessun candidato → nessun aggiornamento',
  false,
  eAggiornamentoContatto('segreteria@icgigli.edu.it', null),
);

console.log("\n— 5. Etichette per l'interfaccia —");
check(
  "etichette dichiarate (quelle mostrate all'utente)",
  {
    peo: 'PEO ministeriale',
    segreteria: 'Segreteria',
    dirigenza: 'Dirigenza',
    istituto: 'Istituto',
    pec: 'PEC (atti formali)',
    esterno: 'Dominio esterno',
  },
  ETICHETTA_NATURA,
);
check('etichetta della PEO', 'PEO ministeriale', etichettaContatto('bsis02900x@istruzione.it'));
check(
  'etichetta di ripiego dichiarata',
  'PEC (atti formali)',
  etichettaContatto('bsis02900x@pec.istruzione.it'),
);
check('nessuna etichetta per un valore illeggibile', '', etichettaContatto(null));

// §26.116 — Le stesse regole sull'ANAGRAFICA (contratto «fill-only»): un recapito
// già buono non si tocca, PEC e dominio personale salgono alla PEO dell'istituto.
const scuola = {
  codice: 'MBIC80500A',
  nome: 'I.C. "S. ANDREA"',
  istitutoCodice: 'MBIC80500A',
  email: 'mbic80500a@istruzione.it',
  pec: 'mbic80500a@pec.istruzione.it',
  sitoWeb: null,
  provinciaCodice: 'MB',
};
const indice = {
  perCodice: new Map([['MBIC80500A', scuola]]),
  perIstituto: new Map(),
  sitoPerIstituto: new Map(),
  perNome: new Map(),
  totale: 1,
  fileLetti: [],
  disponibile: true,
} as unknown as IndiceAnagrafica;
const recapitoDopo = (contact_email: string) =>
  arricchisciDaAnagrafica(indice, { school_code: 'MBIC80500A', contact_email }).patch
    .contact_email as string | undefined;
check(
  '§26.116 · anagrafica: PEC/dominio personale → PEO, un primario resta',
  ['mbic80500a@istruzione.it', 'mbic80500a@istruzione.it', undefined],
  ['mbic80500a@pec.istruzione.it', 'segreteria.ic@gmail.com', 'segreteria@ic.it'].map(recapitoDopo),
);

console.log(`\n${errori === 0 ? '✅' : '❌'} GERARCHIA CONTATTI: ${errori} errore/i`);
if (errori > 0) process.exitCode = 1;

check('rango di un valore illeggibile = 0', 0, rangoContatto('non-una-email'));
