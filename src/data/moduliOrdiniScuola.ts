/**
 * ScuoleRadar.it — Modulistica: alberi degli ORDINI DI SCUOLA
 * (Infanzia, Primaria, Secondaria 1° e 2° grado).
 *
 * Struttura REALE a 3 livelli coerente (Macroarea -> Tema -> Sottocategoria -> Moduli):
 * i temi raggruppano le pratiche omogenee (es. "Inclusione e benessere",
 * "Rapporti di lavoro") e ogni sottocategoria contiene i moduli correlati, con il
 * `profilo` che seleziona il template specifico del documento.
 *
 * Tutti gli `id` dei documenti sono PRESERVATI (backward compatibility con la
 * cache localStorage e lo storico "Modelli scaricati").
 *
 * Verifica di integrità: `npm run test:moduli`.
 */
import type { MacroAreaModulistica } from './moduli';

/** Macroarea "Infanzia". */
export const macroAreaInfanzia: MacroAreaModulistica = {
  "id": "infanzia",
  "nome": "Infanzia",
  "descrizione": "Modulistica per la scuola dell'infanzia: iscrizioni, servizi e inclusione.",
  "sotto": [
    {
      "id": "ingresso-iscrizioni",
      "nome": "Iscrizioni e primo ingresso",
      "descrizione": "Iscrizioni, scelta della scuola, sezioni e ammissione al grado di studi.",
      "sotto": [
        {
          "id": "iscrizione-infanzia",
          "nome": "Iscrizione e documenti",
          "descrizione": "Iscrizione alla scuola dell’infanzia e documentazione di accompagnamento.",
          "documenti": [
            {
              "id": "iscrizione-infanzia",
              "nome": "Domanda di iscrizione – Scuola dell’Infanzia",
              "descrizione": "Modello di domanda di iscrizione per la scuola dell’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "infanzia"
              }
            },
            {
              "id": "nullaosta-frequenza",
              "nome": "Nulla osta di frequenza",
              "descrizione": "Richiesta di nulla osta per la frequenza della scuola dell’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "sezioni-primavera",
          "nome": "Sezioni Primavera",
          "descrizione": "Iscrizione e documentazione per le Sezioni Primavera (0-3).",
          "documenti": [
            {
              "id": "iscrizione-sezione-primavera",
              "nome": "Domanda di iscrizione – Sezione Primavera",
              "descrizione": "Domanda di iscrizione ai servizi educativi per la fascia 0-3 anni.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "infanzia"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "servizi-mensa-trasporto",
      "nome": "Servizi, mensa e trasporto",
      "descrizione": "Mensa e diete speciali, trasporto scolastico, rette e servizi extrascolastici.",
      "sotto": [
        {
          "id": "mensa-diete",
          "nome": "Mensa e diete speciali",
          "descrizione": "Richieste per il servizio mensa e per le diete speciali.",
          "documenti": [
            {
              "id": "richiesta-mensa-dieta",
              "nome": "Richiesta mensa e dieta speciale",
              "descrizione": "Modulo per la richiesta del servizio mensa e della dieta speciale certificata.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "mensa",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "trasporto-infanzia",
          "nome": "Trasporto scolastico",
          "descrizione": "Domande per il servizio di trasporto scolastico.",
          "documenti": [
            {
              "id": "richiesta-trasporto-infanzia",
              "nome": "Richiesta trasporto scolastico – Infanzia",
              "descrizione": "Domanda per l’attivazione del trasporto scolastico comunale.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "rette-convenzioni",
          "nome": "Rette e convenzioni",
          "descrizione": "Richiesta di riduzione retta e documentazione economica.",
          "documenti": [
            {
              "id": "richiesta-riduzione-retta",
              "nome": "Richiesta riduzione retta mensa",
              "descrizione": "Domanda di riduzione della retta per il servizio mensa (ISEE).",
              "tipo": "PDF",
              "profilo": {
                "tipo": "mensa",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "nidi-infanzia",
          "nome": "Nidi d’infanzia",
          "descrizione": "Iscrizione ai nidi e rette.",
          "documenti": [
            {
              "id": "iscrizione-nido",
              "nome": "Domanda di iscrizione al nido d’infanzia",
              "descrizione": "Domanda di iscrizione ai nidi d’infanzia comunali.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "infanzia"
              }
            },
            {
              "id": "richiesta-retta-nido",
              "nome": "Richiesta agevolazione retta nido",
              "descrizione": "Domanda di agevolazione sulla retta del nido con ISEE.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "liste-attesa",
          "nome": "Liste di attesa",
          "descrizione": "Iscrizione in lista d’attesa e comunicazioni.",
          "documenti": [
            {
              "id": "iscrizione-lista-attesa",
              "nome": "Iscrizione in lista d’attesa",
              "descrizione": "Modulo per l’iscrizione in lista d’attesa dei servizi 0-6.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "infanzia"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "didattica-valutazione",
      "nome": "Didattica, valutazione e progetti",
      "descrizione": "Programmazione, valutazione, scrutini, biblioteca e attività didattiche.",
      "sotto": [
        {
          "id": "schede-osservazione-infanzia",
          "nome": "Schede di osservazione",
          "descrizione": "Schede di osservazione delle competenze per la scuola dell’infanzia.",
          "documenti": [
            {
              "id": "scheda-osservazione-infanzia",
              "nome": "Scheda osservazione competenze – Infanzia",
              "descrizione": "Scheda di osservazione delle competenze per la scuola dell’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "schede_osservazione",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "continuita-nido-infanzia",
          "nome": "Progetti continuità nido-infanzia",
          "descrizione": "Adesione ai progetti di continuità tra nido e scuola dell’infanzia.",
          "documenti": [
            {
              "id": "continuita-nido-infanzia",
              "nome": "Adesione progetto continuità nido-infanzia",
              "descrizione": "Consenso alla partecipazione al progetto continuità nido-infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "progetto_continuita",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "uscite-laboratori-infanzia",
          "nome": "Uscite e laboratori",
          "descrizione": "Autorizzazioni per uscite didattiche e attività di laboratorio.",
          "documenti": [
            {
              "id": "autorizzazione-uscite-laboratori",
              "nome": "Autorizzazione uscite / laboratori – Infanzia",
              "descrizione": "Modulo di autorizzazione per uscite didattiche e laboratori.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "uscite_didattiche",
                "ordine": "infanzia"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "inclusione-benessere",
      "nome": "Inclusione e benessere",
      "descrizione": "Sostegno, PEI, PDP/BES, assistenza specialistica e sportelli di ascolto.",
      "sotto": [
        {
          "id": "pei-glo-infanzia",
          "nome": "PEI e Gestione GLO",
          "descrizione": "Verbali, proposte e gestione del Gruppo di Lavoro Operativo.",
          "documenti": [
            {
              "id": "sostegno-infanzia",
              "nome": "Richiesta di sostegno – Scuola dell’Infanzia",
              "descrizione": "Domanda di accertamento e assegnazione delle ore di sostegno per l’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "sostegno",
                "ordine": "infanzia",
                "scopo_sostegno": "richiesta"
              }
            },
            {
              "id": "verbale-glo-infanzia",
              "nome": "Verbale GLO / GLHO – Infanzia",
              "descrizione": "Verbale delle riunioni del GLO per la scuola dell’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "verbale_glo",
                "ordine": "infanzia",
                "scopo_sostegno": "pei"
              }
            },
            {
              "id": "proposta-pei-infanzia",
              "nome": "Proposta PEI – Infanzia",
              "descrizione": "Bozza di proposta PEI per la scuola dell’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pei",
                "ordine": "infanzia",
                "scopo_sostegno": "pei"
              }
            }
          ]
        },
        {
          "id": "pdp-infanzia",
          "nome": "PDP (DSA e BES)",
          "descrizione": "Piani Didattici Personalizzati per DSA e BES.",
          "documenti": [
            {
              "id": "pdp-dsa-infanzia",
              "nome": "PDP DSA (L. 170/2010) – Infanzia",
              "descrizione": "Piano Didattico Personalizzato per alunni con DSA certificati.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pdp_dsa",
                "ordine": "infanzia",
                "scopo_sostegno": "pdp_dsa"
              }
            },
            {
              "id": "pdp-bes-infanzia",
              "nome": "PDP BES – Infanzia",
              "descrizione": "Piano Didattico Personalizzato per alunni con BES non certificati.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pdp_bes",
                "ordine": "infanzia",
                "scopo_sostegno": "pdp_bes"
              }
            }
          ]
        },
        {
          "id": "nai-infanzia",
          "nome": "Inclusione NAI e Mediatori",
          "descrizione": "Piani personalizzati e progetti di alfabetizzazione per alunni stranieri.",
          "documenti": [
            {
              "id": "piano-nai-infanzia",
              "nome": "Piano personalizzato NAI – Infanzia",
              "descrizione": "Piano di Studio Personalizzato per alunni NAI non alfabetizzati: scheda di ingresso QCER (A0-B1), laboratorio italiano L2 e progettazione per Assi/Macro-Aree.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "piano_personalizzato_nai",
                "ordine": "infanzia"
              }
            },
            {
              "id": "progetto-alfabetizzazione-infanzia",
              "nome": "Progetto alfabetizzazione / italiano L2 – Infanzia",
              "descrizione": "Progetto di alfabetizzazione e mediazione per alunni NAI.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "progetto_alfabetizzazione",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "relazioni-finali-infanzia",
          "nome": "Relazioni e Monitoraggio Finale",
          "descrizione": "Relazioni finali di inclusione e monitoraggio del percorso.",
          "documenti": [
            {
              "id": "relazione-finale-inclusione-infanzia",
              "nome": "Relazione finale inclusione – Infanzia",
              "descrizione": "Relazione finale di verifica del percorso di inclusione (PEI/PDP): 4 Dimensioni ICF strutturate (D.I. 182/2020), esiti e proposte di transizione (art. 10 D.Lgs. 66/2017).",
              "tipo": "PDF",
              "profilo": {
                "tipo": "relazione_finale_inclusione",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "richiesta-pei-infanzia",
          "nome": "Richiesta PEI – Infanzia",
          "descrizione": "Compilazione e aggiornamento del PEI per la scuola dell’infanzia.",
          "documenti": [
            {
              "id": "richiesta-pei-infanzia-doc",
              "nome": "Richiesta compilazione PEI – Infanzia",
              "descrizione": "Istanza per la compilazione o la revisione del PEI nella scuola dell’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pei",
                "ordine": "infanzia",
                "scopo_sostegno": "pei"
              }
            }
          ]
        },
        {
          "id": "pdp-bes-infanzia",
          "nome": "PDP e BES – Infanzia",
          "descrizione": "Piani educativi personalizzati e percorsi per BES nella fascia 3-6.",
          "documenti": [
            {
              "id": "pdp-infanzia",
              "nome": "Piano educativo personalizzato – Infanzia",
              "descrizione": "Modello di piano educativo personalizzato per la scuola dell’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pei",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "segnalazioni-asl-infanzia",
          "nome": "Segnalazioni ASL – Infanzia",
          "descrizione": "Segnalazioni ai servizi sanitari e richieste di valutazione 0-6.",
          "documenti": [
            {
              "id": "segnalazione-asl-infanzia",
              "nome": "Segnalazione ASL – Infanzia",
              "descrizione": "Segnalazione ai servizi sanitari per la valutazione di un bambino.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificazione",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "assistenza-specialistica-infanzia",
          "nome": "Assistenza specialistica – Infanzia",
          "descrizione": "Richieste di assistenza specialistica e socio-educativa al Comune.",
          "documenti": [
            {
              "id": "richiesta-assistenza-infanzia",
              "nome": "Richiesta assistenza specialistica – Infanzia",
              "descrizione": "Istanza al Comune per l’assistenza specialistica nella scuola dell’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "sostegno",
                "ordine": "infanzia",
                "scopo_sostegno": "autonomia",
                "destinatario": "comune"
              }
            }
          ]
        },
        {
          "id": "trasporto-disabili-infanzia",
          "nome": "Trasporto disabili – Infanzia",
          "descrizione": "Trasporto dedicato per bambini con disabilità.",
          "documenti": [
            {
              "id": "richiesta-trasporto-disabili-infanzia",
              "nome": "Richiesta trasporto dedicato – Infanzia",
              "descrizione": "Istanza per il trasporto scolastico dedicato di un bambino con disabilità.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "sostegno",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "esoneri-infanzia",
          "nome": "Esoneri e deroghe – Infanzia",
          "descrizione": "Esoneri e deroghe per motivi di salute nella fascia 3-6.",
          "documenti": [
            {
              "id": "esonero-infanzia",
              "nome": "Richiesta esonero – Infanzia",
              "descrizione": "Istanza di esonero dalle attività per motivi di salute certificati.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificazione",
                "ordine": "infanzia"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "uscite-viaggi",
      "nome": "Uscite, viaggi e progetti speciali",
      "descrizione": "Uscite didattiche, viaggi di istruzione, PCTO e scambi all’estero.",
      "sotto": [
        {
          "id": "uscite-infanzia",
          "nome": "Uscite didattiche e autorizzazioni",
          "descrizione": "Autorizzazioni per uscite didattiche e attività fuori sede.",
          "documenti": [
            {
              "id": "autorizzazione-uscita-infanzia",
              "nome": "Autorizzazione uscita didattica – Infanzia",
              "descrizione": "Modulo di autorizzazione per le uscite didattiche della scuola dell’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "uscite_didattiche",
                "ordine": "infanzia"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "documenti-famiglia",
      "nome": "Documenti per la famiglia",
      "descrizione": "Autocertificazioni, deleghe, giustificazioni e consensi privacy.",
      "sotto": [
        {
          "id": "autocert-famiglia-infanzia",
          "nome": "Autocertificazioni e Stato Famiglia",
          "descrizione": "Dichiarazioni sostitutive e stato di famiglia.",
          "documenti": [
            {
              "id": "dichiarazione-famiglia-infanzia",
              "nome": "Dichiarazione stato di famiglia",
              "descrizione": "Dichiarazione sostitutiva dello stato di famiglia per la scuola dell’infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "autocertificazione",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "deleghe-ritiro-infanzia",
          "nome": "Deleghe e Ritiro Alunni",
          "descrizione": "Delega al ritiro del bambino da parte di parenti o conoscenti.",
          "documenti": [
            {
              "id": "delega-ritiro-infanzia",
              "nome": "Delega ritiro bambino/a (parenti / conoscenti)",
              "descrizione": "Modulo di delega al ritiro del bambino da parte di parenti o conoscenti.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "delega_famiglia",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "assenze-giustif-infanzia",
          "nome": "Assenze e Giustificazioni",
          "descrizione": "Comunicazioni di assenza, permessi orari e istruzione parentale.",
          "documenti": [
            {
              "id": "istruzione-parentale-infanzia",
              "nome": "Comunicazione assenze / istruzione parentale",
              "descrizione": "Comunicazione dell’intenzione di avvalersi dell’istruzione parentale o assenze prolungate.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "istruzione_parentale",
                "ordine": "infanzia"
              }
            },
            {
              "id": "permesso-orario-infanzia",
              "nome": "Richiesta permesso orario / uscita anticipata",
              "descrizione": "Modulo per entrata posticipata, uscita anticipata o assenza breve.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "permesso_orario",
                "ordine": "infanzia"
              }
            },
            {
              "id": "congedo-maternita-infanzia",
              "nome": "Congedo di maternità / paternità",
              "descrizione": "Richiesta di congedo obbligatorio di maternità o paternità (D.Lgs. 151/2001).",
              "tipo": "PDF",
              "profilo": {
                "tipo": "congedo_maternita",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "accesso-privacy-infanzia",
          "nome": "Accesso agli Atti e Privacy",
          "descrizione": "Accesso agli atti (L. 241/1990) e consensi per immagini e dati personali.",
          "documenti": [
            {
              "id": "accesso-atti-infanzia",
              "nome": "Richiesta accesso agli atti (L. 241/1990)",
              "descrizione": "Istanza di accesso ai documenti amministrativi della scuola.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "accesso_atti",
                "ordine": "infanzia"
              }
            },
            {
              "id": "consenso-foto-infanzia",
              "nome": "Consenso foto / video",
              "descrizione": "Consenso al trattamento e alla pubblicazione di immagini e riprese video.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "consenso_foto",
                "ordine": "infanzia"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "vita-scolastica",
      "nome": "Vita scolastica e rappresentanze",
      "descrizione": "Assemblee, rappresentanze, ricorsi, reclami e organizzazione.",
      "sotto": [
        {
          "id": "mensa-org-infanzia",
          "nome": "Mensa e diete speciali",
          "descrizione": "Richieste per il servizio mensa e le diete speciali.",
          "documenti": [
            {
              "id": "mensa-diete-organizzazione",
              "nome": "Modulo mensa / diete speciali",
              "descrizione": "Richiesta del servizio mensa e della dieta speciale certificata.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "mensa",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "prepost-infanzia",
          "nome": "Pre / Post scuola",
          "descrizione": "Richiesta del servizio di pre e post scuola.",
          "documenti": [
            {
              "id": "servizio-prepost-infanzia",
              "nome": "Richiesta servizio pre / post scuola",
              "descrizione": "Domanda di attivazione del servizio pre / post scuola.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "servizi_prepost",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "rinunce-infanzia",
          "nome": "Rinunce e ritiri",
          "descrizione": "Rinuncia o ritiro dell’iscrizione.",
          "documenti": [
            {
              "id": "rinuncia-iscrizione-infanzia",
              "nome": "Rinuncia / ritiro iscrizione – Infanzia",
              "descrizione": "Modulo di rinuncia o ritiro dell’iscrizione.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "rinuncia_iscrizione",
                "ordine": "infanzia"
              }
            }
          ]
        },
        {
          "id": "ricorsi-infanzia",
          "nome": "Ricorsi e reclami – Infanzia",
          "descrizione": "Ricorsi e reclami per i servizi della prima infanzia.",
          "documenti": [
            {
              "id": "ricorso-infanzia",
              "nome": "Reclamo servizi prima infanzia",
              "descrizione": "Modello di reclamo per i servizi educativi della prima infanzia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "ricorso_reclamo",
                "ordine": "infanzia"
              }
            }
          ]
        }
      ]
    }
  ]
};

/** Macroarea "Primaria". */
export const macroAreaPrimaria: MacroAreaModulistica = {
  "id": "primaria",
  "nome": "Primaria",
  "descrizione": "Modulistica per la scuola primaria: iscrizioni, servizi, valutazione e inclusione.",
  "sotto": [
    {
      "id": "ingresso-iscrizioni",
      "nome": "Iscrizioni e primo ingresso",
      "descrizione": "Iscrizioni, scelta della scuola, sezioni e ammissione al grado di studi.",
      "sotto": [
        {
          "id": "iscrizione-primaria",
          "nome": "Iscrizione e scelta scuola",
          "descrizione": "Iscrizione alla scuola primaria e scelte di indirizzo.",
          "documenti": [
            {
              "id": "iscrizione-primaria",
              "nome": "Domanda di iscrizione – Scuola Primaria",
              "descrizione": "Modello di domanda di iscrizione per la scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "tempo-pieno-40",
          "nome": "Tempo pieno (40 ore)",
          "descrizione": "Adesione al tempo pieno di 40 ore settimanali.",
          "documenti": [
            {
              "id": "richiesta-tempo-pieno",
              "nome": "Richiesta tempo pieno 40 ore",
              "descrizione": "Domanda di adesione al tempo pieno di 40 ore settimanali.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "tempo-prolungato",
          "nome": "Tempo prolungato (36/38 ore)",
          "descrizione": "Adesione al tempo prolungato con mensa.",
          "documenti": [
            {
              "id": "richiesta-tempo-prolungato",
              "nome": "Richiesta tempo prolungato",
              "descrizione": "Domanda di adesione al tempo prolungato con mensa.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "primaria"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "servizi-mensa-trasporto",
      "nome": "Servizi, mensa e trasporto",
      "descrizione": "Mensa e diete speciali, trasporto scolastico, rette e servizi extrascolastici.",
      "sotto": [
        {
          "id": "servizi-primaria",
          "nome": "Mensa, trasporto e pre/post",
          "descrizione": "Servizi scolastici complementari per la primaria.",
          "documenti": [
            {
              "id": "richiesta-servizi-primaria",
              "nome": "Richiesta mensa, trasporto e pre/post scuola",
              "descrizione": "Domanda unica per i servizi scolastici della scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "primaria"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "didattica-valutazione",
      "nome": "Didattica, valutazione e progetti",
      "descrizione": "Programmazione, valutazione, scrutini, biblioteca e attività didattiche.",
      "sotto": [
        {
          "id": "valutazione-primaria",
          "nome": "Valutazione e scrutini",
          "descrizione": "Richiesta di accesso agli atti e documentazione valutativa.",
          "documenti": [
            {
              "id": "accesso-atti-valutazione",
              "nome": "Richiesta accesso agli atti – valutazione",
              "descrizione": "Istanza di accesso agli atti relativi alla valutazione e agli scrutini.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "accesso_atti",
                "ordine": "primaria"
              }
            },
            {
              "id": "verbale-scrutini-primaria",
              "nome": "Verbale / Scheda di valutazione e scrutini",
              "descrizione": "Verbale di valutazione periodica e scrutinio per la scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "scrutini",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "schede-valutazione-primaria",
          "nome": "Schede di valutazione periodica",
          "descrizione": "Schede di valutazione periodica e finale degli apprendimenti.",
          "documenti": [
            {
              "id": "scheda-valutazione-primaria",
              "nome": "Scheda di valutazione periodica – Primaria",
              "descrizione": "Scheda di valutazione periodica degli apprendimenti e del comportamento.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "scrutini",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "certificazione-competenze-primaria",
          "nome": "Certificazione delle competenze",
          "descrizione": "Certificazione delle competenze al termine della scuola primaria (D.M. 742/2017).",
          "documenti": [
            {
              "id": "certificazione-competenze-primaria",
              "nome": "Certificazione delle competenze (D.M. 742/2017)",
              "descrizione": "Modello di certificazione delle competenze per la scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificazione_competenze",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "piani-personalizzati-primaria",
          "nome": "Piani di studio personalizzati",
          "descrizione": "Piani di studio personalizzati e flessibilità didattica.",
          "documenti": [
            {
              "id": "piano-personalizzato-primaria",
              "nome": "Piano di studio personalizzato – Primaria",
              "descrizione": "Proposta di piano di studio personalizzato con flessibilità didattica.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "piano_personalizzato",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "biblioteca-lettura",
          "nome": "Biblioteca e lettura",
          "descrizione": "Prestiti, progetti di lettura e biblioteca scolastica.",
          "documenti": [
            {
              "id": "progetto-lettura-primaria",
              "nome": "Progetto biblioteca e lettura",
              "descrizione": "Scheda progettuale per iniziative di lettura nella scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "biblioteca",
                "ordine": "primaria"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "inclusione-benessere",
      "nome": "Inclusione e benessere",
      "descrizione": "Sostegno, PEI, PDP/BES, assistenza specialistica e sportelli di ascolto.",
      "sotto": [
        {
          "id": "pei-glo-primaria",
          "nome": "PEI e Gestione GLO",
          "descrizione": "Verbali, proposte e gestione del Gruppo di Lavoro Operativo.",
          "documenti": [
            {
              "id": "sostegno-primaria",
              "nome": "Richiesta di sostegno – Scuola Primaria",
              "descrizione": "Domanda di accertamento e assegnazione delle ore di sostegno per la primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "sostegno",
                "ordine": "primaria",
                "scopo_sostegno": "richiesta"
              }
            },
            {
              "id": "verbale-glo-primaria",
              "nome": "Verbale di accoglienza / GLO – Primaria",
              "descrizione": "Modello di verbale di accoglienza e di riunione del GLO per la scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "verbale_glo",
                "ordine": "primaria",
                "scopo_sostegno": "pei"
              }
            },
            {
              "id": "verifica-intermedia-pei-primaria",
              "nome": "Scheda verifica intermedia PEI – Primaria",
              "descrizione": "Prospetto per la verifica intermedia del PEI nella scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pei",
                "ordine": "primaria",
                "scopo_sostegno": "pei"
              }
            },
            {
              "id": "osservazioni-pei-primaria",
              "nome": "Scheda osservazioni PEI – Primaria",
              "descrizione": "Schema di osservazione per il PEI nella scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pei",
                "ordine": "primaria",
                "scopo_sostegno": "pei"
              }
            },
            {
              "id": "pei-primaria",
              "nome": "Proposta PEI – Scuola Primaria",
              "descrizione": "Bozza di proposta PEI per la scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pei",
                "ordine": "primaria",
                "scopo_sostegno": "pei"
              }
            }
          ]
        },
        {
          "id": "pdp-primaria",
          "nome": "PDP (DSA e BES)",
          "descrizione": "Piani Didattici Personalizzati per DSA e BES.",
          "documenti": [
            {
              "id": "pdp-dsa-primaria",
              "nome": "PDP DSA (L. 170/2010) – Primaria",
              "descrizione": "Piano Didattico Personalizzato per alunni con DSA certificati.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pdp_dsa",
                "ordine": "primaria",
                "scopo_sostegno": "pdp_dsa"
              }
            },
            {
              "id": "pdp-bes-primaria",
              "nome": "PDP BES – Primaria",
              "descrizione": "Piano Didattico Personalizzato per alunni con BES non certificati.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pdp_bes",
                "ordine": "primaria",
                "scopo_sostegno": "pdp_bes"
              }
            }
          ]
        },
        {
          "id": "nai-primaria",
          "nome": "Inclusione NAI e Mediatori",
          "descrizione": "Piani personalizzati e progetti di alfabetizzazione per alunni stranieri.",
          "documenti": [
            {
              "id": "piano-nai-primaria",
              "nome": "Piano personalizzato NAI – Primaria",
              "descrizione": "Piano di Studio Personalizzato per alunni NAI non alfabetizzati: scheda di ingresso QCER (A0-B1), laboratorio italiano L2 e progettazione per Assi/Macro-Aree.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "piano_personalizzato_nai",
                "ordine": "primaria"
              }
            },
            {
              "id": "progetto-alfabetizzazione-primaria",
              "nome": "Progetto alfabetizzazione / italiano L2 – Primaria",
              "descrizione": "Progetto di alfabetizzazione e mediazione per alunni NAI.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "progetto_alfabetizzazione",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "relazioni-finali-primaria",
          "nome": "Relazioni e Monitoraggio Finale",
          "descrizione": "Relazioni finali di inclusione e monitoraggio del percorso.",
          "documenti": [
            {
              "id": "relazione-finale-inclusione-primaria",
              "nome": "Relazione finale inclusione – Primaria",
              "descrizione": "Relazione finale di verifica del percorso di inclusione (PEI/PDP): 4 Dimensioni ICF strutturate (D.I. 182/2020), esiti e proposte di transizione (art. 10 D.Lgs. 66/2017).",
              "tipo": "PDF",
              "profilo": {
                "tipo": "relazione_finale_inclusione",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "esoneri-certificazioni",
          "nome": "Certificazioni ed esoneri",
          "descrizione": "Esoneri dall’educazione fisica e certificazioni sanitarie.",
          "documenti": [
            {
              "id": "esonero-educazione-fisica",
              "nome": "Richiesta esonero educazione fisica",
              "descrizione": "Richiesta di esonero dalle attività di educazione fisica con certificato medico.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificazione",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "segnalazioni-mediche-primaria",
          "nome": "Certificati e segnalazioni mediche",
          "descrizione": "Certificati medici, allergie e segnalazioni sanitarie.",
          "documenti": [
            {
              "id": "certificato-medico-primaria",
              "nome": "Certificato medico per attività scolastica",
              "descrizione": "Modello di certificato medico per la partecipazione alle attività.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificazione",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "richiesta-pei-primaria",
          "nome": "Richiesta PEI e aggiornamenti",
          "descrizione": "Compilazione e aggiornamento del PEI nella scuola primaria.",
          "documenti": [
            {
              "id": "richiesta-pei-primaria-doc",
              "nome": "Richiesta compilazione PEI – Primaria",
              "descrizione": "Istanza per la compilazione o la revisione del PEI nella scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pei",
                "ordine": "primaria",
                "scopo_sostegno": "pei"
              }
            }
          ]
        },
        {
          "id": "pdp-bes-primaria",
          "nome": "PDP e BES",
          "descrizione": "Piani Didattici Personalizzati per alunni con BES.",
          "documenti": [
            {
              "id": "pdp-primaria",
              "nome": "Modello PDP – Primaria",
              "descrizione": "Modello di Piano Didattico Personalizzato per la scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pei",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "esoneri-primaria",
          "nome": "Esoneri attività didattiche",
          "descrizione": "Esoneri da educazione fisica e attività per motivi di salute.",
          "documenti": [
            {
              "id": "esonero-primaria",
              "nome": "Richiesta esonero attività – Primaria",
              "descrizione": "Istanza di esonero con certificato medico per la scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificazione",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "trasporto-disabili-primaria",
          "nome": "Trasporto alunni disabili",
          "descrizione": "Trasporto dedicato per alunni con disabilità nella primaria.",
          "documenti": [
            {
              "id": "richiesta-trasporto-disabili-primaria",
              "nome": "Richiesta trasporto dedicato – Primaria",
              "descrizione": "Istanza per il trasporto scolastico dedicato di un alunno con disabilità.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "sostegno",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "assistenza-specialistica-primaria",
          "nome": "Assistenza specialistica (Comune)",
          "descrizione": "Richieste al Comune per l’assistenza specialistica nella primaria.",
          "documenti": [
            {
              "id": "richiesta-assistenza-specialistica-primaria",
              "nome": "Richiesta assistenza specialistica – Primaria",
              "descrizione": "Istanza al Comune per l’assistenza specialistica nella scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "assistenza_comune",
                "ordine": "primaria",
                "scopo_sostegno": "autonomia",
                "destinatario": "comune"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "uscite-viaggi",
      "nome": "Uscite, viaggi e progetti speciali",
      "descrizione": "Uscite didattiche, viaggi di istruzione, PCTO e scambi all’estero.",
      "sotto": [
        {
          "id": "uscite-primaria",
          "nome": "Uscite didattiche e autorizzazioni",
          "descrizione": "Autorizzazioni per uscite didattiche e attività fuori sede.",
          "documenti": [
            {
              "id": "autorizzazione-uscita-primaria",
              "nome": "Autorizzazione uscita didattica – Primaria",
              "descrizione": "Modulo di autorizzazione per le uscite didattiche della scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "uscite_didattiche",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "uscite-gite-primaria",
          "nome": "Uscite e viaggi di istruzione",
          "descrizione": "Consensi e autorizzazioni per uscite didattiche e viaggi di istruzione.",
          "documenti": [
            {
              "id": "consenso-viaggio-primaria",
              "nome": "Consenso uscita didattica / viaggio di istruzione – Primaria",
              "descrizione": "Autorizzazione alla partecipazione a uscite didattiche e viaggi di istruzione.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "uscite_didattiche",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "progetti-fondi-primaria",
          "nome": "Progetti PON / POR / PNRR",
          "descrizione": "Adesioni ai progetti finanziati con fondi nazionali ed europei.",
          "documenti": [
            {
              "id": "adesione-pon-primaria",
              "nome": "Adesione progetto PON / POR / PNRR",
              "descrizione": "Consenso alla partecipazione a progetti finanziati con fondi PON/POR/PNRR.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "progetti_fondi",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "attivita-sportive-primaria",
          "nome": "Liberatorie attività sportive",
          "descrizione": "Liberatorie per la partecipazione ad attività sportive.",
          "documenti": [
            {
              "id": "liberatoria-sport-primaria",
              "nome": "Liberatoria attività sportive – Primaria",
              "descrizione": "Liberatoria per la partecipazione a tornei e attività motorie.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "liberatoria_sport",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "sport-teatro-musica",
          "nome": "Sport, teatro e musica",
          "descrizione": "Attività sportive, teatrali e musicali nella primaria.",
          "documenti": [
            {
              "id": "adesione-sport-primaria",
              "nome": "Adesione attività sportiva – Primaria",
              "descrizione": "Modulo di adesione alle attività sportive scolastiche.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "extracurricolari",
                "ordine": "primaria"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "rapporti-lavoro",
      "nome": "Rapporti di lavoro",
      "descrizione": "Messa a disposizione (MAD), supplenze/interpelli e candidature.",
      "sotto": [
        {
          "id": "mad-primaria",
          "nome": "Messa a disposizione (MAD)",
          "descrizione": "MAD per la scuola primaria.",
          "documenti": [
            {
              "id": "mad-primaria",
              "nome": "Domanda di messa a disposizione (MAD) – Primaria",
              "descrizione": "Modello aggiornato di MAD per insegnamenti nella scuola primaria.",
              "tipo": "PDF",
              "catalogoId": "mad",
              "profilo": {
                "tipo": "mad",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "supplenze-primaria",
          "nome": "Supplenze e interpelli",
          "descrizione": "Domande di supplenza e interpelli per la primaria.",
          "documenti": [
            {
              "id": "supplenza-primaria",
              "nome": "Domanda di supplenza breve – Primaria",
              "descrizione": "Modello di domanda di supplenza breve per la scuola primaria.",
              "tipo": "PDF",
              "catalogoId": "supplenza-breve",
              "profilo": {
                "tipo": "supplenza",
                "ordine": "primaria"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "documenti-famiglia",
      "nome": "Documenti per la famiglia",
      "descrizione": "Autocertificazioni, deleghe, giustificazioni e consensi privacy.",
      "sotto": [
        {
          "id": "autocert-famiglia-primaria",
          "nome": "Autocertificazioni e Stato Famiglia",
          "descrizione": "Dichiarazioni sostitutive e stato di famiglia.",
          "documenti": [
            {
              "id": "dichiarazione-famiglia-primaria",
              "nome": "Dichiarazione stato di famiglia – Primaria",
              "descrizione": "Dichiarazione sostitutiva dello stato di famiglia per la scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "autocertificazione",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "deleghe-ritiro-primaria",
          "nome": "Deleghe e Ritiro Alunni",
          "descrizione": "Delega al ritiro da parte di terzi e uscita autonoma (L. 172/2017).",
          "documenti": [
            {
              "id": "delega-ritiro-primaria",
              "nome": "Delega ritiro alunno (compagni / parenti)",
              "descrizione": "Modulo di delega al ritiro dell’alunno da parte di compagni o parenti.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "delega_famiglia",
                "ordine": "primaria"
              }
            },
            {
              "id": "uscita-autonoma-primaria",
              "nome": "Autorizzazione uscita autonoma (L. 172/2017)",
              "descrizione": "Autorizzazione all’uscita autonoma dell’alunno al termine delle lezioni.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "delega_famiglia",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "assenze-giustif-primaria",
          "nome": "Assenze e Giustificazioni",
          "descrizione": "Permessi orari, giustificazioni e istruzione parentale.",
          "documenti": [
            {
              "id": "permesso-orario-primaria",
              "nome": "Richiesta permesso orario / uscita anticipata",
              "descrizione": "Modulo per entrata posticipata, uscita anticipata o assenza breve.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "permesso_orario",
                "ordine": "primaria"
              }
            },
            {
              "id": "congedo-maternita-primaria",
              "nome": "Congedo di maternità / paternità",
              "descrizione": "Richiesta di congedo obbligatorio di maternità o paternità (D.Lgs. 151/2001).",
              "tipo": "PDF",
              "profilo": {
                "tipo": "congedo_maternita",
                "ordine": "primaria"
              }
            },
            {
              "id": "istruzione-parentale-primaria",
              "nome": "Comunicazione istruzione parentale",
              "descrizione": "Comunicazione dell’intenzione di avvalersi dell’istruzione parentale.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "istruzione_parentale",
                "ordine": "primaria"
              }
            }
          ]
        },
        {
          "id": "accesso-privacy-primaria",
          "nome": "Accesso agli Atti e Privacy",
          "descrizione": "Accesso agli atti (L. 241/1990) e consensi per immagini e dati personali.",
          "documenti": [
            {
              "id": "accesso-atti-primaria",
              "nome": "Richiesta accesso agli atti (L. 241/1990)",
              "descrizione": "Istanza di accesso ai documenti amministrativi della scuola.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "accesso_atti",
                "ordine": "primaria"
              }
            },
            {
              "id": "consenso-foto-primaria",
              "nome": "Consenso foto / video",
              "descrizione": "Consenso al trattamento e alla pubblicazione di immagini e riprese video.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "consenso_foto",
                "ordine": "primaria"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "vita-scolastica",
      "nome": "Vita scolastica e rappresentanze",
      "descrizione": "Assemblee, rappresentanze, ricorsi, reclami e organizzazione.",
      "sotto": [
        {
          "id": "ricorsi-primaria",
          "nome": "Ricorsi e reclami",
          "descrizione": "Reclami e ricorsi relativi alla scuola primaria.",
          "documenti": [
            {
              "id": "ricorso-primaria",
              "nome": "Reclamo alla segreteria – Primaria",
              "descrizione": "Modello di reclamo per disservizi nella scuola primaria.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "autocertificazione",
                "ordine": "primaria"
              }
            }
          ]
        }
      ]
    }
  ]
};

/** Macroarea "Secondaria 1° Grado". */
export const macroAreaSecondaria1: MacroAreaModulistica = {
  "id": "secondaria1",
  "nome": "Secondaria 1° Grado",
  "descrizione": "Modulistica per la scuola secondaria di I grado: orientamento, esami, viaggi e inclusione.",
  "sotto": [
    {
      "id": "ingresso-iscrizioni",
      "nome": "Iscrizioni e primo ingresso",
      "descrizione": "Iscrizioni, scelta della scuola, sezioni e ammissione al grado di studi.",
      "sotto": [
        {
          "id": "iscrizione-medie",
          "nome": "Iscrizione e scelta scuola",
          "descrizione": "Iscrizione alla scuola secondaria di I grado.",
          "documenti": [
            {
              "id": "iscrizione-medie",
              "nome": "Domanda di iscrizione – Secondaria di I grado",
              "descrizione": "Modello di domanda di iscrizione per la scuola secondaria di I grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "secondaria1"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "inclusione-benessere",
      "nome": "Inclusione e benessere",
      "descrizione": "Sostegno, PEI, PDP/BES, assistenza specialistica e sportelli di ascolto.",
      "sotto": [
        {
          "id": "pei-glo-secondaria1",
          "nome": "PEI e Gestione GLO",
          "descrizione": "Verbali, proposte e gestione del Gruppo di Lavoro Operativo.",
          "documenti": [
            {
              "id": "sostegno-medie",
              "nome": "Richiesta di sostegno – Secondaria di I grado",
              "descrizione": "Domanda di accertamento e assegnazione delle ore di sostegno per le medie.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "sostegno",
                "ordine": "secondaria1",
                "scopo_sostegno": "richiesta"
              }
            },
            {
              "id": "verbale-glo-secondaria1",
              "nome": "Verbale GLO / GLHO – Secondaria di I grado",
              "descrizione": "Verbale delle riunioni del GLO per la secondaria di I grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "verbale_glo",
                "ordine": "secondaria1",
                "scopo_sostegno": "pei"
              }
            },
            {
              "id": "proposta-pei-secondaria1",
              "nome": "Proposta PEI – Secondaria di I grado",
              "descrizione": "Bozza di proposta PEI per la secondaria di I grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pei",
                "ordine": "secondaria1",
                "scopo_sostegno": "pei"
              }
            }
          ]
        },
        {
          "id": "pdp-secondaria1",
          "nome": "PDP (DSA e BES)",
          "descrizione": "Piani Didattici Personalizzati per DSA e BES.",
          "documenti": [
            {
              "id": "pdp-dsa-secondaria1",
              "nome": "PDP DSA (L. 170/2010) – Secondaria di I grado",
              "descrizione": "Piano Didattico Personalizzato per alunni con DSA certificati.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pdp_dsa",
                "ordine": "secondaria1",
                "scopo_sostegno": "pdp_dsa"
              }
            },
            {
              "id": "pdp-bes-secondaria1",
              "nome": "PDP BES – Secondaria di I grado",
              "descrizione": "Piano Didattico Personalizzato per alunni con BES non certificati.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pdp_bes",
                "ordine": "secondaria1",
                "scopo_sostegno": "pdp_bes"
              }
            }
          ]
        },
        {
          "id": "nai-secondaria1",
          "nome": "Inclusione NAI e Mediatori",
          "descrizione": "Piani personalizzati e progetti di alfabetizzazione per alunni stranieri.",
          "documenti": [
            {
              "id": "piano-nai-secondaria1",
              "nome": "Piano personalizzato NAI – Secondaria di I grado",
              "descrizione": "Piano di Studio Personalizzato per alunni NAI non alfabetizzati: scheda di ingresso QCER (A0-B1), laboratorio italiano L2 e progettazione per Assi/Macro-Aree.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "piano_personalizzato_nai",
                "ordine": "secondaria1"
              }
            },
            {
              "id": "progetto-alfabetizzazione-secondaria1",
              "nome": "Progetto alfabetizzazione / italiano L2 – Secondaria di I grado",
              "descrizione": "Progetto di alfabetizzazione e mediazione per alunni NAI.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "progetto_alfabetizzazione",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "relazioni-finali-secondaria1",
          "nome": "Relazioni e Monitoraggio Finale",
          "descrizione": "Relazioni finali di inclusione e monitoraggio del percorso.",
          "documenti": [
            {
              "id": "relazione-finale-inclusione-secondaria1",
              "nome": "Relazione finale inclusione – Secondaria di I grado",
              "descrizione": "Relazione finale di verifica del percorso di inclusione (PEI/PDP): 4 Dimensioni ICF strutturate (D.I. 182/2020), esiti e proposte di transizione (art. 10 D.Lgs. 66/2017).",
              "tipo": "PDF",
              "profilo": {
                "tipo": "relazione_finale_inclusione",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "pdp-bes-secondaria1",
          "nome": "PDP e BES",
          "descrizione": "Piani Didattici Personalizzati per alunni con BES.",
          "documenti": [
            {
              "id": "pdp-secondaria1",
              "nome": "Modello PDP – Secondaria di I Grado",
              "descrizione": "Modello di Piano Didattico Personalizzato per la secondaria di I grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pdp_bes",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "segnalazioni-asl-secondaria1",
          "nome": "Segnalazioni ASL",
          "descrizione": "Segnalazioni ai servizi sanitari e richieste di valutazione.",
          "documenti": [
            {
              "id": "segnalazione-asl-secondaria1",
              "nome": "Segnalazione ASL – Secondaria di I Grado",
              "descrizione": "Segnalazione ai servizi sanitari per la valutazione di un alunno.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificazione",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "esoneri-secondaria1",
          "nome": "Esoneri e deroghe",
          "descrizione": "Esoneri da attività didattiche e deroghe per motivi di salute.",
          "documenti": [
            {
              "id": "esonero-secondaria1",
              "nome": "Richiesta esonero – Secondaria di I Grado",
              "descrizione": "Istanza di esonero con certificato medico.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificazione",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "trasporto-disabili-secondaria1",
          "nome": "Trasporto alunni disabili",
          "descrizione": "Trasporto dedicato per alunni con disabilità.",
          "documenti": [
            {
              "id": "richiesta-trasporto-disabili-secondaria1",
              "nome": "Richiesta trasporto dedicato – Secondaria di I Grado",
              "descrizione": "Istanza per il trasporto scolastico dedicato di un alunno con disabilità.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "sostegno",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "sportello-psicologico",
          "nome": "Sportello psicologico e ascolto",
          "descrizione": "Richiesta di colloqui con lo sportello di ascolto.",
          "documenti": [
            {
              "id": "richiesta-colloquio-sportello",
              "nome": "Richiesta colloquio sportello psicologico",
              "descrizione": "Istanza per un colloquio con lo sportello di ascolto scolastico.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "secondaria1"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "esami-carriera",
      "nome": "Esami, carriera e certificazioni",
      "descrizione": "Esami di Stato, orientamento, crediti formativi e certificazioni.",
      "sotto": [
        {
          "id": "esami-medie",
          "nome": "Esame di Stato e scrutini",
          "descrizione": "Documentazione per l’esame di Stato conclusivo del primo ciclo.",
          "documenti": [
            {
              "id": "domanda-esame-medie",
              "nome": "Domanda esame di Stato – I ciclo",
              "descrizione": "Domanda di ammissione e documentazione per l’esame di Stato del I ciclo.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "orientamento",
          "nome": "Orientamento scolastico",
          "descrizione": "Moduli per l’orientamento in uscita dalla secondaria di I grado.",
          "documenti": [
            {
              "id": "richiesta-incontro-orientamento",
              "nome": "Richiesta colloquio di orientamento",
              "descrizione": "Modulo per richiedere un colloquio di orientamento con i docenti.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "cambio-sezione-medie",
          "nome": "Cambio sezione / indirizzo",
          "descrizione": "Richieste di cambio di sezione, indirizzo o corso.",
          "documenti": [
            {
              "id": "cambio-sezione-medie",
              "nome": "Richiesta cambio sezione / indirizzo",
              "descrizione": "Istanza di cambio di sezione, indirizzo o corso di studi.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "cambio_sezione",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "assemblee-studenti-medie",
          "nome": "Assemblee di classe / istituto",
          "descrizione": "Istanza di convocazione di assemblee studentesche.",
          "documenti": [
            {
              "id": "istanza-assemblea-medie",
              "nome": "Istanza assemblea di classe / istituto",
              "descrizione": "Richiesta di convocazione di un’assemblea di classe o d’Istituto.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "assemblea_studenti",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "esonero-tasse-medie",
          "nome": "Esonero tasse e contributi",
          "descrizione": "Esoneri e riduzioni di tasse scolastiche e contributi.",
          "documenti": [
            {
              "id": "esonero-tasse-medie",
              "nome": "Richiesta esonero tasse scolastiche / contributi",
              "descrizione": "Istanza di esonero o riduzione delle tasse scolastiche e dei contributi.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "esonero_tasse",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "ammissione-esami-medie",
          "nome": "Ammissione agli esami",
          "descrizione": "Domande di ammissione agli esami di Stato.",
          "documenti": [
            {
              "id": "ammissione-esami-medie",
              "nome": "Domanda ammissione esami di Stato – I ciclo",
              "descrizione": "Domanda di ammissione all’esame di Stato conclusivo del primo ciclo.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "ammissione_esami",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "crediti-medie",
          "nome": "Crediti scolastici / formativi",
          "descrizione": "Riconoscimento di crediti scolastici e formativi.",
          "documenti": [
            {
              "id": "crediti-medie",
              "nome": "Richiesta riconoscimento crediti scolastici / formativi",
              "descrizione": "Istanza di riconoscimento di crediti formativi e scolastici.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "crediti_scolastici",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "certificati-medie",
          "nome": "Certificati sostitutivi",
          "descrizione": "Certificati di diploma e copie conformi.",
          "documenti": [
            {
              "id": "certificato-diploma-medie",
              "nome": "Richiesta certificato sostitutivo diploma",
              "descrizione": "Istanza di rilascio di certificato o copia conforme del diploma.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificato_diploma",
                "ordine": "secondaria1"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "uscite-viaggi",
      "nome": "Uscite, viaggi e progetti speciali",
      "descrizione": "Uscite didattiche, viaggi di istruzione, PCTO e scambi all’estero.",
      "sotto": [
        {
          "id": "uscite-medie",
          "nome": "Uscite didattiche e autorizzazioni",
          "descrizione": "Autorizzazioni per uscite didattiche e viaggi di istruzione.",
          "documenti": [
            {
              "id": "autorizzazione-uscita-medie",
              "nome": "Autorizzazione uscita didattica – Secondaria di I grado",
              "descrizione": "Modulo di autorizzazione per le uscite didattiche delle medie.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "uscite_didattiche",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "viaggi-nazionali",
          "nome": "Viaggi nazionali",
          "descrizione": "Autorizzazioni per viaggi in Italia.",
          "documenti": [
            {
              "id": "autorizzazione-viaggio-nazionale",
              "nome": "Autorizzazione viaggio di istruzione nazionale",
              "descrizione": "Modulo di autorizzazione per viaggi di istruzione in Italia.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "uscite_didattiche",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "viaggi-estero",
          "nome": "Viaggi all’estero",
          "descrizione": "Autorizzazioni con dati del documento di identità.",
          "documenti": [
            {
              "id": "autorizzazione-viaggio-estero",
              "nome": "Autorizzazione viaggio di istruzione all’estero",
              "descrizione": "Modulo di autorizzazione con dati del documento di identità.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "uscite_didattiche",
                "ordine": "secondaria1"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "rapporti-lavoro",
      "nome": "Rapporti di lavoro",
      "descrizione": "Messa a disposizione (MAD), supplenze/interpelli e candidature.",
      "sotto": [
        {
          "id": "mad-medie",
          "nome": "Messa a disposizione (MAD)",
          "descrizione": "MAD per la secondaria di I grado.",
          "documenti": [
            {
              "id": "mad-medie",
              "nome": "Domanda di messa a disposizione (MAD) – Secondaria di I grado",
              "descrizione": "Modello aggiornato di MAD per insegnamenti nelle scuole medie.",
              "tipo": "PDF",
              "catalogoId": "mad",
              "profilo": {
                "tipo": "mad",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "supplenze-medie",
          "nome": "Supplenze e interpelli",
          "descrizione": "Domande di supplenza e interpelli per la secondaria di I grado.",
          "documenti": [
            {
              "id": "supplenza-medie",
              "nome": "Domanda di supplenza breve – Secondaria di I grado",
              "descrizione": "Modello di domanda di supplenza breve per le scuole medie.",
              "tipo": "PDF",
              "catalogoId": "supplenza-breve",
              "profilo": {
                "tipo": "supplenza",
                "ordine": "secondaria1"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "documenti-famiglia",
      "nome": "Documenti per la famiglia",
      "descrizione": "Autocertificazioni, deleghe, giustificazioni e consensi privacy.",
      "sotto": [
        {
          "id": "autocert-famiglia-secondaria1",
          "nome": "Autocertificazioni e Stato Famiglia",
          "descrizione": "Dichiarazioni sostitutive e stato di famiglia.",
          "documenti": [
            {
              "id": "dichiarazione-famiglia-medie",
              "nome": "Dichiarazione stato di famiglia – Secondaria di I grado",
              "descrizione": "Dichiarazione sostitutiva dello stato di famiglia per la scuola secondaria di I grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "autocertificazione",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "deleghe-ritiro-secondaria1",
          "nome": "Deleghe e Ritiro Alunni",
          "descrizione": "Delega al ritiro da parte di terzi e uscita autonoma (L. 172/2017).",
          "documenti": [
            {
              "id": "delega-ritiro-medie",
              "nome": "Delega ritiro alunno (compagni / parenti)",
              "descrizione": "Modulo di delega al ritiro dell’alunno da parte di compagni o parenti.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "delega_famiglia",
                "ordine": "secondaria1"
              }
            },
            {
              "id": "uscita-autonoma-medie",
              "nome": "Autorizzazione uscita autonoma (L. 172/2017)",
              "descrizione": "Autorizzazione all’uscita autonoma dell’alunno al termine delle lezioni.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "delega_famiglia",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "assenze-giustif-secondaria1",
          "nome": "Assenze e Giustificazioni",
          "descrizione": "Permessi orari, giustificazioni, esoneri e istruzione parentale.",
          "documenti": [
            {
              "id": "permesso-orario-medie",
              "nome": "Richiesta permesso orario / uscita anticipata",
              "descrizione": "Modulo per entrata posticipata, uscita anticipata o assenza breve.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "permesso_orario",
                "ordine": "secondaria1"
              }
            },
            {
              "id": "congedo-maternita-medie",
              "nome": "Congedo di maternità / paternità",
              "descrizione": "Richiesta di congedo obbligatorio di maternità o paternità (D.Lgs. 151/2001).",
              "tipo": "PDF",
              "profilo": {
                "tipo": "congedo_maternita",
                "ordine": "secondaria1"
              }
            },
            {
              "id": "esonero-scienze-motorie-medie",
              "nome": "Richiesta esonero scienze motorie",
              "descrizione": "Richiesta di esonero dalle attività di scienze motorie con certificato medico.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "esonero_motoria",
                "ordine": "secondaria1"
              }
            },
            {
              "id": "istruzione-parentale-medie",
              "nome": "Comunicazione istruzione parentale",
              "descrizione": "Comunicazione dell’intenzione di avvalersi dell’istruzione parentale.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "istruzione_parentale",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "accesso-privacy-secondaria1",
          "nome": "Accesso agli Atti e Privacy",
          "descrizione": "Accesso agli atti (L. 241/1990) e consensi per immagini e dati personali.",
          "documenti": [
            {
              "id": "accesso-atti-medie",
              "nome": "Richiesta accesso agli atti (L. 241/1990)",
              "descrizione": "Istanza di accesso ai documenti amministrativi della scuola.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "accesso_atti",
                "ordine": "secondaria1"
              }
            },
            {
              "id": "consenso-foto-medie",
              "nome": "Consenso foto / video",
              "descrizione": "Consenso al trattamento e alla pubblicazione di immagini e riprese video.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "consenso_foto",
                "ordine": "secondaria1"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "vita-scolastica",
      "nome": "Vita scolastica e rappresentanze",
      "descrizione": "Assemblee, rappresentanze, ricorsi, reclami e organizzazione.",
      "sotto": [
        {
          "id": "ricorsi-secondaria1",
          "nome": "Ricorsi e reclami",
          "descrizione": "Reclami e ricorsi relativi alla secondaria di I grado.",
          "documenti": [
            {
              "id": "ricorso-secondaria1",
              "nome": "Reclamo alla segreteria – Secondaria di I Grado",
              "descrizione": "Modello di reclamo per disservizi nella secondaria di I grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "autocertificazione",
                "ordine": "secondaria1"
              }
            }
          ]
        },
        {
          "id": "assemblee-rappresentanze",
          "nome": "Assemblee e rappresentanze",
          "descrizione": "Assemblee di classe, rappresentanti e organi collegiali.",
          "documenti": [
            {
              "id": "candidatura-rappresentante",
              "nome": "Candidatura rappresentante di classe",
              "descrizione": "Modulo di candidatura a rappresentante dei genitori.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "autocertificazione",
                "ordine": "secondaria1"
              }
            }
          ]
        }
      ]
    }
  ]
};

/** Macroarea "Secondaria 2° Grado". */
export const macroAreaSecondaria2: MacroAreaModulistica = {
  "id": "secondaria2",
  "nome": "Secondaria 2° Grado",
  "descrizione": "Modulistica per la scuola secondaria di II grado: PCTO, esami, orientamento e inclusione.",
  "sotto": [
    {
      "id": "ingresso-iscrizioni",
      "nome": "Iscrizioni e primo ingresso",
      "descrizione": "Iscrizioni, scelta della scuola, sezioni e ammissione al grado di studi.",
      "sotto": [
        {
          "id": "iscrizione-superiori",
          "nome": "Iscrizione e scelta scuola",
          "descrizione": "Iscrizione alla scuola secondaria di II grado.",
          "documenti": [
            {
              "id": "iscrizione-superiori",
              "nome": "Domanda di iscrizione – Secondaria di II grado",
              "descrizione": "Modello di domanda di iscrizione per la scuola secondaria di II grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "secondaria2"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "inclusione-benessere",
      "nome": "Inclusione e benessere",
      "descrizione": "Sostegno, PEI, PDP/BES, assistenza specialistica e sportelli di ascolto.",
      "sotto": [
        {
          "id": "pei-glo-secondaria2",
          "nome": "PEI e Gestione GLO",
          "descrizione": "Verbali, proposte e gestione del Gruppo di Lavoro Operativo.",
          "documenti": [
            {
              "id": "sostegno-superiori",
              "nome": "Richiesta di sostegno – Secondaria di II grado",
              "descrizione": "Domanda di accertamento e assegnazione delle ore di sostegno per le superiori.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "sostegno",
                "ordine": "secondaria2",
                "scopo_sostegno": "richiesta"
              }
            },
            {
              "id": "verbale-glo-secondaria2",
              "nome": "Verbale GLO / GLHO – Secondaria di II grado",
              "descrizione": "Verbale delle riunioni del GLO per la secondaria di II grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "verbale_glo",
                "ordine": "secondaria2",
                "scopo_sostegno": "pei"
              }
            },
            {
              "id": "proposta-pei-secondaria2",
              "nome": "Proposta PEI – Secondaria di II grado",
              "descrizione": "Bozza di proposta PEI per la secondaria di II grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pei",
                "ordine": "secondaria2",
                "scopo_sostegno": "pei"
              }
            }
          ]
        },
        {
          "id": "pdp-secondaria2",
          "nome": "PDP (DSA e BES)",
          "descrizione": "Piani Didattici Personalizzati per DSA e BES.",
          "documenti": [
            {
              "id": "pdp-dsa-secondaria2",
              "nome": "PDP DSA (L. 170/2010) – Secondaria di II grado",
              "descrizione": "Piano Didattico Personalizzato per alunni con DSA certificati.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pdp_dsa",
                "ordine": "secondaria2",
                "scopo_sostegno": "pdp_dsa"
              }
            },
            {
              "id": "pdp-bes-secondaria2",
              "nome": "PDP BES – Secondaria di II grado",
              "descrizione": "Piano Didattico Personalizzato per alunni con BES non certificati.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pdp_bes",
                "ordine": "secondaria2",
                "scopo_sostegno": "pdp_bes"
              }
            }
          ]
        },
        {
          "id": "nai-secondaria2",
          "nome": "Inclusione NAI e Mediatori",
          "descrizione": "Piani personalizzati e progetti di alfabetizzazione per alunni stranieri.",
          "documenti": [
            {
              "id": "piano-nai-secondaria2",
              "nome": "Piano personalizzato NAI – Secondaria di II grado",
              "descrizione": "Piano di Studio Personalizzato per alunni NAI non alfabetizzati: scheda di ingresso QCER (A0-B1), laboratorio italiano L2 e progettazione per Assi/Macro-Aree.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "piano_personalizzato_nai",
                "ordine": "secondaria2"
              }
            },
            {
              "id": "progetto-alfabetizzazione-secondaria2",
              "nome": "Progetto alfabetizzazione / italiano L2 – Secondaria di II grado",
              "descrizione": "Progetto di alfabetizzazione e mediazione per alunni NAI.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "progetto_alfabetizzazione",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "relazioni-finali-secondaria2",
          "nome": "Relazioni e Monitoraggio Finale",
          "descrizione": "Relazioni finali di inclusione e monitoraggio del percorso.",
          "documenti": [
            {
              "id": "relazione-finale-inclusione-secondaria2",
              "nome": "Relazione finale inclusione – Secondaria di II grado",
              "descrizione": "Relazione finale di verifica del percorso di inclusione (PEI/PDP): 4 Dimensioni ICF strutturate (D.I. 182/2020), esiti e proposte di transizione (art. 10 D.Lgs. 66/2017).",
              "tipo": "PDF",
              "profilo": {
                "tipo": "relazione_finale_inclusione",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "pdp-bes-secondaria2",
          "nome": "PDP e BES",
          "descrizione": "Piani Didattici Personalizzati per alunni con BES.",
          "documenti": [
            {
              "id": "pdp-secondaria2",
              "nome": "Modello PDP – Secondaria di II Grado",
              "descrizione": "Modello di Piano Didattico Personalizzato per la secondaria di II grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "pdp_bes",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "esoneri-secondaria2",
          "nome": "Esoneri e deroghe",
          "descrizione": "Esoneri da attività didattiche e deroghe per motivi di salute.",
          "documenti": [
            {
              "id": "esonero-secondaria2",
              "nome": "Richiesta esonero – Secondaria di II Grado",
              "descrizione": "Istanza di esonero con certificato medico.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificazione",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "sportello-psicologico-secondaria2",
          "nome": "Sportello psicologico e ascolto",
          "descrizione": "Richiesta di colloqui con lo sportello di ascolto.",
          "documenti": [
            {
              "id": "richiesta-colloquio-sportello-secondaria2",
              "nome": "Richiesta colloquio sportello psicologico",
              "descrizione": "Istanza per un colloquio con lo sportello di ascolto scolastico.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "secondaria2"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "esami-carriera",
      "nome": "Esami, carriera e certificazioni",
      "descrizione": "Esami di Stato, orientamento, crediti formativi e certificazioni.",
      "sotto": [
        {
          "id": "esami-superiori",
          "nome": "Esame di Stato",
          "descrizione": "Documentazione per l’esame di Stato del secondo ciclo.",
          "documenti": [
            {
              "id": "domanda-esame-superiori",
              "nome": "Domanda esame di Stato – II ciclo",
              "descrizione": "Domanda di ammissione e documentazione per l’esame di Stato del II ciclo.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "certificazioni-crediti",
          "nome": "Certificazioni e crediti",
          "descrizione": "Certificazioni delle competenze e riconoscimento crediti.",
          "documenti": [
            {
              "id": "richiesta-crediti",
              "nome": "Richiesta riconoscimento crediti formativi",
              "descrizione": "Istanza di riconoscimento dei crediti formativi per le superiori.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "crediti_formativi",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "cambio-sezione-superiori",
          "nome": "Cambio sezione / indirizzo",
          "descrizione": "Richieste di cambio di sezione, indirizzo o corso.",
          "documenti": [
            {
              "id": "cambio-sezione-superiori",
              "nome": "Richiesta cambio sezione / indirizzo",
              "descrizione": "Istanza di cambio di sezione, indirizzo o corso di studi.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "cambio_sezione",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "assemblee-studenti-superiori",
          "nome": "Assemblee di classe / istituto",
          "descrizione": "Istanza di convocazione di assemblee studentesche.",
          "documenti": [
            {
              "id": "istanza-assemblea-superiori",
              "nome": "Istanza assemblea di classe / istituto",
              "descrizione": "Richiesta di convocazione di un’assemblea di classe o d’Istituto.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "assemblea_studenti",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "esonero-tasse-superiori",
          "nome": "Esonero tasse e contributi",
          "descrizione": "Esoneri e riduzioni di tasse scolastiche e contributi.",
          "documenti": [
            {
              "id": "esonero-tasse-superiori",
              "nome": "Richiesta esonero tasse scolastiche / contributi",
              "descrizione": "Istanza di esonero o riduzione delle tasse scolastiche e dei contributi.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "esonero_tasse",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "ammissione-esami-superiori",
          "nome": "Ammissione agli esami",
          "descrizione": "Domande di ammissione agli esami di Stato.",
          "documenti": [
            {
              "id": "ammissione-esami-superiori",
              "nome": "Domanda ammissione esami di Stato – II ciclo",
              "descrizione": "Domanda di ammissione all’esame di Stato conclusivo del secondo ciclo.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "ammissione_esami",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "crediti-superiori",
          "nome": "Crediti scolastici / formativi",
          "descrizione": "Riconoscimento di crediti scolastici e formativi.",
          "documenti": [
            {
              "id": "crediti-superiori",
              "nome": "Richiesta riconoscimento crediti scolastici / formativi",
              "descrizione": "Istanza di riconoscimento di crediti formativi e scolastici.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "crediti_scolastici",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "certificati-superiori",
          "nome": "Certificati sostitutivi",
          "descrizione": "Certificati di diploma e copie conformi.",
          "documenti": [
            {
              "id": "certificato-diploma-superiori",
              "nome": "Richiesta certificato sostitutivo diploma",
              "descrizione": "Istanza di rilascio di certificato o copia conforme del diploma.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "certificato_diploma",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "orientamento-universitario",
          "nome": "Orientamento in uscita",
          "descrizione": "Orientamento universitario, saloni e test di ingresso.",
          "documenti": [
            {
              "id": "richiesta-orientamento-universitario",
              "nome": "Richiesta incontro orientamento universitario",
              "descrizione": "Modulo per richiedere un incontro di orientamento universitario.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "secondaria2"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "uscite-viaggi",
      "nome": "Uscite, viaggi e progetti speciali",
      "descrizione": "Uscite didattiche, viaggi di istruzione, PCTO e scambi all’estero.",
      "sotto": [
        {
          "id": "pcto",
          "nome": "PCTO e uscite didattiche",
          "descrizione": "Convenzioni PCTO, autorizzazioni uscite e viaggi di istruzione.",
          "documenti": [
            {
              "id": "autorizzazione-pcto",
              "nome": "Autorizzazione uscita didattica / PCTO – Secondaria di II grado",
              "descrizione": "Modulo di autorizzazione per uscite e attività PCTO delle superiori.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "uscite_didattiche",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "convenzioni-pcto",
          "nome": "Convenzioni con le aziende",
          "descrizione": "Istanze di convenzione per i percorsi PCTO.",
          "documenti": [
            {
              "id": "richiesta-convenzione-pcto",
              "nome": "Richiesta convenzione PCTO con azienda",
              "descrizione": "Istanza per la stipula della convenzione PCTO con un’azienda.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "valutazione-pcto",
          "nome": "Valutazione e certificazione",
          "descrizione": "Certificazione delle competenze acquisite nel PCTO.",
          "documenti": [
            {
              "id": "certificato-competenze-pcto",
              "nome": "Certificazione delle competenze PCTO",
              "descrizione": "Modello per la certificazione delle competenze acquisite nel PCTO.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "autocertificazione",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "scambi-estero",
          "nome": "Scambi e progetti all’estero",
          "descrizione": "Scambi scolastici, soggiorni linguistici e progetti europei.",
          "documenti": [
            {
              "id": "adesione-scambio-estero",
              "nome": "Adesione scambio scolastico all’estero",
              "descrizione": "Modulo di adesione a uno scambio o soggiorno linguistico.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "iscrizione",
                "ordine": "secondaria2"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "rapporti-lavoro",
      "nome": "Rapporti di lavoro",
      "descrizione": "Messa a disposizione (MAD), supplenze/interpelli e candidature.",
      "sotto": [
        {
          "id": "mad-superiori",
          "nome": "Messa a disposizione (MAD)",
          "descrizione": "MAD per la secondaria di II grado.",
          "documenti": [
            {
              "id": "mad-superiori",
              "nome": "Domanda di messa a disposizione (MAD) – Secondaria di II grado",
              "descrizione": "Modello aggiornato di MAD per insegnamenti nelle scuole superiori.",
              "tipo": "PDF",
              "catalogoId": "mad",
              "profilo": {
                "tipo": "mad",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "supplenze-superiori",
          "nome": "Supplenze e interpelli",
          "descrizione": "Domande di supplenza e interpelli per la secondaria di II grado.",
          "documenti": [
            {
              "id": "supplenza-superiori",
              "nome": "Domanda di supplenza breve – Secondaria di II grado",
              "descrizione": "Modello di domanda di supplenza breve per le scuole superiori.",
              "tipo": "PDF",
              "catalogoId": "supplenza-breve",
              "profilo": {
                "tipo": "supplenza",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "candidature",
          "nome": "Candidature",
          "descrizione": "Lettere e documenti per candidarsi presso le istituzioni scolastiche.",
          "documenti": [
            {
              "id": "lettera-presentazione",
              "nome": "Lettera di presentazione",
              "descrizione": "Template professionale per presentare la tua candidatura alle istituzioni scolastiche.",
              "tipo": "PDF",
              "catalogoId": "lettera-presentazione",
              "profilo": {
                "tipo": "lettera",
                "ordine": "secondaria2"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "documenti-famiglia",
      "nome": "Documenti per la famiglia",
      "descrizione": "Autocertificazioni, deleghe, giustificazioni e consensi privacy.",
      "sotto": [
        {
          "id": "autocert-famiglia-secondaria2",
          "nome": "Autocertificazioni e Stato Famiglia",
          "descrizione": "Dichiarazioni sostitutive e stato di famiglia.",
          "documenti": [
            {
              "id": "dichiarazione-famiglia-superiori",
              "nome": "Dichiarazione stato di famiglia – Secondaria di II grado",
              "descrizione": "Dichiarazione sostitutiva dello stato di famiglia per la scuola secondaria di II grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "autocertificazione",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "deleghe-ritiro-secondaria2",
          "nome": "Deleghe e Ritiro Alunni",
          "descrizione": "Delega al ritiro da parte di terzi e uscita autonoma (L. 172/2017).",
          "documenti": [
            {
              "id": "delega-ritiro-superiori",
              "nome": "Delega ritiro alunno (compagni / parenti)",
              "descrizione": "Modulo di delega al ritiro dell’alunno da parte di compagni o parenti.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "delega_famiglia",
                "ordine": "secondaria2"
              }
            },
            {
              "id": "uscita-autonoma-superiori",
              "nome": "Autorizzazione uscita autonoma (L. 172/2017)",
              "descrizione": "Autorizzazione all’uscita autonoma dell’alunno al termine delle lezioni.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "delega_famiglia",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "assenze-giustif-secondaria2",
          "nome": "Assenze e Giustificazioni",
          "descrizione": "Permessi orari, giustificazioni, esoneri e istruzione parentale.",
          "documenti": [
            {
              "id": "permesso-orario-superiori",
              "nome": "Richiesta permesso orario / uscita anticipata",
              "descrizione": "Modulo per entrata posticipata, uscita anticipata o assenza breve.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "permesso_orario",
                "ordine": "secondaria2"
              }
            },
            {
              "id": "congedo-maternita-superiori",
              "nome": "Congedo di maternità / paternità",
              "descrizione": "Richiesta di congedo obbligatorio di maternità o paternità (D.Lgs. 151/2001).",
              "tipo": "PDF",
              "profilo": {
                "tipo": "congedo_maternita",
                "ordine": "secondaria2"
              }
            },
            {
              "id": "esonero-scienze-motorie-superiori",
              "nome": "Richiesta esonero scienze motorie",
              "descrizione": "Richiesta di esonero dalle attività di scienze motorie con certificato medico.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "esonero_motoria",
                "ordine": "secondaria2"
              }
            },
            {
              "id": "istruzione-parentale-superiori",
              "nome": "Comunicazione istruzione parentale",
              "descrizione": "Comunicazione dell’intenzione di avvalersi dell’istruzione parentale.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "istruzione_parentale",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "accesso-privacy-secondaria2",
          "nome": "Accesso agli Atti e Privacy",
          "descrizione": "Accesso agli atti (L. 241/1990) e consensi per immagini e dati personali.",
          "documenti": [
            {
              "id": "accesso-atti-superiori",
              "nome": "Richiesta accesso agli atti (L. 241/1990)",
              "descrizione": "Istanza di accesso ai documenti amministrativi della scuola.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "accesso_atti",
                "ordine": "secondaria2"
              }
            },
            {
              "id": "consenso-foto-superiori",
              "nome": "Consenso foto / video",
              "descrizione": "Consenso al trattamento e alla pubblicazione di immagini e riprese video.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "consenso_foto",
                "ordine": "secondaria2"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "vita-scolastica",
      "nome": "Vita scolastica e rappresentanze",
      "descrizione": "Assemblee, rappresentanze, ricorsi, reclami e organizzazione.",
      "sotto": [
        {
          "id": "ricorsi-secondaria2",
          "nome": "Ricorsi e reclami",
          "descrizione": "Reclami e ricorsi relativi alla secondaria di II grado.",
          "documenti": [
            {
              "id": "ricorso-secondaria2",
              "nome": "Reclamo alla segreteria – Secondaria di II Grado",
              "descrizione": "Modello di reclamo per disservizi nella secondaria di II grado.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "ricorso_reclamo",
                "ordine": "secondaria2"
              }
            }
          ]
        },
        {
          "id": "assemblee-studenti",
          "nome": "Assemblee studentesche",
          "descrizione": "Convocazioni, assemblee e rappresentanze studentesche.",
          "documenti": [
            {
              "id": "convocazione-assemblea-studenti",
              "nome": "Convocazione assemblea studentesca",
              "descrizione": "Modello di convocazione dell’assemblea studentesca.",
              "tipo": "PDF",
              "profilo": {
                "tipo": "autocertificazione",
                "ordine": "secondaria2"
              }
            }
          ]
        }
      ]
    }
  ]
};
