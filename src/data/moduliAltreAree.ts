/**
 * ScuoleRadar.it — Modulistica: alberi "Sostegno", "Università" e "Comunicazione Interna".
 *
 * Struttura REALE a 3 livelli (Macroarea > Categoria > Sottocategoria > Moduli):
 * ogni sottocategoria raccoglie i moduli correlati della stessa pratica, con un
 * `profilo.tipo` che seleziona il template specifico del documento.
 * Gli `id` dei documenti esistenti sono PRESERVATI (nessuna rottura di cache/salvati).
 */
import type { MacroAreaModulistica } from './moduli';

/** Macroarea "Sostegno": inclusione, PEI, PDP, gruppi di lavoro e servizi. */
export const macroAreaSostegno: MacroAreaModulistica = {
  id: 'sostegno',
  nome: 'Sostegno',
  descrizione: "Inclusione, PEI, PDP, gruppi di lavoro e servizi di supporto all'alunno/a.",
  sotto: [
    {
      id: 'richieste-sostegno',
      nome: 'Richieste e Attivazione del Sostegno',
      descrizione: 'Domande, accertamenti e variazioni delle ore di sostegno.',
      sotto: [
        {
          id: 'domande-ordine',
          nome: 'Domande di Sostegno per Ordine di Scuola',
          descrizione: 'Richiesta di sostegno declinata per ordine e grado.',
          documenti: [
            { id: 'richiesta-sostegno-infanzia', nome: "Richiesta di sostegno – Scuola dell\u2019Infanzia", descrizione: 'Domanda di attivazione del sostegno per la scuola dell\u2019infanzia.', tipo: 'PDF', profilo: { tipo: 'sostegno', ordine: 'infanzia' } },
            { id: 'richiesta-sostegno-primaria', nome: 'Richiesta di sostegno – Scuola Primaria', descrizione: 'Domanda di attivazione del sostegno per la scuola primaria.', tipo: 'PDF', profilo: { tipo: 'sostegno', ordine: 'primaria' } },
            { id: 'richiesta-sostegno-secondaria1', nome: 'Richiesta di sostegno – Secondaria di I grado', descrizione: 'Domanda di attivazione del sostegno per la secondaria di I grado.', tipo: 'PDF', profilo: { tipo: 'sostegno', ordine: 'secondaria1' } },
            { id: 'richiesta-sostegno-secondaria2', nome: 'Richiesta di sostegno – Secondaria di II grado', descrizione: 'Domanda di attivazione del sostegno per la secondaria di II grado.', tipo: 'PDF', profilo: { tipo: 'sostegno', ordine: 'secondaria2' } },
          ],
        },
        {
          id: 'accertamento-avvio',
          nome: 'Accertamento e Avvio',
          descrizione: 'Segnalazioni, accertamento e richiesta delle ore.',
          documenti: [
            { id: 'richiesta-sostegno-npia', nome: 'Richiesta di accertamento – destinatario NPIA/ASL', descrizione: 'Richiesta di accertamento ai fini dell\u2019attivazione del sostegno.', tipo: 'PDF', profilo: { tipo: 'sostegno', destinatario: 'npia_asl' } },
            { id: 'segnalazione-asl-sostegno', nome: 'Segnalazione ASL per accertamento', descrizione: 'Segnalazione all\u2019ASL per l\u2019accertamento della disabilit\u00e0 e delle necessit\u00e0 di sostegno.', tipo: 'PDF', profilo: { tipo: 'sostegno', destinatario: 'npia_asl' } },
            { id: 'richiesta-ore-sostegno', nome: 'Richiesta ore di sostegno / assistenza specialistica', descrizione: 'Richiesta delle ore di sostegno e dell\u2019assistenza specialistica necessarie.', tipo: 'PDF', profilo: { tipo: 'sostegno' } },
          ],
        },
        {
          id: 'variazioni-ore',
          nome: 'Variazioni e Revisione delle Ore',
          descrizione: 'Inserimento, variazione e revisione delle ore assegnate.',
          documenti: [
            { id: 'richiesta-variazione-ore-sostegno', nome: 'Richiesta inserimento / variazione ore di sostegno', descrizione: 'Richiesta di inserimento o variazione delle ore di sostegno.', tipo: 'PDF', profilo: { tipo: 'sostegno' } },
            { id: 'istanza-revisione-ore', nome: 'Istanza di revisione ore di sostegno', descrizione: 'Istanza di revisione della dotazione oraria di sostegno.', tipo: 'PDF', profilo: { tipo: 'sostegno' } },
          ],
        },
      ],
    },
    {
      id: 'pei-inclusione',
      nome: "PEI e Documentazione dell'Inclusione",
      descrizione: 'Modelli nazionali, compilazione e verbali di verifica del PEI.',
      sotto: [
        {
          id: 'modelli-nazionali-pei',
          nome: 'Modelli Nazionali (D.I. 182/2020)',
          descrizione: 'Modelli e schede di sintesi previsti dalla normativa vigente.',
          documenti: [
            { id: 'pei-nazionale-dotazione', nome: 'Modello nazionale PEI – dotazione tipo', descrizione: 'Modello nazionale PEI con dotazione tipo (D.I. 182/2020).', tipo: 'PDF', profilo: { tipo: 'pei' } },
            { id: 'pei-nazionale-calendario', nome: 'Calendario delle verifiche PEI', descrizione: 'Calendario degli incontri di verifica del PEI nell\u2019anno scolastico.', tipo: 'PDF', profilo: { tipo: 'pei' } },
            { id: 'scheda-sintesi-pei', nome: 'Scheda di sintesi PEI (D.I. 182/2020)', descrizione: 'Scheda di sintesi del PEI prevista dal D.I. 182/2020.', tipo: 'PDF', profilo: { tipo: 'pei' } },
          ],
        },
        {
          id: 'compilazione-pei',
          nome: 'Compilazione e Proposta PEI',
          descrizione: 'Proposta, osservazioni e richiesta di compilazione del PEI.',
          documenti: [
            { id: 'proposta-pei', nome: 'Proposta PEI compilabile', descrizione: 'Proposta di PEI pronta da compilare a cura del consiglio di classe.', tipo: 'PDF', profilo: { tipo: 'pei' } },
            { id: 'pei-osservazioni', nome: 'Modello PEI – sezione osservazioni', descrizione: 'Sezione osservazioni del PEI per la descrizione del funzionamento.', tipo: 'PDF', profilo: { tipo: 'pei' } },
            { id: 'richiesta-compilazione-pei', nome: 'Richiesta compilazione PEI', descrizione: 'Richiesta di avvio della compilazione del PEI.', tipo: 'PDF', profilo: { tipo: 'pei' } },
          ],
        },
        {
          id: 'verbali-verifiche-pei',
          nome: 'Verbali e Verifiche',
          descrizione: 'Verbali di accoglienza, verifica intermedia e relazione finale.',
          documenti: [
            { id: 'verbale-glho', nome: 'Verbale di accoglienza / GLHO', descrizione: 'Verbale dell\u2019incontro di accoglienza / GLHO.', tipo: 'PDF', profilo: { tipo: 'verbale_glo' } },
            { id: 'verifica-intermedia-sostegno', nome: 'Verbale di verifica intermedia PEI', descrizione: 'Verbale della verifica intermedia del PEI.', tipo: 'PDF', profilo: { tipo: 'pei' } },
            { id: 'relazione-finale-pei-pdp', nome: 'Relazione finale PEI / PDP', descrizione: 'Relazione finale sulle attività di sostegno e sugli esiti del PEI/PDP.', tipo: 'PDF', profilo: { tipo: 'relazione_finale' } },
          ],
        },
      ],
    },
    {
      id: 'gruppi-pdp-bes',
      nome: 'Gruppi di Lavoro e PDP/BES',
      descrizione: 'Convocazioni e verbali GLO, PDP DSA e misure per i BES.',
      sotto: [
        {
          id: 'glo',
          nome: 'Convocazioni e Verbali GLO',
          descrizione: 'Documenti dei gruppi di lavoro operativi GLO / GLHO / GLI.',
          documenti: [
            { id: 'convocazione-glo', nome: 'Convocazione GLO / GLHO / GLI', descrizione: 'Convocazione dei componenti del gruppo di lavoro.', tipo: 'PDF', profilo: { tipo: 'convocazione_glo' } },
            { id: 'verbale-insediamento-glo', nome: 'Verbale insediamento GLO', descrizione: 'Verbale della riunione di insediamento del GLO.', tipo: 'PDF', profilo: { tipo: 'verbale_glo' } },
            { id: 'verbale-verifica-intermedia-glo', nome: 'Verbale verifica intermedia GLO', descrizione: 'Verbale della verifica intermedia del GLO.', tipo: 'PDF', profilo: { tipo: 'verbale_glo' } },
            { id: 'verbale-finale-glo', nome: 'Verbale finale GLO', descrizione: 'Verbale finale del GLO con la valutazione degli esiti.', tipo: 'PDF', profilo: { tipo: 'verbale_glo' } },
            { id: 'verbale-glo-riunione', nome: 'Verbale riunione GLO', descrizione: 'Verbale di una riunione del GLO.', tipo: 'PDF', profilo: { tipo: 'verbale_glo' } },
          ],
        },
        {
          id: 'pdp-bes',
          nome: 'PDP DSA e BES',
          descrizione: 'Piani didattici personalizzati e misure compensative/dispensative.',
          documenti: [
            { id: 'pdp-dsa', nome: 'Piano Didattico Personalizzato DSA (L. 170/2010)', descrizione: 'PDP per alunni con disturbi specifici di apprendimento.', tipo: 'PDF', profilo: { tipo: 'pdp_dsa' } },
            { id: 'pdp-bes-non-certificati', nome: 'PDP BES non certificati', descrizione: 'PDP per bisogni educativi speciali non certificati.', tipo: 'PDF', profilo: { tipo: 'pdp_bes' } },
            { id: 'misure-compensative', nome: 'Misure compensative e dispensative', descrizione: 'Prospetto delle misure compensative e dispensative adottate.', tipo: 'PDF', profilo: { tipo: 'pdp_bes' } },
          ],
        },
      ],
    },
    {
      id: 'certificazioni-figure-servizi',
      nome: 'Certificazioni, Figure e Servizi',
      descrizione: 'Certificazioni sanitarie, figure di supporto, trasporto e tecnologie.',
      sotto: [
        {
          id: 'certificazioni-npia',
          nome: 'Certificazioni e NPIA/ASL',
          descrizione: 'Certificazioni, autodichiarazioni ed esoneri per motivi di salute.',
          documenti: [
            { id: 'richiesta-certificazione', nome: 'Richiesta certificazione alla NPIA/ASL', descrizione: 'Richiesta di certificazione ai fini dell\u2019inclusione scolastica.', tipo: 'PDF', profilo: { tipo: 'certificazione', destinatario: 'npia_asl' } },
            { id: 'autodichiarazione-104', nome: 'Autodichiarazione condizioni di salute (L. 104/92)', descrizione: 'Autodichiarazione delle condizioni di salute ai sensi della L. 104/1992.', tipo: 'PDF', profilo: { tipo: 'certificazione' } },
            { id: 'esonero-attivita-sostegno', nome: 'Richiesta esonero attività per motivi di salute', descrizione: 'Richiesta di esonero dalle attività didattiche per motivi di salute.', tipo: 'PDF', profilo: { tipo: 'certificazione' } },
          ],
        },
        {
          id: 'assistenza-figure',
          nome: "Assistenza all'Autonomia e Figure di Supporto",
          descrizione: 'Assistente all\u2019autonomia, educatore e assistente alla comunicazione.',
          documenti: [
            { id: 'richiesta-assistente-autonomia', nome: "Richiesta Assistente all\u2019Autonomia – Comune", descrizione: 'Richiesta all\u2019Ente locale dell\u2019assistente all\u2019autonomia e alla comunicazione.', tipo: 'PDF', profilo: { tipo: 'sostegno', destinatario: 'comune' } },
            { id: 'patto-autonomia', nome: "Patto di corresponsabilità – Assistente all\u2019Autonomia", descrizione: 'Patto di corresponsabilità per il servizio di assistenza all\u2019autonomia.', tipo: 'PDF', profilo: { tipo: 'sostegno', destinatario: 'comune' } },
            { id: 'richiesta-assistenza-specialistica', nome: 'Richiesta assistenza specialistica', descrizione: 'Richiesta del servizio di assistenza specialistica.', tipo: 'PDF', profilo: { tipo: 'assistenza_comune' } },
            { id: 'richiesta-educatore', nome: 'Richiesta educatore scolastico', descrizione: 'Richiesta di un educatore scolastico per il supporto all\u2019alunno/a.', tipo: 'PDF', profilo: { tipo: 'sostegno' } },
            { id: 'richiesta-assistente-comunicazione', nome: 'Richiesta assistente alla comunicazione', descrizione: 'Richiesta di un assistente alla comunicazione.', tipo: 'PDF', profilo: { tipo: 'sostegno' } },
          ],
        },
        {
          id: 'trasporto-uscite',
          nome: 'Trasporto e Uscite Inclusive',
          descrizione: 'Trasporto scolastico assistito e progetti di uscita inclusivi.',
          documenti: [
            { id: 'richiesta-trasporto-disabili', nome: 'Richiesta trasporto alunno disabile', descrizione: 'Richiesta del servizio di trasporto per alunni con disabilit\u00e0.', tipo: 'PDF', profilo: { tipo: 'sostegno', destinatario: 'comune' } },
            { id: 'trasporto-protetto', nome: 'Richiesta trasporto scolastico protetto', descrizione: 'Richiesta di trasporto scolastico protetto/assistito.', tipo: 'PDF', profilo: { tipo: 'trasporto_protetto' } },
            { id: 'progetto-gita-inclusiva', nome: 'Progetto gita inclusiva', descrizione: 'Progetto di uscita/gita inclusiva con le necessarie tutele.', tipo: 'PDF', profilo: { tipo: 'sostegno' } },
          ],
        },
        {
          id: 'tecnologie-progetti',
          nome: 'Tecnologie, Progetti e Autismo',
          descrizione: 'Ausili, laboratori inclusivi e segnalazioni specifiche.',
          documenti: [
            { id: 'richiesta-ausili', nome: 'Richiesta ausili e tecnologie assistive', descrizione: 'Richiesta di ausili e tecnologie assistive per l\u2019inclusione.', tipo: 'PDF', profilo: { tipo: 'sostegno' } },
            { id: 'proposta-laboratorio-inclusivo', nome: 'Proposta laboratorio inclusivo', descrizione: 'Proposta di un laboratorio inclusivo.', tipo: 'PDF', profilo: { tipo: 'sostegno' } },
            { id: 'modello-autismo', nome: 'Modello segnalazione disturbo dello spettro autistico', descrizione: 'Segnalazione relativa a un disturbo dello spettro autistico.', tipo: 'PDF', profilo: { tipo: 'sostegno', destinatario: 'npia_asl' } },
          ],
        },
      ],
    },
    {
      id: 'incarichi-normativa',
      nome: 'Incarichi Professionali e Tutele',
      descrizione: 'Incarichi, graduatorie, ricorsi e riferimenti normativi.',
      sotto: [
        {
          id: 'incarichi-graduatorie',
          nome: 'Incarichi e Graduatorie',
          descrizione: 'Disponibilità, graduatorie e specializzazione sul sostegno.',
          documenti: [
            { id: 'sostegno-disponibilita', nome: 'Domanda disponibilità incarico sostegno (ADEE/ADSS)', descrizione: 'Disponibilità a incarichi di sostegno nelle classi ADEE/ADSS.', tipo: 'PDF', catalogoId: 'sostegno-disponibilita', profilo: { tipo: 'sostegno', scopo_sostegno: 'incarico' } },
            { id: 'domanda-graduatoria-sostegno', nome: 'Domanda inserimento in graduatoria', descrizione: 'Domanda di inserimento nella graduatoria per il sostegno.', tipo: 'PDF', profilo: { tipo: 'sostegno' } },
            { id: 'specializzazione-sostegno', nome: 'Domanda di specializzazione sul sostegno', descrizione: 'Domanda di partecipazione ai corsi di specializzazione sul sostegno (TFA).', tipo: 'PDF', profilo: { tipo: 'sostegno' } },
          ],
        },
        {
          id: 'ricorsi-accordi',
          nome: 'Ricorsi e Accordi con Enti',
          descrizione: 'Tutela avverso i dinieghi e accordi con associazioni.',
          documenti: [
            { id: 'ricorso-sostegno', nome: 'Ricorso avverso diniego di sostegno', descrizione: 'Ricorso avverso il diniego di attivazione del sostegno.', tipo: 'PDF', profilo: { tipo: 'ricorso_reclamo' } },
            { id: 'convenzione-associazione', nome: 'Richiesta convenzione con associazione', descrizione: 'Richiesta di convenzione con un\u2019associazione per progetti inclusivi.', tipo: 'PDF', profilo: { tipo: 'convenzione_pcto' } },
          ],
        },
        {
          id: 'normativa-riferimenti',
          nome: 'Normativa e Riferimenti',
          descrizione: "Sintesi dei riferimenti normativi sull'inclusione.",
          documenti: [
            { id: 'sintesi-normativa-inclusione', nome: 'Sintesi normativa inclusione (L. 104/92, D.Lgs. 66/2017)', descrizione: 'Sintesi dei riferimenti normativi su inclusione e sostegno.', tipo: 'PDF', profilo: { tipo: 'sostegno', scopo_sostegno: 'richiesta' } },
          ],
        },
      ],
    },
  ],
};

