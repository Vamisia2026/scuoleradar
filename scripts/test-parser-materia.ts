/**
 * TEST PARSER — MATERIA, CONTATTO (email) e FORMATO TELEGRAM
 * ----------------------------------------------------------
 * Verifica i fix:
 *  · inferenza materia/settore per gli avvisi generici "DOCENTE";
 *  · estrazione dell'email di candidatura (mailto: o nel testo);
 *  · SCADENZA reale (mai la pubblicazione) nei post Telegram;
 *  · barra PDF cliccabile per i link PDF.
 *
 * Esecuzione: npm run test:parser:materia
 */

import { estraiEmail, inferisciMateria, parseInterpello } from '../src/scraper/parser.ts';
import { formattaPostCanaleTelegram } from '../src/lib/telegram.ts';

/** Interfaccia minima per l'ambiente (senza dipendere da @types/node). */
declare const process: { exitCode?: number };

let falliti = 0;
function check(descrizione: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) {
    falliti += 1;
    console.log(`  ✗ ${descrizione}`);
    console.log(`      atteso:   ${JSON.stringify(atteso)}`);
    console.log(`      ottenuto: ${JSON.stringify(ottenuto)}`);
  } else {
    console.log(`  ✓ ${descrizione}`);
  }
}

console.log('──────────────────────────────────────────────────────────');
console.log('🧪 TEST PARSER — materia, email, scadenza, PDF');
console.log('──────────────────────────────────────────────────────────');

console.log('\n— Inferenza materia (avvisi generici "DOCENTE") —');
check('Matematica', 'Matematica', inferisciMateria('Avviso per il conferimento di supplenza — DOCENTE di Matematica'));
check('Matematiche (plurale)', 'Matematica', inferisciMateria('Avviso supplenza per le matematiche'));
check('Sostegno', 'Sostegno', inferisciMateria('Interpello DOCENTE di sostegno (ADSS)'));
check('Scienze motorie (non "Scienze" generico)', 'Scienze motorie', inferisciMateria('DOCENTE di scienze motorie'));
check('Scienze umane (non "Scienze" generico)', 'Filosofia / Scienze umane', inferisciMateria('DOCENTE di scienze umane'));
check('Lingue straniere', 'Lingue straniere', inferisciMateria('DOCENTE di inglese'));
check('generico non riconosciuto → null', null, inferisciMateria('Avviso per il conferimento di supplenza — DOCENTE'));

console.log('\n— Email di candidatura —');
check('da testo', 'segreteria@icmilano.edu.it', estraiEmail(null, 'Le domande vanno inviate a segreteria@icmilano.edu.it entro 5 giorni.'));
check('da mailto:', 'prot@scuola.edu.it', estraiEmail('mailto:prot@scuola.edu.it?subject=Interpello', ''));
check('assente → null', null, estraiEmail('https://esempio.it/avviso.pdf', 'Nessun indirizzo indicato.'));

console.log('\n— parseInterpello — materia + email + classi —');
const generico = parseInterpello({
  title: 'Avviso per il conferimento di supplenza — DOCENTE',
  link: 'https://esempio.it/avviso',
  provincia: 'AT',
  source: 'fixture',
  corpo: 'Si ricerca docente di matematica. Domande a prot@scuola.edu.it entro il 20/09/2026.',
});
check('materia inferita', 'Matematica', generico.materia);
check('email candidatura', 'prot@scuola.edu.it', generico.contactEmail);
check('classi vuote', [], generico.classCodes);

const esplicito = parseInterpello({
  title: 'Interpello A-022 Italiano e Latino — Liceo "Augusto Monti" di Asti',
  link: 'https://esempio.it/avviso2',
  provincia: 'AT',
  source: 'fixture',
});
check('classe esplicita → materia null', null, esplicito.materia);
check('classCodes rilevate', ['A-022'], esplicito.classCodes);

console.log('\n— Scadenza nei post Telegram (mai la pubblicazione) —');
const conDate = parseInterpello({
  title: 'Interpello A-026 Matematica — Liceo "Augusto Monti" di Asti',
  link: 'https://esempio.it/avviso3',
  provincia: 'AT',
  source: 'fixture',
  dataPubblicazione: '2026-09-01',
  corpo: 'Pubblicato il 01/09/2026. Termine presentazione domande: 20/09/2026.',
});
check('expirationDate = scadenza reale', '2026-09-20', conDate.expirationDate);
check('publishedAt = pubblicazione', '2026-09-01', conDate.publishedAt);

const postScad = formattaPostCanaleTelegram({
  title: conDate.title,
  province: conDate.province,
  classCodes: conDate.classCodes,
  materia: conDate.materia,
  contactEmail: conDate.contactEmail,
  expirationDate: conDate.expirationDate,
  link: conDate.link,
});
check('il post mostra la scadenza (20 settembre 2026)', true, postScad.includes('20 settembre 2026'));
check('il post NON mostra la pubblicazione come scadenza', false, postScad.includes('01 settembre 2026'));
// Il ruolo è mostrato nel blocco Classe/Materia (il "Docente" generico è soppresso).
check('classe A-026 in Classe/Materia (non "Docente")', true, postScad.includes('Classe/Materia: <b>A-026 - Matematica</b>'));
check('nessun ruolo generico "Docente"', false, postScad.includes('Ruolo / Categoria: <b>Docente</b>'));

console.log('\n— Barra PDF e materia nel post canale —');
const postPdf = formattaPostCanaleTelegram({
  title: 'Avviso per il conferimento di supplenza — DOCENTE',
  province: 'AT',
  materia: 'Matematica',
  contactEmail: 'prot@scuola.edu.it',
  expirationDate: '2026-09-30',
  link: 'https://www.istruzione.piemonte.it/avviso/matematica.pdf',
});
check('email candidature presente', true, postPdf.includes('📧 Candidature:'));
// Sorgente ufficiale = UN solo link, con l'etichetta standard (niente barra "📥 PDF").
check(
  "link ufficiale cliccabile con etichetta standard",
  true,
  postPdf.includes('<a href="https://www.istruzione.piemonte.it/avviso/matematica.pdf"><b>👉 Apri l\'avviso ufficiale</b></a>'),
);
check('scadenza reale 30 settembre 2026', true, postPdf.includes('30 settembre 2026'));

console.log('\n──────────────────────────────────────────────────────────');
if (falliti === 0) {
  console.log('✅ PARSER MATERIA/EMAIL: tutti i controlli superati');
} else {
  console.log(`❌ PARSER MATERIA/EMAIL: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('──────────────────────────────────────────────────────────');
