/**
 * Verifica l'ESTRAZIONE dell'email istituzionale dalle TABELLE delle fonti:
 *  · `mailto:` (anche con entità HTML);
 *  · indirizzi OFFUSCATI ("[at]", "(dot)", " at ", " dot ");
 *  · scelta del dominio scolastico (.edu.it/.gov.it) e correlazione con l'istituto
 *    (es. Liceo Augusto Monti → segreteria@liceoaugustomonti.edu.it);
 *  · nessuna email inventata quando la fonte non ne contiene.
 *
 * Uso: npm run test:email-scuola
 */
import {
  deoffuscaEmail,
  estraiEmailScuola,
  estraiEmails,
  normalizzaTldEmail,
  parseInterpello,
  punteggioEmailScuola,
} from '../src/scraper/parser.ts';
import {
  estraiCodiceMeccanograficoDaTesto,
  normalizzaCodiceMeccanografico,
  risolviEmailUfficialeScuola,
} from '../src/lib/emailScuola.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— De-offuscamento (entità HTML e varianti testuali) —');
check('entità &#64;/&#46;', 'segreteria@scuola.edu.it', deoffuscaEmail('segreteria&#64;scuola&#46;edu&#46;it'));
check('&commat; + &period;', 'info@x.gov.it', deoffuscaEmail('info&commat;x&period;gov&period;it'));
check('[at] e (dot)', 'protocollo@liceoaugustomonti.edu.it', deoffuscaEmail('protocollo [at] liceoaugustomonti (dot) edu (dot) it'));
check(' " at " + " dot " ', 'segreteria@scuola.edu.it', deoffuscaEmail('segreteria at scuola dot edu dot it'));
check('prosa italiana intatta', 'punto di vista at school', deoffuscaEmail('punto di vista at school'));

console.log('\n— Riparazione del TLD con parola INCOLLATA (fonti reali: …itposta) —');
check('TLD riparato', 'emailusp.mc@istruzione.it', normalizzaTldEmail('emailusp.mc@istruzione.itposta'));
check('estraiEmails ripara il TLD', ['usp.mo@istruzione.it'], estraiEmails('Contatti: usp.mo@istruzione.itposta elettronica'));
check('TLD valido invariato', 'segreteria@scuola.edu.it', normalizzaTldEmail('segreteria@scuola.edu.it'));
check('TLD sconosciuto NON alterato', 'info@dominio.invalid', normalizzaTldEmail('info@dominio.invalid'));

console.log('\n— estraiEmails su testo TABELLARE —');
const rigaTabella =
  'Interpello supplenza A-041 · Liceo Augusto Monti · Candidature: segreteria [at] liceoaugustomonti (dot) edu (dot) it · Info: protocollo@liceoaugustomonti.edu.it';
check(
  'due indirizzi normalizzati',
  ['segreteria@liceoaugustomonti.edu.it', 'protocollo@liceoaugustomonti.edu.it'],
  estraiEmails(rigaTabella),
);

console.log('\n— Scelta dell\'indirizzo di candidatura —');
const ctx = { schoolName: 'Liceo Augusto Monti', schoolCode: 'TOPC01000X' };
check(
  'preferisce il .edu.it al gmail',
  'segreteria@liceoaugustomonti.edu.it',
  estraiEmailScuola(null, 'Scrivere a augustomonti@gmail.com oppure a segreteria@liceoaugustomonti.edu.it', ctx),
);
check(
  'mailto: prioritario',
  'protocollo@liceoaugustomonti.edu.it',
  estraiEmailScuola('mailto:protocollo@liceoaugustomonti.edu.it', 'altro@esempio.com', ctx),
);
check(
  'correlazione con il nome scuola → punteggio più alto',
  true,
  punteggioEmailScuola('segreteria@liceoaugustomonti.edu.it', ctx) >
    punteggioEmailScuola('segreteria@istitutoesempio.edu.it', ctx),
);
check(
  'indirizzo offuscato riconosciuto come migliore',
  'segreteria@liceoaugustomonti.edu.it',
  estraiEmailScuola(null, 'Candidature: segreteria [at] liceoaugustomonti (dot) edu (dot) it', ctx),
);
check(
  'nessuna email nella fonte → null',
  null,
  estraiEmailScuola(null, 'Nessun contatto indicato.', ctx),
);

console.log('\n— Email UFFICIALE dalla convenzione MIM (PEO/PEC) —');
check('codice meccanografico riconosciuto', 'ASTF01000X', normalizzaCodiceMeccanografico('as tf 01000 x'));
check('codice non valido → null', null, normalizzaCodiceMeccanografico('ASTF010'));
check(
  'codice estratto dal testo',
  'BSIS02900X',
  estraiCodiceMeccanograficoDaTesto('Istituto "L. Gigli" — Cod. Mecc. BSIS02900X (Rovato)'),
);
check('PEO ufficiale dal codice', 'bsis02900x@istruzione.it', risolviEmailUfficialeScuola({ schoolCode: 'BSIS02900X' })?.email ?? null);
check('tipo PEO dichiarato', 'peo', risolviEmailUfficialeScuola({ schoolCode: 'BSIS02900X' })?.tipo ?? null);
check('PEC su richiesta (atti formali)', 'bsis02900x@pec.istruzione.it', risolviEmailUfficialeScuola({ schoolCode: 'BSIS02900X', preferisciPec: true })?.email ?? null);
check(
  'email della fonte vince sulla convenzione',
  'segreteria@liceoaugustomonti.edu.it',
  risolviEmailUfficialeScuola({ emailsTrovate: ['segreteria@liceoaugustomonti.edu.it'], schoolCode: 'ASTF01000X' })?.email ?? null,
);
check(
  'domini non istituzionali scartati (si usa la PEO)',
  'astf01000x@istruzione.it',
  risolviEmailUfficialeScuola({ emailsTrovate: ['docente@gmail.com'], schoolCode: 'ASTF01000X' })?.email ?? null,
);
check(
  'nessun appiglio reale → null (mai email inventate)',
  null,
  risolviEmailUfficialeScuola({ emailsTrovate: [], schoolCode: null, testo: 'Avviso senza codice.' }),
);

console.log("\n— Pipeline: il parser completa l'email mancante —");
const conCodice = parseInterpello({
  title: 'Interpello supplenza A-041 — Liceo Augusto Monti (cod. mecc. ASTF01000X)',
  link: 'https://www.istruzione.piemonte.it/avvisi/interpello-a041-monti.pdf',
  provincia: 'AT',
  source: 'test',
});
check('email risolta dal codice nel titolo', 'astf01000x@istruzione.it', conCodice.contactEmail);
check('codice meccanografico persistito', 'ASTF01000X', conCodice.schoolCode);
const senzaCodice = parseInterpello({
  title: 'Interpello supplenza posto comune — scuola senza recapito',
  link: 'https://www.istruzione.piemonte.it/avvisi/interpello-generico.pdf',
  provincia: 'AT',
  source: 'test',
});
check('senza codice → email resta null (nessuna invenzione)', null, senzaCodice.contactEmail);


console.log(errori === 0 ? '\n✅ EMAIL SCUOLA: nessun problema' : `\n❌ EMAIL SCUOLA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
