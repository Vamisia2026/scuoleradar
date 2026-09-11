/**
 * ScuoleRadar.it — Modulistica: alberi "Enti" e "Altro".
 *
 * Struttura REALE a 3 livelli (Macroarea > Categoria > Sottocategoria > Moduli):
 * le categorie raggruppano pratiche omogenee (es. "Burocrazia e Segreterie",
 * "Concorsi e Selezioni", "Collaborazioni Esterne") e ogni sottocategoria
 * contiene i moduli correlati, con un `profilo.tipo` che seleziona il template
 * specifico del documento (non un generico fallback).
 */
import type { MacroAreaModulistica } from './moduli';

/** Macroarea "Enti": rapporti con segreterie, enti locali e procedure concorsuali. */
export const macroAreaEnti: MacroAreaModulistica = {
  id: 'enti',
  nome: 'Enti',
  descrizione: 'Rapporti con segreterie, enti locali e pubbliche amministrazioni.',
  sotto: [
    {
      id: 'burocrazia-segreterie',
      nome: 'Burocrazia e Segreterie',
      descrizione: 'Autocertificazioni, deleghe e privacy, istanze verso la segreteria.',
      sotto: [
        {
          id: 'autocertificazioni-dichiarazioni',
          nome: 'Autocertificazioni e Dichiarazioni',
          descrizione: 'Dichiarazioni sostitutive (DPR 445/2000) pronte da compilare.',
          documenti: [
            {
              id: 'enti-autocert-titoli',
              nome: 'Autocertificazione titoli di studio e servizi',
              descrizione: 'Dichiarazione sostitutiva di certificazione dei titoli di studio e dei servizi svolti (DPR 445/2000).',
              tipo: 'PDF',
              catalogoId: 'autocertificazione-titoli',
              profilo: { tipo: 'autocertificazione', ordine: 'enti' },
            },
            {
              id: 'enti-dich-certificazione',
              nome: 'Dichiarazione sostitutiva di certificazione (DPR 445/2000)',
              descrizione: 'Modello libero di dichiarazione sostitutiva di certificazione.',
              tipo: 'PDF',
              profilo: { tipo: 'autocertificazione', ordine: 'enti' },
            },
            {
              id: 'enti-dich-incompatibilita',
              nome: 'Dichiarazione di assenza di cause di incompatibilità',
              descrizione: 'Dichiarazione di non trovarsi in situazioni di incompatibilità o conflitto di interessi.',
              tipo: 'PDF',
              profilo: { tipo: 'autocertificazione', ordine: 'enti' },
            },
          ],
        },
        {
          id: 'deleghe-privacy',
          nome: 'Deleghe e Privacy',
          descrizione: 'Deleghe a terzi e consensi al trattamento dei dati personali.',
          documenti: [
            {
              id: 'enti-delega-privacy',
              nome: 'Modulo deleghe e consenso privacy',
              descrizione: 'Delega a terzi con consensi privacy (finalità, immagini, comunicazioni).',
              tipo: 'PDF',
              catalogoId: 'deleghe-privacy',
              profilo: { tipo: 'delega_privacy', ordine: 'enti' },
            },
            {
              id: 'enti-consenso-dati',
              nome: 'Consenso al trattamento dei dati personali',
              descrizione: 'Consenso informato al trattamento dei dati ai sensi del Reg. UE 2016/679.',
              tipo: 'PDF',
              profilo: { tipo: 'delega_privacy', ordine: 'enti' },
            },
            {
              id: 'enti-delega-ritiro-documenti',
              nome: 'Delega al ritiro di documenti e pratiche',
              descrizione: 'Delega a una persona di fiducia per il ritiro di documenti e pratiche.',
              tipo: 'PDF',
              profilo: { tipo: 'delega_privacy', ordine: 'enti' },
            },
          ],
        },
        {
          id: 'protocollo-istanze',
          nome: 'Protocollo e Istanze',
          descrizione: 'Istanze generiche, accesso agli atti e informazioni sulle pratiche.',
          documenti: [
            {
              id: 'enti-istanza-generica',
              nome: 'Istanza generica a Ente / Istituzione',
              descrizione: 'Istanza formale indirizzata a un ente o a un ufficio pubblico.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti', ordine: 'enti' },
            },
            {
              id: 'enti-accesso-atti',
              nome: 'Richiesta di accesso agli atti (L. 241/1990)',
              descrizione: 'Istanza di accesso documentale ai sensi della L. 241/1990.',
              tipo: 'PDF',
              profilo: { tipo: 'accesso_atti', ordine: 'enti' },
            },
            {
              id: 'enti-info-pratica',
              nome: 'Richiesta di informazioni sullo stato della pratica',
              descrizione: 'Richiesta di aggiornamento sullo stato di una pratica in corso.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti', ordine: 'enti' },
            },
          ],
        },
      ],
    },
    {
      id: 'concorsi-selezioni',
      nome: 'Concorsi e Selezioni',
      descrizione: 'Domande di partecipazione, dichiarazioni dei titoli e tutele nelle procedure.',
      sotto: [
        {
          id: 'domanda-partecipazione',
          nome: 'Domanda di Partecipazione',
          descrizione: 'Domanda, requisiti di ammissione e dichiarazione dei titoli.',
          documenti: [
            {
              id: 'enti-domanda-concorso',
              nome: 'Domanda di partecipazione a concorso',
              descrizione: 'Domanda con riferimento alla procedura, requisiti di ammissione ed elenco allegati.',
              tipo: 'PDF',
              profilo: { tipo: 'concorso', ordine: 'enti' },
            },
            {
              id: 'enti-autocert-requisiti',
              nome: 'Autocertificazione dei requisiti di ammissione',
              descrizione: 'Autocertificazione del possesso dei requisiti previsti dal bando.',
              tipo: 'PDF',
              profilo: { tipo: 'autocertificazione', ordine: 'enti' },
            },
            {
              id: 'enti-dich-titoli-servizi',
              nome: 'Dichiarazione dei titoli e dei servizi svolti',
              descrizione: 'Dichiarazione analitica dei titoli valutabili e dei servizi prestati.',
              tipo: 'PDF',
              profilo: { tipo: 'autocertificazione', ordine: 'enti' },
            },
          ],
        },
        {
          id: 'istruttoria-tutela',
          nome: 'Istruttoria e Tutela',
          descrizione: 'Accesso agli atti, riesame e rettifica dei dati di carriera.',
          documenti: [
            {
              id: 'enti-accesso-atti-concorso',
              nome: 'Accesso agli atti della procedura concorsuale',
              descrizione: 'Istanza di accesso documentale agli atti di una procedura concorsuale.',
              tipo: 'PDF',
              profilo: { tipo: 'accesso_atti', ordine: 'enti' },
            },
            {
              id: 'enti-ricorso-esiti',
              nome: 'Istanza di riesame / ricorso avverso gli esiti',
              descrizione: 'Istanza di riesame in autotutela o ricorso avverso gli esiti di una procedura.',
              tipo: 'PDF',
              profilo: { tipo: 'ricorso_reclamo', ordine: 'enti' },
            },
            {
              id: 'enti-rettifica-carriera',
              nome: 'Richiesta di rettifica dei dati di carriera',
              descrizione: 'Richiesta di correzione dei dati presenti nel fascicolo personale.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti', ordine: 'enti' },
            },
          ],
        },
      ],
    },
    {
      id: 'collaborazioni-esterne',
      nome: 'Collaborazioni Esterne',
      descrizione: 'Incarichi con enti locali, convenzioni, protocolli e rendicontazioni.',
      sotto: [
        {
          id: 'incarichi-enti-locali',
          nome: 'Incarichi con Enti Locali',
          descrizione: 'Dichiarazioni e istanze per incarichi con Comuni, Province e Regioni.',
          documenti: [
            {
              id: 'enti-dich-incarico',
              nome: 'Dichiarazione di incarico con Ente locale',
              descrizione: 'Dichiarazione relativa allo svolgimento di incarichi con gli enti locali.',
              tipo: 'PDF',
              profilo: { tipo: 'autocertificazione', ordine: 'enti' },
            },
            {
              id: 'enti-istanza-comune',
              nome: 'Istanza al Comune / Provincia',
              descrizione: 'Istanza formale verso il Comune o la Provincia.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti', ordine: 'enti' },
            },
            {
              id: 'enti-autorizzazione-incarico',
              nome: 'Comunicazione di autorizzazione allo svolgimento di incarico',
              descrizione: 'Comunicazione formale di autorizzazione a un incarico esterno.',
              tipo: 'PDF',
              profilo: { tipo: 'lettera', ordine: 'enti' },
            },
          ],
        },
        {
          id: 'convenzioni-protocolli',
          nome: 'Convenzioni e Protocolli',
          descrizione: 'Accordi con enti, associazioni e soggetti esterni.',
          documenti: [
            {
              id: 'enti-protocollo-intesa',
              nome: "Protocollo d'intesa con Ente / Associazione",
              descrizione: "Schema di protocollo d'intesa per attività congiunte con un ente o un'associazione.",
              tipo: 'PDF',
              profilo: { tipo: 'protocollo_intesa', ordine: 'enti' },
            },
            {
              id: 'enti-convenzione-pcto',
              nome: 'Convenzione per PCTO / Tirocini',
              descrizione: 'Convenzione per percorsi per le competenze trasversali e per l\u2019orientamento.',
              tipo: 'PDF',
              profilo: { tipo: 'convenzione_pcto', ordine: 'enti' },
            },
            {
              id: 'enti-patrocinio-locali',
              nome: 'Patrocinio e concessione locali',
              descrizione: 'Richiesta di patrocinio e/o concessione di locali scolastici.',
              tipo: 'PDF',
              profilo: { tipo: 'patrocinio_locali', ordine: 'enti' },
            },
          ],
        },
        {
          id: 'rendicontazione',
          nome: 'Rendicontazione e Comunicazioni',
          descrizione: 'Rendiconti, comunicazioni formali e segnalazioni verso enti e uffici.',
          documenti: [
            {
              id: 'enti-relazione-finale',
              nome: 'Relazione / rendiconto di progetto',
              descrizione: 'Relazione finale e rendiconto delle attività svolte in un progetto.',
              tipo: 'PDF',
              profilo: { tipo: 'relazione_finale', ordine: 'enti' },
            },
            {
              id: 'enti-comunicazione-ente',
              nome: 'Comunicazione formale a Ente / Ufficio',
              descrizione: 'Lettera formale di comunicazione verso un ente o un ufficio.',
              tipo: 'PDF',
              profilo: { tipo: 'lettera', ordine: 'enti' },
            },
            {
              id: 'enti-segnalazione-anomalia',
              nome: 'Segnalazione di anomalia di servizio',
              descrizione: 'Segnalazione formale di un disservizio o di una anomalia.',
              tipo: 'PDF',
              profilo: { tipo: 'segnalazione_anomalia', ordine: 'enti' },
            },
          ],
        },
      ],
    },
  ],
};

