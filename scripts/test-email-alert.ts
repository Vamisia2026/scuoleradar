/**
 * TEST — EMAIL DELLA SCUOLA IN OGNI ALERT (asset del piano PRO)
 * -----------------------------------------------------------------
 * Verifica la POLITICA di inclusione del recapito di candidatura:
 *   · il recapito è un campo dell'avviso STRUTTURATO (`costruisciAvviso.email`);
 *   · viene popolato anche quando l'unico link è una pagina di RIEPILOGO /
 *     "Stampa" o un elenco tabellare (codice meccanografico nell'URL o in un
 *     link candidato) → PEO ufficiale dalla convenzione MIM;
 *   · è RENDERIZZATO (mailto:) in email e Telegram, con etichetta/icona comuni;
 *   · se MANCA non compare nessuno stato negativo (mai "Email non disponibile").
 *
 * Esecuzione: npm run test:email-alert
 */

import { parseInterpello } from '../src/scraper/parser.ts';
import {
  EMAIL_ETICHETTA,
  EMAIL_ETICHETTA_WEB,
  EMAIL_ICONA,
  classificaFonteLink,
  costruisciAvviso,
  emailAvviso,
  ePaginaRiepilogo,
  etichettaFonteLink,
} from '../src/lib/alertInterpello.ts';
import {
  renderEmailHtml,
  type DettagliNotifica,
  type DestinatarioNotifica,
} from '../src/lib/resend.ts';
import { formattaMessaggioTelegram } from '../src/lib/telegram.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— Riconoscimento pagine di RIEPILOGO / "Stampa" —');
check('pagina di stampa riconosciuta', true, ePaginaRiepilogo('https://www.liceo.edu.it/albo/stampa.php?id=12'));
check('parametro ?stampa=1 riconosciuto', true, ePaginaRiepilogo('https://www.liceo.edu.it/avvisi?stampa=1'));
check('elenco tabellare riconosciuto', true, ePaginaRiepilogo('https://www.usp.it/interpelli/elenco-avvisi'));
check('pagina di avviso NON è riepilogo', false, ePaginaRiepilogo('https://www.usp.it/interpelli/avviso-123'));
check('classifica Fonte = stampa', 'stampa', classificaFonteLink('https://x.edu.it/avvisi?stampa=1'));
check('etichetta ONESTA per il riepilogo', 'Apri la pagina di riepilogo', etichettaFonteLink('https://x.edu.it/avvisi?stampa=1'));
check('PDF resta PDF', 'pdf', classificaFonteLink('https://x.edu.it/bandi/avviso-a022.pdf'));
check("Albo Pretorio resta albo", 'albo', classificaFonteLink('https://x.edu.it/albo-pretorio/atto-1'));

console.log('\n— Normalizzazione del recapito —');
check('trim + minuscolo', 'a.b@istruzione.it', emailAvviso('  A.B@Istruzione.IT '));
check('testo non-email → null', null, emailAvviso('scrivi alla segreteria'));
check('dominio senza punto → null', null, emailAvviso('a@b'));
check('valore vuoto → null', null, emailAvviso(''));

console.log('\n— Parser: pagina di riepilogo con codice meccanografico nell\'URL —');
const conCodice = parseInterpello({
  title: 'Interpello supplenza docenti',
  link: 'https://www.istruzione.piemonte.it/interpelli/stampa?cod=ASTF01000X',
  linkCandidati: ['https://www.istruzione.piemonte.it/interpelli/stampa?cod=ASTF01000X'],
  provincia: 'AT',
  source: 'test',
});
check('codice meccanografico dal riepilogo', 'ASTF01000X', conCodice.schoolCode);
check(
  'PEO ufficiale ricostruita (convenzione MIM) sul riepilogo',
  'astf01000x@istruzione.it',
  conCodice.contactEmail,
);
const avvisoRiepilogo = costruisciAvviso({
  provincia: 'Asti (AT)',
  classCode: 'A-022',
  scadenza: '2026-09-30',
  schoolName: conCodice.schoolName,
  email: conCodice.contactEmail,
  titolo: conCodice.title,
});
check(
  "l'avviso strutturato porta l'email del riepilogo",
  'astf01000x@istruzione.it',
  avvisoRiepilogo.email,
);
check('nessun campo obbligatorio perso', [], avvisoRiepilogo.mancanti);

