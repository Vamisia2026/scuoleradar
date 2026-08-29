/**
 * TEST GENERAZIONE PDF — Moduli BREVI (Iscrizione + Dichiarazione sostitutiva DPR 445/2000)
 * ----------------------------------------------------------------------------------------
 * Verifica che entrambi i documenti si chiudano su 1 SOLA pagina A4, senza duplicazione
 * del blocco firme, con i riferimenti normativi corretti in calce.
 *
 * Esecuzione:
 *   npm run test:pdf:brevi
 * Poi apri `scripts/out/test-iscrizione.html` e `scripts/out/test-dpr445.html` nel browser
 * e stampa con "Salva come PDF".
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { costruisciDocumento } from '../src/modules/modulistica/creator/pdfGenerator.ts';

/** Riga anagrafica 2 colonne identica al template locale. */
const riga = (etichetta: string): string =>
  `<tr><td class="campo-etichetta">${etichetta}</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>`;

const quadroGenerico = `<h2>Quadro anagrafico del richiedente</h2>
  <table class="quadro-anagrafico">
    ${riga('Cognome e Nome')}
    ${riga('Codice Fiscale')}
    ${riga('Data e luogo di nascita')}
    ${riga('Residenza')}
    ${riga('Contatto (email / telefono)')}
  </table>`;

const quadroIstanza = `<h2>Quadro anagrafico dell&apos;alunno/a</h2>
  <table class="quadro-anagrafico">
    ${riga('Cognome e Nome dell&apos;alunno/a')}
    ${riga('Codice Fiscale')}
    ${riga('Data e luogo di nascita')}
    ${riga('Residenza')}
    ${riga('Classe / Sezione')}
    ${riga('Istituto di appartenenza')}
    ${riga('Genitore / esercente la responsabilità genitoriale')}
  </table>`;

const intestazione = `<table class="intestazione-formale">
  <tr><td class="campo-etichetta">Istituto Scolastico</td><td class="campo-compilazione"><div class="campo-scrittura"></div><div class="campo-scrittura"></div></td></tr>
  <tr><td class="campo-etichetta">Anno Scolastico</td><td class="campo-compilazione">20____ / 20____</td></tr>
  <tr><td class="campo-etichetta">Protocollo n.</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  <tr><td class="campo-etichetta">Data</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
</table>`;

const firme = `<div class="blocco-firme">
  <p class="micro-copy">Da sottoscrivere a cura del richiedente. Allegare eventuale documentazione integrativa.</p>
  <div class="blocco-convalida-unico">
    <div class="chiusura-documento">
      <p class="titolo-chiusura">Luogo e Data</p>
      <p>Luogo e data: <span class="riga-firma"></span></p>
      <p>Firma del richiedente (leggibile): <span class="riga-firma"></span></p>
    </div>
    <div class="protocollo-scuola">
      <p class="titolo-chiusura">Riservato all&apos;Ufficio di Protocollo</p>
      <p>N° Prot. / Data / Timbro: <span class="riga-firma"></span></p>
    </div>
  </div>
</div>`;

const righe = `<div class="righe-scrittura"><div></div><div></div><div></div><div></div></div>`;

