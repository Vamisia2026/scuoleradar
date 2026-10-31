// scripts/table-reporter.ts
//
// Table Reporter — v10
//   • FIX v10 — Robustezza per portali USR Piemonte (pagine PHP legacy):
//       - Rilevamento header anche dalla prima riga di <td> (le tabelle
//         Piemonte spesso non hanno <thead>).
//       - Mappatura colonne più flessibile con pattern multipli e
//         fallback posizionali.
//       - Rilevamento dinamico della colonna "Stato" analizzando i valori
//         delle celle (cerca "aperto"/"chiuso").
//       - Filtro stato: se non c'è colonna stato, controlla l'intera riga
//         per "aperto" e assenza di "chiuso"/"cancellato".
//       - Estrazione codice meccanografico e scadenza da QUALSIASI cella,
//         non solo dalla prima.
//       - Log di debug opzionali (DEBUG=1) per ispezionare header e colonne.
//   • FIX v9 — Filtro STATO INTERPELLO dedicato + lettura orizzontale rigida.
//   • FIX #1 — Forzatura assoluta della scadenza (v8).
//   • FIX #2 — Eliminazione totale degli "EE" (v8).
//   • FIX #3 — Nome scuola pulito (v8).
//   • FIX #4 — Ingestione Master Liguria (v8).
//   • Auto-disattivazione target inutili (v6) preservata.
//   • Cleanup iniziale Umbria (v6) preservato.
//   • Anti-spam Sindacale & Rumore — Zero Tolleranza (v5).
//   • Pre-check Strutturale (v4) + Filtro Chiusi / Link attivo (v3).
//
// VERSIONE v11 (22/10/2026) — filtro regioni per verifiche mirate:
//   `npx tsx scripts/table-reporter.ts --regioni=Piemonte,Liguria`
//   limita i target a quelle regioni: serve a validare una correzione di
//   sorgente (es. il passaggio Piemonte `/interpello2025/` → `/interpello2026/`)
//   senza riscrivere gli interpelli delle altre regioni in produzione.
//
//   • FIX v11 — parser allineati ai portali 2026: Piemonte (le righe non hanno
//     <a>, l'azione è un submit POST «Stampa <progr>»: `source_url` diventa
//     `<pagina>#progr=<n>`) e Liguria (lista servita come griglia di <div>
//     `results-row`, non più come <table>).
//
// VERSIONE v12 (22/10/2026) — codici di classe e griglia nazionale Liguria:
//   • FIX v12 — `A041`/`A026`/`A048` diventavano `GENERALE`. Il pattern v11
//     del codice di classe (`[A-Za-z]{2,6}[0-9]{0,2}`) pretendeva almeno DUE
//     lettere: le classi del secondo grado scritte come «A041 - Scienze e
//     tecnologie informatiche» non passavano e ricadevano su
//     `extractSubjectAndClass` → `GENERALE` (misurato: 17 righe Piemonte e 33
//     Liguria incapaci di fare match). Ora il codice è riconosciuto in TRE
//     forme: 4-6 lettere (AAAA, ADEE, AAIRC), 2 lettere + 2 cifre (AA24, BD02)
//     e 1 lettera + 2/3 cifre (A026, A041).
//   • FIX v12 — la griglia Liguria ha DUE layout: per provincia (5 celle, la
//     scadenza è la cella «Scadenza») e nazionale (7 celle: Data · Regione ·
//     Provincia · Scuola · CDC · Interpello · Azione). Il layout nazionale
//     veniva letto con le colonne del primo: `school_name` = «Puglia»,
//     `province` = 'EE', `deadline` inventata. Ora il layout si rileva dagli
//     header e ogni riga prende la provincia reale (città → codice dal
//     catalogo) e la data dopo l'etichetta «Scadenza:».
//
// VERSIONE v13 (22/10/2026) — la SCADENZA è solo quella dichiarata (§26.75):
//   • FIX v13 — la tabella Piemonte ha 12 colonne: «Durata Supplenza» (30 Giugno,
//     04 Febbraio, «fino a 10 giorni») e «Data Interpello» (07/10/2027, la FINE
//     dell'incarico) non sono scadenze di candidatura. Il vecchio fallback
//     «cerca QUALSIASI data futura in qualsiasi cella» pescava quelle date e la
//     riga risultava aperta fino all'anno dopo. Ora la scadenza si legge SOLO
//     dalla colonna mappata o da una cella che scrive «Scadenza:».
//   • FIX v13 — caduti i due ripieghi che INVENTAVANO una data: `oggi + 15
//     giorni` (tabelle senza colonna scadenza) e «data di pubblicazione + 15»
//     (griglia Liguria senza etichetta). Una riga senza scadenza dichiarata si
//     scarta: niente più badge verdi «In corso» su avvisi che nessuno ha datato.
//
// VERSIONE v15 (22/10/2026) — PIEMONTE: decide la SCADENZA, non lo stato (§26.79):
//   • FIX v15 — su `servizi.istruzionepiemonte.it` la stessa URL restituisce, a
//     minuti di distanza, due snapshot con le STESSE 221 righe e la colonna
//     «Stato interpello» ribaltata: 7 aperte / 202 chiuse, oppure 139 aperte / 70
//     chiuse. Nel secondo le 139 «aperte» hanno la scadenza già passata e le 7
//     con scadenza futura sono marcate «chiuso». Su TO le righe «aperto» sono
//     variate 58→471 in cinque fetch, mentre quelle entro l'orizzonte restavano
//     43. Per i target tabellari Piemonte il flag di stato viene quindi ignorato
//     (si scarta solo una cancellazione esplicita): conta la scadenza
//     dichiarata, già filtrata da `isExpired` e dall'orizzonte (§26.75).
//     Effetto: ingestione deterministica (VB 7, TO 43, AL 39 su qualunque
//     snapshot) invece di 0 record quando capitava il backend con lo stato fermo.
//
// VERSIONE v17 (30/10/2026) — la SCADENZA DICHIARATA non si butta via (§26.114):
//   • FIX v17 — l'orizzonte dei 15 giorni della VETRINA era applicato anche
//     all'INGESTIONE: una riga con scadenza oltre i 15 giorni non entrava nel
//     database, quindi non esisteva più per nessuno (né per la bacheca pubblica,
//     che dal §26.100 mostra senza tetto, né per un secondo giro). Misurato il
//     30/10/2026 sul portale USR Piemonte: tutte le righe di Asti ancora «aperte»
//     dichiarano `Data Scadenza Interpello = 2027-04-30` (segnaposto «disponibile
//     fino a 10 giorni») e venivano scartate — zero opportunità AT, mentre
//     Alessandria con scadenze ravvicinate ne produceva 4. Ora l'ingestione usa
//     `GIORNI_ORIZZONTE_INGESTIONE` (365 giorni, `src/lib/scadenza.ts`): il
//     database conserva la data dichiarata, feed e matching continuano a
//     lavorare dentro i 15 giorni (§26.82) e la bacheca pubblica mostra le
//     scadenze lontane con la banda blu (§26.100).
//
// Legge i target da discovered_links (status = 'active_crawler'),
// estrae le righe delle tabelle interpelli e fa upsert su interpelli.
//
// Dipendenze: @supabase/supabase-js, cheerio, dotenv
// Uso: npx tsx scripts/table-reporter.ts
//      npx tsx scripts/table-reporter.ts --regioni=Piemonte,Liguria
//      npx tsx scripts/table-reporter.ts --regioni=Piemonte,Liguria --dry-run
//        (dry-run: stampa i record estratti senza scrivere su Supabase)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

// FIX v12 — la griglia nazionale Liguria nomina la provincia per esteso
// («Taranto», «Reggio Calabria»): il codice e la regione si leggono dal
// catalogo condiviso, senza tabelle duplicate nello script.
import { provinciaDaCitta, provinciaDaCodice } from '../src/lib/scanTargets.ts';
// FIX v13 — l'orizzonte della scadenza è UNO solo, ma non è quello della vetrina:
// l'ingestione conserva la data DICHIARATA dalla fonte entro un anno
// (`GIORNI_ORIZZONTE_INGESTIONE`, §26.114) — feed e matching continuano a
// lavorare dentro i 15 giorni (`GIORNI_ORIZZONTE_OPPORTUNITA`, §26.82).
import { GIORNI_ORIZZONTE_INGESTIONE } from '../src/lib/scadenza.ts';
// Pre-filtro semantico condiviso col discovery engine: atti di gara, circolari
// per le famiglie e burocrazia del personale si scartano PRIMA del parsing.
import { isAdministrativeNoise } from '../src/lib/noiseFilter.ts';
// Lettura euristica universale (§26.84): layout e voci della pagina così come
// li vede un lettore che non conosce il portale — il segnale di quarantena per
// le sorgenti che nessun parser specifico spiega.
import {
  parseUniversalHtml,
  type ExtractedInterpello,
  type UniversalExtractionResult,
} from '../src/lib/universalEuristica.ts';
// Whitelist nazionale (§26.93): le fonti verificate del registro (hub USR/USP di
// ogni regione) diventano target del giro `--nazionale`, senza aspettare che la
// coda `discovered_links` sia stata seminata a mano.
import { targetWhitelist } from '../src/scraper/whitelistTargets.ts';
// §26.101 — SGRANATURA: quali voci di un elenco sono AVVISI da aprire (mai la
// home, mai una sezione: §26.99) e quanti documenti si concedono per elenco,
// per giro e per istituto. I tetti arrivano dall'ambiente, non dal codice.
import { finestraElenco, limitiSgranatura, vociDaSgranare } from '../src/scraper/sgranatura.ts';

// Nome dell'istituto scritto dalla fonte accanto al codice: serve alla lettura
// adattiva degli elenchi, dove la scuola è nel titolo dell'avviso.
import { scuolaDaRiga } from '../src/scraper/scuolaDaRiga.ts';
// `schools_master` (§26.88): codice meccanografico → istituto CERTIFICATO
// dall'anagrafica MIM (nome, PEO/PEC, `SITOWEBSCUOLA`). Serve alla lettura
// profonda delle tabelle UST, dove la fonte scrive un codice e un nome
// abbreviato; senza certificazione la riga non entra (meglio nessun avviso che
// un avviso di una scuola che non esiste).
import { caricaAnagrafica } from '../src/lib/anagraficaIndice.ts';
import {
  scuolaCertificata,
  scuoleDaTesto,
  urlUfficiale,
  urlVerificabile,
  type ScuolaCertificata,
} from '../src/lib/scuoleMaster.ts';
// §26.94, §26.96 — la scadenza DICHIARATA nel testo dell'avviso si legge con
// `campiDocumento`, che a sua volta usa `lib/scadenzaTesto` (etichetta
// obbligatoria): quando la tabella o l'elenco non la riportano, la si cerca nel
// corpo del documento prima di scartare una riga valida come «senza scadenza».
import { testo as testoHtml } from '../src/lib/universalHtml.ts';
// §26.102 — la pagina successiva di un elenco si legge in `lib/paginaSuccessiva`
// (estratto dal lettore HTML per la soglia dei 250 righe): qui si segue.
import { urlPaginaSuccessiva } from '../src/lib/paginaSuccessiva.ts';
// §26.94 — deep crawl degli istituti: dalla scuola certificata alla sua HOME
// ufficiale, poi ai link «Interpelli / Albo» che la scuola pubblica davvero.
import { leggiPagineInterpelli } from '../src/scraper/deepCrawlScuole.ts';
import { linkAllegatiInterpello } from '../src/scraper/linkScuola.ts';
// §26.96 — ALLEGATI su piattaforma documentale (Gecodoc, Argo, Nuvola/Spaggiari):
// un `.pdf` servito da quelle piattaforme È l'avviso (la pagina di login no), e
// quando la piattaforma risponde con un viewer il PDF va cercato dentro.
import {
  eAllegatoPiattaforma,
  eAvvisoSuPiattaforma,
  eFileDocumento,
  urlDocumentoInHtml,
} from '../src/scraper/allegatiPiattaforma.ts';
// §26.101 — la tabella dentro il documento dell'avviso: una riga per scuola
// (codice, classe, scadenza, link dell'avviso). È il modo in cui gli Uffici
// Territoriali pubblicano davvero: un post e un PDF con N istituti dentro.
import { righeTabellaInterpelli } from '../src/scraper/tabellaInterpelliPdf.ts';
// §26.96 — i cinque campi che il DOCUMENTO dichiara (classi, codice, provincia,
// scadenza, recapiti): la pagina-elenco spesso non li ha. Da §26.115 la facciata
// è `datiBandoDaTesto`, che aggiunge intestazione, ore e requisiti e delega qui.
// §26.115 — dal documento alla RIGA: intestazione (titolo), ore settimanali e
// requisiti. Il nome del file non è un titolo: `bando_A022.pdf` non dice per
// quale classe né quante ore.
import {
  datiBandoDaTesto,
  intestazioneDaDocumento,
  titoloBandoDaDocumento,
} from '../src/scraper/datiBando.ts';
// §26.115 — allegato → titolo leggibile (testo del link o nome del file ripulito).
import { titoloDaAllegato } from '../src/scraper/allegatiBando.ts';
// §26.115 — RECAPITI dal codice meccanografico (modello Liguria): PEO e PEC
// ufficiali dell'istituto entrano nella riga, così la candidatura ha un
// destinatario senza aprire il PDF. Convenzione MIM, mai un indirizzo inventato.
import { emailDaCodiceMeccanografico } from '../src/lib/emailScuola.ts';
import { scegliContatto } from '../src/lib/gerarchiaContatti.ts';
import { statoArricchimento } from '../src/lib/statoArricchimento.ts';
// §26.96 — vicolo cieco su una bacheca di piattaforma: dal codice meccanografico
// dell'URL alla home istituzionale, senza inventare né URL né province.
import { meritaFallback } from '../src/scraper/fallbackPiattaforma.ts';
// La piattaforma di un host (Argo, Nuvola, Spaggiari, ClasseViva, Gecodoc): serve
// a distinguere un viewer che contiene il PDF da una pagina qualsiasi.
import { piattaformaScolastica } from '../src/lib/piattaformeLink.ts';
// §26.95 — gli allegati sono PDF: si legge il TESTO (stream compressi + CMap
// `/ToUnicode`) delle prime pagine. Senza questo, «senza scadenza» è un limite
// del lettore, non un dato che manca.
import { MAX_BYTE_PDF, estraiTestoPdf } from '../src/scraper/pdfTesto.ts';
// Lettura PROFONDA delle tabelle non mappabili + gate semantico stretto
// (`scraper/tabellaUst.ts`): scioperi, assemblee, avvisi chiusi, graduatorie e
// righe senza scadenza dichiarata non diventano opportunità.
import {
  leggiRigheTabellaUst,
  scadenzaDaRiga,
  valutaRigaUst,
} from '../src/scraper/tabellaUst.ts';
// Telemetria delle fonti (§26.85): ogni run lascia un segno e una fonte che
// sbaglia tre volte di fila finisce in QUARANTENA, dove i giri ordinari la
// saltano. `source_health` non raggiungibile → elenco vuoto, si scansiona
// comunque (meglio una richiesta sprecata che una regione non letta).
import {
  filtraFontiSane,
  fontiInQuarantena,
  recordSourceRun,
  type EsitoRun,
} from '../src/lib/sourceTelemetry.ts';
// Coda delle notifiche (§26.86): questo script e' un PRODUTTORE. Scrive le righe
// e accoda la voce; la consegna la fa `npm run notifiche:processa`. Un timeout di
// Telegram non puo' piu' far fallire (o allungare) la scansione.
import { accodaInterpelli } from '../src/lib/notificationQueue.ts';
// Censimento delle voci senza scadenza (§26.118): la classificazione è pura e
// condivisa con la sua guardia, così i numeri della decisione sono ripetibili.
import {
  ETICHETTA_CAUSA as ETICHETTA_CENSIMENTO,
  causaSenzaScadenza,
  titoloCandidabile,
  type CausaSenzaScadenza,
} from '../src/lib/motivoSenzaScadenza.ts';
import { writeFileSync } from 'node:fs';

dotenv.config();

// ---------------------------------------------------------------------------
// Configurazione
// ---------------------------------------------------------------------------

const CONFIG = {
  userAgent: 'ScuoleRadarBot/1.0 (+https://scuoleradar.it)',
  fetchTimeoutMs: 25_000,
  minSchoolNameLength: 4,
  fallbackProvince: 'EE',
  disqualifiedStatus: 'disabled',
  // Stato dedicato al rumore semantico (`src/lib/noiseFilter.ts`): distingue
  // «pagina senza tabella» da «pagina che non è un'opportunità».
  noiseStatus: 'disqualified_noise',
  // Debug: se true, stampa header e colonne rilevate per ogni tabella.
  debug: process.env.DEBUG === '1' || process.env.DEBUG === 'true',
} as const;

// FIX v13 (§26.75) — NIENTE PIÙ `defaultDeadlineDays`: fino alla v12 una riga
// senza scadenza riceveva `oggi + 15 giorni`, una data che nessuna fonte aveva
// pubblicato (e che il «Radar Live» mostrava come badge verde «In corso»). Ora
// una riga senza scadenza DICHIARATA si scarta: la colonna «Scadenza» del
// tabellone deve potere essere sempre vera.