console.log('\n— Parser: email trovata su un LINK CANDIDATO (fonte = elenco) —');
const conEmailLink = parseInterpello({
  title: 'Interpello supplenza A-022',
  link: 'https://www.usp-asti.gov.it/interpelli/elenco-avvisi',
  linkCandidati: [
    'https://www.liceoaugustomonti.edu.it/interpelli/allegato/protocollo@liceoaugustomonti.edu.it',
  ],
  provincia: 'AT',
  source: 'test',
});
check(
  'email presa dalla pagina collegata',
  'protocollo@liceoaugustomonti.edu.it',
  conEmailLink.contactEmail,
);

console.log('\n— Parser: email nel testo della riga (nessuna regressione) —');
const daTesto = parseInterpello({
  title: 'Interpello A-022 — Liceo Augusto Monti',
  link: 'https://www.usp-asti.gov.it/interpelli/avviso-1',
  provincia: 'AT',
  source: 'test',
  corpo: 'Le candidature vanno inviate a segreteria@liceoaugustomonti.edu.it entro il 30/09/2026',
});
check(
  'email dal testo (come prima)',
  'segreteria@liceoaugustomonti.edu.it',
  daTesto.contactEmail,
);

console.log('\n— Rendering: EMAIL —');
const destinatario: DestinatarioNotifica = {
  email: 'docente@example.it',
  nome: 'Mario',
  province: ['AT'],
  classi: ['A-022'],
};
const dettagli: DettagliNotifica = {
  id: 'test-email-alert',
  title: 'Interpello supplenza A-022 Matematica',
  schoolName: 'Liceo Augusto Monti',
  province: 'Asti',
  classi: ['A-022'],
  materia: 'Matematica',
  scadenza: '2099-09-30',
  link: 'https://www.usp-asti.gov.it/interpelli/stampa?cod=ASTF01000X',
  contactEmail: 'astf01000x@istruzione.it',
};
const html = renderEmailHtml(
  dettagli,
  destinatario,
  'https://www.scuoleradar.it/dashboard',
  'notifica_pro',
);
check('email cliccabile (mailto)', true, html.includes('mailto:astf01000x@istruzione.it'));
check('etichetta email nei messaggi', true, html.includes(`${EMAIL_ICONA} ${EMAIL_ETICHETTA}:`));
// Il bottone di fonte usa l'etichetta STANDARD ("👉 Apri l'avviso ufficiale"),
// identica in tutte le superfici; la pagina di riepilogo resta spiegata dalla
// guida operativa del blocco opportunità.
check("etichetta standard del link di fonte", true, html.includes("👉 Apri l'avviso ufficiale"));
check('guida per la pagina di riepilogo presente', true, /elenco|STAMPA/i.test(html));
check('niente "Email non disponibile"', false, html.includes('Email non disponibile'));

const htmlSenza = renderEmailHtml(
  { ...dettagli, contactEmail: null },
  destinatario,
  'https://www.scuoleradar.it/dashboard',
  'notifica_pro',
);
check('nessun mailto quando il recapito manca', false, htmlSenza.includes('mailto:'));
check('nessun segnaposto quando il recapito manca', false, htmlSenza.includes(EMAIL_ICONA));

console.log('\n— Rendering: TELEGRAM —');
const tg = formattaMessaggioTelegram(
  dettagli,
  'A-022',
  'https://www.scuoleradar.it/dashboard',
  'notifica_pro',
);
check('email cliccabile su Telegram', true, tg.includes('mailto:astf01000x@istruzione.it'));
check('etichetta email su Telegram', true, tg.includes(`${EMAIL_ICONA} ${EMAIL_ETICHETTA}:`));
const tgSenza = formattaMessaggioTelegram(
  { ...dettagli, contactEmail: null },
  'A-022',
  'https://www.scuoleradar.it/dashboard',
  'notifica_pro',
);
check('nessuna riga email su Telegram se assente', false, tgSenza.includes(EMAIL_ICONA));

console.log('\n— Etichette condivise (web vs messaggi) —');
check('etichetta web dedicata', 'Email candidature', EMAIL_ETICHETTA_WEB);
check('etichetta messaggi dedicata', 'Candidature', EMAIL_ETICHETTA);
check('icona condivisa', '📧', EMAIL_ICONA);

console.log(errori === 0 ? '\n✅ EMAIL ALERT: nessun problema' : `\n❌ EMAIL ALERT: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
