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
  punteggioEmailScuola,
} from '../src/scraper/parser.ts';

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
check('nessuna email nella fonte → null', null, estraiEmailScuola(null, 'Nessun contatto indicato.', ctx));

console.log(errori === 0 ? '\n✅ EMAIL SCUOLA: nessun problema' : `\n❌ EMAIL SCUOLA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