// VERSIONE v17 (26/10/2026) — INGESTIONE NAZIONALE (§26.93):
//   • `--nazionale` (o `NATIONALE=1`): giro su TUTTE le regioni — la coda
//     `discovered_links` PIÙ gli hub USR/USP verificati del registro fonti
//     (`src/scraper/fonti.ts`), deduplicati per URL. `--regioni` diventa un
//     filtro per SOTTOSTRINGA normalizzata: «Valle» trova «Valle d'Aosta».
//   • Lettore ADATTIVO: dove non c'è una `<table>` (liste `<li>`, card, post
//     WordPress, archivi paginati) le voci si leggono con l'euristica universale
//     e diventano record SOLO con una scadenza DICHIARATA (§26.75).
//   • Un elenco riconosciuto ma senza scadenze NON disattiva più il target:
//     una fonte viva che oggi non pubblica un termine non è una fonte rotta.
//   • Errori classificati (dns · tls · timeout · 5xx · 4xx · non-HTML) con UN
//     ritentativo sui guasti transitori; il riepilogo per regione distingue
//     record estratti, scarti oltre l'orizzonte, voci senza scadenza ed errori
//     con la causa. Un giro nazionale in dry-run chiude con exit 0.
//
// VERSIONE v19 (26/10/2026) — ALLEGATI PDF LETTI, ALBI VERIFICATI IN CODA (§26.95):
//   • Motore PDF senza dipendenze nuove (`src/scraper/pdfTesto.ts`): stream
//     `FlateDecode`, font Identity-H con CMap `/ToUnicode`, operatori `Tj`/`TJ`.
//     Il termine scritto nell'allegato («entro le ore 12:00 del 12/11/2026») non
//     va più perso perché il documento non è HTML.
//   • Ogni pagina «Interpelli / Albo» VERIFICATA su un istituto (stesso dominio
//     della home certificata e con almeno una voce d'interpello dentro) viene
//     iscritta in `discovered_links` come `active_crawler`: il giro successivo la
//     legge come target, senza riscoprirla.
//
// VERSIONE v18 (26/10/2026) — CODA ATTIVA, DEEP CRAWL, SCADENZA DAL CORPO (§26.94):
//   • `--attiva` / `--disabilita-morti` nel seminatore della whitelist: le fonti
//     verificate passano da `pending` a `active_crawler` (entrano nei giri del
//     runner) e i domini NXDOMAIN vengono spenti con motivazione.
//   • Deep crawl degli istituti: le scuole CITATE negli avvisi vengono risolte
//     sull'anagrafica MIM e visitate sulla loro home, alla ricerca della pagina
//     «Interpelli / Albo» che la scuola linka davvero (`deepCrawlScuole.ts`).
//   • Scadenza dal CORPO dell'avviso: quando né la tabella né l'elenco la
//     dichiarano, il documento viene letto e il termine cercato con le forme
//     italiane standard («entro le ore … del», «termine per la presentazione
//     delle domande», «non oltre il», «a pena di esclusione») — con un tetto di
//     richieste per target e per giro. Una data di pubblicazione resta esclusa.
//
// Filtro regioni opzionale: `--regioni=Piemonte,Liguria`, `--regioni=Valle`
// oppure variabile d'ambiente `REGIONI=…`. Vuoto = tutte le regioni.
//
// §26.93 — il confronto è per SOTTOSTRINGA normalizzata (minuscolo, senza
// accenti né punteggiatura): «Valle» trova «Valle d'Aosta», «emilia romagna»
// trova «Emilia-Romagna». Prima era un'uguaglianza esatta sulla stringa
// minuscola, e un nome parziale non selezionava NESSUN target (trappola muta).
function normalizzaRegione(nome: string): string {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const REGIONI_FILTRO: string[] = (() => {
  const arg = process.argv.find((a) => a.startsWith('--regioni='));
  const raw = arg ? arg.slice('--regioni='.length) : process.env.REGIONI ?? '';
  return raw.split(',').map(normalizzaRegione).filter(Boolean);
})();

/** True se la regione del target rientra nel filtro (vuoto = tutte). */
function regioneCorrisponde(regione: string | null): boolean {
  if (REGIONI_FILTRO.length === 0) return true;
  const r = normalizzaRegione(regione ?? '');
  if (!r) return false;
  return REGIONI_FILTRO.some((filtro) => r.includes(filtro) || filtro.includes(r));
}

// Filtro PROVINCE opzionale: `--province=AT` (alias `--provincia=AT`) oppure
// variabile d'ambiente `PROVINCE=AT`. Vuoto = tutte le province.
//
// Perché serve (§26.119): una verifica mirata («solo Asti») non poteva esistere —
// `--regioni=Piemonte` legge anche TO, AL, CN… e i record delle altre province
// finivano comunque nel database. Con questo filtro il giro scarta i target che non
// sono della provincia richiesta E, prima dell'upsert, i record che la fonte ha
// citato per altre province (un hub regionale ne elenca di mezza regione): un giro
// dichiaratamente «solo Asti» scrive solo righe di Asti.
const PROVINCE_FILTRO: string[] = (() => {
  const arg = process.argv.find(
    (a) => a.startsWith('--province=') || a.startsWith('--provincia='),
  );
  const raw = arg ? arg.split('=')[1] : process.env.PROVINCE ?? '';
  return raw.split(',').map((codice) => codice.trim().toUpperCase()).filter(Boolean);
})();

/** True se il codice provincia rientra nel filtro (vuoto = tutte). */
function provinciaCorrisponde(codice: string | null | undefined): boolean {
  if (PROVINCE_FILTRO.length === 0) return true;
  return PROVINCE_FILTRO.includes((codice ?? '').trim().toUpperCase());
}

// `--nazionale` (o `NATIONALE=1`): GIRO NAZIONALE — tutti i target attivi di
// `discovered_links` di ogni regione PIÙ gli hub USR/USP verificati della
// whitelist (`src/scraper/fonti.ts`), deduplicati per URL. Ignora `--regioni`.
const NAZIONALE =
  process.argv.includes('--nazionale') || process.env.NATIONALE === '1';

// `--max-per-regione=N` (o `MAX_PER_REGIONE=N`): campione per la verifica
// nazionale — N target per regione, 0 = tutti. Serve a provare il giro su tutto
// il Paese senza scaricare 100+ portali in un colpo solo.
const MAX_PER_REGIONE = (() => {
  const arg = process.argv.find((a) => a.startsWith('--max-per-regione='));
  const n = Number(arg?.split('=')[1] ?? process.env.MAX_PER_REGIONE ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
})();

// §26.101 — TETTI DELL'ATTACCO DI MASSA. I numeri non sono più scritti qui: la
// politica (quanti documenti per elenco, per giro, per istituto) vive in
// `src/scraper/sgranatura.ts` con default dichiarati e override d'ambiente
// (`SGRANATURA_ELENCO`, `SGRANATURA_RUN`, `SGRANATURA_ISTITUTI`, …). Fino al
// 28/10/2026 un elenco regionale da 60 avvisi perdeva 50 termini su 60 perché
// il tetto era 10 per pagina: il portale veniva letto, le opportunità no.
const LIMITI = limitiSgranatura(process.env);

/**
 * §26.118 — CENSIMENTO DELLE VOCI SENZA SCADENZA (solo su richiesta).
 *
 * `--censimento-senza-scadenza` (o `CENSIMENTO_SENZA_SCADENZA=1`) non cambia
 * NIENTE dell'ingestione: classifica le voci che il gate scarta per assenza di
 * termine, per decidere — con i numeri e non con le impressioni — se e come
 * esporre le «disponibilità aperte fino a revoca». Regole in
 * `lib/motivoSenzaScadenza.ts`. Il CSV si scrive dove dice `--censimento-out`
 * (default `censimento-senza-scadenza.csv`).
 */
const CENSIMENTO =
  process.argv.includes('--censimento-senza-scadenza') ||
  process.env.CENSIMENTO_SENZA_SCADENZA === '1';
const CENSIMENTO_OUT = (() => {
  const arg = process.argv.find((a) => a.startsWith('--censimento-out='));
  return arg ? arg.slice('--censimento-out='.length) : 'censimento-senza-scadenza.csv';
})();

/**
 * §26.101 — segmento della FINESTRA ROTANTE sugli elenchi lunghi. Default: l'ora
 * corrente (i tre run quotidiani leggono tre segmenti diversi); override
 * esplicito con `SGRANATURA_FINESTRA` per una campagna manuale.
 */
const GIRO_SGRANATURA = (() => {
  const n = Number(process.env.SGRANATURA_FINESTRA ?? Math.floor(Date.now() / 3_600_000));
  return Number.isFinite(n) ? Math.floor(n) : 0;
})();

// §26.94 — DEEP CRAWL degli istituti: quante scuole visitare in un giro
// (`--max-scuole=N`, 0 = nessuna) e quante pagine per istituto. Il tetto resta
// (un albo pretorio può essere enorme), ma non è più un campione: il default è
// `istitutiPerGiro` e le pagine per istituto vengono dalla stessa politica.
const MAX_SCUOLE_DEEP = (() => {
  const arg = process.argv.find((a) => a.startsWith('--max-scuole='));
  const n = Number(arg?.split('=')[1] ?? process.env.MAX_SCUOLE ?? LIMITI.istitutiPerGiro);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : LIMITI.istitutiPerGiro;
})();
const DEEP_CRAWL = !process.argv.includes('--no-deep') && MAX_SCUOLE_DEEP > 0;
const MAX_PAGINE_SCUOLA = Math.max(1, LIMITI.paginePerAlbo);

// §26.94/§26.95 — scadenze lette nel CORPO di un avviso quando l'elenco non la
// dichiara: tetto per target e per giro (è rete, non parsing). Dal 26/10/2026 il
// corpo comprende gli ALLEGATI PDF, quindi le riserve si possono alzare senza
// toccare il numero di target: `APPROFONDIMENTI_RUN` / `APPROFONDIMENTI_SCUOLE_RUN`.
const MAX_APPROFONDIMENTI_TARGET = LIMITI.perElenco;
function riservaDaAmbiente(chiave: string, predefinito: number): number {
  const n = Number(process.env[chiave] ?? predefinito);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : predefinito;
}
const MAX_APPROFONDIMENTI_RUN = riservaDaAmbiente('APPROFONDIMENTI_RUN', LIMITI.perGiro);
const MAX_APPROFONDIMENTI_SCUOLE_RUN = riservaDaAmbiente('APPROFONDIMENTI_SCUOLE_RUN', LIMITI.perGiro);
/**
 * §26.102 — PAGINE D'ELENCO per giro: quante pagine 2…N si scaricano in tutto
 * il run (è rete, non parsing). Il tetto per singolo target è `pagineElenco`;
 * questa riserva evita che un archivio da 300 pagine divori il giro.
 */
let pagineElencoResidue = riservaDaAmbiente('PAGINE_ELENCO_RUN', 600);
const APPROFONDIMENTO_TIMEOUT_MS = 10_000;
/** Riserve separate: il deep crawl non consuma quella del giro sugli hub. */
let approfondimentiTarget = MAX_APPROFONDIMENTI_RUN;
let approfondimentiScuole = MAX_APPROFONDIMENTI_SCUOLE_RUN;

/** §26.95 — allegati PDF aperti nel giro: letti, con testo, con scadenza. */
const statisticaPdf = { aperti: 0, conTesto: 0, conScadenza: 0 };

// `--dry-run` (o `DRY_RUN=1`): esegue fetch ed estrazione e stampa i record
// trovati, senza scrivere su Supabase. Serve a validare una correzione di
// parser PRIMA di toccare la produzione.
const DRY_RUN =
  process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

// `--ignora-quarantena` (o `IGNORA_QUARANTENA=1`): lavora anche le fonti isolate
// dalla telemetria (§26.85). È il giro di ri-validazione dopo una correzione di
// parser: un run riuscito le riabilita da solo, senza toccare il database.
const IGNORA_QUARANTENA =
  process.argv.includes('--ignora-quarantena') ||
  process.env.IGNORA_QUARANTENA === '1';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.error('[table-reporter] Credenziali Supabase mancanti nel file .env');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Codici meccanografici
// ---------------------------------------------------------------------------

const PROVINCE_CODES = new Set<string>([
  'AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO',
  'BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ',
  'EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE',
  'LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU',
  'OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA',
  'RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV',
  'TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR',
  'VT','VV',
]);

// Regex più permissiva: cattura codici con eventuali spazi interni.
const MECH_CODE_REGEX = /\b([A-Za-z]{2}\s*[A-Za-z0-9]\s*[A-Za-z0-9]\s*[A-Za-z0-9]\s*[A-Za-z0-9]\s*[A-Za-z0-9]\s*[A-Za-z0-9]\s*[A-Za-z0-9]\s*[A-Za-z0-9])\b/g;

function isLikelyMechCode(code: string): boolean {
  const clean = code.replace(/\s+/g, '');
  if (clean.length !== 10) return false;
  if (!PROVINCE_CODES.has(clean.slice(0, 2))) return false;
  if (!/^[A-Z]{2}$/.test(clean.slice(2, 4))) return false;
  return true;
}

function extractMechCode(text: string): string {
  if (!text) return 'ND';
  const matches = text.match(MECH_CODE_REGEX) || [];
  for (const raw of matches) {
    const clean = raw.replace(/\s+/g, '').toUpperCase();
    if (isLikelyMechCode(clean)) return clean;
  }
  // Fallback: cerca pattern standard senza spazi
  const fallback = text.match(/\b([A-Za-z]{2}[A-Za-z0-9]{8})\b/);
  if (fallback) {
    const upper = fallback[1].toUpperCase();
    if (isLikelyMechCode(upper)) return upper;
  }
  return 'ND';
}

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface DiscoveredLink {
  id: string;
  url: string;
  region: string | null;
  province: string | null;
  status: string;
  /** Da dove arriva il target: coda DB oppure whitelist in memoria (§26.93). */
  origine?: 'db' | 'whitelist';
  /**
   * §26.94 — la riga del DB corrisponde a una fonte VERIFICATA del registro
   * (`fonti.ts`). Una fonte verificata non si disattiva per un giro a vuoto: il
   * suo stato lo decide il registro, non l'assenza di record di oggi.
   */
  verificata?: boolean;
  /** Etichetta della fonte nel registro (solo whitelist). */
  etichetta?: string;
}

interface InterpelloRecord {
  hash_id: string;
  title: string;
  school_name: string;
  school_code: string;
  province: string;
  region: string | null;
  class_code: string;
  /**
   * §26.119 — le STESSE classi in ARRAY, accanto al singolare. La RPC
   * `match_interpelli` e il fallback PostgREST filtrano su `class_codes`
   * (`&&`/`.overlaps`): scrivendo solo `class_code` la riga entrava nel database
   * ma era INVISIBILE a ogni ricerca per classe — misurato il 30/10/2026: 465
   * righe con il singolare, 197 con l'array, e la bacheca dell'utente vuota.
   */
  class_codes: string[];
  subject: string;
  /** Colonna LEGACY (text ISO): resta per compatibilità e per la migrazione. */
  deadline: string;
  /**
   * FIX v13 (§26.75) — la scadenza CANONICA che leggono bacheca, filtro attivi,
   * matching e notifiche. Prima lo script scriveva SOLO `deadline`: le righe
   * Piemonte/Liguria entravano con `expiration_date` NULLO e restavano invisibili
   * al «Radar Live» (misurato il 22/10/2026: **382 righe su 382**).
   */
  expiration_date: string | null;
  source_url: string;
  /**
   * §26.115 — RECAPITO di candidatura (modello Liguria): la PEO ufficiale
   * dell'istituto, derivata dal codice meccanografico con la convenzione MIM
   * (`lib/emailScuola.emailDaCodiceMeccanografico`). Nessun indirizzo inventato:
   * se il codice non è valido il campo resta `null`.
   */
  contact_email?: string | null;
  /** §26.115 — PEC ufficiale (`codice@pec.istruzione.it`), per gli atti formali. */
  school_pec?: string | null;
  /** §26.115 — `completo`/`parziale` secondo `lib/statoArricchimento`. */
  stato_arricchimento?: string;
}

interface ProcessResult {
  extracted: number;
  status: 'success' | 'error';
  signature: string | null;
  error?: string;
  disqualified?: boolean;
  /** Pagina scartata dal pre-filtro semantico (atto di gara, circolare, TFR). */
  noise?: boolean;
  /** Layout della pagina secondo l'euristica universale (§26.84). */
  layout?: string;
  /** Righe/voci scartate perché la scadenza è oltre l'orizzonte (§26.75). */
  oltreOrizzonte?: number;
  /** Voci di elenco lette dalla pagina ma senza scadenza dichiarata (§26.93). */
  senzaScadenza?: number;
  /** Voci lette dal lettore adattivo (elenchi/card/paginazione). */
  vociAdattive?: number;
  /** Scadenze recuperate leggendo il CORPO dell'avviso (§26.94). */
  scadenzeDaCorpo?: number;
  /** Codici meccanografici degli istituti citati: alimentano il deep crawl. */
  scuole?: string[];
  /** Causa classificata di un errore: serve al riepilogo nazionale. */
  cause?: CausaErrore;
}

/**
 * Cause di un target non letto. Servono a distinguere un guasto del MONDO
 * (dominio morto, TLS sbagliato, 503) da un problema di PARSER: nel riepilogo
 * nazionale la prima colonna che conta è «perché».
 */
type CausaErrore =
  | 'dns'
  | 'tls'
  | 'timeout'
  | 'http_5xx'
  | 'http_4xx'
  | 'content_type'
  | 'rete'
  | 'altro';

/** Etichetta leggibile di una causa (log e riepilogo). */
const ETICHETTA_CAUSA: Readonly<Record<CausaErrore, string>> = {
  dns: 'dominio non risolto',
  tls: 'certificato TLS non valido',
  timeout: 'timeout di rete',
  http_5xx: 'errore del server (5xx)',
  http_4xx: 'pagina non trovata (4xx)',
  content_type: 'risposta non HTML',
  rete: 'connessione fallita',
  altro: 'errore non classificato',
};

/** Classifica un errore di fetch/HTTP senza dipendere dal testo esatto di Node. */
function causaDaErrore(messaggio: string): CausaErrore {
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|name_not_resolved/i.test(messaggio)) return 'dns';
  if (/CERT_|certificate|self.signed|ERR_TLS|SSL|TLS/i.test(messaggio)) return 'tls';
  if (/abort|timed?\s?out|ETIMEDOUT|UND_ERR_(?:HEADERS|CONNECT)_TIMEOUT/i.test(messaggio)) {
    return 'timeout';
  }
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|fetch failed|socket hang up/i.test(messaggio)) {
    return 'rete';
  }
  const http = /HTTP\s+(\d{3})/i.exec(messaggio);
  if (http) return Number(http[1]) >= 500 ? 'http_5xx' : 'http_4xx';
  return 'altro';
}

interface ExtractionResult {
  records: InterpelloRecord[];
  disqualified: boolean;
  /**
   * Righe con scadenza dichiarata fra oggi e l'orizzonte ma SENZA azione
   * (`progr`), tipiche dello snapshot Piemonte con lo stato non aggiornato:
   * l'interpello è candidabile ma la pagina non espone il link. Se > 0 conviene
   * rifetchare il target (FIX v16, §26.80).
   */
  righeSenzaAzione?: number;
  /** Righe scartate perché la scadenza è oltre l'orizzonte di vetrina. */
  oltreOrizzonte?: number;
  /** Voci lette dal lettore adattivo (elenchi/card), se è stato usato. */
  vociAdattive?: number;
  /** Voci di elenco senza scadenza dichiarata: nessun record, nessuno scarto. */
  senzaScadenza?: number;
}