/** Macroarea "Università": immatricolazione, tasse, borse, servizi e laurea. */
export const macroAreaUniversita: MacroAreaModulistica = {
  id: 'universita',
  nome: 'Università',
  descrizione: 'Immatricolazione, carriere, tasse, borse di studio e servizi agli studenti.',
  sotto: [
    {
      id: 'immatricolazione-carriera',
      nome: 'Immatricolazione e Carriera',
      descrizione: 'Iscrizioni, piani di studio, passaggi e trasferimenti.',
      sotto: [
        {
          id: 'iscrizioni',
          nome: 'Immatricolazione e Iscrizioni',
          descrizione: 'Immatricolazione, corsi singoli e iscrizione a tempo parziale.',
          documenti: [
            { id: 'immatricolazione', nome: 'Domanda di immatricolazione', descrizione: 'Domanda di immatricolazione a un corso di laurea.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
            { id: 'iscrizione-corsi-singoli', nome: 'Iscrizione a corsi singoli / secondo titolo', descrizione: 'Iscrizione a corsi singoli o per il conseguimento di un secondo titolo.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
            { id: 'iscrizione-part-time', nome: 'Richiesta iscrizione a tempo parziale', descrizione: 'Richiesta di iscrizione a tempo parziale.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
          ],
        },
        {
          id: 'piani-studio',
          nome: 'Piani di Studio',
          descrizione: 'Compilazione e approvazione del piano di studi.',
          documenti: [
            { id: 'richiesta-piano-studi', nome: 'Richiesta compilazione piano di studi', descrizione: 'Richiesta di compilazione del piano di studi.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
            { id: 'approvazione-piano-studi', nome: 'Richiesta approvazione piano di studi', descrizione: 'Richiesta di approvazione del piano di studi.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
          ],
        },
        {
          id: 'passaggi-trasferimenti',
          nome: 'Passaggi e Trasferimenti',
          descrizione: 'Passaggio di corso, abbreviazione e trasferimento di sede.',
          documenti: [
            { id: 'domanda-passaggio-corso', nome: 'Domanda di passaggio di corso di laurea', descrizione: 'Domanda di passaggio a un altro corso di laurea.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
            { id: 'domanda-abbreviazione-corso', nome: 'Domanda di abbreviazione di corso', descrizione: 'Domanda di abbreviazione di corso per riconoscimento crediti.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
            { id: 'domanda-trasferimento-sede', nome: 'Domanda di trasferimento di sede', descrizione: 'Domanda di trasferimento presso un\u2019altra sede universitaria.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
            { id: 'trasferimento-uscita', nome: 'Richiesta trasferimento in entrata / uscita', descrizione: 'Richiesta di trasferimento in entrata o in uscita.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
          ],
        },
      ],
    },
    {
      id: 'tasse-esoneri',
      nome: 'Tasse, Esoneri e Agevolazioni',
      descrizione: 'Esenzioni, rateizzazioni, ISEE e riduzione del contributo unico.',
      sotto: [
        {
          id: 'tasse-esenzioni',
          nome: 'Tasse ed Esenzioni',
          descrizione: 'Esenzione, rateizzazione ed esonero per merito.',
          documenti: [
            { id: 'richiesta-esenzione-tasse', nome: 'Richiesta esenzione tasse universitarie', descrizione: 'Richiesta di esenzione dalle tasse universitarie.', tipo: 'PDF', profilo: { tipo: 'esenzione_tasse' } },
            { id: 'richiesta-rateizzazione', nome: 'Richiesta rateizzazione tasse universitarie', descrizione: 'Richiesta di rateizzazione delle tasse universitarie.', tipo: 'PDF', profilo: { tipo: 'esenzione_tasse' } },
            { id: 'esonero-tasse-merito', nome: 'Richiesta esonero tasse per merito', descrizione: 'Richiesta di esonero dalle tasse per merito.', tipo: 'PDF', profilo: { tipo: 'esenzione_tasse' } },
          ],
        },
        {
          id: 'isee-contributi',
          nome: 'ISEE e Contributo Unico',
          descrizione: 'Dichiarazione ISEE e riduzione/ricalcolo del contributo.',
          documenti: [
            { id: 'dichiarazione-isee-universita', nome: 'Dichiarazione ISEE Università', descrizione: 'Dichiarazione del valore ISEE per l\u2019Università.', tipo: 'PDF', profilo: { tipo: 'isee_universita' } },
            { id: 'richiesta-riduzione-contributo', nome: 'Richiesta ricalcolo / riduzione contributo unico', descrizione: 'Richiesta di ricalcolo o riduzione del contributo unico.', tipo: 'PDF', profilo: { tipo: 'riduzione_contributi' } },
          ],
        },
      ],
    },
    {
      id: 'borse-sostegni',
      nome: 'Borse di Studio e Sostegni Economici',
      descrizione: 'Borse regionali, sussidi straordinari e collaborazioni studentesche.',
      sotto: [
        {
          id: 'borse-regionali',
          nome: 'Borse di Studio Regionali',
          descrizione: 'Domanda e ricorso sulle borse di studio (EDISU/ALISEO/DSU).',
          documenti: [
            { id: 'richiesta-borsa-studio', nome: 'Domanda borsa di studio regionale', descrizione: 'Domanda di borsa di studio regionale (EDISU/ALISEO/DSU).', tipo: 'PDF', profilo: { tipo: 'borsa_studio' } },
            { id: 'ricorso-graduatoria-borse', nome: 'Richiesta riesame / ricorso graduatoria provvisoria', descrizione: 'Richiesta di riesame o ricorso avverso la graduatoria provvisoria.', tipo: 'PDF', profilo: { tipo: 'ricorso_borsa' } },
          ],
        },
        {
          id: 'sussidi-collaborazioni',
          nome: 'Sussidi e Collaborazioni',
          descrizione: 'Contributi straordinari, Erasmus e collaborazioni a 200 ore.',
          documenti: [
            { id: 'contributo-straordinario', nome: 'Richiesta contributo straordinario per disagio economico', descrizione: 'Richiesta di un contributo straordinario per disagio economico.', tipo: 'PDF', profilo: { tipo: 'contributo_straordinario' } },
            { id: 'integrativo-erasmus', nome: 'Integrativo borsa Erasmus', descrizione: 'Richiesta di integrazione della borsa Erasmus.', tipo: 'PDF', profilo: { tipo: 'integrativo_erasmus' } },
            { id: 'domanda-collaborazioni', nome: 'Domanda 200 ore / tutorato retribuito', descrizione: 'Domanda di collaborazione studentesca (200 ore / tutorato).', tipo: 'PDF', profilo: { tipo: 'collaborazioni_studentesche' } },
          ],
        },
      ],
    },
    {
      id: 'servizi-studenti',
      nome: 'Servizi agli Studenti',
      descrizione: 'Alloggi, biblioteche, tirocini, mobilità e inclusione.',
      sotto: [
        {
          id: 'alloggi-biblioteche',
          nome: 'Alloggi e Biblioteche',
          descrizione: 'Residenze universitarie e servizi bibliotecari.',
          documenti: [
            { id: 'richiesta-alloggio', nome: 'Richiesta alloggio in residenza universitaria', descrizione: 'Richiesta di alloggio in una residenza universitaria.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
            { id: 'richiesta-prestito', nome: 'Richiesta prestito bibliotecario', descrizione: 'Richiesta di prestito bibliotecario.', tipo: 'PDF', profilo: { tipo: 'biblioteca' } },
          ],
        },
        {
          id: 'tirocini-mobilita',
          nome: 'Tirocini e Mobilità',
          descrizione: 'Attivazione tirocini e candidature Erasmus+.',
          documenti: [
            { id: 'richiesta-tirocinio', nome: 'Richiesta attivazione tirocinio', descrizione: 'Richiesta di attivazione di un tirocinio curriculare.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
            { id: 'candidatura-erasmus', nome: 'Candidatura Erasmus+', descrizione: 'Candidatura al programma Erasmus+.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
          ],
        },
        {
          id: 'inclusione-volontariato',
          nome: 'Inclusione e Volontariato',
          descrizione: 'Misure di sostegno e servizio civile universale.',
          documenti: [
            { id: 'richiesta-sostegno-universita', nome: 'Richiesta misure di sostegno – Università', descrizione: 'Richiesta di misure di sostegno e inclusione in ambito universitario.', tipo: 'PDF', profilo: { tipo: 'sostegno', ordine: 'universita' } },
            { id: 'candidatura-servizio-civile', nome: 'Candidatura servizio civile universale', descrizione: 'Candidatura al servizio civile universale.', tipo: 'PDF', profilo: { tipo: 'iscrizione', ordine: 'universita' } },
          ],
        },
      ],
    },
    {
      id: 'laurea-titoli',
      nome: 'Laurea, Titoli e Carriera',
      descrizione: 'Prova finale, certificati di carriera e riconoscimento titoli.',
      sotto: [
        {
          id: 'laurea-prova-finale',
          nome: 'Laurea e Prova Finale',
          descrizione: 'Domanda di laurea, proclamazione e assegnazione tesi.',
          documenti: [
            { id: 'domanda-laurea', nome: 'Domanda di laurea', descrizione: 'Domanda di ammissione alla prova finale di laurea.', tipo: 'PDF', profilo: { tipo: 'laurea' } },
            { id: 'richiesta-proclamazione', nome: 'Richiesta proclamazione / prova finale', descrizione: 'Richiesta relativa alla proclamazione e alla prova finale.', tipo: 'PDF', profilo: { tipo: 'laurea' } },
            { id: 'richiesta-tesi', nome: 'Richiesta assegnazione tesi e relatore', descrizione: 'Richiesta di assegnazione di tesi e relatore.', tipo: 'PDF', profilo: { tipo: 'laurea' } },
          ],
        },
        {
          id: 'certificati-riconoscimenti',
          nome: 'Certificati e Riconoscimenti',
          descrizione: 'Certificati di carriera, titoli esteri e autocertificazioni.',
          documenti: [
            { id: 'richiesta-certificato-carriera', nome: 'Richiesta certificato di carriera', descrizione: 'Richiesta del certificato di carriera universitario.', tipo: 'PDF', profilo: { tipo: 'istanza_enti', ordine: 'universita' } },
            { id: 'riconoscimento-titolo-estero', nome: 'Richiesta riconoscimento titolo estero', descrizione: 'Richiesta di riconoscimento di un titolo di studio estero.', tipo: 'PDF', profilo: { tipo: 'istanza_enti', ordine: 'universita' } },
            { id: 'autocertificazione-titoli', nome: 'Autocertificazione titoli di studio', descrizione: 'Autocertificazione dei titoli di studio posseduti.', tipo: 'PDF', catalogoId: 'autocertificazione-titoli', profilo: { tipo: 'autocertificazione', ordine: 'universita' } },
          ],
        },
      ],
    },
  ],
};

/** Macroarea "Comunicazione Interna": moduli organizzativi per il personale. */
export const macroAreaComunicazioneInterna: MacroAreaModulistica = {
  id: 'comunicazione-interna',
  nome: 'Comunicazione Interna',
  icona: 'MessageSquare',
  descrizione: 'Moduli interni di servizio: turni, permessi, circolari, verbali e sicurezza.',
  sotto: [
    {
      id: 'personale-ata',
      nome: 'Personale ATA e Collaboratori',
      descrizione: 'Turni, assenze, permessi e gestione dei beni del plesso.',
      sotto: [
        {
          id: 'turni-orari',
          nome: 'Turni, Sostituzioni e Orari',
          descrizione: 'Cambio turno, sostituzioni e recupero ore.',
          documenti: [
            { id: 'ci-richiesta-cambio-turno-sostituzione', nome: 'Richiesta cambio turno e sostituzione', descrizione: 'Richiesta di cambio turno e sostituzione di un collega.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'turni', pratica: 'cambio_turno' } },
            { id: 'ci-sostituzione-collega-modello', nome: 'Modulo sostituzione collega e recupero', descrizione: 'Modulo per la sostituzione di un collega con recupero ore.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'turni', pratica: 'sostituzione' } },
            { id: 'ci-richiesta-permesso-breve-recupero-ore', nome: 'Richiesta permesso breve e recupero ore', descrizione: 'Richiesta di permesso breve con recupero ore.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'permessi', pratica: 'permesso_breve' } },
          ],
        },
        {
          id: 'assenze-congedi',
          nome: 'Assenze e Congedi',
          descrizione: 'Comunicazione delle assenze, congedi e ferie.',
          documenti: [
            { id: 'ci-comunicazione-assenza-visita-medica', nome: 'Comunicazione assenza e visita medica', descrizione: 'Comunicazione dell\u2019assenza e della visita medica.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'assenze', pratica: 'visita_medica' } },
            { id: 'ci-richiesta-congedo-l104', nome: 'Richiesta congedo e L. 104', descrizione: 'Richiesta di congedo e permessi ai sensi della L. 104/1992.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'assenze', pratica: 'congedo_104' } },
            { id: 'ci-richiesta-ferie-permesso', nome: 'Richiesta ferie e permesso retribuito', descrizione: 'Richiesta di ferie o permesso retribuito.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'assenze', pratica: 'ferie' } },
          ],
        },
        {
          id: 'manutenzione-beni',
          nome: 'Manutenzione e Consegna Beni',
          descrizione: 'Segnalazioni di guasti e registri di consegna.',
          documenti: [
            { id: 'ci-segnalazione-guasto-pleso', nome: 'Segnalazione guasti e manutenzione plesso', descrizione: 'Segnalazione di guasti e richieste di manutenzione del plesso.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'manutenzione', pratica: 'guasti' } },
            { id: 'ci-registro-consegne-materiali-chiavi', nome: 'Registro consegna materiali e chiavi', descrizione: 'Registro di consegna di materiali e chiavi in uso al personale.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'beni', pratica: 'consegna_materiali' } },
            { id: 'ci-verbale-consegna-riconsegna-beni', nome: 'Verbale consegna / riconsegna beni', descrizione: 'Verbale per la consegna e la riconsegna di beni e attrezzature.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'beni', pratica: 'consegna_riconsegna_beni' } },
          ],
        },
      ],
    },
    {
      id: 'circolari-verbali',
      nome: 'Circolari, Verbali e Comunicazioni',
      descrizione: 'Circolari, verbali di riunione e comunicazioni di servizio.',
      sotto: [
        {
          id: 'circolari',
          nome: 'Circolari e Presa Visione',
          descrizione: 'Pubblicazione delle circolari e attestazioni di presa visione.',
          documenti: [
            { id: 'ci-dichiarazione-presa-visione-circolare-modello', nome: 'Dichiarazione presa visione circolare', descrizione: 'Dichiarazione di presa visione di una circolare.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'circolari', pratica: 'presa_visione' } },
            { id: 'ci-comunicazione-circolare-famiglie', nome: 'Comunicazione di circolare alle famiglie', descrizione: 'Comunicazione ai genitori della pubblicazione di una circolare.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'circolari', pratica: 'circolare_famiglie' } },
            { id: 'ci-richiesta-diffusione-circolare', nome: 'Richiesta diffusione circolare', descrizione: 'Richiesta di diffusione di una circolare al personale.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'circolari', pratica: 'diffusione' } },
          ],
        },
        {
          id: 'verbali-riunione',
          nome: 'Verbali di Riunione',
          descrizione: 'Verbali di dipartimento, consiglio di classe e assemblee.',
          documenti: [
            { id: 'ci-verbale-riunione-dipartimento-modello', nome: 'Verbale riunione di dipartimento', descrizione: 'Verbale di una riunione di dipartimento disciplinare.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'verbali', pratica: 'dipartimento' } },
            { id: 'ci-verbale-riunione-consiglio-classe', nome: 'Verbale riunione consiglio di classe', descrizione: 'Verbale di una riunione del consiglio di classe.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'verbali', pratica: 'consiglio_classe' } },
            { id: 'ci-verbale-assemblea-sindacale', nome: 'Verbale assemblea sindacale', descrizione: 'Verbale di un\u2019assemblea sindacale.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'verbali', pratica: 'assemblea_sindacale' } },
          ],
        },
        {
          id: 'comunicazioni-servizio',
          nome: 'Comunicazioni di Servizio',
          descrizione: 'Comunicazioni organizzative e segnalazioni di disservizio.',
          documenti: [
            { id: 'ci-comunicazione-cambio-orario-servizio', nome: 'Comunicazione cambio orario di servizio', descrizione: 'Comunicazione della variazione dell\u2019orario di servizio.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'servizio', pratica: 'orario_servizio' } },
            { id: 'ci-segnalazione-disservizio-informatico', nome: 'Segnalazione disservizio informatico', descrizione: 'Segnalazione di un disservizio informatico o di rete.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'servizio', pratica: 'disservizio_informatico' } },
          ],
        },
      ],
    },
    {
      id: 'incarichi-progetti',
      nome: 'Incarichi, Progetti e Rendicontazioni',
      descrizione: 'Candidature a incarichi interni e rendicontazione delle attività.',
      sotto: [
        {
          id: 'candidature',
          nome: 'Candidature e Incarichi',
          descrizione: 'Candidature a incarichi e funzioni strumentali.',
          documenti: [
            { id: 'ci-candidatura-incarico-funzione-strumentale-modello', nome: 'Candidatura incarico o funzione strumentale', descrizione: 'Candidatura a un incarico o a una funzione strumentale.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'incarichi', pratica: 'funzione_strumentale' } },
            { id: 'ci-candidatura-referente-progetto', nome: 'Candidatura referente di progetto', descrizione: 'Candidatura come referente di un progetto d\u2019istituto.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'incarichi', pratica: 'referente_progetto' } },
          ],
        },
        {
          id: 'progetti-rendicontazioni',
          nome: 'Progetti e Rendicontazioni',
          descrizione: 'Attivazione progetti PTOF e rendicontazione delle attività.',
          documenti: [
            { id: 'ci-attivazione-progetto-ptof-modello', nome: 'Scheda attivazione progetto PTOF', descrizione: 'Scheda di attivazione di un progetto PTOF.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'progetti', pratica: 'ptof' } },
            { id: 'ci-rendicontazione-fis-modello', nome: 'Rendicontazione attività FIS', descrizione: 'Rendicontazione delle attività finanziate dal FIS.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'progetti', pratica: 'fis' } },
            { id: 'ci-relazione-finale-attivita-aggiuntiva-modello', nome: 'Relazione finale attività aggiuntiva', descrizione: 'Relazione finale su un\u2019attività aggiuntiva svolta.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'progetti', pratica: 'relazione_aggiuntiva' } },
          ],
        },
      ],
    },
    {
      id: 'economici-sicurezza',
      nome: 'Economici, FIS e Sicurezza',
      descrizione: 'Ore eccedenti, rimborsi, anticipi e adempimenti di sicurezza.',
      sotto: [
        {
          id: 'ore-rimborsi',
          nome: 'Ore Eccedenti e Rimborsi',
          descrizione: 'Autorizzazioni, rimborsi spese e richieste di anticipo fondi.',
          documenti: [
            { id: 'ci-richiesta-ore-eccedenti-modello', nome: 'Richiesta autorizzazione ore eccedenti', descrizione: 'Richiesta di autorizzazione allo svolgimento di ore eccedenti.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'economici', pratica: 'ore_eccedenti' } },
            { id: 'ci-richiesta-rimborso-spese', nome: 'Richiesta rimborso spese missione / uscita', descrizione: 'Richiesta di rimborso delle spese per missione o uscita.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'economici', pratica: 'rimborso_spese' } },
            { id: 'ci-richiesta-anticipo-fondi', nome: 'Richiesta anticipo fondi', descrizione: 'Richiesta di anticipo di fondi per attività d\u2019istituto.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'economici', pratica: 'anticipo_fondi' } },
          ],
        },
        {
          id: 'sicurezza-infortuni',
          nome: 'Sicurezza e Infortuni',
          descrizione: 'Segnalazioni di rischio e verbali di infortunio.',
          documenti: [
            { id: 'ci-segnalazione-rischio-rspp', nome: 'Segnalazione rischio / locali (RSPP)', descrizione: 'Segnalazione di un rischio o di un problema ai locali (RSPP).', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'sicurezza', pratica: 'rischio' } },
            { id: 'ci-verbale-infortunio-alunno', nome: 'Verbale infortunio alunno', descrizione: 'Verbale di infortunio occorso a un alunno.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'sicurezza', pratica: 'infortunio_alunno' } },
            { id: 'ci-verbale-infortunio-personale', nome: 'Verbale infortunio personale', descrizione: 'Verbale di infortunio occorso a un dipendente.', tipo: 'PDF', profilo: { tipo: 'comunicazione_interna', area: 'sicurezza', pratica: 'infortunio_personale' } },
          ],
        },
      ],
    },
  ],
};