/** Macroarea "Altro": certificati, deleghe, pagamenti e modelli di uso comune. */
export const macroAreaAltro: MacroAreaModulistica = {
  id: 'altro',
  nome: 'Altro',
  descrizione: 'Certificati, autocertificazioni, deleghe e modelli di uso comune.',
  sotto: [
    {
      id: 'certificati-anagrafe',
      nome: 'Certificati e Anagrafe',
      descrizione: 'Certificati anagrafici e attestazioni di frequenza / iscrizione.',
      sotto: [
        {
          id: 'certificati-base',
          nome: 'Certificati Anagrafici',
          descrizione: 'Residenza, stato di famiglia e certificati anagrafici di base.',
          documenti: [
            {
              id: 'altro-cert-residenza',
              nome: 'Richiesta certificato di residenza',
              descrizione: 'Domanda di rilascio del certificato di residenza.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti' },
            },
            {
              id: 'altro-cert-stato-famiglia',
              nome: 'Certificato di stato di famiglia',
              descrizione: 'Richiesta del certificato di stato di famiglia.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti' },
            },
            {
              id: 'altro-cert-nascita',
              nome: 'Certificato di nascita',
              descrizione: 'Richiesta dell\u2019estratto o del certificato di nascita.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti' },
            },
          ],
        },
        {
          id: 'anagrafe-scolastica',
          nome: 'Anagrafe Scolastica',
          descrizione: 'Attestazioni di frequenza e di iscrizione per pratiche e bonus.',
          documenti: [
            {
              id: 'altro-cert-frequenza',
              nome: 'Certificato di frequenza scolastica',
              descrizione: 'Attestazione di frequenza dell\u2019alunno/a per usi amministrativi.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti' },
            },
            {
              id: 'altro-attestazione-iscrizione',
              nome: 'Attestazione di iscrizione',
              descrizione: 'Attestazione di avvenuta iscrizione a un istituto scolastico.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti' },
            },
          ],
        },
      ],
    },
    {
      id: 'autocertificazioni',
      nome: 'Autocertificazioni',
      descrizione: 'Dichiarazioni sostitutive per i casi più comuni (DPR 445/2000).',
      sotto: [
        {
          id: 'autocertificazioni-base',
          nome: 'Dichiarazioni di Base',
          descrizione: 'Autocertificazione generica e atto di notorietà.',
          documenti: [
            {
              id: 'altro-autocert-generica',
              nome: 'Autocertificazione generica (DPR 445/2000)',
              descrizione: 'Modello libero di dichiarazione sostitutiva di certificazione.',
              tipo: 'PDF',
              profilo: { tipo: 'autocertificazione' },
            },
            {
              id: 'altro-dich-notorieta',
              nome: "Dichiarazione sostitutiva dell'atto di notorietà",
              descrizione: "Dichiarazione sostitutiva dell'atto di notorietà ai sensi dell'art. 47 del DPR 445/2000.",
              tipo: 'PDF',
              profilo: { tipo: 'autocertificazione' },
            },
            {
              id: 'altro-dich-residenza',
              nome: 'Dichiarazione di residenza e stato di famiglia',
              descrizione: 'Autocertificazione di residenza e composizione del nucleo familiare.',
              tipo: 'PDF',
              profilo: { tipo: 'autocertificazione' },
            },
          ],
        },
      ],
    },
    {
      id: 'deleghe-prelievo',
      nome: 'Deleghe e Prelievo dei Minori',
      descrizione: 'Deleghe a terzi per il prelievo e l\u2019accompagnamento dei minori.',
      sotto: [
        {
          id: 'delega-prelievo',
          nome: 'Deleghe al Prelievo',
          descrizione: 'Delega, accompagnamento e revoca.',
          documenti: [
            {
              id: 'altro-delega-prelievo',
              nome: 'Delega prelievo minore',
              descrizione: 'Modulo di delega per il prelievo di un minore da parte di terzi.',
              tipo: 'PDF',
              catalogoId: 'deleghe-privacy',
              profilo: { tipo: 'delega_privacy' },
            },
            {
              id: 'altro-delega-visite',
              nome: 'Delega per visite mediche e accompagnamento',
              descrizione: 'Delega per accompagnare il minore a visite mediche o ad attività.',
              tipo: 'PDF',
              profilo: { tipo: 'delega_privacy' },
            },
            {
              id: 'altro-revoca-delega',
              nome: 'Revoca della delega',
              descrizione: 'Comunicazione scritta di revoca di una delega in essere.',
              tipo: 'PDF',
              profilo: { tipo: 'lettera' },
            },
          ],
        },
      ],
    },
    {
      id: 'pagamenti-assicurazioni',
      nome: 'Pagamenti, Rimborsi e Assicurazioni',
      descrizione: 'Rateizzazioni, attestazioni di pagamento e pratiche assicurative.',
      sotto: [
        {
          id: 'pagamenti-rate',
          nome: 'Pagamenti e Rateizzazioni',
          descrizione: 'Rateizzazione dei pagamenti e attestazioni di versamento.',
          documenti: [
            {
              id: 'altro-rateizzazione',
              nome: 'Richiesta di pagamento rateizzato',
              descrizione: 'Istanza di rateizzazione di un pagamento dovuto.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti' },
            },
            {
              id: 'altro-attestazione-pagamento',
              nome: 'Attestazione di avvenuto pagamento',
              descrizione: 'Attestazione di avvenuto versamento di una somma.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti' },
            },
          ],
        },
        {
          id: 'assicurazioni',
          nome: 'Assicurazioni',
          descrizione: 'Adesione alle polizze e denuncia dei sinistri.',
          documenti: [
            {
              id: 'altro-adesione-polizza',
              nome: 'Adesione alla polizza assicurativa scolastica',
              descrizione: 'Adesione al servizio di assicurazione integrativa scolastica.',
              tipo: 'PDF',
              profilo: { tipo: 'istanza_enti' },
            },
            {
              id: 'altro-denuncia-sinistro',
              nome: 'Comunicazione di denuncia sinistro',
              descrizione: 'Comunicazione formale di apertura di un sinistro assicurativo.',
              tipo: 'PDF',
              profilo: { tipo: 'lettera' },
            },
          ],
        },
      ],
    },
    {
      id: 'modelli-liberi',
      nome: 'Modelli Liberi e Promemoria',
      descrizione: 'Comunicazioni, promemoria e richieste di chiarimento.',
      sotto: [
        {
          id: 'promemoria',
          nome: 'Promemoria e Comunicazioni',
          descrizione: 'Promemoria, diffide e richieste formali.',
          documenti: [
            {
              id: 'altro-promemoria',
              nome: 'Promemoria / comunicazione generica',
              descrizione: 'Comunicazione scritta di promemoria a un ufficio o a un soggetto.',
              tipo: 'PDF',
              profilo: { tipo: 'lettera' },
            },
            {
              id: 'altro-diffida',
              nome: 'Diffida / messa in mora',
              descrizione: 'Diffida formale ad adempiere con indicazione di un termine.',
              tipo: 'PDF',
              profilo: { tipo: 'lettera' },
            },
            {
              id: 'altro-richiesta-chiarimenti',
              nome: 'Richiesta di chiarimenti',
              descrizione: 'Richiesta formale di chiarimenti su una comunicazione ricevuta.',
              tipo: 'PDF',
              profilo: { tipo: 'lettera' },
            },
          ],
        },
      ],
    },
  ],
};