interface ColumnMapping {
  codeIdx: number;
  schoolIdx: number;
  /** FIX v12 — colonna «Classe di concorso» (Piemonte: `A041 - Scienze…`). */
  classIdx: number;
  deadlineIdx: number;
  publishDateIdx: number;
  stateIdx: number;
  deadlineByText: number;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function normalize(input: string): string {
  return input.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateHashId(
  province: string,
  schoolCode: string,
  title: string,
  url: string
): string {
  const raw = `${province}|${schoolCode}|${title}|${url}`.toLowerCase();
  return sha256(raw);
}

function getStructuralSignature($: cheerio.CheerioAPI): string {
  const parts: string[] = [];
  $('table').each((tIdx, tableEl) => {
    const $table = $(tableEl);
    const rowCount = $table.find('tr').length;
    const headers = $table
      .find('th')
      .map((_, el) => $(el).text().trim())
      .get()
      .join('|');
    parts.push(`t${tIdx}:r${rowCount}:h[${headers}]`);
  });
  return crypto.createHash('md5').update(parts.join(';')).digest('hex');
}

function resolveUrl(href: string, baseUrl: string): string {
  if (!href) return baseUrl;
  try {
    if (href.startsWith('http://') || href.startsWith('https://')) return href;
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

// ---------------------------------------------------------------------------
// Parsing della scadenza
// ---------------------------------------------------------------------------

function todayIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TODAY_ISO = todayIso();

// FIX v13 (§26.75) + §26.114 — ORIZZONTE di una scadenza tabellare. Il portale
// Piemonte a volte scrive nella colonna «Data Scadenza Interpello» la FINE del
// contratto (`30/06/2027`, `31/05/2027`) invece del termine per candidarsi; e per
// gli avvisi «disponibile fino a 10 giorni» scrive il segnaposto `2027-04-30`.
// Il tetto qui è quello dell'INGESTIONE (`GIORNI_ORIZZONTE_INGESTIONE`, 365
// giorni): il database conserva ciò che la fonte dichiara, ed è la VETRINA a
// decidere cosa mostrare — feed e matching dentro i 15 giorni (§26.82), bacheca
// pubblica senza tetto con la banda blu «Scadenza lontana» (§26.100).
function isoPiuGiorni(iso: string, giorni: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + giorni);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const LIMITE_ORIZZONTE_ISO = isoPiuGiorni(TODAY_ISO, GIORNI_ORIZZONTE_INGESTIONE);

/** True se la scadenza è entro l'orizzonte di INGESTIONE (mai un refuso d'anno). */
function entroOrizzonte(deadlineIso: string): boolean {
  return deadlineIso <= LIMITE_ORIZZONTE_ISO;
}

/**
 * Scadenza canonica per `interpelli.expiration_date` (timestamptz): mezzanotte
 * UTC, come le scadenze già presenti in tabella e come fa la migrazione
 * `20261015120000_allinea_deadline_expiration_interpelli.sql`.
 */
function aExpirationDate(deadlineIso: string): string {
  return `${deadlineIso}T00:00:00+00:00`;
}

function parseDeadline(text: string): string | null {
  if (!text) return null;

  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return validateIsoDate(y, m, d);
  }

  const euMatch = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (!euMatch) return null;

  const [, d, m, y] = euMatch;
  const day = d.padStart(2, '0');
  const month = m.padStart(2, '0');
  const year = y.length === 2 ? `20${y}` : y;

  return validateIsoDate(year, month, day);
}

// FIX v12 — LIGURIA, griglia NAZIONALE: la cella «Interpello» è un testo lungo
// («A044 – Sostegno … – 13 ore dal 23/10/2026 al 30/06/2027 – prot. 26737 del
// 21/10/2026 Scadenza: 22/10/2026 13:00»). Le prime date sono l'INIZIO
// dell'incarico e la data del protocollo: `parseDeadline` prenderebbe la prima
// (23/10) e la riga risulterebbe aperta fino a novembre. Si legge SOLO la data
// che segue l'etichetta «Scadenza:».
function parseLabeledDeadline(text: string): string | null {
  if (!text) return null;
  const m = normalize(text).match(
    /scadenz\w*\s*:?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i
  );
  return m ? parseDeadline(m[1]) : null;
}

/**
 * Scadenza di una riga della griglia Liguria: il layout NAZIONALE porta un testo
 * lungo (inizio incarico, fine contratto, protocollo, poi «Scadenza: …»), quindi
 * vale solo la data ETICHETTATA; il layout PROVINCIALE ha una cella dedicata e si
 * legge diretta. In nessun caso si ripiega su un'altra data della riga (§26.75).
 */
function parseDeadlineLabeledOrCell(
  layout: LiguriaGridLayout,
  testo: string
): string | null {
  return layout === 'nazionale' ? parseLabeledDeadline(testo) : parseDeadline(testo);
}

function validateIsoDate(
  year: string,
  month: string,
  day: string
): string | null {
  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);

  if (dayNum < 1 || dayNum > 31) return null;
  if (monthNum < 1 || monthNum > 12) return null;
  if (yearNum < 2000 || yearNum > 2100) return null;

  return `${year}-${month}-${day}`;
}

function isExpired(deadlineIso: string | null): boolean {
  if (!deadlineIso) return false;
  return deadlineIso < TODAY_ISO;
}

function isFutureOrToday(deadlineIso: string | null): boolean {
  if (!deadlineIso) return false;
  return deadlineIso >= TODAY_ISO;
}

// ---------------------------------------------------------------------------
// Estrazione provincia dall'URL
// ---------------------------------------------------------------------------

const URL_AMBITO_REGEX = /ambito[_\-.]?([a-z]{2})(?:[_\-.]|\b)/i;
const URL_SUFFIX_REGEX = /[-_]([a-z]{2})\.php/i;
const URL_QUERY_PROV_REGEX = /[?&]p=([A-Za-z]{2})\b/;
const URL_LIGURIA_REGEX = /provincia\.php\?p=([A-Za-z]{2})/i;

function extractProvinceFromUrl(url: string): string | null {
  if (!url) return null;

  const candidates: Array<RegExp> = [
    URL_LIGURIA_REGEX,
    URL_QUERY_PROV_REGEX,
    URL_AMBITO_REGEX,
    URL_SUFFIX_REGEX,
  ];

  for (const re of candidates) {
    const m = url.match(re);
    if (m) {
      const prov = m[1].toUpperCase();
      if (PROVINCE_CODES.has(prov)) return prov;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Anti-spam sindacale & rumore (Zero Tolleranza)
// ---------------------------------------------------------------------------

const NOISE_KEYWORDS = [
  'assemblea sindacale',
  'assemblee sindacali',
  'sciopero',
  'scioperi',
  'rappresentanza sindacale',
  'rappresentanze sindacali',
  'r.s.u.',
  'rsu',
  'orario ricevimento',
  'orari di ricevimento',
  'verbale',
  'verbali',
  'delibera',
  'delibere',
  'determina',
  'determine',
  'cig',
];

function rowIsNoise(fullRowTextLower: string): boolean {
  for (const kw of NOISE_KEYWORDS) {
    if (fullRowTextLower.includes(kw)) return true;
  }
  return false;
}

/**
 * Pre-filtro semantico di RIGA (`src/lib/noiseFilter.ts`): scarta in due regex
 * gli atti amministrativi e i documenti non di reclutamento, PRIMA del parsing
 * di date, classi e codici. Il log è di livello DEBUG: in produzione tace.
 */
function rowIsSemanticNoise(fullRowText: string, etichetta: string): boolean {
  const esito = isAdministrativeNoise(fullRowText, fullRowText);
  if (!esito.isNoise) return false;
  if (CONFIG.debug) {
    console.log(
      `[table-reporter][debug] rumore semantico (${esito.reason}) — ${etichetta}`
    );
  }
  return true;
}

/**
 * Pre-filtro semantico di PAGINA: titolo + contenuto principale, senza menu e
 * footer. Restituisce il motivo dello scarto (o `null`), così `processTarget`
 * può disattivare il target con lo stato dedicato.
 */
function pageSemanticNoiseReason($: cheerio.CheerioAPI): string | null {
  const titolo = normalize($('title').text());
  const $principale = $('main, article, #content, .content, #main, .main').first();
  const grezzo = $principale.length > 0 ? $principale.text() : $('body').text();
  const testo = normalize(grezzo.slice(0, 30_000));
  const esito = isAdministrativeNoise(testo, titolo);
  if (!esito.isNoise) return null;
  if (CONFIG.debug) {
    console.log(
      `[table-reporter][debug] rumore semantico (${esito.reason}) — pagina ${titolo.slice(0, 80)}`
    );
  }
  return esito.reason ?? 'rumore amministrativo';
}

// ---------------------------------------------------------------------------
// Filtro di stato generico (interpelli chiusi / scaduti / non attivi)
// ---------------------------------------------------------------------------

const CLOSED_STATE_KEYWORDS = [
  'chiuso',
  'chiusa',
  'chiusi',
  'chiuse',
  'scaduto',
  'scaduta',
  'scaduti',
  'scadute',
  'concluso',
  'conclusa',
  'conclusi',
  'concluse',
  'terminato',
  'terminata',
  'terminati',
  'terminate',
  'non attivo',
  'non attiva',
  'non attivi',
  'non attive',
  'inattivo',
  'inattiva',
  'cancellato',
  'cancellata',
  'cancellati',
  'cancellate',
  'expired',
  'closed',
];

function rowIndicatesClosed(fullRowTextLower: string): boolean {
  for (const kw of CLOSED_STATE_KEYWORDS) {
    if (fullRowTextLower.includes(kw)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// FIX v10 — Filtro STATO INTERPELLO robusto
// ---------------------------------------------------------------------------

const OPEN_STATE_VALUES = [
  'aperto', 'aperta', 'aperti', 'aperte',
  'attivo', 'attiva', 'attivi', 'attive',
  'disponibile', 'disponibili',
];

function isRowOpen(stateText: string): boolean {
  const t = normalize(stateText).toLowerCase();
  if (!t) return false;
  return OPEN_STATE_VALUES.some((v) => t === v || t.includes(v));
}

// Rilevamento dinamico della colonna stato: cerca una colonna i cui valori
// nel corpo della tabella contengano "aperto" o "chiuso".
function detectStateColumnByCellText(
  colTexts: string[]
): number {
  for (let i = 0; i < colTexts.length; i += 1) {
    const cellLower = colTexts[i].toLowerCase();
    if (
      cellLower.includes('aperto') ||
      cellLower.includes('chiuso') ||
      cellLower.includes('cancellato')
    ) {
      return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// PRE-CHECK STRUTTURALE
// ---------------------------------------------------------------------------

const STRONG_INTERPELLI_MARKERS: RegExp[] = [
  /classi?\s+di\s+concorso/i,
  /cod(?:ice)?\.?\s*mecc(?:anografico)?/i,
  /graduator/i,
  /\bscadenz/i,
  /supplenz/i,
];

const WEAK_INTERPELLI_MARKERS: RegExp[] = [
  /candidatur/i,
  /posti?\s+disponibil/i,
  /tipo\s+posto/i,
  /data\s+pubblicazione/i,
  /codice\s+scuola/i,
  /destinatari/i,
  /requisiti/i,
  /\bclass[ei]\b/i,
  /\bstato\b/i,
  /denominazione/i,
];

function pageContainsInterpelliTable($: cheerio.CheerioAPI): boolean {
  const tables = $('table');
  if (tables.length === 0) return false;

  const headersText: string[] = [];
  const bodyChunks: string[] = [];

  tables.each((_, tableEl) => {
    const $table = $(tableEl);
    if ($table.find('tr').length < 2) return;

    $table.find('th, thead td').each((_, el) => {
      headersText.push(normalize($(el).text()));
    });
    bodyChunks.push(normalize($table.text()));
  });

  if (bodyChunks.length === 0) return false;

  const headerScope = headersText.join(' ').toLowerCase();
  const bodyScope = bodyChunks.join(' ').toLowerCase();
  const fullScope = `${headerScope} ${bodyScope}`;

  if (fullScope.trim().length === 0) return false;

  if (/\binterpell/i.test(fullScope)) return true;

  const strongHits = STRONG_INTERPELLI_MARKERS.reduce(
    (n, re) => n + (re.test(fullScope) ? 1 : 0),
    0
  );
  const weakHits = WEAK_INTERPELLI_MARKERS.reduce(
    (n, re) => n + (re.test(fullScope) ? 1 : 0),
    0
  );

  if (strongHits >= 2) return true;
  if (strongHits >= 1 && weakHits >= 2) return true;

  // FIX v10: accetta anche tabelle con codice meccanografico + denominazione
  // anche senza la parola "interpello".
  if (
    /cod(?:ice)?\.?\s*mecc/i.test(fullScope) &&
    /denominazione/i.test(fullScope)
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Rilevamento colonne
// ---------------------------------------------------------------------------

function getTableHeaders(
  $: cheerio.CheerioAPI,
  tableEl: cheerio.Element
): string[] {
  const $table = $(tableEl);

  // 1) <thead> esplicito
  const $thead = $table.find('thead').first();
  if ($thead.length > 0) {
    const cells = $thead.find('tr').first().find('th, td');
    if (cells.length > 0) {
      return cells
        .map((_, el) => normalize($(el).text()).toLowerCase())
        .get();
    }
  }

  // 2) Prima riga con <th>
  const $firstRow = $table.find('tr').first();
  if ($firstRow.find('th').length > 0) {
    return $firstRow
      .find('th, td')
      .map((_, el) => normalize($(el).text()).toLowerCase())
      .get();
  }

  // FIX v10: 3) Prima riga di <td> come potenziale header (tabelle legacy).
  if ($firstRow.find('td').length > 0) {
    const texts = $firstRow
      .find('td')
      .map((_, el) => normalize($(el).text()).toLowerCase())
      .get();
    // Verifica che sembri un header: contiene parole chiave tipiche.
    const joined = texts.join(' ');
    if (
      /cod(?:ice)?/.test(joined) ||
      /denominazione/.test(joined) ||
      /scadenz/.test(joined) ||
      /stato/.test(joined) ||
      /classe/.test(joined) ||
      /data/.test(joined)
    ) {
      return texts;
    }
  }

  return [];
}

/**
 * Colonne che NON sono MAI la scadenza di candidatura — FIX v13 (§26.75).
 *
 * Il caso reale (Piemonte, tabelle `ric_interpello_ambito_*`): la tabella ha
 * DODICI colonne e la
 * «Data Interpello» contiene la FINE dell'incarico (`07/10/2027`, `30/06/2027`),
 * mentre la «Durata Supplenza» contiene «Disponibile fino a 10 giorni»,
 * «30 Giugno», «04 Febbraio». Il vecchio fallback «cerca QUALSIASI data futura in
 * qualsiasi cella» pescava proprio quelle: la scadenza finiva a un anno di
 * distanza e il badge verde «In corso» dichiarava aperto un contratto annuale.
 *
 * Da qui in poi una data vale come scadenza SOLO se la sua colonna lo dichiara.
 */
const RE_COLONNA_NON_SCADENZA =
  /durata|supplenz|incaric|decorrenz|inizio|data\s*interpello|pubblicat|protocoll|cancellazion|note/i;

/**
 * True se l'intestazione dichiara una SCADENZA di candidatura («Data Scadenza
 * Interpello», «Scadenza domande», «Termine presentazione», «Chiusura avviso»).
 * Le intestazioni di durata/pubblicazione sono escluse a monte: `data interpello`
 * non è una scadenza, è la fine del rapporto di lavoro.
 */
function intestazioneScadenza(header: string): boolean {
  const h = normalize(header).toLowerCase();
  if (!h) return false;
  if (RE_COLONNA_NON_SCADENZA.test(h)) return false;
  return /scadenz|chiusur|termine\s*(?:presentazione|domande|candidatur|iscrizion)|presentazione\s*(?:domande|candidatur)/.test(
    h
  );
}
function detectColumns(headers: string[]): ColumnMapping {
  const findIdx = (patterns: RegExp[]): number => {
    for (let i = 0; i < headers.length; i += 1) {
      if (patterns.some((re) => re.test(headers[i]))) return i;
    }
    return -1;
  };

  // Pattern più flessibili e multipli.
  const codeIdx = findIdx([
    /cod(?:ice)?\.?\s*mecc/,
    /codice\s*scuola/,
    /cod\.?\s*scuola/,
    /meccanografico/,
    /codice/,
  ]);

  const schoolIdx = findIdx([
    /denominazione/,
    /istituto\s+scolastico/,
    /nome\s+(?:istituto|scuola)/,
    /scuola/,
    /istituto/,
    /sede/,
  ]);

  // FIX v12 — colonna della classe di concorso: serve a leggere anche i codici
  // «nudi» (senza descrizione) e a non dipendere dal match sul testo intero.
  const classIdx = findIdx([
    /classe\s+di\s+concorso/,
    /classi\s+di\s+concorso/,
    /classe\s*concorso/,
    /codice\s+classe/,
    /\bcdc\b/,
  ]);

  // FIX v13 (§26.75) — la scadenza si mappa SOLO su un'intestazione che la
  // dichiara (`intestazioneScadenza`). Sono state rimosse le regex generiche
  // `/termine/` e `/data fine/`: su una tabella con «Durata supplenza» o «Data
  // fine incarico» agganciavano la fine del contratto, non il termine per
  // candidarsi.
  const deadlineIdx = headers.findIndex((h) => intestazioneScadenza(h));

  const publishDateIdx = findIdx([
    /data\s*interpello/,
    /data\s*pubblicazione/,
    /data\s*avviso/,
    /pubblicato\s*il/,
    /data\s*pubbl/,
  ]);

  const stateIdx = findIdx([
    /stato\s*interpello/,
    /stato\s*avviso/,
    /\bstato\b/,
    /situazione/,
  ]);

  if (CONFIG.debug) {
    console.log('[table-reporter][debug] headers=', headers);
    console.log(
      `[table-reporter][debug] mappatura: code=${codeIdx} school=${schoolIdx} deadline=${deadlineIdx} state=${stateIdx}`
    );
  }

  return {
    codeIdx: codeIdx >= 0 ? codeIdx : 0,
    schoolIdx: schoolIdx >= 0 ? schoolIdx : 1,
    classIdx,
    deadlineIdx,
    publishDateIdx,
    stateIdx,
    deadlineByText: -1,
  };
}

/**
 * Scadenza di una riga tabellare, letta SOLO da una colonna che la dichiara
 * (FIX v13, §26.75):
 *   1. la colonna mappata dalle intestazioni (`intestazioneScadenza`);
 *   2. una cella che scrive esplicitamente «Scadenza: …» (alcune fonti mettono
 *      l'etichetta dentro la cella invece che in testata).
 * `null` = la riga non dichiara una scadenza: il chiamante la scarta, senza
 * inventare né la data di pubblicazione né la durata della supplenza.
 */
function deadlineDichiarata(
  colTexts: string[],
  columns: ColumnMapping
): string | null {
  const mapped = columns.deadlineIdx;
  if (mapped >= 0 && mapped < colTexts.length) {
    const dichiarata = parseDeadline(colTexts[mapped]);
    if (dichiarata) return dichiarata;
  }

  const byText = detectDeadlineColumnByCellText(colTexts);
  if (byText >= 0 && byText !== mapped) {
    return parseDeadline(colTexts[byText]);
  }

  return null;
}

// FIX #1 (v13) — rilevamento scadenza dal TESTO della cella («Scadenza:
// 16/10/2026»). La cella deve NOMINARE la scadenza e non essere una colonna di
// durata/pubblicazione: «Durata supplenza: 30 Giugno» o «Data interpello:
// 07/10/2027» non sono termini per candidarsi (§26.75).
function detectDeadlineColumnByCellText(colTexts: string[]): number {
  for (let i = 0; i < colTexts.length; i += 1) {
    const cellLower = colTexts[i].toLowerCase();
    if (RE_COLONNA_NON_SCADENZA.test(cellLower)) continue;
    if (/scadenz/.test(cellLower)) {
      const d = parseDeadline(colTexts[i]);
      if (d && isFutureOrToday(d)) return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

interface FetchResult {
  status: number;
  contentType: string;
  html: string;
}

/** Tentativi di rete per target: un 5xx/timeout isolato non è un target morto. */
const TENTATIVI_FETCH = 2;
const ATTESA_FETCH_MS = 1_200;

async function fetchHtmlUnaVolta(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.fetchTimeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': CONFIG.userAgent,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();
    return { status: response.status, contentType, html };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch con UN ritentativo sui guasti transitori (5xx, timeout, DNS, TLS).
 *
 * §26.93 — un giro nazionale tocca decine di portali: senza ritentativo un 503
 * di dieci secondi faceva sembrare «morta» una fonte che risponde al secondo
 * colpo, e il riepilogo attribuiva l'errore al parser. Un 4xx NON si ritenta:
 * la pagina non c'è, insistere è solo rumore.
 */
async function fetchHtml(url: string): Promise<FetchResult> {
  let ultimo: unknown = null;
  for (let tentativo = 1; tentativo <= TENTATIVI_FETCH; tentativo += 1) {
    try {
      const esito = await fetchHtmlUnaVolta(url);
      if (esito.status < 500 || tentativo === TENTATIVI_FETCH) return esito;
      ultimo = new Error(`HTTP ${esito.status}`);
    } catch (err) {
      ultimo = err;
    }
    if (tentativo < TENTATIVI_FETCH) await attesa(ATTESA_FETCH_MS);
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

// ---------------------------------------------------------------------------
// Estrazione record tabellari
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FIX v11 — LIGURIA: griglia di risultati in <div> (nessuna <table>)
// ---------------------------------------------------------------------------
//
// Dal 2026 `servizi.istruzioneliguria.gov.it` non pubblica più tabelle HTML:
// la lista è una griglia `div.results-table` con una `div.results-head`
// (intestazioni) e una `div.results-row` per riga, cinque celle per riga:
//   1) Codice / Tipologia     → <strong>ADEE</strong><small>Posto intero</small>
//   2) Istituzione scolastica → <span>IC MARASSI – Genova</span><small>STATALE</small>
//   3) Ordine di scuola       → "Primaria"
//   4) Scadenza               → "22/10/2026"
//   5) Azione                 → <a href="interpello.php?id=1296">
// Misurato il 22/10/2026 sulla pagina GE: 92 righe, 5 colonne, 0 <table>.
//
// FIX v12 — la stessa griglia serve DUE layout, con un numero di celle diverso:
//   · per provincia (`provincia.php?p=GE`) — 5 celle come sopra;
//   · nazionale (`nazionali.php`) — 7 celle:
//       1) Data → «21/10/2026»
//       2) Regione → «Puglia»
//       3) Provincia → «Taranto» (nome per esteso, non sigla)
//       4) Scuola → «IISS “Del Prete-Falcone” – Sava»
//       5) CDC / posto → «A044» (codice nudo, nessuna descrizione)
//       6) Interpello → testo lungo con «Scadenza: 22/10/2026 13:00»
//       7) Azione → <a href="documenti.php…">
// Letto con le colonne del layout provinciale, il nazionale produceva
// `school_name` = «Puglia», `province` = 'EE' (fallback) e una scadenza
// inventata: 11 righe in DB il 22/10/2026.

const LIGURIA_GRID_HEAD_SELECTOR = '.results-head';
const LIGURIA_GRID_ROW_SELECTOR = '.results-row';

/** Layout della griglia Liguria: 5 celle per provincia, 7 per il nazionale. */
type LiguriaGridLayout = 'provincia' | 'nazionale';

interface GridColumns {
  layout: LiguriaGridLayout;
  codeIdx: number;
  schoolIdx: number;
  deadlineIdx: number;
  /** Solo layout nazionale: cella con il testo dell'interpello (scadenza). */
  textIdx: number;
  /** Solo layout nazionale: nome della regione scritto nella riga. */
  regionIdx: number;
  /** Solo layout nazionale: provincia per esteso («Taranto»). */
  provinceNameIdx: number;
  /** Solo layout nazionale: data di pubblicazione dell'avviso. */
  publishIdx: number;
  actionIdx: number;
}

function detectLiguriaGridColumns($: cheerio.CheerioAPI): GridColumns {
  const headers = $(`${LIGURIA_GRID_HEAD_SELECTOR} span`)
    .map((_, el) => normalize($(el).text()).toLowerCase())
    .get();

  const find = (patterns: RegExp[], fallback: number): number => {
    for (let i = 0; i < headers.length; i += 1) {
      if (patterns.some((re) => re.test(headers[i]))) return i;
    }
    return fallback;
  };

  const lastIdx = headers.length > 0 ? headers.length - 1 : 4;

  // Il layout nazionale è l'unico che espone ANCHE la regione: la cella
  // «Provincia» da sola non basta a distinguerlo (esiste in entrambi).
  const isNazionale = headers.some((h) => /regione/.test(h));

  if (isNazionale) {
    return {
      layout: 'nazionale',
      codeIdx: find([/\bcdc\b/, /posto/, /codice/, /tipologia/], 4),
      schoolIdx: find([/scuola/, /istituzione/], 3),
      deadlineIdx: -1,
      textIdx: find([/interpello/, /avviso/], 5),
      regionIdx: find([/regione/], 1),
      provinceNameIdx: find([/provincia/], 2),
      publishIdx: find([/^data/, /data/], 0),
      actionIdx: find([/azione/, /link/, /apri/], 6),
    };
  }

  return {
    layout: 'provincia',
    codeIdx: find([/codice/, /tipologia/], 0),
    schoolIdx: find([/istituzione/, /scuola/], 1),
    deadlineIdx: find([/scadenz/, /termine/], 3),
    textIdx: -1,
    regionIdx: -1,
    provinceNameIdx: -1,
    publishIdx: -1,
    actionIdx: find([/azione/, /link/, /apri/], lastIdx),
  };
}

function isLiguriaGridPage($: cheerio.CheerioAPI): boolean {
  return (
    $(LIGURIA_GRID_HEAD_SELECTOR).length > 0 ||
    $(LIGURIA_GRID_ROW_SELECTOR).length > 0
  );
}

function extractRecordsFromLiguriaGrid(
  $: cheerio.CheerioAPI,
  target: DiscoveredLink
): ExtractionResult {
  const records: InterpelloRecord[] = [];
  // Righe scartate perché la scadenza cadrebbe oltre l'orizzonte (§26.75).
  let scartateOltreOrizzonte = 0;
  const cols = detectLiguriaGridColumns($);

  // Layout provinciale: la provincia arriva dall'URL (`provincia.php?p=GE`) o
  // dal target. Nel layout nazionale arriva dalla riga (vedi sotto).
  const provinciaDelTarget =
    extractProvinceFromUrl(target.url) ??
    (target.province || CONFIG.fallbackProvince).toUpperCase();

  $(LIGURIA_GRID_ROW_SELECTOR).each((_, rowEl) => {
    const $row = $(rowEl);
    const $cells = $row.children('span');
    if ($cells.length < 3) return;

    const cellTexts = $cells
      .map((__, el) => normalize($(el).text()))
      .get();

    // Azione: senza link non c'è un interpello da aprire.
    const $link = $cells.eq(cols.actionIdx).find('a[href]').first();
    const rawHref = $link.attr('href');
    const href = rawHref ? rawHref.trim() : '';
    if (!href || href === '#') return;

    const fullRowText = cellTexts.join(' ');
    const fullRowTextLower = fullRowText.toLowerCase();
    if (rowIsNoise(fullRowTextLower)) return;
    if (rowIsSemanticNoise(fullRowText, target.url)) return;
    if (rowIndicatesClosed(fullRowTextLower)) return;

    // Istituzione scolastica: il badge STATALE/PARITARIA è un <small> di
    // servizio, non fa parte del nome.
    if (cols.schoolIdx >= $cells.length) return;
    const $schoolCell = $cells.eq(cols.schoolIdx).clone();
    $schoolCell.find('small').remove();
    const schoolName = normalize($schoolCell.text());
    if (!schoolName || schoolName.length < CONFIG.minSchoolNameLength) return;

    // ---------------------------------------------------------------------
    // FIX v12 — riga del layout NAZIONALE: provincia e regione sono scritte
    // nella riga (la provincia per esteso, «Taranto»). Senza un codice di
    // provincia riconosciuto la riga non è attribuibile: si scarta, invece di
    // salvarla con il fallback 'EE'.
    // ---------------------------------------------------------------------
    let province = provinciaDelTarget;
    let region = target.region;
    let deadlineCellText = cellTexts[cols.deadlineIdx] ?? '';

    if (cols.layout === 'nazionale') {
      const nomeProvincia = cellTexts[cols.provinceNameIdx] ?? '';
      const codiceProvincia = provinciaDaCitta(nomeProvincia);
      if (!codiceProvincia) return;
      province = codiceProvincia;
      region = provinciaDaCodice(codiceProvincia)?.regione ?? region;
      deadlineCellText = cellTexts[cols.textIdx] ?? '';
    }

    // Codice classe di concorso: <strong> nella cella «Codice / Tipologia».
    // Il testo della cella inizia con l'icona <i> («▤ ADEE Posto intero»),
    // perciò il token va letto dal <strong>, non dall'inizio della cella.
    // Il layout nazionale scrive il codice «nudo» e senza <strong> («A044»).
    const strongText = normalize(
      $cells.eq(cols.codeIdx).find('strong').first().text()
    );
    const codeCellText = cellTexts[cols.codeIdx] ?? '';
    const classCode =
      classCodeNudo(strongText) ??
      classCodeInTesta(strongText) ??
      classCodeNudo(codeCellText) ??
      classCodeInTesta(codeCellText) ??
      extractSubjectAndClass(fullRowText).classCode;

    // Scadenza: nel layout nazionale il testo porta l'inizio incarico, la data di
    // protocollo e la FINE del contratto PRIMA della scadenza — conta solo quella
    // dopo l'etichetta («Scadenza: 22/10/2026 13:00»).
    //
    // FIX v13 (§26.75) — caduto il ripiego «data di pubblicazione + 15 giorni»:
    // una data di pubblicazione NON è una scadenza, e il ripiego fabbricava un
    // termine che nessuna fonte aveva dichiarato (badge verde su avvisi chiusi).
    // Senza etichetta la riga si scarta.
    const deadline = parseDeadlineLabeledOrCell(cols.layout, deadlineCellText);
    if (!deadline) return;
    if (isExpired(deadline)) return;
    // Oltre l'orizzonte la «scadenza» è la FINE dell'incarico: fuori (§26.75).
    if (!entroOrizzonte(deadline)) {
      scartateOltreOrizzonte += 1;
      return;
    }

    const subject = extractSubjectAndClass(fullRowText).subject;
    const sourceUrl = resolveUrl(href, target.url);
    const title = `${schoolName} - Interpello Ufficiale`;
    // La griglia non espone il codice meccanografico: `school_code` = 'ND'.
    const hashId = generateHashId(province, 'ND', title, sourceUrl);

    records.push({
      hash_id: hashId,
      title,
      school_name: schoolName,
      school_code: 'ND',
      province,
      region,
      class_code: classCode,
      class_codes: classiArray(classCode),
      subject,
      deadline,
      expiration_date: aExpirationDate(deadline),
      source_url: sourceUrl,
    });
  });

  if (CONFIG.debug) {
    console.log(
      `[table-reporter][debug] griglia Liguria: ${records.length} record validi`
    );
  }

  if (scartateOltreOrizzonte > 0) {
    console.log(
      `[table-reporter] Liguria: ${scartateOltreOrizzonte} righe scartate oltre l'orizzonte di ${GIORNI_ORIZZONTE_INGESTIONE} giorni.`
    );
  }

  return { records, disqualified: false };
}

// ---------------------------------------------------------------------------
// LETTURA PROFONDA DELLE TABELLE (§26.88)
// ---------------------------------------------------------------------------

/** Conta uno scarto della lettura profonda, per motivo (il report lo stampa). */
function contaIneleggibile(motivi: Map<string, number>, motivo: string): void {
  motivi.set(motivo, (motivi.get(motivo) ?? 0) + 1);
}

/**
 * Righe di una pagina che NESSUNA mappatura di colonne spiega: tabelle degli UST
 * (Arezzo, Grosseto) con intestazioni atipiche, celle unite, elenchi a sei-sette
 * colonne, albi con la scadenza in fondo. Fino a ieri queste pagine finivano
 * `disqualified` con zero avvisi, pur contenendo decine di interpelli veri.
 *
 * Qui la riga si legge con `scraper/tabellaUst.ts` (celle unite, etichette di
 * colonna, link scelto fra quelli della riga), passa il GATE SEMANTICO STRETTO
 * (`valutaRigaUst`) e viene CERTIFICATA sull'anagrafica MIM (`scuoleMaster`):
 * nome presentabile, provincia dal codice, home `.edu.it`.
 *
 * PERCHÉ QUI SI PUÒ RISOLVERE LA SCUOLA E NEL GIRO ORDINARIO NO: queste righe non
 * sono mai state ingerite (la pagina era `disqualified`), quindi non esiste un
 * `hash_id` storico da rispettare. Nel giro ordinario `title`/`province`/
 * `source_url` fanno parte dell'identità dell'avviso e cambiarli creerebbe
 * duplicati (vedi `lib/scuoleMaster.ts` → `urlUfficiale`).
 *
 * §26.96 — LA RIGA SENZA SCADENZA SI LEGGE NEL DOCUMENTO. Quando la riga è
 * candidabile ma non dichiara il termine, il link della riga (spesso un PDF su
 * Gecodoc/Argo) si apre con `leggiAvvisoCompleto`: se il documento scrive «entro
 * il …», la riga diventa un record, e le classi lette nel PDF completano quelle
 * della tabella. Tetto `MAX_DOCUMENTI_UST` per pagina: è rete, non parsing.
 */
/**
 * §26.96 — quante righe di tabella, prive di scadenza, si approfondiscono sul
 * DOCUMENTO linkato (tabella d'albo → PDF su Gecodoc/Argo). È rete: tetto basso e
 * per giro, come gli altri approfondimenti.
 */
const MAX_DOCUMENTI_UST = 6;

function extractRecordsFromUstTables(
  $: cheerio.CheerioAPI,
  target: DiscoveredLink
): Promise<InterpelloRecord[]> {
  return leggiTabelleUst($, target);
}

async function leggiTabelleUst(
  $: cheerio.CheerioAPI,
  target: DiscoveredLink
): Promise<InterpelloRecord[]> {
  const anagrafica = caricaAnagrafica();
  const defaultProvince = (target.province || CONFIG.fallbackProvince).toUpperCase();
  const urlProvince = extractProvinceFromUrl(target.url);
  const motivi = new Map<string, number>();
  const records: InterpelloRecord[] = [];
  const visti = new Set<string>();
  let documentiLetti = 0;

  for (const riga of leggiRigheTabellaUst($, target.url)) {
    const esito = valutaRigaUst(riga);
    if (esito.stato !== 'candidabile') {
      contaIneleggibile(motivi, esito.motivo ?? 'scarto senza motivo');
      continue;
    }

    const codice = esito.codice === 'ND' ? null : esito.codice;
    const scuola = scuolaCertificata(anagrafica, {
      codice,
      nome: esito.scuola,
      provincia: defaultProvince,
    });
    if (!scuola) {
      // Codice sconosciuto all'anagrafica o nome ambiguo: nessuna certificazione,
      // nessun avviso. La riga resta fuori e il motivo finisce nel log.
      contaIneleggibile(
        motivi,
        `scuola non certificata (${codice ?? esito.scuola ?? 'senza codice'})`
      );
      continue;
    }

    let deadline = esito.data;
    let classi = esito.classi;
    // §26.96 — la riga è candidabile ma non dichiara il termine: sulla tabella di
    // Arezzo il termine (e la classe) stanno nel PDF linkato, spesso su Gecodoc.
    // Si legge il DOCUMENTO, una volta per riga e con un tetto per pagina.
    if (!deadline && esito.link && documentiLetti < MAX_DOCUMENTI_UST) {
      documentiLetti += 1;
      const documento = await leggiAvvisoCompleto(esito.link, 'target', defaultProvince);
      deadline = documento.deadline ?? null;
      if (classi.length === 0) classi = documento.classi;
      if (!deadline) {
        contaIneleggibile(motivi, 'documento senza scadenza dichiarata');
        continue;
      }
    }

    // `urlUfficiale`: il link della riga se è apribile, altrimenti la home
    // dell'istituto (mai una pagina di login Argo/Nuvola spacciata per avviso).
    // §26.123 — SE NON C'È NESSUNO DEI DUE (Piemonte: tabelle «per ambito» con
    // 0 `<a href>`, scuola non certificata) l'identità dell'avviso è la TABELLA
    // USR stessa: è la fonte ufficiale in cui la riga vive, e la card deve poter
    // mostrare «Vai alla fonte» invece di sparire. Il dominio del target è
    // verificato in ingresso: nessun aggregatore, nessun social, nessun modulo.
    const sourceUrl = urlUfficiale(esito.link, scuola) ?? target.url;
    if (!deadline || !sourceUrl) {
      contaIneleggibile(motivi, 'riga senza scadenza o senza URL apribile');
      continue;
    }

    const schoolCode = scuola.codice ?? codice ?? 'ND';
    const schoolName = esito.scuola ?? scuola.nome ?? `Istituto ${schoolCode}`;
    const province = isLikelyMechCode(schoolCode)
      ? schoolCode.slice(0, 2).toUpperCase()
      : scuola.provincia ?? urlProvince ?? defaultProvince;

    // §26.123 — L'EMAIL DELLA SCUOLA SULLA RIGA DI TABELLA (la «Sartoria» del
    // recapito). Una tabella USR (Liguria `provincia.php`, Piemonte modulo «per
    // ambito») dichiara il codice meccanografico ma quasi mai la casella: senza
    // questo passaggio la card della bacheca arriva con «Email non disponibile»
    // e la riga è inutilizzabile. Stessa GERARCHIA del percorso scuola
    // (`lib/gerarchiaContatti`): anagrafica MIM → PEO/PEC della convenzione
    // ministeriale, con la PEC come estrema ratio e i domini personali esclusi.
    const caselleUst = emailDaCodiceMeccanografico(schoolCode);
    const contattoUst = scegliContatto([
      { email: scuola.email, provenienza: 'anagrafica' },
      { email: caselleUst?.peo, provenienza: 'convenzione', derivato: true },
      { email: caselleUst?.pec, provenienza: 'convenzione', derivato: true },
    ]);
    const contactEmail = contattoUst && contattoUst.natura !== 'esterno' ? contattoUst.email : null;
    const schoolPec = scuola.pec ?? caselleUst?.pec ?? null;

    // Il titolo porta l'OGGETTO della riga: sulla stessa scuola convivono più
    // interpelli (classi diverse) e `hash_id` è costruito anche sul titolo.
    const title = `${schoolName} - ${esito.titolo}`;
    const hashId = generateHashId(province, schoolCode, title, sourceUrl);
    if (visti.has(hashId)) continue;
    visti.add(hashId);

    const { classCode, subject } = extractSubjectAndClass(esito.testo);
    records.push({
      hash_id: hashId,
      title,
      school_name: schoolName,
      school_code: schoolCode,
      province,
      region: target.region,
      class_code: classi[0] ?? classCode,
      class_codes: classiArray(classi[0], classCode, ...classi),
      subject,
      deadline,
      expiration_date: aExpirationDate(deadline),
      source_url: sourceUrl,
      contact_email: contactEmail,
      school_pec: schoolPec,
      stato_arricchimento: statoArricchimento({
        school_name: schoolName,
        school_code: schoolCode,
        contact_email: contactEmail,
        school_pec: schoolPec,
      }),
    });
  }

  if (records.length > 0 || motivi.size > 0) {
    const scarti = [...motivi].map(([motivo, n]) => `${n}× ${motivo}`).join(' · ');
    console.log(
      `[table-reporter] Lettura profonda: ${records.length} righe valide${scarti ? ` — scarti: ${scarti}` : ''}`
    );
  }

  return records;
}

// ---------------------------------------------------------------------------
// LETTURA ADATTIVA DEGLI ELENCHI (§26.93)
// ---------------------------------------------------------------------------

interface EsitoAdattivo {
  records: InterpelloRecord[];
  oltreOrizzonte: number;
  voci: number;
  senzaScadenza: number;
}

/**
 * Voci dell'euristica universale → record ingeribili.
 *
 * Serve ai portali che non hanno `<table>`: liste di `<li>`, card, `<article>`
 * di WordPress, archivi paginati. Le regole sono quelle di sempre — la scadenza
 * deve essere DICHIARATA (`expirationDate`, mai una data di pubblicazione), la
 * scuola va CERTIFICATA sull'anagrafica MIM (codice o nome univoco) e l'URL
 * deve essere apribile. Una voce senza scadenza non è un errore: è una notizia
 * senza termine, e non entra.
 */
/**
 * Voce adattiva + scadenza dichiarata → record ingeribile, `null` se la scuola
 * non è certificabile, se manca un URL apribile o se è un duplicato del giro.
 * Una sola traduzione: la usano sia la lettura della pagina sia il recupero
 * della scadenza dal corpo dell'avviso (§26.94).
 */
function recordDaVoceAdattiva(
  voce: ExtractedInterpello,
  deadline: string,
  target: DiscoveredLink,
  anagrafica: ReturnType<typeof caricaAnagrafica>,
  visti: Set<string>,
  scuolaForzata?: ScuolaCertificata,
  // §26.96 — classi lette DENTRO il documento quando l'elenco non le dichiara.
  classiDocumento: string[] = [],
): InterpelloRecord | null {
  const defaultProvince = (target.province || CONFIG.fallbackProvince).toUpperCase();
  const daCodice =
    voce.schoolCode && isLikelyMechCode(voce.schoolCode) ? voce.schoolCode : null;
  const dalTitolo = extractMechCode(`${voce.title} ${voce.schoolName ?? ''}`);
  const codice = daCodice ?? (dalTitolo === 'ND' ? null : dalTitolo);
  const nome =
    voce.schoolName ?? scuolaDaRiga(`${voce.title} ${voce.schoolName ?? ''}`, codice);
  const scuola =
    scuolaForzata ??
    scuolaCertificata(anagrafica, { codice, nome, provincia: defaultProvince });
  // Nessuna certificazione → nessun avviso: mai una scuola inventata.
  if (!scuola) return null;

  const sourceUrl = urlUfficiale(voce.directUrl, scuola);
  if (!sourceUrl) return null;

  const schoolCode = scuola.codice ?? codice ?? 'ND';
  const province = isLikelyMechCode(schoolCode)
    ? schoolCode.slice(0, 2).toUpperCase()
    : scuola.provincia ?? defaultProvince;
  const title = normalize(voce.title);
  const hashId = generateHashId(province, schoolCode, title, sourceUrl);
  if (visti.has(hashId)) return null;
  visti.add(hashId);

  // §26.96 — se l'elenco non dichiara la classe ma il documento sì, vale quella:
  // è il caso delle tabelle che linkano solo il PDF su Gecodoc/Argo.
  const classi = voce.classCodes.length > 0 ? voce.classCodes : classiDocumento;
  const { classCode, subject } = extractSubjectAndClass(`${title} ${classi.join(' ')}`);
  const classCodeVoce = (classi[0] ?? '').replace(/[-_\s]/g, '');
  return {
    hash_id: hashId,
    title,
    school_name: scuolaForzata
      ? scuola.nome ?? `Istituto ${schoolCode}`
      : voce.schoolName ?? scuola.nome ?? `Istituto ${schoolCode}`,
    school_code: schoolCode,
    province,
    region: target.region,
    class_code: CLASS_CODE_SHAPE.test(classCodeVoce) ? classCodeVoce : classCode,
    class_codes: classiArray(
      CLASS_CODE_SHAPE.test(classCodeVoce) ? classCodeVoce : classCode,
      ...classi,
    ),
    subject,
    deadline,
    expiration_date: aExpirationDate(deadline),
    source_url: sourceUrl,
  };
}

function recordsDaElencoAdattivo(
  universale: UniversalExtractionResult | undefined,
  target: DiscoveredLink
): EsitoAdattivo {
  const esito: EsitoAdattivo = { records: [], oltreOrizzonte: 0, voci: 0, senzaScadenza: 0 };
  if (!universale?.success || universale.items.length === 0) return esito;

  const anagrafica = caricaAnagrafica();
  const visti = new Set<string>();

  for (const voce of universale.items) {
    esito.voci += 1;
    const deadline = voce.expirationDate ?? null;
    if (!deadline) {
      esito.senzaScadenza += 1;
      continue;
    }
    if (isExpired(deadline)) continue;
    if (!entroOrizzonte(deadline)) {
      esito.oltreOrizzonte += 1;
      continue;
    }

    const record = recordDaVoceAdattiva(voce, deadline, target, anagrafica, visti);
    if (record) esito.records.push(record);
  }

  if (esito.voci > 0) {
    console.log(
      `[table-reporter] Elenco adattivo (${universale.layoutDetected}): ${esito.voci} voci → ` +
        `${esito.records.length} record (senza scadenza: ${esito.senzaScadenza}, ` +
        `oltre orizzonte: ${esito.oltreOrizzonte}).`
    );
  }
  return esito;
}

// ---------------------------------------------------------------------------
// SCADENZA DAL CORPO DELL'AVVISO (§26.94)
// ---------------------------------------------------------------------------
// Una voce d'elenco senza termine non è per forza «senza scadenza»: spesso il
// termine è nella pagina del documento («Le domande vanno presentate entro le
// ore 12:00 del 12/11/2026»). Si scarica il documento — solo per le voci che
// ne hanno bisogno, con un tetto per target e per giro — e si legge il testo
// con le regole di `scadenzaTesto.ts` (etichetta obbligatoria, protocollo e
// pubblicazione esclusi).

/** Esito della lettura di un documento: termine, scuole CITATE, classi. */
interface EsitoAvviso {
  deadline: string | null;
  scuole: ScuolaCertificata[];
  /** §26.96 — classi di concorso DICHIARATE nel documento (vuoto se non le scrive). */
  classi: string[];
  /** True se il documento è stato scaricato (anche senza termine). */
  letto: boolean;
  /** §26.115 — intestazione dichiarata dal documento (`null` se non si intitola). */
  titolo: string | null;
  /** §26.115 — ore settimanali dichiarate (`null` se il documento non le scrive). */
  ore: number | null;
  /** §26.115 — requisiti dichiarati, al massimo tre frasi. */
  requisiti: string[];
  /**
   * §26.116 — RECAPITI scritti nel documento (email ordinarie e PEC): alimentano
   * la gerarchia del contatto (`lib/gerarchiaContatti`) quando il codice
   * meccanografico non basta o non c'è.
   */
  email: string[];
  pec: string[];
}

/**
 * §26.96 — scarica SOLO il documento annidato in un viewer di piattaforma
 * (Gecodoc/Argo/Nuvola che rispondono con una pagina contenitore). `null` se non
 * è un PDF raggiungibile: nessuna eccezione, nessun byte tenuto in memoria qui.
 */
async function scaricaDocumentoPdf(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APPROFONDIMENTO_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': CONFIG.userAgent,
        Accept: 'application/pdf,*/*;q=0.4',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    return contentType.includes('pdf') ? response : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Apre un avviso e ne legge il testo: scadenza DICHIARATA e istituti CITATI.
 * Non lancia mai; `letto: false` quando la riserva è esaurita, il documento non
 * è né HTML né PDF, o non risponde. Dal 26/10/2026 gli allegati PDF si leggono
 * (`pdfTesto.ts`): il termine è spesso solo lì.
 */
async function leggiAvvisoCompleto(
  url: string,
  da: 'target' | 'scuola' = 'target',
  provincia?: string | null,
): Promise<EsitoAvviso> {
  const vuoto: EsitoAvviso = {
    deadline: null,
    scuole: [],
    classi: [],
    letto: false,
    titolo: null,
    ore: null,
    requisiti: [],
    email: [],
    pec: [],
  };
  const residuo = da === 'scuola' ? approfondimentiScuole : approfondimentiTarget;
  if (residuo <= 0) return vuoto;
  if (da === 'scuola') approfondimentiScuole -= 1;
  else approfondimentiTarget -= 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APPROFONDIMENTO_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': CONFIG.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.4',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) return vuoto;
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('pdf') || /\.pdf(?:$|[?#])/i.test(url)) {
      return await leggiAvvisoPdf(response, provincia);
    }
    if (!contentType.includes('html')) return vuoto;
    const html = await response.text();
    // §26.96 — la piattaforma documentale risponde con un VIEWER: il PDF sta
    // dentro un `<iframe>`/`<embed>` (o in un link). UN salto, con la stessa
    // riserva: se non c'è riserva, si resta alla pagina (niente sorprese di rete).
    const residuoAnnidato = da === 'scuola' ? approfondimentiScuole : approfondimentiTarget;
    if (piattaformaScolastica(url) && residuoAnnidato > 0) {
      const annidato = urlDocumentoInHtml(html, url, 1)[0];
      if (annidato) {
        if (da === 'scuola') approfondimentiScuole -= 1;
        else approfondimentiTarget -= 1;
        const documento = await scaricaDocumentoPdf(annidato);
        if (documento) {
          const dalPdf = await leggiAvvisoPdf(documento, provincia);
          // §26.117 — il PDF annidato è la fonte più ricca, non l'unica. Se non
          // dichiara NÉ il termine NÉ un istituto (scansione, viewer vuoto,
          // avviso senza data) si legge ANCHE la pagina: prima il `return`
          // chiudeva la lettura e una riga con la data nel viewer diventava
          // «senza scadenza» senza che nessuno avesse letto la data.
          if (dalPdf.deadline || dalPdf.scuole.length > 0) return dalPdf;
        }
      }
    }
    // Il contenuto dell'avviso, non il menu del sito: se c'è un contenitore
    // semantico si legge quello, altrimenti la pagina intera.
    const $ = cheerio.load(html);
    const contenuto = $('article, main, .entry-content, .avviso, #content, .contenuto').first();
    const frammento = contenuto.length > 0 ? contenuto.html() ?? html : html;
    const testoAvviso = testoHtml(frammento.slice(0, 400_000));
    // §26.96 + §26.115 — i campi si leggono con la STESSA regola del PDF: classi,
    // scadenza, intestazione, ore e requisiti dal documento; scuola CITATA nel
    // corpo con il codice meccanografico.
    const campi = datiBandoDaTesto(testoAvviso);
    return {
      deadline: campi.scadenza,
      scuole: scuoleDaTesto(caricaAnagrafica(), testoAvviso, provincia ?? null),
      classi: campi.classi,
      letto: true,
      titolo: intestazioneDaDocumento(testoAvviso),
      ore: campi.ore,
      requisiti: campi.requisiti,
      email: campi.recapiti.email,
      pec: campi.recapiti.pec,
    };
  } catch {
    return vuoto;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * §26.95 — l'allegato è un PDF: si scaricano i byte (con tetto, `MAX_BYTE_PDF`)
 * e si legge il testo delle prime pagine. Nel PDF la scuola è citata per esteso
 * o con il codice meccanografico: la certificazione dal corpo vale come per
 * l'HTML. Non lancia mai; un PDF scansionato ha solo immagini → `letto: false`.
 */
async function leggiAvvisoPdf(
  response: Response,
  provincia?: string | null,
): Promise<EsitoAvviso> {
  const vuoto: EsitoAvviso = {
    deadline: null,
    scuole: [],
    classi: [],
    letto: false,
    titolo: null,
    ore: null,
    requisiti: [],
    email: [],
    pec: [],
  };
  const dichiarata = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(dichiarata) && dichiarata > MAX_BYTE_PDF) return vuoto;
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTE_PDF) return vuoto;
  statisticaPdf.aperti += 1;
  const esito = estraiTestoPdf(buffer);
  if (!esito.testo) return vuoto;
  statisticaPdf.conTesto += 1;
  // §26.96 + §26.115 — i campi del documento (classi, codice, provincia,
  // scadenza, recapiti) più intestazione, ore e requisiti: UNA regola sola, la
  // stessa dell'HTML (`datiBandoDaTesto` → `campiDocumento`).
  const campi = datiBandoDaTesto(esito.testo);
  const deadline = campi.scadenza;
  if (deadline) statisticaPdf.conScadenza += 1;
  return {
    deadline,
    scuole: scuoleDaTesto(caricaAnagrafica(), esito.testo, provincia ?? null),
    classi: campi.classi,
    letto: true,
    titolo: intestazioneDaDocumento(esito.testo),
    ore: campi.ore,
    requisiti: campi.requisiti,
    email: campi.recapiti.email,
    pec: campi.recapiti.pec,
  };
}

/** Solo la scadenza dichiarata nel corpo (usata dal deep crawl, §26.94). */
async function scadenzaDaCorpoAvviso(
  url: string,
  da: 'target' | 'scuola' = 'target',
): Promise<string | null> {
  return (await leggiAvvisoCompleto(url, da)).deadline;
}

/** Documenti aperti dentro un avviso-pagina (tabella delle scuole che assumono). */
const MAX_DOCUMENTI_AVVISO = 2;

/**
 * §26.101 — SGRANATURA DEL DOCUMENTO: da un avviso-pagina alle SUE righe.
 *
 * Il caso che ha reso necessario questo passaggio: l'avviso n. 72 dell'ATP
 * Bergamo è un POST che dichiara «Data Scadenza: -» e allega `Interpelli n. 72.pdf`.
 * Dentro quel PDF c'è una tabella con QUATTRO istituti, ognuno con codice
 * meccanografico, classe di concorso, termine e link dell'avviso. Letto come un
 * unico documento era «un avviso senza scadenza» (0 record); letto per righe sono
 * quattro opportunità distinte, già certificate.
 *
 * Regole (nessuna nuova eccezione di qualità): la riga deve dichiarare il
 * termine (`tabellaInterpelliPdf`), la scuola deve esistere in `schools_master`
 * (`scuolaCertificata`) e il link deve essere quello della riga (la pagina
 * dell'istituto o la sua bacheca su piattaforma) — altrimenti resta il documento
 * stesso. Consuma la riserva degli approfondimenti, come ogni apertura.
 */
async function sgranaDocumentoAvviso(
  voce: ExtractedInterpello,
  anagrafica: ReturnType<typeof caricaAnagrafica>,
  visti: Set<string>,
): Promise<{ records: InterpelloRecord[]; righe: number; conTermine: number }> {
  const esito = { records: [] as InterpelloRecord[], righe: 0, conTermine: 0 };
  const url = (voce.directUrl ?? '').trim();
  if (!/^https?:\/\//i.test(url) || approfondimentiTarget <= 0) return esito;

  let documenti: string[];
  if (eFileDocumento(url)) {
    documenti = [url];
  } else {
    approfondimentiTarget -= 1;
    try {
      const pagina = await scaricaPaginaLeggera(url);
      if (pagina.status >= 400 || !pagina.contentType.includes('html')) return esito;
      documenti = urlDocumentoInHtml(pagina.html, url, MAX_DOCUMENTI_AVVISO);
    } catch {
      return esito;
    }
  }

  for (const documento of documenti) {
    if (approfondimentiTarget <= 0) break;
    approfondimentiTarget -= 1;
    const risposta = await scaricaDocumentoPdf(documento);
    if (!risposta) continue;
    let byte: Uint8Array;
    try {
      byte = new Uint8Array(await risposta.arrayBuffer());
    } catch {
      continue;
    }
    if (byte.byteLength === 0 || byte.byteLength > MAX_BYTE_PDF) continue;
    const pdf = estraiTestoPdf(byte);
    if (!pdf.testo) continue;
    statisticaPdf.aperti += 1;
    statisticaPdf.conTesto += 1;

    for (const riga of righeTabellaInterpelli(pdf.testo)) {
      esito.righe += 1;
      if (!riga.deadline) continue;
      esito.conTermine += 1;
      if (isExpired(riga.deadline) || !entroOrizzonte(riga.deadline)) continue;
      const scuola = scuolaCertificata(anagrafica, { codice: riga.schoolCode });
      if (!scuola) continue;
      const materia = [riga.classCode, riga.subject].filter(Boolean).join(' ');
      const record = recordDaVoceScuola(
        {
          title: `Interpello ${materia} — ${riga.schoolName}`,
          schoolName: scuola.nome ?? riga.schoolName,
          classCodes: riga.classCode ? [riga.classCode] : [],
          directUrl: riga.sourceUrl ?? documento,
        },
        riga.deadline,
        scuola,
        visti,
      );
      if (record) esito.records.push(record);
    }
  }
  if (esito.conTermine > 0) statisticaPdf.conScadenza += 1;
  return esito;
}

/**
 * Recupera la scadenza dal corpo delle voci che non la dichiarano e le
 * converte in record. Tetti: `MAX_APPROFONDIMENTI_TARGET` (`perElenco`) per
 * pagina, `MAX_APPROFONDIMENTI_RUN` (`perGiro`) per giro — è rete, non parsing.
 * Le voci si scelgono con `vociDaSgranare` (§26.101): si aprono gli AVVISI, mai
 * la pagina, la home o una sezione.
 */
async function approfondisciVociSenzaScadenza(
  universale: UniversalExtractionResult | undefined,
  target: DiscoveredLink,
  giaPresenti: readonly InterpelloRecord[],
): Promise<{
  records: InterpelloRecord[];
  richieste: number;
  trovate: number;
  daCorpoScuola: number;
  oltreOrizzonte: number;
  righeTabella: number;
}> {
  const esito = {
    records: [],
    richieste: 0,
    trovate: 0,
    daCorpoScuola: 0,
    oltreOrizzonte: 0,
    righeTabella: 0,
  } as {
    records: InterpelloRecord[];
    richieste: number;
    trovate: number;
    daCorpoScuola: number;
    oltreOrizzonte: number;
    righeTabella: number;
  };
  if (!universale?.success) return esito;
  // §26.101 — SGRANATURA: le voci dell'elenco che non dichiarano la scadenza si
  // aprono UNA PER UNA, ma solo se sono avvisi: la pagina stessa, la home e le
  // sezioni/indici restano fuori (§26.99 «un avviso si apre su un avviso»). Fino
  // al 28/10/2026 si aprivano al massimo 10 documenti per pagina: era il tetto,
  // non il portale, a decidere quante opportunità esistevano.
  const apribili = vociDaSgranare(
    universale.items.filter((voce) => !voce.expirationDate),
    { paginaUrl: target.url },
  );
  if (apribili.length === 0) return esito;
  // §26.101 — finestra ROTANTE: un ufficio dichiara 200 voci e il tetto per
  // pagina è 40, quindi senza rotazione si aprono sempre le prime 40 e
  // l'archivio sotto non si legge mai. La finestra avanza a ogni ora del giorno.
  const finestra = finestraElenco(apribili.length, MAX_APPROFONDIMENTI_TARGET, GIRO_SGRANATURA);
  const candidate = apribili.slice(finestra.da, finestra.a);
  if (candidate.length === 0) return esito;

  const anagrafica = caricaAnagrafica();
  const visti = new Set(giaPresenti.map((record) => record.hash_id));
  const tetto = Math.min(candidate.length, approfondimentiTarget);
  const scadenzaElenco = Date.now() + Math.max(1_000, LIMITI.millisecondiElenco);
  if (apribili.length > tetto) {
    console.log(
      `[table-reporter] Sgranatura ${target.province ?? target.region ?? 'N/D'}: ` +
        `${apribili.length} avvisi apribili, finestra ${finestra.da}-${finestra.a}, ` +
        `${tetto} aperti (riserva del giro: ${approfondimentiTarget}).`,
    );
  }

  for (const voce of candidate) {
    if (esito.richieste >= tetto) break;
    // §26.101 — un portale lento non deve congelare il giro: allo scadere del
    // tempo si smette di aprire questo elenco e si passa al target successivo.
    if (Date.now() > scadenzaElenco) {
      console.log(
        `[table-reporter] Sgranatura ${target.province ?? target.region ?? 'N/D'}: ` +
          `tempo dell'elenco esaurito (${LIMITI.millisecondiElenco} ms) dopo ${esito.richieste} aperture — ` +
          `le voci non lette restano al giro successivo.`,
      );
      break;
    }
    esito.richieste += 1;
    // §26.101 — prima il DOCUMENTO dell'avviso: se è un PDF tabellare, ogni riga
    // (una per istituto) è un record a sé con scuola, classe e link. Solo quando
    // la tabella non c'è si prova la lettura «un termine per pagina».
    const daDocumento = await sgranaDocumentoAvviso(voce, anagrafica, visti);
    esito.righeTabella += daDocumento.righe;
    if (daDocumento.records.length > 0) {
      esito.records.push(...daDocumento.records);
      continue;
    }
    const documento = await leggiAvvisoCompleto(voce.directUrl, 'target', target.province);
    if (!documento.deadline) continue;
    esito.trovate += 1;
    if (isExpired(documento.deadline)) continue;
    if (!entroOrizzonte(documento.deadline)) {
      esito.oltreOrizzonte += 1;
      continue;
    }
    // Prima certificazione dal TITOLO (come sempre); se la fonte non nomina la
    // scuola lì ma la cita nel CORPO con il codice, vale quella (§26.94). Le
    // classi lette nel documento completano quelle dell'elenco (§26.96).
    let record = recordDaVoceAdattiva(
      voce,
      documento.deadline,
      target,
      anagrafica,
      visti,
      undefined,
      documento.classi,
    );
    if (!record && documento.scuole.length > 0) {
      record = recordDaVoceAdattiva(
        voce,
        documento.deadline,
        target,
        anagrafica,
        visti,
        documento.scuole[0],
        documento.classi,
      );
      if (record) esito.daCorpoScuola += 1;
    }
    if (record) esito.records.push(record);
  }

  if (esito.richieste > 0) {
    console.log(
      `[table-reporter] Sgranatura (${apribili.length} avvisi apribili, finestra ${finestra.da}-${finestra.a}): ` +
        `${esito.richieste} documenti letti → ${esito.trovate} termini dichiarati, ` +
        `${esito.righeTabella} righe di tabella, ${esito.records.length} record ` +
        `(${esito.daCorpoScuola} con scuola dal corpo) · riserva del giro: ${approfondimentiTarget}.`
    );
  }
  return esito;
}

function extractRecordsFromHtml(
  $: cheerio.CheerioAPI,
  target: DiscoveredLink,
  universale?: UniversalExtractionResult
): Promise<ExtractionResult> {
  return leggiRecordsDaHtml($, target, universale);
}

async function leggiRecordsDaHtml(
  $: cheerio.CheerioAPI,
  target: DiscoveredLink,
  universale?: UniversalExtractionResult
): Promise<ExtractionResult> {
  const records: InterpelloRecord[] = [];
  // Righe scartate perché la «scadenza» cadrebbe oltre l'orizzonte (§26.75):
  // sono le fini di incarico scritte dal portale nella colonna della scadenza.
  let scartateOltreOrizzonte = 0;
  // Righe candidabili (scadenza fra oggi e l'orizzonte) ma prive di azione
  // `progr`: sintomo dello snapshot Piemonte con lo stato non aggiornato
  // (FIX v16, §26.80).
  let righeSenzaAzione = 0;

  // FIX v11 — Liguria espone la lista come griglia di <div>, non come <table>.
  if (isLiguriaGridPage($)) {
    return extractRecordsFromLiguriaGrid($, target);
  }

  if (!pageContainsInterpelliTable($)) {
    // §26.88 — prima di dichiarare vuota una pagina: le tabelle degli UST e gli
    // albi a colonne atipiche non hanno una mappatura riconoscibile, ma le righe
    // sono dati veri. La lettura profonda le ricompone, le filtra col gate
    // semantico e le certifica sull'anagrafica MIM.
    const profonde = await extractRecordsFromUstTables($, target);
    // §26.93 — e se non c'è nemmeno una tabella, gli elenchi/card/paginazione:
    // il lettore adattivo restituisce solo voci con scadenza DICHIARATA.
    const adattivo = recordsDaElencoAdattivo(universale, target);
    if (profonde.length > 0) {
      return {
        records: profonde,
        disqualified: false,
        oltreOrizzonte: adattivo.oltreOrizzonte,
        vociAdattive: adattivo.voci,
        senzaScadenza: adattivo.senzaScadenza,
      };
    }
    if (adattivo.records.length > 0) {
      return {
        records: adattivo.records,
        disqualified: false,
        oltreOrizzonte: adattivo.oltreOrizzonte,
        vociAdattive: adattivo.voci,
        senzaScadenza: adattivo.senzaScadenza,
      };
    }
    // Layout RICONOSCIUTO senza scadenze dichiarate (tipico: elenco di avvisi
    // con la sola data di pubblicazione): la fonte è viva e resta attiva. Non
    // si disattiva un portale perché oggi non pubblica un termine — si
    // disattiva una pagina che non è un elenco di interpelli.
    if (universale?.success && universale.layoutDetected !== 'table') {
      console.log(
        `[table-reporter] Layout «${universale.layoutDetected}» senza scadenze dichiarate ` +
          `(voci=${universale.items.length}, senza scadenza=${adattivo.senzaScadenza}) — target mantenuto attivo.`
      );
      return {
        records: [],
        disqualified: false,
        oltreOrizzonte: adattivo.oltreOrizzonte,
        vociAdattive: adattivo.voci,
        senzaScadenza: adattivo.senzaScadenza,
      };
    }
    console.log(
      '[table-reporter] Pagina priva di tabella interpelli riconoscibile — skip.'
    );
    return { records: [], disqualified: true };
  }

  const defaultProvince = (
    target.province || CONFIG.fallbackProvince
  ).toUpperCase();
  const region = target.region;

  const urlProvince = extractProvinceFromUrl(target.url);

  $('table').each((_tableIdx, tableEl) => {
    const $table = $(tableEl);

    const headers = getTableHeaders($, tableEl as cheerio.Element);
    const columns = detectColumns(headers);

    // FIX v10: se la colonna stato non è mappata, prova a rilevarla
    // analizzando i valori delle celle della prima riga di dati.
    let stateIdxDynamic = columns.stateIdx;
    if (stateIdxDynamic < 0) {
      const firstDataRow = $table.find('tr').eq(1);
      if (firstDataRow.length > 0) {
        const firstColTexts = firstDataRow
          .find('td')
          .map((_, el) => normalize($(el).text()))
          .get();
        const detected = detectStateColumnByCellText(firstColTexts);
        if (detected >= 0) {
          stateIdxDynamic = detected;
          if (CONFIG.debug) {
            console.log(
              `[table-reporter][debug] Colonna stato rilevata dinamicamente: indice ${detected}`
            );
          }
        }
      }
    }

    $table.find('tr').each((rowIndex, rowEl) => {
      const $row = $(rowEl);

      // Salta righe header.
      if (rowIndex === 0 && $row.find('th').length > 0) return;
      if (rowIndex === 0 && headers.length > 0 && $row.find('td').length > 0) {
        // La prima riga è stata usata come header.
        return;
      }

      const cols = $row.find('td');
      if (cols.length < 2) return;

      const colTexts: string[] = cols
        .map((_, el) => normalize($(el).text()))
        .get();

      const fullRowText = colTexts.join(' ');
      const fullRowTextLower = fullRowText.toLowerCase();

      // Anti-spam sindacale.
      if (rowIsNoise(fullRowTextLower)) return;

      // Pre-filtro semantico: una riga con CIG, determine, TFR o circolari per
      // le famiglie non è un'opportunità, qualunque colonna la contenga.
      if (rowIsSemanticNoise(fullRowText, target.url)) return;

      // -----------------------------------------------------------------
      // SCADENZA — SOLO la colonna che la dichiara (FIX v13, §26.75)
      // -----------------------------------------------------------------
      // Prima qui c'erano tre ripieghi in cascata: keyword in qualsiasi cella,
      // «QUALSIASI data futura in qualsiasi cella» e — se non si trovava nulla —
      // `oggi + 15 giorni`. Sulla tabella Piemonte il secondo pescava la FINE
      // dell'incarico dalla colonna «Data Interpello» (07/10/2027, 30/06/2027) e
      // il terzo inventava una scadenza: entrambi producevano badge verdi «In
      // corso» su contratti annuali già chiusi.
      //
      // Regola nuova: la data si legge SOLO dalla colonna mappata (o da una cella
      // che scrive «Scadenza»), altrimenti la riga si scarta. Nessuna data di
      // pubblicazione, nessuna durata della supplenza, nessuna data inventata.
      //
      // FIX v16 (§26.80): la scadenza si calcola PRIMA del link. Serve a
      // distinguere «riga chiusa» da «riga candidabile senza azione», che è il
      // sintomo dello snapshot Piemonte con lo stato non aggiornato.
      //
      // §26.88 — RIPIEGO DICHIARATO: se né la colonna mappata né una cella
      // scrivono la data, si accetta la scadenza che la riga DICHIARA con
      // un'etichetta («Scadenza», «entro il», «termine per la presentazione»,
      // vedi `estraiDataScadenza`). Non è un'invenzione: è la stessa regola del
      // §26.75 (nessuna data dedotta dalla pubblicazione o dalla durata), estesa
      // ai casi in cui l'etichetta e la data stanno in due celle diverse, come
      // nelle tabelle degli UST.
      const deadline = deadlineDichiarata(colTexts, columns) ?? scadenzaDaRiga(fullRowText);
      if (!deadline) return;
      if (isExpired(deadline)) return;
      // §26.114 — oltre l'orizzonte di INGESTIONE (365 giorni) la data è un
      // refuso d'anno, non un termine: la riga non entra. Dentro l'anno la riga
      // entra con la data DICHIARATA: è la vetrina a decidere (feed 15 giorni,
      // bacheca pubblica senza tetto).
      if (!entroOrizzonte(deadline)) {
        scartateOltreOrizzonte += 1;
        return;
      }

      // -----------------------------------------------------------------
      // FIX v10 — FILTRO STATO
      // -----------------------------------------------------------------
      // Priorità:
      //   1) Colonna stato mappata o rilevata dinamicamente.
      //   2) Fallback: controllo sull'intera riga per "aperto" e assenza
      //      di "chiuso"/"cancellato".
      // FIX v15 (§26.79) — PIEMONTE: la colonna «Stato interpello» NON è
      // affidabile. Misurato il 22/10/2026 su VB (221 righe, due snapshot
      // serviti a minuti di distanza dallo stesso URL):
      //   · snapshot A: 7 «aperto», 202 «chiuso» → le 7 aperte sono esattamente
      //     le righe con scadenza futura (coerente);
      //   · snapshot B: 139 «aperto», 70 «chiuso» → le 139 aperte hanno tutte la
      //     scadenza PASSATA e le 7 con scadenza FUTURA sono marcate «chiuso».
      // Il flag è quindi rumore: se lo si segue si perdono gli avvisi veri
      // (snapshot B) o si accettano quelli impossibili (snapshot A/B misti).
      // Qui decide la SCADENZA dichiarata (isExpired + orizzonte, §26.75); lo
      // stato si usa solo per scartare una CANCELLAZIONE esplicita.
      const statoInaffidabile = isPiemonteTabellare(target.url);

      let stateText = '';
      if (stateIdxDynamic >= 0 && stateIdxDynamic < colTexts.length) {
        stateText = colTexts[stateIdxDynamic];
      }

      if (statoInaffidabile) {
        if (/\bcancellat|\bannullat|\brevocat/i.test(`${stateText} ${fullRowTextLower}`)) {
          return;
        }
      } else if (stateText) {
        if (!isRowOpen(stateText)) {
          return;
        }
      } else {
        // Fallback: se la riga non contiene "aperto" o contiene
        // esplicitamente "chiuso"/"cancellato", scarta.
        const hasOpen = /\baperto\b|\battivo\b|\bdisponibile\b/i.test(
          fullRowTextLower
        );
        const hasClosed = rowIndicatesClosed(fullRowTextLower);
        if (hasClosed && !hasOpen) {
          return;
        }
        if (!hasOpen && !hasClosed) {
          // Stato incerto: per i portali Piemonte, se non c'è indicazione,
          // accetta comunque la riga (potrebbe essere "aperto" implicito).
        }
      }

      // Link attivo (oppure ancora stabile per i portali con form POST).
      const $link = $row.find('a').first();
      const rawHref = $link.attr('href');
      let href = rawHref ? rawHref.trim() : '';

      if (!href || href === '#') {
        // FIX v11 — Piemonte: le righe non hanno <a>. L'azione è un
        // <input type="submit" value="Stampa 3574"> dentro un form POST
        // (`statointerpello_ambito.php`) che in GET restituisce una pagina
        // vuota (misurato il 22/10/2026: HTTP 200, 2.811 byte, nessun dato).
        // Si usa quindi la pagina di elenco con un'ancora stabile per riga:
        // `source_url` resta univoca per interpello e apribile dall'utente.
        const progr = $row
          .find('input[name="progr"]')
          .first()
          .attr('value');
        const progrValue = progr ? String(progr).trim() : '';
        if (!progrValue) {
          // Riga candidabile ma senza link: è lo snapshot Piemonte in cui il
          // portale non ha ancora riallineato stato e azioni (FIX v16, §26.80).
          righeSenzaAzione += 1;
          return;
        }
        href = `${target.url}#progr=${progrValue}`;
      }

      const linkText = $link.length > 0 ? normalize($link.text()) : '';

      // -----------------------------------------------------------------
      // FIX v10 — CODICE MECCANOGRAFICO da qualsiasi cella
      // -----------------------------------------------------------------
      let schoolCode = 'ND';

      // 1) Colonna mappata.
      if (columns.codeIdx >= 0 && columns.codeIdx < colTexts.length) {
        schoolCode = extractMechCode(colTexts[columns.codeIdx]);
      }

      // 2) Prima cella (posizionale).
      if (schoolCode === 'ND') {
        schoolCode = extractMechCode(colTexts[0] || '');
      }

      // 3) Qualsiasi cella (fallback aggressivo).
      if (schoolCode === 'ND') {
        for (const cell of colTexts) {
          schoolCode = extractMechCode(cell);
          if (schoolCode !== 'ND') break;
        }
      }

      // 4) Intera riga.
      if (schoolCode === 'ND') {
        schoolCode = extractMechCode(fullRowText);
      }

      // Provincia.
      let province: string;
      if (schoolCode !== 'ND' && isLikelyMechCode(schoolCode)) {
        const derivedProv = schoolCode.slice(0, 2).toUpperCase();
        if (PROVINCE_CODES.has(derivedProv)) {
          province = derivedProv;
        } else if (urlProvince) {
          province = urlProvince;
        } else {
          province = defaultProvince;
        }
      } else if (urlProvince) {
        province = urlProvince;
      } else {
        province = defaultProvince;
      }

      if (province === 'EE' && target.url) {
        const aggressive = extractProvinceFromUrl(target.url);
        if (aggressive) {
          province = aggressive;
        }
      }

      // -----------------------------------------------------------------
      // FIX v10 — NOME SCUOLA da qualsiasi colonna
      // -----------------------------------------------------------------
      let schoolName = '';

      // 1) Colonna mappata.
      if (columns.schoolIdx >= 0 && columns.schoolIdx < colTexts.length) {
        schoolName = colTexts[columns.schoolIdx];
      }

      // 2) Seconda cella (posizionale).
      if (
        !schoolName ||
        schoolName.length < CONFIG.minSchoolNameLength ||
        schoolName.toLowerCase().includes('non specificata')
      ) {
        const secondCellText = colTexts[1] || '';
        if (
          secondCellText &&
          secondCellText.length >= CONFIG.minSchoolNameLength &&
          !secondCellText.toLowerCase().includes('non specificata')
        ) {
          schoolName = secondCellText;
        }
      }

      // 3) Testo del link.
      if (
        !schoolName ||
        schoolName.length < CONFIG.minSchoolNameLength ||
        schoolName.toLowerCase().includes('non specificata')
      ) {
        if (
          linkText &&
          linkText.length >= CONFIG.minSchoolNameLength &&
          !linkText.toLowerCase().includes('non specificata')
        ) {
          schoolName = linkText;
        }
      }

      // 4) Codice meccanografico come ultima spiaggia.
      if (
        !schoolName ||
        schoolName.length < CONFIG.minSchoolNameLength ||
        schoolName.toLowerCase().includes('non specificata')
      ) {
        if (schoolCode !== 'ND') {
          schoolName = `Istituto ${schoolCode}`;
        }
      }

      if (!schoolName || schoolName.length < CONFIG.minSchoolNameLength) return;
      if (schoolName.toLowerCase().includes('scuola non specificata')) return;
      if (href.includes('artov.rm.cnr.it')) return;

      // (La scadenza è già stata validata sopra, prima del link: FIX v16.)

      const { classCode, subject } = extractSubjectAndClass(fullRowText);
      // FIX v12 — prima la colonna «Classe di concorso» (copre anche i codici
      // nudi, senza descrizione), poi la cella «CODICE - DESCRIZIONE», infine
      // il match sul testo intero della riga.
      const classFromColumn =
        (columns.classIdx >= 0 && columns.classIdx < colTexts.length
          ? classCodeNudo(colTexts[columns.classIdx])
          : null) ?? extractClassCodeFromCell(colTexts);
      const finalClassCode = classFromColumn ?? classCode;
      const sourceUrl = resolveUrl(href, target.url);
      const title = `${schoolName} - Interpello Ufficiale`;
      const hashId = generateHashId(province, schoolCode, title, sourceUrl);

      records.push({
        hash_id: hashId,
        title,
        school_name: schoolName,
        school_code: schoolCode,
        province,
        region,
        class_code: finalClassCode,
        class_codes: classiArray(finalClassCode, classCode),
        subject,
        deadline,
        expiration_date: aExpirationDate(deadline),
        source_url: sourceUrl,
      });
    });
  });

  if (scartateOltreOrizzonte > 0) {
    console.log(
      `[table-reporter] ${scartateOltreOrizzonte} righe scartate: «scadenza» oltre l'orizzonte di ${GIORNI_ORIZZONTE_INGESTIONE} giorni (data illeggibile o refuso d'anno).`
    );
  }

  if (righeSenzaAzione > 0) {
    console.log(
      `[table-reporter] ${righeSenzaAzione} righe candidabili ma SENZA azione (snapshot con stato non aggiornato).`
    );
  }

  return { records, disqualified: false, righeSenzaAzione, oltreOrizzonte: scartateOltreOrizzonte };
}

// ---------------------------------------------------------------------------
// Utility: estrazione materia / classe di concorso
// ---------------------------------------------------------------------------

function extractSubjectAndClass(text: string): {
  classCode: string;
  subject: string;
} {
  const classMatch = text.match(/\b([A-E][0-9]{2}|[A-Z]{2,3}[0-9]{1,2})\b/i);
  const classCode = classMatch ? classMatch[1].toUpperCase() : 'GENERALE';

  let subject = 'Non specificata';
  const t = text.toLowerCase();

  if (t.includes('sostegno')) subject = 'Sostegno';
  else if (t.includes('inglese')) subject = 'Inglese';
  else if (t.includes('matematica')) subject = 'Matematica';
  else if (t.includes('italiano')) subject = 'Italiano';
  else if (t.includes('fisica')) subject = 'Fisica';
  else if (t.includes('chimica')) subject = 'Chimica';
  else if (t.includes('storia')) subject = 'Storia';
  else if (t.includes('filosofia')) subject = 'Filosofia';
  else if (t.includes('latino')) subject = 'Latino';
  else if (t.includes('scienze')) subject = 'Scienze';

  return { classCode, subject };
}

// FIX v12 — codice classe di concorso: le fonti ufficiali usano TRE forme.
//   · 4-6 lettere            → `AAAA`, `EEEE`, `ADEE`, `AAIRC`
//   · 2 lettere + 2 cifre    → `AA24`, `AB25`, `BD02`, `AG55`
//   · 1 lettera + 2/3 cifre  → `A026`, `A029`, `A041`, `A048`
// Il pattern v11 (`[A-Za-z]{2,6}[0-9]{0,2}`) pretendeva DUE lettere e rifiutava
// la terza forma: «A041 - Scienze e tecnologie informatiche» ricadeva su
// `extractSubjectAndClass` → `GENERALE` (17 righe Piemonte, 33 Liguria il
// 22/10/2026: nessuna poteva fare match con il profilo dell'utente).
const CLASS_CODE_SHAPE = /^(?:[A-Z]{1,2}[0-9]{2,3}|[A-Z]{4,6})$/;

// Il codice deve essere seguito da un separatore: senza questo vincolo celle
// come «DIURNO» o «POSTO INTERO» verrebbero lette come codici di 4-5 lettere.
const CLASS_CODE_HEAD = /^([A-Za-z]{1,2}[0-9]{2,3}|[A-Za-z]{4,6})\s*[-–—]\s*\S/;

/** Codice «nudo» in una cella dedicata (`A044`, `ADEE`, `AAIRC`) oppure null. */
function classCodeNudo(raw: string): string | null {
  const code = normalize(raw).toUpperCase();
  return CLASS_CODE_SHAPE.test(code) ? code : null;
}

/** Segnaposto che NON sono classi di concorso (stessa lista del mapper, §26.119). */
const CLASS_CODE_SEGNAPOSTO = new Set(['GENERALE', 'ND', 'N.A.', 'NON SPECIFICATA']);

/**
 * Classi in ARRAY (`class_codes`) accanto al singolare (`class_code`).
 *
 * Perché serve (§26.119): la RPC `match_interpelli` filtra con `class_codes &&
 * varianti` e il fallback PostgREST con `.overlaps('class_codes', …)`. Scrivendo
 * solo la colonna singolare, la riga entrava nel database ma nessuna ricerca per
 * classe poteva vederla: la bacheca dell'utente restava vuota pur avendo avvisi
 * attivi. Si deduplica, si alza il caso e si scartano i segnaposto: «GENERALE»
 * significa «nessuna classe riconosciuta» e non deve diventare una classe.
 */
function classiArray(...codici: (string | null | undefined)[]): string[] {
  return [
    ...new Set(
      codici
        .flatMap((codice) => (codice ?? '').split(/[,;|]/))
        .map((codice) => codice.trim().toUpperCase())
        .filter((codice) => codice.length > 0 && !CLASS_CODE_SEGNAPOSTO.has(codice)),
    ),
  ];
}

/** Codice all'INIZIO di una cella con descrizione (`A041 - Scienze…` → `A041`,
 *  `ADEE - EH` → `ADEE`) oppure null. */
function classCodeInTesta(raw: string): string | null {
  const m = normalize(raw).toUpperCase().match(CLASS_CODE_HEAD);
  return m ? m[1] : null;
}

// FIX v11 — codice classe di concorso dalla cella esplicita
// (Piemonte: «AAAA - INFANZIA», «ADEE - SOSTEGNO SCUOLA PRIMARIA»).
// Il match sul testo intero della riga può agganciare altri token; la colonna
// dedicata è la fonte affidabile e ha la precedenza.
function extractClassCodeFromCell(colTexts: string[]): string | null {
  for (const raw of colTexts) {
    const code = classCodeInTesta(raw);
    if (code) return code;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Orchestrazione — disattivazione target inutili
// ---------------------------------------------------------------------------

const JUNK_UMBRIA_URL_PATTERNS: RegExp[] = [
  /amministrazione[-\s_]?trasparente/i,
  /albo[-\s_]?online/i,
];

async function disableObviousJunkTargets(): Promise<number> {
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, url, status')
    .eq('region', 'Umbria')
    .eq('status', 'active_crawler');

  if (error) {
    console.error(
      `[table-reporter] Errore query Umbria (cleanup iniziale): ${error.message}`
    );
    return 0;
  }

  const ids = (data ?? [])
    .filter((row) =>
      JUNK_UMBRIA_URL_PATTERNS.some((re) => re.test(String(row.url ?? '')))
    )
    .map((row) => row.id);

  if (ids.length === 0) {
    console.log(
      '[table-reporter] Cleanup iniziale: nessun link Umbria generico da disattivare.'
    );
    return 0;
  }

  const { error: updErr } = await supabase
    .from('discovered_links')
    .update({ status: CONFIG.disqualifiedStatus })
    .in('id', ids);

  if (updErr) {
    console.error(
      `[table-reporter] Errore disattivazione Umbria (cleanup iniziale): ${updErr.message}`
    );
    return 0;
  }

  console.log(
    `[table-reporter] Cleanup iniziale: disattivati ${ids.length} link Umbria generici.`
  );
  return ids.length;
}

async function disqualifyTarget(
  target: DiscoveredLink,
  status: string = CONFIG.disqualifiedStatus
): Promise<void> {
  const { error } = await supabase
    .from('discovered_links')
    .update({ status })
    .eq('id', target.id);

  if (error) {
    console.error(
      `[table-reporter] Errore disattivazione ${target.url}: ${error.message}`
    );
  } else {
    console.log(
      `[table-reporter] Target disattivato (${status}): ${target.url}`
    );
  }
}

// ---------------------------------------------------------------------------
// Orchestrazione — main
// ---------------------------------------------------------------------------

async function loadTargets(): Promise<DiscoveredLink[]> {
  const { data, error } = await supabase
    .from('discovered_links')
    .select('id, url, region, province, status')
    .eq('status', 'active_crawler');

  if (error) {
    throw new Error(`Errore query discovered_links: ${error.message}`);
  }

  const rows = ((data ?? []) as DiscoveredLink[]).map((row) => ({
    ...row,
    origine: 'db' as const,
    // §26.94 — una riga del DB che corrisponde a una fonte verificata resta
    // "verificata" anche quando arriva dalla coda: non si disattiva da sola.
    verificata: CHIAVI_WHITELIST.has(chiaveUrl(row.url)),
  }));

  // Giro nazionale: la coda del DB si prende TUTTA, senza filtro di regione.
  if (NAZIONALE || REGIONI_FILTRO.length === 0) return rows;

  return rows.filter((row) => regioneCorrisponde(row.region));
}

/**
 * Target in memoria dalla whitelist verificata (§26.93): gli hub USR/USP di
 * OGNI regione, nella forma che il loop si aspetta. Nessuna scrittura su
 * `discovered_links`: il giro nazionale legge e basta, così una dry-run non
 * lascia segni e un `--apply` non crea record senza storia.
 */
function targetDaWhitelist(): DiscoveredLink[] {
  return targetWhitelist(undefined, { soliHub: true }).map((target) => ({
    id: `whitelist:${target.fonte}`,
    url: target.url,
    region: target.region,
    province: target.province,
    status: 'active_crawler',
    origine: 'whitelist' as const,
    etichetta: target.etichetta,
  }));
}

/** Unione per URL canonica: il record del DB vince (id, telemetria, storia). */
function unisciTarget(db: DiscoveredLink[], whitelist: DiscoveredLink[]): DiscoveredLink[] {
  const visti = new Set(db.map((target) => chiaveUrl(target.url)));
  return [...db, ...whitelist.filter((target) => !visti.has(chiaveUrl(target.url)))];
}

/** Campione deterministico per regione (0 = nessun limite). */
function limitaPerRegione(targets: DiscoveredLink[]): DiscoveredLink[] {
  if (MAX_PER_REGIONE === 0) return targets;
  const conteggio = new Map<string, number>();
  const out = targets.filter((target) => {
    const chiave = target.region ?? 'N/D';
    const n = conteggio.get(chiave) ?? 0;
    if (n >= MAX_PER_REGIONE) return false;
    conteggio.set(chiave, n + 1);
    return true;
  });
  console.log(
    `[table-reporter] Campione: max ${MAX_PER_REGIONE} target per regione (${out.length}/${targets.length}).`
  );
  return out;
}

/**
 * Chiave di un target nel runner. §26.101 — la QUERY conta: gli elenchi
 * provinciali della Liguria vivono sullo stesso percorso (`provincia.php?p=GE`,
 * `?p=SP`, `?p=IM`, `?p=SV`) e una chiave che la ignorava fondeva quattro fonti
 * verificate in una sola. `unisciTarget` e `CHIAVI_WHITELIST` usano questa.
 */
function chiaveUrl(url: string): string {
  try {
    const u = new URL(url);
    const base = `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
    return (u.search ? `${base}?${new URLSearchParams(u.search).toString()}` : base).toLowerCase();
  } catch {
    return String(url ?? '').trim().toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * §26.94 — URL canoniche delle fonti VERIFICATE del registro. Una riga della
 * coda che corrisponde a una di queste non viene disattivata da un giro a
 * vuoto: la fonte è verificata nel registro, non «promossa» dall'ingestione.
 */
const CHIAVI_WHITELIST = new Set(targetWhitelist().map((target) => chiaveUrl(target.url)));

// ---------------------------------------------------------------------------
// DEEP CRAWL DEGLI ISTITUTI (§26.94)
// ---------------------------------------------------------------------------
// L'hub USR/USP dice CHE la scuola assume; l'albo della scuola dice TUTTO ciò
// che quella scuola ha pubblicato. Qui, per ogni istituto citato negli avvisi
// del giro, si visita la sua casa ufficiale (risolta da `schools_master`) e si
// leggono le pagine «Interpelli / Albo» che la home linka davvero.

/** Titoli che sono davvero un interpello: l'albo pubblica anche altro. */
const RE_TITOLO_INTERPELLO =
  /interpell|supplenz|incaric|disponibilit|messa\s+a\s+disposizione/i;

/** True se l'URL appartiene allo STESSO istituto della home certificata. */
function stessoSito(url: string, home: string | null): boolean {
  if (!home) return false;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const hostHome = new URL(home).hostname.toLowerCase().replace(/^www\./, '');
    return host === hostHome || host.endsWith(`.${hostHome}`) || hostHome.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

/** Tetto di record per istituto: un albo può contenere anni di storia. */
const MAX_RECORD_SCUOLA = 40;
/**
 * Tetto di documenti aperti per istituto (scadenza nel corpo, §26.94).
 * Dal 26/10/2026 questi documenti sono spesso PDF; dal 29/10/2026 (§26.101) il
 * numero viene dalla politica di sgranatura (`documentiPerIstituto`), così una
 * campagna di massa alza la profondità senza toccare questo file.
 */
const MAX_APPROFONDIMENTI_SCUOLA = Math.max(1, LIMITI.documentiPerIstituto);
/** Allegati PDF letti da una pagina d'albo quando l'elenco non dà voci. */
const MAX_ALLEGATI_PAGINA = 4;
/**
 * Albi nuovi iscritti in coda per giro: senza tetto un solo giro può aggiungere
 * centinaia di URL e il giro successivo diventa ingestibile. 120 copre gli
 * istituti che il deep crawl visita davvero.
 */
const MAX_ALBI_CODA = 120;
/** URL d'albo già promossi in questo giro: la stessa pagina può ricomparire. */
const alboVisti = new Set<string>();

/** Scaricatore leggero per le pagine degli istituti: 10 s, nessun ritentativo. */
async function scaricaPaginaLeggera(
  url: string,
): Promise<{ status: number; contentType: string; html: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APPROFONDIMENTO_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': CONFIG.userAgent,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    const html = await response.text();
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      html,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ciò che serve a un record: una voce dell'albo (`ExtractedInterpello`) oppure un
 * allegato PDF (dove il «titolo» è il testo del link o il nome del file).
 */
interface VoceAlbo {
  title: string;
  schoolName?: string | null;
  classCodes?: string[];
  directUrl?: string | null;
  expirationDate?: string | null;
}

/** Voce dell'albo di un istituto → record con la scuola CERTIFICATA. */
function recordDaVoceScuola(
  voce: VoceAlbo,
  deadline: string,
  scuola: ScuolaCertificata,
  visti: Set<string>,
  /** §26.116 — recapiti scritti nel documento letto (email ordinarie e PEC). */
  recapiti?: { email?: readonly string[]; pec?: readonly string[] } | null,
): InterpelloRecord | null {
  const title = normalize(voce.title);
  if (title.length < 8 || !RE_TITOLO_INTERPELLO.test(title)) return null;
  const schoolCode = scuola.codice ?? extractMechCode(`${title} ${voce.schoolName ?? ''}`);
  if (!isLikelyMechCode(schoolCode)) return null;
  const province = schoolCode.slice(0, 2).toUpperCase();
  // L'avviso deve essere un documento APRIBILE della scuola stessa: mai la home
  // (non identifica l'avviso) e mai un albo su piattaforma privata (Argo).
  // §26.96 — UN'ECCEZIONE DICHIARATA: un FILE su una piattaforma documentale
  // (`…/avviso.pdf` su Argo, Gecodoc, Nuvola) è l'avviso ufficiale, non un login:
  // la regola dello «stesso sito» non si applica e il documento resta apribile.
  // §26.101 — e vale anche per un link PROFONDO sulla bacheca della piattaforma
  // (`nuvola.madisoft.it/bacheca-digitale/bacheca/<CODICE>/…`): è la pagina che
  // la scuola ha pubblicato, non una credenziale.
  // §26.108 — su una piattaforma di LOGIN il link profondo deve stare in un
  // CONTENITORE PUBBLICO (bacheca/albo/pubblicazioni/documenti): un'area
  // applicativa come `…/interpelli/<CODICE>/docenti/<uuid>/candidatura` è il
  // modulo del docente (guscio JS `noindex` che chiede il login) e resta fuori.
  const sourceUrl = (voce.directUrl ?? '').trim();
  const allegato =
    eAllegatoPiattaforma(sourceUrl) || eAvvisoSuPiattaforma(sourceUrl);
  if (!allegato && (!urlVerificabile(sourceUrl) || !stessoSito(sourceUrl, scuola.home))) {
    return null;
  }
  const hashId = generateHashId(province, schoolCode, title, sourceUrl);
  if (visti.has(hashId)) return null;
  visti.add(hashId);

  const classCodes = voce.classCodes ?? [];
  const { classCode, subject } = extractSubjectAndClass(`${title} ${classCodes.join(' ')}`);
  const classCodeVoce = (classCodes[0] ?? '').replace(/[-_\s]/g, '');
  const schoolName = scuola.nome ?? voce.schoolName ?? `Istituto ${schoolCode}`;
  // §26.115 — MODELLO LIGURIA: il recapito si deriva dal codice meccanografico
  // (PEO/PEC della convenzione MIM), così la riga nasce con un destinatario e
  // non «Email non disponibile». Solo per codici validi: `null` altrimenti.
  // §26.116 — GERARCHIA del contatto (`lib/gerarchiaContatti`): le caselle scritte
  // nel DOCUMENTO e quelle dell'anagrafica MIM sono OSSERVATE e valgono più della
  // PEO ricostruita dal codice; nell'ordine contano PEO → segreteria → dirigenza →
  // generica, con la PEC come estrema ratio e i domini personali sempre esclusi.
  const caselle = emailDaCodiceMeccanografico(schoolCode);
  const contatto = scegliContatto([
    ...(recapiti?.email ?? []).map((email) => ({ email, provenienza: 'documento' })),
    ...(recapiti?.pec ?? []).map((email) => ({ email, provenienza: 'documento' })),
    { email: scuola.email, provenienza: 'anagrafica' },
    { email: caselle?.peo, provenienza: 'convenzione', derivato: true },
    { email: caselle?.pec, provenienza: 'convenzione', derivato: true },
  ]);
  const contactEmail = contatto && contatto.natura !== 'esterno' ? contatto.email : null;
  const schoolPec = scuola.pec ?? caselle?.pec ?? recapiti?.pec?.[0] ?? null;
  return {
    hash_id: hashId,
    title,
    school_name: schoolName,
    school_code: schoolCode,
    province,
    // La regione viene dal catalogo province: mai dal target che ha citato la
    // scuola (un hub nazionale cita istituti di mezza Italia).
    region: provinciaDaCodice(province)?.regione ?? null,
    class_code: CLASS_CODE_SHAPE.test(classCodeVoce) ? classCodeVoce : classCode,
    class_codes: classiArray(
      CLASS_CODE_SHAPE.test(classCodeVoce) ? classCodeVoce : classCode,
      ...classCodes,
    ),
    subject,
    deadline,
    expiration_date: aExpirationDate(deadline),
    source_url: sourceUrl,
    contact_email: contactEmail,
    school_pec: schoolPec,
    stato_arricchimento: statoArricchimento({
      school_name: schoolName,
      school_code: schoolCode,
      contact_email: contactEmail,
      school_pec: schoolPec,
    }),
  };
}

/**
 * §26.95 — ALBO VERIFICATO → CODA PERMANENTE.
 *
 * Un albo che QUESTA scuola linka dalla propria home e che contiene almeno una
 * voce d'interpello non è un link scoperto per caso: è una fonte. Si iscrive in
 * `discovered_links` come `active_crawler`, così il giro successivo la legge
 * come target e non deve più riscoprirla (né dipendere da una citazione).
 *
 * Regole (le stesse della certificazione): stesso istituto della home
 * certificata, URL http(s) verificabile, mai una piattaforma privata. Un URL già
 * attivo non si riscrive; uno disattivato torna attivo (la pagina esiste
 * davvero). In dry-run non si scrive nulla e si conta come `nuovo`.
 */
async function promuoviPaginaAlbo(
  url: string,
  scuola: ScuolaCertificata,
): Promise<'nuovo' | 'riattivato' | 'gia-attivo' | null> {
  if (!urlVerificabile(url) || !stessoSito(url, scuola.home)) return null;
  let domain: string;
  try {
    domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  if (DRY_RUN) return 'nuovo';
  try {
    const { data, error } = await supabase
      .from('discovered_links')
      .select('status')
      .eq('url', url)
      .maybeSingle();
    if (error) throw new Error(error.message);
    // `active_crawler` = STATO_ATTIVO di `lib/codaTargets.ts`.
    const stato = (data as { status?: string } | null)?.status ?? null;
    if (stato === 'active_crawler') return 'gia-attivo';
    const adesso = new Date().toISOString();
    const esito = stato
      ? await supabase
          .from('discovered_links')
          .update({ status: 'active_crawler', last_scanned_at: adesso })
          .eq('url', url)
      : await supabase.from('discovered_links').insert({
          url,
          domain,
          region: null,
          province: scuola.provincia?.toUpperCase() ?? null,
          status: 'active_crawler',
          depth: 2,
          parent_url: scuola.home,
          last_scanned_at: adesso,
        });
    if (esito.error) throw new Error(esito.error.message);
    return stato ? 'riattivato' : 'nuovo';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[table-reporter] Albo non accodato (${url}): ${msg}`);
    return null;
  }
}

/**
 * Fase 2 del giro: visita le case degli istituti citati e ingerisce i loro
 * interpelli attivi. `scuole` è codice meccanografico → nome visto in fonte.
 * Nessuna eccezione esce da qui: un sito rotto è una riga di log, non un giro
 * perso.
 */
async function deepCrawlScuole(scuole: Map<string, string>): Promise<void> {
  if (!DEEP_CRAWL) {
    console.log(
      '[table-reporter] Deep crawl degli istituti disattivato (--no-deep o --max-scuole=0).',
    );
    return;
  }
  if (scuole.size === 0) {
    console.log('[table-reporter] Deep crawl: nessun istituto citato in questo giro.');
    return;
  }
  const anagrafica = caricaAnagrafica();
  const elenco = [...scuole.entries()].slice(0, MAX_SCUOLE_DEEP);
  console.log(
    `[table-reporter] Deep crawl: ${elenco.length} istituti su ${scuole.size} citati ` +
      `(tetto ${MAX_SCUOLE_DEEP}, ${MAX_PAGINE_SCUOLA} pagine per istituto).`,
  );

  let visitati = 0;
  let senzaSito = 0;
  let pagine = 0;
  let trovati = 0;
  let nuovi = 0;
  let errori = 0;
  let albiNuovi = 0;
  let albiRiattivati = 0;
  let albiGiaAttivi = 0;

  for (const [codice, nome] of elenco) {
    const scuola = scuolaCertificata(anagrafica, { codice });
    if (!scuola?.home) {
      senzaSito += 1;
      continue;
    }
    const esito = await leggiPagineInterpelli(
      { codice: scuola.codice, nome: scuola.nome ?? nome, home: scuola.home },
      scaricaPaginaLeggera,
      { maxPagine: MAX_PAGINE_SCUOLA },
    );
    if (esito.pagine.length === 0) {
      if (esito.errori.length > 0) {
        errori += 1;
        if (CONFIG.debug) {
          console.log(`[table-reporter] Deep crawl ${codice}: ${esito.errori.join('; ')}`);
        }
      }
      continue;
    }
    visitati += 1;
    const visti = new Set<string>();
    const records: InterpelloRecord[] = [];
    let approfondimentiScuola = 0;
    let voci = 0;
    let vociInterpello = 0;
    for (const pagina of esito.pagine) {
      pagine += 1;
      let interpelliPagina = 0;
      // §26.115 — PAGINA-GUSCIO: vale solo per gli allegati. In un guscio le
      // «voci» sarebbero le voci di menu, e un menu non è un interpello.
      if (!pagina.soloAllegati) {
        const universale = parseUniversalHtml(pagina.html, pagina.url);
        if (universale.success) {
          for (const voce of universale.items) {
            if (records.length >= MAX_RECORD_SCUOLA) break;
            voci += 1;
            if (RE_TITOLO_INTERPELLO.test(voce.title)) {
              vociInterpello += 1;
              interpelliPagina += 1;
            }
            let deadline = voce.expirationDate ?? null;
            if (!deadline && approfondimentiScuola < MAX_APPROFONDIMENTI_SCUOLA) {
              approfondimentiScuola += 1;
              deadline = await scadenzaDaCorpoAvviso(voce.directUrl, 'scuola');
            }
            if (!deadline || isExpired(deadline) || !entroOrizzonte(deadline)) continue;
            const record = recordDaVoceScuola(voce, deadline, scuola, visti);
            if (record) records.push(record);
          }
        }
      }
      // §26.95 — albo che elenca SOLO file: l'elenco non dà voci, ma i PDF sono
      // documenti veri. Se ne leggono al massimo due, col termine dentro.
      // §26.115 — il documento si legge INTERO (non solo la data): classe, ore e
      // intestazione diventano i campi della riga e l'atterraggio è il PDF.
      if (interpelliPagina === 0) {
        // §26.123 — SPOONFEEDING: se il deep crawl ha già risolto il PDF unico
        // del contenitore/guscio (`allegatoUnico`), si usa QUELL'indirizzo:
        // niente secondo scan dei link e nessun rischio di atterrare
        // sull'elenco invece che sul documento ufficiale.
        const allegati = pagina.allegatoUnico
          ? [{ url: pagina.allegatoUnico, testo: '', punteggio: 0 }]
          : linkAllegatiInterpello(pagina.html, pagina.url, MAX_ALLEGATI_PAGINA);
        for (const allegato of allegati) {
          if (approfondimentiScuola >= MAX_APPROFONDIMENTI_SCUOLA) break;
          approfondimentiScuola += 1;
          const documento = await leggiAvvisoCompleto(allegato.url, 'scuola');
          if (!documento.deadline) continue;
          if (isExpired(documento.deadline) || !entroOrizzonte(documento.deadline)) continue;
          const record = recordDaVoceScuola(
            {
              title: titoloBandoDaDocumento({
                testo: documento.titolo,
                fallback: titoloDaAllegato(allegato.testo, allegato.url),
                classi: documento.classi,
                ore: documento.ore,
              }),
              schoolName: scuola.nome,
              classCodes: documento.classi,
              directUrl: allegato.url,
            },
            documento.deadline,
            scuola,
            visti,
            // §26.116 — i recapiti scritti nel bando entrano nella riga: se il
            // documento indica la segreteria, è quella la casella da usare.
            documento,
          );
          if (record) records.push(record);
        }
      }
      // §26.95 — pagina-elenco VERIFICATA (almeno una voce d'interpello dentro):
      // diventa una fonte permanente della coda, una volta per giro.
      if (interpelliPagina > 0 && alboVisti.size < MAX_ALBI_CODA && alboVisti.add(pagina.url)) {
        const esitoAlbo = await promuoviPaginaAlbo(pagina.url, scuola);
        if (esitoAlbo === 'nuovo') albiNuovi += 1;
        else if (esitoAlbo === 'riattivato') albiRiattivati += 1;
        else if (esitoAlbo === 'gia-attivo') albiGiaAttivi += 1;
        if (CONFIG.debug && esitoAlbo) {
          console.log(`[table-reporter] Albo in coda (${esitoAlbo}): ${pagina.url}`);
        }
      }
    }
    if (CONFIG.debug) {
      console.log(
        `[table-reporter] Deep crawl ${codice}: ${esito.linkTrovati} link · ` +
          `${esito.pagine.length} pagine · ${voci} voci (${vociInterpello} interpelli) · ` +
          `${records.length} record` +
          (esito.allegatiTrovati > 0 ? ` · guscio con ${esito.allegatiTrovati} allegati` : '') +
          (esito.errori.length > 0 ? ` — ${esito.errori.join('; ')}` : ''),
      );
    }
    trovati += records.length;
    if (records.length === 0) continue;
    if (DRY_RUN) {
      logRecords(records);
      continue;
    }
    try {
      nuovi += await salvaRecords(records);
    } catch (err) {
      errori += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[table-reporter] Deep crawl ${codice}: upsert fallito — ${msg}`);
    }
  }

  console.log(
    `[table-reporter] Deep crawl: ${visitati} siti letti · ${pagine} pagine · ` +
      `${trovati} record · ${nuovi} nuovi in DB · ${senzaSito} senza sito · ${errori} errori.`,
  );
  console.log(
    `[table-reporter] Albi verificati in coda: ${albiNuovi} nuovi · ` +
      `${albiRiattivati} riattivati · ${albiGiaAttivi} già attivi.`,
  );
}

// Dry-run: una riga per record, con i campi che il match usa davvero.
// `class_code = null` = «GENERALE» (nessuna classe riconosciuta): è la firma
// del bug dei codici «A041» che questa versione corregge.
function logRecords(records: InterpelloRecord[]): void {
  for (const r of records) {
    console.log(
      `[dry-run] ${r.province} | ${r.region} | ${r.class_code ?? 'GENERALE'} | ${r.deadline} | ${r.school_code} | ${r.school_name} | ${r.source_url}`
    );
  }
}

// ---------------------------------------------------------------------------
// FIX v16 (§26.80) — PIEMONTE: due snapshot, uno solo è usabile
// ---------------------------------------------------------------------------
// MISURATO il 22/10/2026 su `servizi.istruzionepiemonte.it` (VB, stesso URL a
// pochi secondi di distanza): le 221 righe sono identiche, ma il portale serve
// due varianti della tabella —
//   · coerente:   7 righe «aperto», 202 «chiuso», e l'azione `progr` (il link
//     «Stampa») presente SOLO sulle 7 righe candidabili;
//   · non allineata: 139 «aperto» (tutte con scadenza passata), 70 «chiuso» e
//     azione presente SOLO su quelle 139; le 7 righe con scadenza FUTURA
//     restano «chiuso» e SENZA `progr`.
// Nella seconda variante le righe vere non hanno né stato né link: senza azione
// non esiste `source_url` e quindi non sono ingeribili. Su TO le righe «aperto»
// sono variate 58→471 in cinque fetch, mentre quelle con scadenza entro
// l'orizzonte restavano 43: la parte stabile del dato è la SCADENZA.
// Qui: i target tabellari Piemonte ignorano il flag di stato (conta la scadenza,
// §26.75) e, se resta una riga candidabile senza azione, il target viene
// rifetchato (max 6 tentativi, 3 s) tenendo il tentativo con più record.
const PIEMONTE_TENTATIVI = 6;
const PIEMONTE_ATTESA_MS = 3000;

function isPiemonteTabellare(url: string): boolean {
  return /servizi\.istruzionepiemonte\.it\/interpello\d{4}\/ric_interpello_ambito_/i.test(
    url
  );
}

function attesa(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upsert dei record + accodamento delle NUOVE voci (§26.86).
 *
 * `.select('id')` con `ignoreDuplicates` restituisce SOLO le righe davvero
 * inserite (l'ON CONFLICT DO NOTHING non fa RETURNING per i duplicati): sono
 * esattamente i nuovi interpelli da accodare, senza rischio di notificare
 * l'archivio storico. Lancia in caso di errore: il chiamante decide se è un
 * errore del target (ingestione) o solo del deep crawl (§26.94).
 */
async function salvaRecords(records: readonly InterpelloRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  // GIRO MIRATO (§26.119): un filtro provincia si applica anche a CIÒ CHE SI SCRIVE,
  // non solo ai target letti. Un hub regionale elenca avvisi di mezza regione: senza
  // questo taglio un «giro solo Asti» riempiva il database di righe di Torino e
  // Alessandria. Lo scarto è dichiarato, mai silenzioso.
  const daScrivere = PROVINCE_FILTRO.length === 0
    ? records
    : records.filter((record) => provinciaCorrisponde(record.province));
  if (daScrivere.length !== records.length) {
    console.log(
      `[table-reporter] Giro mirato (${PROVINCE_FILTRO.join(', ')}): ` +
        `${records.length - daScrivere.length} record di altre province non scritti ` +
        `(${daScrivere.length}/${records.length} ammessi).`
    );
  }
  if (daScrivere.length === 0) return 0;
  const { data: inseriti, error } = await supabase
    .from('interpelli')
    .upsert(daScrivere, {
      onConflict: 'hash_id',
      ignoreDuplicates: true,
    })
    .select('id');

  if (error) throw new Error(error.message);

  const nuoviIds = ((inseriti ?? []) as Array<{ id?: string | null }>)
    .map((riga) => riga.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (nuoviIds.length > 0) {
    const accodati = await accodaInterpelli(nuoviIds, { client: supabase });
    console.log(
      `[table-reporter] Coda notifiche: ${accodati}/${nuoviIds.length} nuove voci READY.`,
    );
  }
  return nuoviIds.length;
}

/**
 * §26.96 — BACHECA SU PIATTAFORMA SENZA AVVISI → ALBO DELLA SCUOLA.
 *
 * Il giro legge i target della coda: se uno punta alla bacheca di Argo /
 * Nuvola–Spaggiari / Gecodoc e quella non dà nulla (login, archivio chiuso,
 * pagina vuota), il target verrebbe conteggiato come fonte morta e disattivato.
 * La scuola però esiste: dal CODICE MECCANOGRAFICO scritto nell'URL si risolve
 * la sua scheda su `schools_master` (nome, recapiti, home `.edu.it`) e si punta
 * l'ALBO della home — la stessa lettura del deep crawl, con le stesse regole di
 * scadenza e di certificazione. Nessun URL costruito a mano, nessun codice
 * inventato: se l'URL non dichiara il codice, non si fa nulla e lo si scrive.
 */
async function recuperaDaBachecaPiattaforma(target: DiscoveredLink): Promise<InterpelloRecord[]> {
  const decisione = meritaFallback(target.url, '', 0);
  if (!decisione.attivo || !decisione.codice) {
    if (decisione.piattaforma) {
      console.log(
        `[table-reporter] Piattaforma ${decisione.piattaforma.etichetta}: nessun fallback (${decisione.motivo}).`,
      );
    }
    return [];
  }
  const scuola = scuolaCertificata(caricaAnagrafica(), { codice: decisione.codice });
  if (!scuola?.home) {
    console.log(
      `[table-reporter] Piattaforma ${decisione.piattaforma?.etichetta ?? ''}: ${decisione.codice} non ha una home istituzionale in anagrafica.`,
    );
    return [];
  }
  const esito = await leggiPagineInterpelli(
    { codice: scuola.codice, nome: scuola.nome, home: scuola.home },
    scaricaPaginaLeggera,
    { maxPagine: MAX_PAGINE_SCUOLA },
  );
  if (esito.pagine.length === 0) {
    console.log(
      `[table-reporter] Piattaforma → albo ${decisione.codice}: nessuna pagina-elenco (${esito.errori.join('; ') || 'home senza link'}).`,
    );
    return [];
  }
  const records: InterpelloRecord[] = [];
  const visti = new Set<string>();
  let approfondimenti = 0;
  for (const pagina of esito.pagine) {
    const universale = parseUniversalHtml(pagina.html, pagina.url);
    if (!universale.success) continue;
    let interpelliPagina = 0;
    for (const voce of universale.items) {
      if (records.length >= MAX_RECORD_SCUOLA) break;
      if (RE_TITOLO_INTERPELLO.test(voce.title)) interpelliPagina += 1;
      let deadline = voce.expirationDate ?? null;
      if (!deadline && approfondimenti < MAX_APPROFONDIMENTI_SCUOLA) {
        approfondimenti += 1;
        deadline = await scadenzaDaCorpoAvviso(voce.directUrl, 'scuola');
      }
      if (!deadline || isExpired(deadline) || !entroOrizzonte(deadline)) continue;
      const record = recordDaVoceScuola(voce, deadline, scuola, visti);
      if (record) records.push(record);
    }
    // L'albo verificato entra in coda come per il deep crawl: il giro successivo
    // lo legge come target, senza dipendere dalla bacheca della piattaforma.
    if (interpelliPagina > 0 && alboVisti.size < MAX_ALBI_CODA && alboVisti.add(pagina.url)) {
      await promuoviPaginaAlbo(pagina.url, scuola);
    }
  }
  console.log(
    `[table-reporter] Piattaforma ${decisione.piattaforma?.etichetta ?? ''} → albo ${decisione.codice} ` +
      `(${scuola.home}): ${esito.pagine.length} pagine · ${records.length} record.`,
  );
  return records;
}

/**
 * §26.102 — LE PAGINE 2…N DELLO STESSO ELENCO.
 *
 * Perché serve: un hub USR pubblica «Interpelli» su WordPress con 10 voci per
 * pagina e 200 in archivio. Il runner leggeva UNA pagina per target, quindi le
 * voci delle pagine 2…N non esistevano per il radar: misurato il 29/10/2026, la
 * pagina 2 dell'AT di Napoli dà altre 12 voci apribili (e 1 con scadenza) mai
 * viste dal giro nazionale. Qui si seguono SOLO le pagine che la pagina stessa
 * dichiara (`urlPaginaSuccessiva`: `rel="next"` o un'ancora «successiva»), fino
 * a `pagineElenco` pagine per target e alla riserva del giro (`PAGINE_ELENCO_RUN`).
 *
 * Le voci si uniscono per URL (la stessa voce può comparire in due pagine durante
 * uno sfasamento di archivio): la sgranatura resta una decisione sola sul totale.
 */
async function allargaPagineElenco(
  prima: UniversalExtractionResult,
  htmlPrima: string,
  target: DiscoveredLink,
): Promise<UniversalExtractionResult> {
  const tetto = Math.max(1, LIMITI.pagineElenco);
  if (tetto <= 1 || !prima.success) return prima;
  const items = [...prima.items];
  const viste = new Set<string>([chiaveUrl(target.url)]);
  const presenti = new Set(items.map((voce) => chiaveUrl(String(voce.directUrl ?? ''))));
  let html = htmlPrima;
  let url = target.url;
  let lette = 1;
  while (lette < tetto && pagineElencoResidue > 0) {
    const successiva = urlPaginaSuccessiva(html, url);
    if (!successiva) break;
    const chiave = chiaveUrl(successiva);
    if (viste.has(chiave)) break;
    viste.add(chiave);
    pagineElencoResidue -= 1;
    let pagina: FetchResult;
    try {
      pagina = await fetchHtml(successiva);
    } catch {
      break;
    }
    if (pagina.status >= 400 || !pagina.contentType.includes('html')) break;
    const estratta = parseUniversalHtml(pagina.html, successiva);
    lette += 1;
    let nuove = 0;
    for (const voce of estratta.items) {
      const k = chiaveUrl(String(voce.directUrl ?? ''));
      if (!k || presenti.has(k)) continue;
      presenti.add(k);
      items.push(voce);
      nuove += 1;
    }
    console.log(
      `[table-reporter] Elenco su più pagine: ${lette}ª pagina (${successiva}) → ` +
        `${nuove} voci nuove · totale ${items.length}.`,
    );
    html = pagina.html;
    url = successiva;
  }
  return items.length === prima.items.length ? prima : { ...prima, items };
}

async function processTarget(target: DiscoveredLink): Promise<ProcessResult> {
  const tentativi = isPiemonteTabellare(target.url) ? PIEMONTE_TENTATIVI : 1;
  let migliore: {
    records: InterpelloRecord[];
    signature: string | null;
    oltreOrizzonte: number;
    senzaScadenza: number;
    vociAdattive: number;
  } | null = null;
  let disqualified = false;
  // Distingue lo scarto semantico (atto di gara/circolare) dalla pagina senza
  // tabella: il primo merita lo stato `disqualified_noise`.
  let rumoreSemantico = false;
  // Layout dell'ultima lettura: è il motivo di quarantena (§26.85) quando la
  // pagina non dà voci — «layout_changed» se è ignoto, «zero_items» se è noto.
  let layoutRilevato: string | undefined;
  // Ultima lettura dell'euristica universale: serve anche DOPO il loop per
  // recuperare la scadenza dal corpo degli avvisi che non la dichiarano (§26.94).
  let universale: UniversalExtractionResult | undefined;

  for (let tentativo = 1; tentativo <= tentativi; tentativo += 1) {
    try {
      const { status, contentType, html } = await fetchHtml(target.url);

      if (status >= 400) {
        return {
          extracted: 0,
          status: 'error',
          signature: null,
          error: `HTTP ${status}`,
          cause: status >= 500 ? 'http_5xx' : 'http_4xx',
        };
      }

      if (!contentType.includes('text/html') && !contentType.includes('xml')) {
        return {
          extracted: 0,
          status: 'error',
          signature: null,
          error: `Content-Type non HTML: ${contentType}`,
          cause: 'content_type',
        };
      }

      const $ = cheerio.load(html);

      // Pre-filtro semantico PRIMA di firma strutturale ed estrazione: una
      // determina o una circolare per le famiglie non è un'opportunità.
      // §26.94 — NON si applica alle fonti VERIFICATE del registro: un hub USR
      // che pubblica anche un bando di gara non diventa «rumore» (e non si
      // disattiva per questo). Le righe restano filtrate dal gate di riga.
      if (!target.verificata && pageSemanticNoiseReason($)) {
        disqualified = true;
        rumoreSemantico = true;
        break;
      }

      // §26.84 — la stessa pagina letta dall'euristica universale (nessuna
      // rete, nessuna scrittura): dice se il layout è tabella, griglia ARIA o
      // lista WordPress. Non sostituisce il parser specifico, che conosce
      // provincia e hash: è il segnale con cui mettere in quarantena (Task 4)
      // una sorgente che nessun layout spiega, e il modo per accorgersi subito
      // di un rifacimento grafico.
      universale = parseUniversalHtml(html, target.url);
      // §26.102 — l'elenco può continuare nelle pagine 2…N (WordPress mostra 10
      // voci per pagina): si seguono solo quelle dichiarate dalla pagina stessa.
      universale = await allargaPagineElenco(universale, html, target);
      // §26.118 — censimento su richiesta: si guarda ciò che il gate scarta.
      if (CENSIMENTO) raccogliCensimento(universale, target);
      layoutRilevato = universale.layoutDetected;
      if (CONFIG.debug || !universale.success) {
        console.log(
          `[table-reporter] Euristica universale: layout=${universale.layoutDetected} voci=${universale.items.length}${universale.error ? ` (${universale.error})` : ''}`
        );
      }

      const signature = getStructuralSignature($);
      const extraction = await extractRecordsFromHtml($, target, universale);
      const senzaAzione = extraction.righeSenzaAzione ?? 0;
      disqualified = extraction.disqualified;

      if (!migliore || extraction.records.length > migliore.records.length) {
        migliore = {
          records: extraction.records,
          signature,
          oltreOrizzonte: extraction.oltreOrizzonte ?? 0,
          senzaScadenza: extraction.senzaScadenza ?? 0,
          vociAdattive: extraction.vociAdattive ?? 0,
        };
      }

      if (senzaAzione === 0 || tentativo === tentativi) break;

      console.log(
        `[table-reporter] ${target.province ?? target.region}: ${senzaAzione} righe candidabili senza azione — snapshot non allineato, ritento (${tentativo}/${tentativi}).`
      );
      await attesa(PIEMONTE_ATTESA_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Il layout letto prima dell'errore resta: se è ignoto il motivo sarà
      // `layout_changed`, altrimenti `timeout` (il messaggio parla di rete).
      // §26.93 — la causa si classifica qui: un dominio morto (DNS), un TLS
      // sbagliato e un 503 sono tre cose diverse nel riepilogo nazionale.
      return {
        extracted: 0,
        status: 'error',
        signature: null,
        error: msg,
        layout: layoutRilevato,
        cause: causaDaErrore(msg),
      };
    }
  }

  const recordsBase = migliore?.records ?? [];
  const signature = migliore?.signature ?? null;

  // §26.94 — le voci d'elenco senza scadenza si riprovano sul CORPO
  // dell'avviso: se il documento dichiara il termine («entro le ore 12:00 del
  // …»), la voce diventa un record invece di essere scartata come «senza
  // scadenza». Tetto per target e per giro: è rete, non parsing.
  const approfondimento = await approfondisciVociSenzaScadenza(
    universale,
    target,
    recordsBase,
  );
  const records = [...recordsBase, ...approfondimento.records];
  // §26.96 — NESSUN avviso e il target è una bacheca di piattaforma (Argo,
  // Nuvola–Spaggiari, Gecodoc): si riparte dall'ALBO della scuola, risolta sul
  // codice meccanografico scritto nell'URL. Se il codice non c'è, non si indovina.
  if (records.length === 0) {
    records.push(...(await recuperaDaBachecaPiattaforma(target)));
  }

  if (records.length > 0) {
    if (DRY_RUN) {
      logRecords(records);
    } else {
      try {
        await salvaRecords(records);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          extracted: 0,
          status: 'error',
          signature,
          error: `Upsert interpelli: ${msg}`,
        };
      }
    }
  }

  return {
    extracted: records.length,
    status: 'success',
    signature,
    disqualified,
    noise: rumoreSemantico,
    layout: layoutRilevato,
    oltreOrizzonte: (migliore?.oltreOrizzonte ?? 0) + approfondimento.oltreOrizzonte,
    senzaScadenza: migliore?.senzaScadenza ?? 0,
    vociAdattive: migliore?.vociAdattive ?? 0,
    scadenzeDaCorpo: approfondimento.trovate,
    // Istituti citati: alimentano il deep crawl (§26.94).
    scuole: [...new Set(records.map((record) => record.school_code))]
      .filter((codice) => isLikelyMechCode(codice)),
  };
}

// Esito per la telemetria (§26.85): un errore di fetch è `quarantine`, un run
// riuscito senza voci è `empty` (conta come fallimento: la pagina non pubblica
// più nulla di leggibile), un run con voci è `success` e azzera i contatori.
// §26.93 — un ELENCO riconosciuto e letto senza scadenze dichiarate NON è un
// fallimento: senza questa eccezione una fonte viva (avvisi con la sola data di
// pubblicazione) finirebbe in quarantena dopo tre giri.
function esitoTelemetria(result: ProcessResult): EsitoRun {
  if (result.status === 'error') return 'quarantine';
  if (result.extracted > 0) return 'success';
  if ((result.vociAdattive ?? 0) > 0) return 'success';
  return 'empty';
}

async function writeReport(
  target: DiscoveredLink,
  result: ProcessResult
): Promise<void> {
  const { error } = await supabase.from('scrape_reports').insert({
    portal_id: target.id,
    extracted_count: result.extracted,
    structural_signature: result.signature,
    status: result.status,
    error_message: result.error ?? null,
  });

  if (error) {
    console.error(
      `[table-reporter] Errore scrittura scrape_reports per ${target.url}: ${error.message}`
    );
  }
}

interface StatRegione {
  regione: string;
  target: number;
  letti: number;
  record: number;
  oltreOrizzonte: number;
  senzaScadenza: number;
  vociAdattive: number;
  /** Scadenze recuperate leggendo il corpo dell'avviso (§26.94). */
  scadenzeDaCorpo: number;
  errori: number;
  disattivati: number;
  cause: Map<CausaErrore, number>;
}

function statRegione(stats: Map<string, StatRegione>, regione: string | null): StatRegione {
  const chiave = regione ?? 'N/D';
  const esistente = stats.get(chiave);
  if (esistente) return esistente;
  const nuova: StatRegione = {
    regione: chiave,
    target: 0,
    letti: 0,
    record: 0,
    oltreOrizzonte: 0,
    senzaScadenza: 0,
    vociAdattive: 0,
    scadenzeDaCorpo: 0,
    errori: 0,
    disattivati: 0,
    cause: new Map<CausaErrore, number>(),
  };
  stats.set(chiave, nuova);
  return nuova;
}

function totaleRegioni(stats: Map<string, StatRegione>): StatRegione {
  const totale = statRegione(new Map(), null);
  for (const r of stats.values()) {
    totale.target += r.target;
    totale.letti += r.letti;
    totale.record += r.record;
    totale.oltreOrizzonte += r.oltreOrizzonte;
    totale.senzaScadenza += r.senzaScadenza;
    totale.vociAdattive += r.vociAdattive;
    totale.scadenzeDaCorpo += r.scadenzeDaCorpo;
    totale.errori += r.errori;
    totale.disattivati += r.disattivati;
    for (const [causa, n] of r.cause) {
      totale.cause.set(causa, (totale.cause.get(causa) ?? 0) + n);
    }
  }
  return totale;
}

/** Riepilogo per regione: record ESTRATTI contro voci SCARTATE, con la causa. */
function stampaRiepilogoRegioni(stats: Map<string, StatRegione>): void {
  const righe = [...stats.values()].sort((a, b) => a.regione.localeCompare(b.regione, 'it'));
  const larg = 22;
  const formatta = (r: StatRegione): string => {
    const cause = [...r.cause.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([causa, n]) => `${causa}=${n}`)
      .join(' · ');
    return (
      `  ${r.regione.padEnd(larg)}${String(r.target).padStart(7)}${String(r.record).padStart(9)}` +
      `${String(r.oltreOrizzonte).padStart(12)}${String(r.senzaScadenza).padStart(12)}` +
      `${String(r.scadenzeDaCorpo).padStart(14)}` +
      `${String(r.errori).padStart(8)}  ${cause || '—'}`
    );
  };

  console.log(
    '\n[table-reporter] Riepilogo per regione (record estratti · scarti · errori):'
  );
  console.log(
    `  ${'Regione'.padEnd(larg)}${'Target'.padStart(7)}${'Record'.padStart(9)}` +
      `${'Oltre 15gg'.padStart(12)}${'Senza scad.'.padStart(12)}${'Da corpo'.padStart(14)}` +
      `${'Errori'.padStart(8)}  Cause`
  );
  for (const r of righe) console.log(formatta(r));
  console.log(formatta({ ...totaleRegioni(stats), regione: 'NAZIONALE' }));
}

async function runTableReporter(): Promise<void> {
  console.log('[table-reporter] Avvio scansione tabellare...');
  if (NAZIONALE) {
    console.log(
      `[table-reporter] Giro NAZIONALE: tutte le regioni` +
        (REGIONI_FILTRO.length > 0 ? ' (filtro --regioni IGNORATO)' : '') +
        '.'
    );
  } else if (REGIONI_FILTRO.length > 0) {
    console.log(
      `[table-reporter] Filtro regioni attivo: ${REGIONI_FILTRO.join(', ')}`
    );
  }
  if (PROVINCE_FILTRO.length > 0) {
    console.log(
      `[table-reporter] Filtro PROVINCE attivo: ${PROVINCE_FILTRO.join(', ')} — ` +
        'si leggono e si scrivono solo righe di queste province (§26.119).'
    );
  }

  try {
    if (DRY_RUN) {
      console.log('[table-reporter] Dry-run: cleanup iniziale Umbria saltato.');
    } else {
      await disableObviousJunkTargets();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[table-reporter] Cleanup iniziale fallito: ${msg}`);
  }

  let targets: DiscoveredLink[];
  try {
    targets = await loadTargets();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[table-reporter] ${msg}`);
    process.exit(1);
  }

  // §26.93 — giro nazionale: alla coda del DB si aggiungono gli hub USR/USP
  // VERIFICATI del registro fonti (17 regioni, 54 province). Nessuna scrittura
  // su `discovered_links`: è una lettura completa del Paese, non un seeding.
  if (NAZIONALE) {
    const whitelist = targetDaWhitelist();
    const uniti = unisciTarget(targets, whitelist);
    console.log(
      `[table-reporter] Whitelist nazionale: ${whitelist.length} hub USR/USP · ` +
        `${uniti.length - targets.length} aggiunti ai ${targets.length} della coda.`
    );
    targets = uniti;
  }

  targets = limitaPerRegione(targets);

  // GIRO MIRATO PER PROVINCIA (§26.119): `--province=AT` legge solo i target della
  // provincia richiesta. I target senza provincia (hub regionali) restano fuori: in un
  // giro «solo Asti» sarebbero letture pagate per righe che poi si scartano.
  if (PROVINCE_FILTRO.length > 0) {
    const prima = targets.length;
    targets = targets.filter((target) => provinciaCorrisponde(target.province));
    console.log(
      `[table-reporter] Filtro province attivo: ${PROVINCE_FILTRO.join(', ')} — ` +
        `${targets.length}/${prima} target`
    );
  }

  if (targets.length === 0) {
    console.warn(
      '[table-reporter] Nessun target con status=active_crawler in discovered_links.'
    );
    return;
  }

  // Telemetria (§26.85): le fonti isolate si saltano. UNA query per giro; se
  // `source_health` non è raggiungibile `fontiInQuarantena` torna l'elenco
  // vuoto e si scansiona tutto — meglio una richiesta sprecata che una regione
  // non letta per un guasto di telemetria.
  const quarantena = await fontiInQuarantena({ client: supabase });
  const sane = filtraFontiSane(targets, quarantena, { ignora: IGNORA_QUARANTENA });
  if (IGNORA_QUARANTENA && quarantena.size > 0) {
    console.log(
      `[table-reporter] Ri-validazione forzata: ${quarantena.size} fonti in quarantena vengono rilette (un successo le riabilita).`
    );
  } else if (sane.length !== targets.length) {
    console.log(
      `[table-reporter] Saltate ${targets.length - sane.length} fonti in quarantena: ${[...quarantena].join(', ')}`
    );
  }
  targets = sane;

  if (targets.length === 0) {
    console.warn(
      '[table-reporter] Tutti i target sono in quarantena: nessuna fonte da leggere. Usa --ignora-quarantena per ri-validarli.'
    );
    return;
  }

  console.log(`[table-reporter] Trovati ${targets.length} target da analizzare.`);

  let totalExtracted = 0;
  let successCount = 0;
  let errorCount = 0;
  let disqualifiedCount = 0;
  const stats = new Map<string, StatRegione>();
  // §26.94 — istituti citati negli avvisi di questo giro: alimentano il deep
  // crawl (codice meccanografico → nome visto in fonte, dedup per codice).
  const scuoleDaVisitare = new Map<string, string>();

  for (const target of targets) {
    const stat = statRegione(stats, target.region);
    stat.target += 1;
    const label = `${target.region ?? 'N/D'} / ${target.province ?? 'N/D'} — ${target.url}`;
    console.log(`\n[table-reporter] Esamino: ${label}`);

    // Un target che lancia non ferma il giro: diventa un errore classificato.
    let result: ProcessResult;
    try {
      result = await processTarget(target);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result = { extracted: 0, status: 'error', signature: null, error: msg, cause: causaDaErrore(msg) };
    }

    // Scritture «di contorno» protette: un errore di `scrape_reports` o della
    // telemetria non deve interrompere la lettura degli altri portali (§26.93).
    try {
      // Un target della whitelist non ha un id in `discovered_links`: la FK di
      // `scrape_reports` lo rifiuterebbe. Il report si scrive solo per la coda.
      if (!DRY_RUN && target.origine !== 'whitelist') await writeReport(target, result);

      // Telemetria (§26.85): solo in un giro reale — un dry-run non deve
      // lasciare segni. Le pagine scartate dal pre-filtro semantico non si
      // registrano: sono fuori perimetro per scelta, non fonti rotte.
      if (!DRY_RUN && !result.noise) {
        await recordSourceRun(
          target.url,
          esitoTelemetria(result),
          {
            itemsCount: result.extracted,
            layoutDetected: result.layout,
            error: result.error,
          },
          { client: supabase }
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[table-reporter] Telemetria/report non scritti per ${target.url}: ${msg}`);
    }

    if (result.status === 'success') {
      successCount += 1;
      totalExtracted += result.extracted;
      stat.letti += 1;
      stat.record += result.extracted;
      stat.oltreOrizzonte += result.oltreOrizzonte ?? 0;
      stat.senzaScadenza += result.senzaScadenza ?? 0;
      stat.vociAdattive += result.vociAdattive ?? 0;
      stat.scadenzeDaCorpo += result.scadenzeDaCorpo ?? 0;
      for (const codice of result.scuole ?? []) {
        // Giro mirato (§26.119): il deep crawl visita solo le scuole della provincia
        // richiesta (le prime due lettere del codice meccanografico sono la provincia).
        if (!provinciaCorrisponde(codice.slice(0, 2))) continue;
        if (!scuoleDaVisitare.has(codice)) scuoleDaVisitare.set(codice, codice);
      }
      console.log(
        `[table-reporter] Estratti ${result.extracted} record validi da ${target.url}`
      );

      if (result.disqualified) {
        const statoScarto = result.noise
          ? CONFIG.noiseStatus
          : CONFIG.disqualifiedStatus;
        const protetto = target.origine === 'whitelist' || target.verificata;
        if (protetto) {
          console.log(
            `[table-reporter] Target VERIFICATO: nessuna disattivazione (${statoScarto}) — ${target.url}`
          );
        } else if (DRY_RUN) {
          console.log(
            `[table-reporter] Dry-run: target DA DISATTIVARE (${statoScarto}): ${target.url}`
          );
          disqualifiedCount += 1;
          stat.disattivati += 1;
        } else {
          await disqualifyTarget(target, statoScarto);
          disqualifiedCount += 1;
          stat.disattivati += 1;
        }
      }
    } else {
      errorCount += 1;
      stat.errori += 1;
      const causa = result.cause ?? 'altro';
      stat.cause.set(causa, (stat.cause.get(causa) ?? 0) + 1);
      console.error(
        `[table-reporter] Errore (${causa}: ${ETICHETTA_CAUSA[causa]}) su ${target.url}: ${result.error}`
      );
    }
  }

  // Fase 2 (§26.94): gli istituti citati vengono visitati sulla loro casa
  // ufficiale. Gira anche in dry-run (nessuna scrittura: solo `[dry-run]`).
  await deepCrawlScuole(scuoleDaVisitare);

  stampaRiepilogoRegioni(stats);

  console.log('\n[table-reporter] Riepilogo:');
  console.log(`  Target elaborati: ${targets.length}`);
  console.log(`  Successi: ${successCount}`);
  console.log(`  Errori: ${errorCount}`);
  console.log(`  Target disattivati (no tabella): ${disqualifiedCount}`);
  console.log(`  Record totali processati: ${totalExtracted}`);
  // §26.95 — trasparenza: quanti allegati PDF sono stati APERTI e quanti hanno
  // dichiarato un termine. Un numero basso qui spiega un «senza scadenza» alto.
  if (statisticaPdf.aperti > 0) {
    console.log(
      `  PDF aperti: ${statisticaPdf.aperti} · con testo: ${statisticaPdf.conTesto} · ` +
        `con scadenza dichiarata: ${statisticaPdf.conScadenza}`,
    );
  }
  // §26.118 — censimento delle voci senza scadenza (solo con il flag).
  if (CENSIMENTO) stampaCensimento();

  // Un giro nazionale in dry-run è un REPORT: le fonti morte restano nel
  // riepilogo (con la causa) ma non fanno fallire la verifica. In un giro
  // reale l'exit code resta l'allarme di sempre.
  if (errorCount > 0) {
    if (NAZIONALE && DRY_RUN) {
      console.log(
        `[table-reporter] Giro nazionale in dry-run: ${errorCount} fonti non lette (cause sopra), exit 0.`
      );
    } else {
      process.exitCode = 2;
    }
  }
}

// ---------------------------------------------------------------------------
// CENSIMENTO DELLE VOCI SENZA SCADENZA (§26.118)
// ---------------------------------------------------------------------------
// Non scrive su Supabase e non cambia il gate: prende le voci che l'elenco
// dichiara SENZA termine, le classifica con `lib/motivoSenzaScadenza` e stampa il
// conto per causa, regione e fonte (più un CSV per l'analisi a mano). Serve a
// decidere se esporre le «disponibilità aperte fino a revoca» con i numeri.
interface VoceCensimento {
  regione: string;
  provincia: string;
  host: string;
  causa: CausaSenzaScadenza;
  candidabile: boolean;
  titolo: string;
  url: string;
}

const censimentoVoci: VoceCensimento[] = [];

/** Host della fonte, senza `www.` (`''` se l'URL non è leggibile). */
function hostDi(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function raccogliCensimento(
  universale: UniversalExtractionResult,
  target: DiscoveredLink
): void {
  for (const voce of universale.items) {
    if (voce.expirationDate) continue;
    // §26.118 — il classificatore lavora su `titolo`/`url`: la voce dell'elenco
    // si mappa QUI, una volta, invece di lasciargli indovinare i nomi.
    const daClassificare = { titolo: voce.title, url: voce.directUrl, testo: voce.schoolName };
    censimentoVoci.push({
      regione: target.region ?? 'N/D',
      provincia: (target.province || 'N/D').toUpperCase(),
      host: hostDi(target.url),
      causa: causaSenzaScadenza(daClassificare),
      candidabile: titoloCandidabile(daClassificare),
      titolo: (voce.title ?? '').replace(/\s+/g, ' ').slice(0, 120),
      url: voce.directUrl ?? '',
    });
  }
}

/** Conteggio per chiave, dal più frequente al meno. */
function contaPer<T extends string>(
  voci: readonly VoceCensimento[],
  chiave: (voce: VoceCensimento) => T
): Array<[T, number]> {
  const mappa = new Map<T, number>();
  for (const voce of voci) mappa.set(chiave(voce), (mappa.get(chiave(voce)) ?? 0) + 1);
  return [...mappa.entries()].sort((a, b) => b[1] - a[1]);
}

/** Riga del CSV: `;` come separatore (Excel italiano), campi fra virgolette. */
function rigaCsv(voce: VoceCensimento): string {
  const campo = (valore: string): string => `"${valore.replace(/"/g, '""')}"`;
  return [
    campo(voce.regione),
    campo(voce.provincia),
    campo(voce.host),
    campo(voce.causa),
    campo(ETICHETTA_CENSIMENTO[voce.causa]),
    campo(voce.candidabile ? 'sì' : 'no'),
    campo(voce.titolo),
    campo(voce.url),
  ].join(';');
}

function stampaCensimento(): void {
  const totale = censimentoVoci.length;
  const fonti = new Set(censimentoVoci.map((voce) => voce.host)).size;
  console.log(
    `\n[table-reporter] CENSIMENTO voci senza scadenza (§26.118): ${totale} voci da ${fonti} fonti.`
  );
  if (totale === 0) return;

  console.log('  Causa                       Voci   Quota   «candidabili»');
  for (const [causa, n] of contaPer(censimentoVoci, (voce) => voce.causa)) {
    const cand = censimentoVoci.filter((v) => v.causa === causa && v.candidabile).length;
    console.log(
      `  ${ETICHETTA_CENSIMENTO[causa].padEnd(24)} ${String(n).padStart(5)} ${((n / totale) * 100).toFixed(1).padStart(6)}%   ${String(cand).padStart(6)}`
    );
  }

  const opache = censimentoVoci.filter((voce) => voce.causa === 'non_dichiarata');
  console.log(
    `\n  Fascia che merita una lettura («senza alcun segnale»): ${opache.length} voci, ` +
      `di cui ${opache.filter((v) => v.candidabile).length} con un titolo di reclutamento.`
  );
  for (const [regione, n] of contaPer(opache, (voce) => voce.regione).slice(0, 8)) {
    console.log(`    · ${regione.padEnd(20)} ${String(n).padStart(4)}`);
  }
  const perFonte = contaPer(opache, (voce) => voce.host).slice(0, 10);
  if (perFonte.length > 0) {
    console.log('  Fonti con più voci opache:');
    for (const [host, n] of perFonte) console.log(`    · ${host.padEnd(34)} ${String(n).padStart(4)}`);
  }

  const intestazione =
    'regione;provincia;fonte;causa;etichetta;titolo_candidabile;titolo;url';
  try {
    writeFileSync(CENSIMENTO_OUT, [intestazione, ...censimentoVoci.map(rigaCsv)].join('\n'), 'utf8');
    console.log(`\n  Dettaglio per voce: ${CENSIMENTO_OUT}`);
  } catch (err) {
    console.warn(
      `  CSV non scritto (${err instanceof Error ? err.message : String(err)}): i numeri restano qui sopra.`
    );
  }
}

runTableReporter().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[table-reporter] Errore fatale: ${msg}`);
  process.exit(1);
});