const corpoIscrizione = `
  ${intestazione}
  ${quadroGenerico}
  <h2>Oggetto della richiesta (barrare)</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Documentazione anagrafica</p>
    <p class="voce"><span class="casella"></span>Privacy e consensi</p>
    <p class="voce"><span class="casella"></span>Richiesta di servizi</p>
    <p class="voce"><span class="casella"></span>Altra istanza (specificare)</p>
  </div>
  <h2>Oggetto e Motivazione della Richiesta</h2>
  ${righe}
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: L. 241/1990, D.P.R. 275/1999, Circolare ministeriale iscrizioni MIM. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoDpr445 = `
  ${intestazione}
  ${quadroGenerico}
  <h2>Dichiarazione</h2>
  <p class="formula-dichiarazione">Il/La sottoscritto/a, consapevole delle responsabilità e delle sanzioni penali stabilite dall&apos;art. 76 del D.P.R. 445/2000 per le false attestazioni e le dichiarazioni mendaci, dichiara sotto la propria responsabilità:</p>
  ${righe}
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: D.P.R. 28 dicembre 2000, n. 445 (artt. 46 e 47). Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoIstanza = `
  ${intestazione}
  ${quadroIstanza}
  <h2>Oggetto della richiesta</h2>
  <p class="formula-dichiarazione">Richiesta di attivazione delle misure di sostegno scolastico e inclusione ai sensi della L. 104/1992 e D.Lgs. 66/2017.</p>
  <h2>Documenti allegati</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Verbale di accertamento dell&apos;handicap (L. 104/1992)</p>
    <p class="voce"><span class="casella"></span>Profilo di Funzionamento / Diagnosi Funzionale</p>
    <p class="voce"><span class="casella"></span>Copia del documento di riconoscimento del richiedente</p>
  </div>
  ${firme}
  <p class="nota-normativa">Modello conforme al D.Lgs. 66/2017, D.M. 182/2020 e D.I. 153/2023. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoBiblioteca = `
  ${intestazione}
  ${quadroIstanza}
  <h2>Sezione Servizi</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Prestito libri</p>
    <p class="voce"><span class="casella"></span>Progetto lettura</p>
    <p class="voce"><span class="casella"></span>Donazione libri</p>
  </div>
  <h2>Dichiarazione di responsabilità</h2>
  <p class="formula-dichiarazione">Il/La sottoscritto/a dichiara di assumersi la responsabilità della cura dei volumi presi in prestito e di restituirli integri entro i termini concordati.</p>
  <div class="righe-scrittura"><div></div><div></div><div></div></div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: DPR 275/1999, L. 145/2018. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoExtracurricolari = `
  ${intestazione}
  ${quadroIstanza}
  <h2>Selezione Attività</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Laboratorio Teatrale</p>
    <p class="voce"><span class="casella"></span>Attività Sportive / Tornei</p>
    <p class="voce"><span class="casella"></span>Progetto Musicale</p>
  </div>
  <h2>Consensi e requisiti</h2>
  <p class="formula-dichiarazione">Consenso alla partecipazione alle uscite e alle attività programmate; allegare il certificato medico sportivo non agonistico.</p>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Consenso alle uscite / trasferte</p>
    <p class="voce"><span class="casella"></span>Certificato medico sportivo non agonistico allegato</p>
  </div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: D.Lgs. 81/2008, art. 42-bis D.L. 69/2013. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoAssistenzaComune = `
  ${intestazione}
  ${quadroIstanza}
  <h2>Dettaglio del servizio richiesto</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Assistenza all&apos;autonomia e comunicazione</p>
    <p class="voce"><span class="casella"></span>Trasporto scolastico dedicato</p>
    <p class="voce"><span class="casella"></span>Assistenza mensa</p>
  </div>
  <h2>Documenti allegati</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Verbale di accertamento dell&apos;handicap (L. 104/1992)</p>
    <p class="voce"><span class="casella"></span>PEI / CIS</p>
  </div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: L. 104/1992, D.Lgs. 66/2017, D.I. 153/2023. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoUscite = `
  ${intestazione}
  <h2>Quadro anagrafico dell&apos;alunno/a</h2>
  <table class="quadro-anagrafico">
    ${riga('Nome e Cognome')}
    ${riga('Classe / Sezione')}
    ${riga('Genitore / esercente la responsabilità genitoriale')}
  </table>
  <h2>Dettagli dell&apos;uscita</h2>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Meta / destinazione</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Data e orario di partenza / rientro</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Quota di partecipazione</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>
  <h2>Consenso dei genitori</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Consenso alla partecipazione all&apos;uscita didattica</p>
    <p class="voce"><span class="casella"></span>Rinuncia alla partecipazione</p>
  </div>
  <h2>Note allergie / farmaci</h2>
  <div class="righe-scrittura"><div></div><div></div></div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: D.P.R. 249/1998, D.Lgs. 297/1994. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoScrutini = `
  ${intestazione}
  <h2>Consiglio di Classe / Interclasse</h2>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Classe / Sezione</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Coordinatore / Presidente</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Data dello scrutinio</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>
  <h2>Ordine del giorno</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Approvazione voti</p>
    <p class="voce"><span class="casella"></span>Giudizi sintetici</p>
    <p class="voce"><span class="casella"></span>Certificazione delle competenze</p>
  </div>
  <h2>Griglia esiti per disciplina</h2>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Disciplina 1</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Disciplina 2</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Disciplina 3</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Disciplina 4</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>
  <h2>Firme del Consiglio</h2>
  <div class="firme-ruoli">
    <p>Docente Segretario: <span class="riga-firma"></span></p>
    <p>Dirigente Scolastico: <span class="riga-firma"></span></p>
  </div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: D.P.R. 122/2009, D.Lgs. 62/2017. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoMensa = `
  ${intestazione}
  ${quadroIstanza}
  <h2>Tipologia richiesta</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Iscrizione al servizio</p>
    <p class="voce"><span class="casella"></span>Rinuncia al servizio</p>
    <p class="voce"><span class="casella"></span>Dieta speciale etico-religiosa o sanitaria (allegare certificato medico)</p>
  </div>
  <h2>Dati di fatturazione / Comune</h2>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Intestatario / fatturazione</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Comune / Ente gestore</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: D.Lgs. 297/1994, D.M. 62/2022. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoCrediti = `
  ${intestazione}
  <h2>Quadro anagrafico dell&apos;alunno/a</h2>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Nome e Cognome</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Classe / Sezione</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Indirizzo di studio</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>
  <h2>Dettaglio Attività / Credito</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Sportiva</p>
    <p class="voce"><span class="casella"></span>Volontariato</p>
    <p class="voce"><span class="casella"></span>Lingue / Certificazioni</p>
    <p class="voce"><span class="casella"></span>Musica</p>
    <p class="voce"><span class="casella"></span>Altro (specificare)</p>
  </div>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Ente / Associazione erogatore</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Ore complessive svolte</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Periodo di svolgimento</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>
  <h2>Documentazione allegata</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Attestato / Certificazione rilasciato dall&apos;Ente</p>
    <p class="voce"><span class="casella"></span>Relazione sull&apos;attività svolta</p>
  </div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: D.P.R. 122/2009, P.T.O.F. d&apos;Istituto, OM di riferimento per gli esami di Stato. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoPdp = `
  ${intestazione}
  <h2>Quadro anagrafico dell&apos;alunno/a</h2>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Nome e Cognome</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Classe / Sezione</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Referente BES / Coordinatore</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>
  <h2>Tipologia BES / DSA</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>DSA (L. 170/2010 con diagnosi)</p>
    <p class="voce"><span class="casella"></span>BES (svantaggio socio-economico / linguistico / culturale)</p>
    <p class="voce"><span class="casella"></span>Altro</p>
  </div>
  <h2>Misure Compensative &amp; Dispensative</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Tempi aggiuntivi</p>
    <p class="voce"><span class="casella"></span>Uso della calcolatrice</p>
    <p class="voce"><span class="casella"></span>Mappe concettuali</p>
    <p class="voce"><span class="casella"></span>Dispensa dalla lettura ad alta voce</p>
    <p class="voce"><span class="casella"></span>Valutazione personalizzata</p>
  </div>
  <h2>Patto con la Famiglia</h2>
  <div class="firme-ruoli">
    <p>Coordinatore di classe: <span class="riga-firma"></span></p>
    <p>Famiglia / Genitore: <span class="riga-firma"></span></p>
    <p>Dirigente Scolastico: <span class="riga-firma"></span></p>
  </div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: L. 170/2010, Direttiva 27/12/2012. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoRicorso = `
  ${intestazione}
  <h2>Quadro anagrafico del richiedente</h2>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Nome e Cognome</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Qualifica (Genitore / Studente maggiorenne)</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Contatto (telefono / email)</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>
  <h2>Oggetto del Reclamo</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Contestazione valutazione / voto</p>
    <p class="voce"><span class="casella"></span>Anomalia servizio / organizzazione scolastica</p>
    <p class="voce"><span class="casella"></span>Inosservanza del regolamento d&apos;Istituto</p>
    <p class="voce"><span class="casella"></span>Altro</p>
  </div>
  <h2>Descrizione dei fatti e motivazioni</h2>
  <div class="righe-scrittura"><div></div><div></div><div></div><div></div></div>
  <h2>Richiesta</h2>
  <p class="formula-dichiarazione">Si richiede il riesame in autotutela del provvedimento ai sensi della L. 241/1990 e la relativa comunicazione degli esiti.</p>
  <div class="righe-scrittura"><div></div><div></div></div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: L. 241/1990, D.Lgs. 104/2010. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoDelega = `
  ${intestazione}
  <h2>Quadro del genitore delegante</h2>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Nome e Cognome</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Contatto (telefono / email)</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>
  <h2>Tipo di richiesta</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Delega al ritiro dell&apos;alunno da parte di terzi</p>
    <p class="voce"><span class="casella"></span>Autorizzazione all&apos;uscita autonoma (L. 172/2017)</p>
    <p class="voce"><span class="casella"></span>Accesso agli atti</p>
  </div>
  <h2>Dati del delegato</h2>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Nome e Cognome del delegato</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Documento d&apos;identità (tipo e n.)</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>
  <h2>Allegati</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Copia del documento d&apos;identità del delegante</p>
    <p class="voce"><span class="casella"></span>Copia del documento d&apos;identità del delegato</p>
  </div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: L. 172/2017, DPR 445/2000, L. 241/1990. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoIstruzioneParentale = `
  ${intestazione}
  <h2>Quadro anagrafico dell&apos;alunno/a</h2>
  <table class="quadro-anagrafico">
    ${riga('Nome e Cognome')}
    ${riga('Classe / Sezione')}
    ${riga('Genitore / esercente la responsabilità genitoriale')}
  </table>
  <h2>Oggetto</h2>
  <p class="formula-dichiarazione">Comunicazione dell&apos;intenzione di avvalersi dell&apos;istruzione parentale ai sensi del D.Lgs. 62/2017 e del DPR 275/1999 per l&apos;anno scolastico ______.</p>
  <h2>Periodo di riferimento</h2>
  <table class="quadro-anagrafico">
    ${riga('Anno scolastico')}
    ${riga('Inizio / fine del periodo')}
  </table>
  <h2>Dichiarazione dell&apos;esercente la responsabilità genitoriale</h2>
  <p class="formula-dichiarazione">Il/La sottoscritto/a, consapevole delle responsabilità e delle sanzioni penali stabilite dall&apos;art. 76 del D.P.R. 445/2000 per le false attestazioni e le dichiarazioni mendaci, dichiara sotto la propria responsabilità di aver comunicato tempestivamente la scelta alla scuola.</p>
  <div class="righe-scrittura"><div></div><div></div></div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: L. 107/2015, D.Lgs. 62/2017, DPR 275/1999. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoPermesso = `
  ${intestazione}
  <h2>Quadro anagrafico dell&apos;alunno/a</h2>
  <table class="quadro-anagrafico">
    ${riga('Nome e Cognome')}
    ${riga('Classe / Sezione')}
    ${riga('Genitore / esercente la responsabilità genitoriale')}
  </table>
  <h2>Tipologia di permesso</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Entrata posticipata</p>
    <p class="voce"><span class="casella"></span>Uscita anticipata</p>
    <p class="voce"><span class="casella"></span>Assenza breve</p>
  </div>
  <h2>Dettagli orari</h2>
  <table class="quadro-anagrafico">
    ${riga('Data / Giorni')}
    ${riga('Orario ingresso / uscita')}
  </table>
  <h2>Motivazione</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Motivi familiari</p>
    <p class="voce"><span class="casella"></span>Motivi di salute</p>
    <p class="voce"><span class="casella"></span>Trasporti / impegni extrascolastici</p>
    <p class="voce"><span class="casella"></span>Altro (specificare)</p>
  </div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: DPR 249/1998, DPR 275/1999. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoEsonero = `
  ${intestazione}
  <h2>Quadro anagrafico dell&apos;alunno/a</h2>
  <table class="quadro-anagrafico">
    ${riga('Nome e Cognome')}
    ${riga('Classe / Sezione')}
    ${riga('Genitore / esercente la responsabilità genitoriale')}
  </table>
  <h2>Tipologia di esonero</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Esonero totale</p>
    <p class="voce"><span class="casella"></span>Esonero parziale</p>
    <p class="voce"><span class="casella"></span>Esonero temporaneo</p>
  </div>
  <h2>Periodo richiesto</h2>
  <table class="quadro-anagrafico">
    ${riga('Dal')}
    ${riga('Al')}
  </table>
  <h2>Certificato medico</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Certificato del medico di medicina generale allegato</p>
    <p class="voce"><span class="casella"></span>Certificato specialistico allegato</p>
  </div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: D.M. 9/1990, D.Lgs. 62/2017. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoAccessoAtti = `
  ${intestazione}
  <h2>Quadro anagrafico del richiedente</h2>
  <table class="quadro-anagrafico">
    ${riga('Nome e Cognome')}
    ${riga('Qualifica (Genitore / Studente maggiorenne)')}
    ${riga('Contatto (telefono / email)')}
  </table>
  <h2>Documenti richiesti</h2>
  <div class="righe-scrittura"><div></div><div></div></div>
  <h2>Modalità di accesso</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Visione degli atti</p>
    <p class="voce"><span class="casella"></span>Copia semplice</p>
    <p class="voce"><span class="casella"></span>Copia autentica</p>
  </div>
  <h2>Motivazione</h2>
  <p class="formula-dichiarazione">Richiesta di accesso ai documenti amministrativi ai sensi dell&apos;art. 22 della L. 241/1990 e del D.Lgs. 104/2010, al fine di tutelare la propria posizione giuridica soggettiva.</p>
  <div class="righe-scrittura"><div></div></div>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: L. 241/1990, D.Lgs. 104/2010. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const corpoConsensoFoto = `
  ${intestazione}
  <h2>Quadro anagrafico dell&apos;alunno/a</h2>
  <table class="quadro-anagrafico">
    ${riga('Nome e Cognome')}
    ${riga('Classe / Sezione')}
    ${riga('Genitore / esercente la responsabilità genitoriale')}
  </table>
  <h2>Consenso</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Consenso al trattamento e alla pubblicazione di immagini / riprese video</p>
    <p class="voce"><span class="casella"></span>Nessun consenso alla pubblicazione</p>
  </div>
  <h2>Finalità e ambiti di utilizzo</h2>
  <div class="crocette">
    <p class="voce"><span class="casella"></span>Sito web della scuola</p>
    <p class="voce"><span class="casella"></span>Pagine social dell&apos;Istituto</p>
    <p class="voce"><span class="casella"></span>Giornalino / materiali informativi</p>
    <p class="voce"><span class="casella"></span>Eventi e manifestazioni scolastiche</p>
  </div>
  <h2>Revoca</h2>
  <p class="formula-dichiarazione">Il consenso può essere revocato in ogni momento con comunicazione scritta alla scuola; i dati saranno trattati ai sensi del Reg. UE 2016/679 (GDPR).</p>
  ${firme}
  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito. Riferimenti normativi: Reg. UE 2016/679 (GDPR), D.Lgs. 196/2003. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const casi = [
  { nome: 'Domanda di iscrizione', corpo: corpoIscrizione, file: 'test-iscrizione.html' },
  { nome: 'Dichiarazione sostitutiva (DPR 445/2000)', corpo: corpoDpr445, file: 'test-dpr445.html' },
  { nome: 'Richiesta di certificazione ai sensi della L. 104/1992', corpo: corpoIstanza, file: 'test-l104.html' },
  { nome: 'Modulo di richiesta di sostegno scolastico', corpo: corpoIstanza, file: 'test-sostegno.html' },
  { nome: 'Modulo di Adesione / Prestito Biblioteca Scolastica', corpo: corpoBiblioteca, file: 'test-biblioteca.html' },
  { nome: 'Autorizzazione e Adesione Attività Extracurricolari (Sport / Teatro / Musica)', corpo: corpoExtracurricolari, file: 'test-extracurricolari.html' },
  { nome: 'Richiesta di Assistenza Specialistica e Autonomia (Ente Locale)', corpo: corpoAssistenzaComune, file: 'test-assistenza-comune.html' },
  { nome: 'Autorizzazione e Consenso Informato Uscita Didattica / Viaggio di Istruzione', corpo: corpoUscite, file: 'test-uscite.html' },
  { nome: 'Verbale / Scheda di Valutazione Periodica e Scrutini', corpo: corpoScrutini, file: 'test-scrutini.html' },
  { nome: 'Modulo di Richiesta / Modifica Servizio Ristorazione Scolastica', corpo: corpoMensa, file: 'test-mensa.html' },
  { nome: 'Richiesta di Riconoscimento Crediti Formativi — Scuola Secondaria di II Grado', corpo: corpoCrediti, file: 'test-crediti.html' },
  { nome: 'Modulo di Reclamo / Ricorso Amministrativo', corpo: corpoRicorso, file: 'test-ricorso.html' },
  { nome: 'Delega Ritiro Alunno / Autorizzazione Uscita Autonoma', corpo: corpoDelega, file: 'test-delega.html' },
  { nome: 'Comunicazione di Istruzione Parentale', corpo: corpoIstruzioneParentale, file: 'test-istruzione-parentale.html' },
  { nome: 'Richiesta Permesso Orario / Uscita Anticipata', corpo: corpoPermesso, file: 'test-permesso-orario.html' },
  { nome: 'Richiesta Esonero Scienze Motorie', corpo: corpoEsonero, file: 'test-esonero-motoria.html' },
  { nome: 'Richiesta di Accesso agli Atti (L. 241/1990)', corpo: corpoAccessoAtti, file: 'test-accesso-atti.html' },
  { nome: 'Consenso Trattamento Immagini e Riprese Video', corpo: corpoConsensoFoto, file: 'test-consenso-foto.html' },
];

const outDir = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(outDir, { recursive: true });

for (const caso of casi) {
  const doc = costruisciDocumento(caso.nome, caso.corpo);
  const outFile = `${outDir}${caso.file}`;
  writeFileSync(outFile, doc.html, 'utf8');
  console.log('──────────────────────────────────────────────');
  console.log(`📄 ${caso.nome}`);
  console.log(`   Output: ${outFile}`);
  console.log(`   Pagine stimate: ${doc.pagineStimate}`);
  console.log(`   Layout dinamico: ${doc.layout} (${doc.layout === 'compatto' ? '1 pagina A4' : '2 pagine A4'})`);
}
console.log('──────────────────────────────────────────────');
console.log('   Da verificare: 1 SOLA pagina, nessun doppio blocco firma,');
console.log('   riferimenti normativi corretti in calce.');
console.log('──────────────────────────────────────────────');
