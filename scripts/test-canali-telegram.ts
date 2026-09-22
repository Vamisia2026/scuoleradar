/**
 * TEST CANALI TELEGRAM — DRY-RUN / INVIO REALE
 * --------------------------------------------
 * Simula la pubblicazione degli avvisi scraper con 3 esempi rappresentativi
 * (1 Docenti, 1 ATA, 1 PNRR) e verifica i requisiti STRICT dei post pubblici:
 *   · BRAND cliccabile in testa a OGNI post (`📡 … Scuole Radar.it`);
 *   · 7 sezioni, testate tipografiche (nessuna fascia colorata o `[BADGE]`);
 *   · LINK ALLA FONTE: solo la riga iperlinkata `🔗 Fonte Ufficiale`,
 *     con l'URL dell'AVVISO SPECIFICO nell'href — nessun URL ufficiale in chiaro;
 *   · GATE LINK DIRETTO: home regionali, elenchi/tag, landing regionali e pagine
 *     di ricerca NON vengono pubblicate (post senza link + pubblicazione annullata);
 *   · ROUTING: canale della regione attiva (+ @scuoleradar_ata per gli ATA).
 *
 * Esegue inoltre una MATRICE DI ROUTING su tutte le 9 regioni attive (più una
 * regione non attiva): garantisce che ogni provincia finisca sul canale della
 * PROPRIA regione e mai "tutte sul Piemonte", e che i profili ATA — riconosciuti
 * dal titolo o dal codice classe (ATA-AA/ATA-AT/ATA-CS) — raggiungano sempre
 * @scuoleradar_ata.
 *
 * Esecuzione:
 *   npm run test:telegram:canali              # DRY-RUN: formattazione + routing, nessun invio
 *   npm run test:telegram:canali -- --dry-run # idem (flag esplicito)
 *   npm run test:telegram:canali -- --send    # INVIO REALE (richiede TELEGRAM_BOT_TOKEN)
 *
 * ATTENZIONE in --send: gli invii partono verso i canali della configurazione
 * attiva. Per un test sicuro di consegna usa canali temporanei via env:
 *   TELEGRAM_CHANNELS_REGIONALI = {"Piemonte":"@canale_test", "ATA Italia (National)":"@canale_test_ata"}
 *   TELEGRAM_CHANNELS           = {"TO":"@canale_test"}   (override per provincia)
 */

import { readFileSync } from 'node:fs';
import {
  canaleAtaNazionale,
  classificaCategoriaPost,
  destinazioniPubblicazione,
  formattaPostCanaleTelegram,
  inviaMessaggioTelegram,
  pubblicaInterpelloSuCanali,
  RADAR_SETUP_URL,
  type CategoriaPost,
  type InterpelloCanale,
} from '../src/lib/telegram.ts';
import { eUrlAvvisoDiretto } from '../src/lib/alertInterpello.ts';

/** Interfaccia minima per l'ambiente (senza dipendere da @types/node). */
declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  loadEnvFile?: (path?: string) => void;
  exitCode?: number;
};

// Carica `.env` dalla cartella corrente (Node >= 20.12), come fa lo scraper.
try {
  process.loadEnvFile?.();
} catch {
  // Nessun .env: si usano le variabili già presenti nell'ambiente
}

/**
 * Testate attese per ciascuna categoria: TIPOGRAFICHE e pulite.
 * NB: niente fasce colorate (`🟢 [INTERPELLO DOCENTI]`), niente parentesi quadre:
 * sembravano badge di sistema / banner di errore.
 */
const HEADER_ATTESO: Record<CategoriaPost, string> = {
  interpello_docenti: '📝 <b>Interpello docenti</b>',
  avviso_ata: '🗂️ <b>Avviso ATA</b>',
  bando_pnrr_esperto: '📣 <b>Bando / PNRR / Esperto</b>',
};

/** Fasce/indicatori di allarme che NON devono comparire nei post pubblici. */
const INDICATORI_VIETATI = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🔴', '🟢', '🔵', '🟣', '🚨', '‼️'];

interface Campione {
  nome: string;
  avviso: InterpelloCanale;
}

const campioni: Campione[] = [
  {
    nome: '1) DOCENTI · Asti (Piemonte)',
    avviso: {
      title: 'Interpello supplenza 18 ore — Liceo "Augusto Monti" di Asti (Classe A-022)',
      schoolName: 'Liceo "Augusto Monti" di Asti',
      province: 'AT',
      comune: 'Asti',
      classCodes: ['A-022'],
      contactEmail: 'prot@liceomonti.edu.it',
      expirationDate: '2026-12-18',
      link: 'https://www.istruzione.piemonte.it/interpello-a022-monti-asti',
    },
  },
  {
    nome: '2) ATA · Milano (Lombardia) → regionale + ATA nazionale',
    avviso: {
      title:
        'Avviso Personale ATA — Assistente amministrativo, IC "Giuseppe Giacosa" di Milano',
      schoolName: 'IC "Giuseppe Giacosa" di Milano',
      province: 'MI',
      comune: 'Milano',
      classCodes: ['AA'],
      expirationDate: '2026-12-12',
      link: 'https://www.istruzione.lombardia.it/avviso-ata-aa-giacosa-milano',
    },
  },
  {
    nome: '3) PNRR / ESPERTO · Roma (Lazio)',
    avviso: {
      title: 'Bando PNRR — Esperto esterno in Biologia (A-050), Liceo scientifico di Roma',
      schoolName: 'Liceo scientifico "Cavour" di Roma',
      province: 'RM',
      comune: 'Roma',
      classCodes: ['A-050'],
      expirationDate: '2026-10-05',
      link: 'https://www.istruzione.lazio.it/bando-pnrr-esperto-a050-cavour-roma',
    },
  },
];

/** Rimuove i commenti (di riga e di blocco) prima dei controlli statici. */
function senzaCommenti(testo: string): string {
  return testo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Verifica che il post rispetti la STRUTTURA UFFICIALE (7 sezioni) e sia un
 * messaggio PULITO: solo testo, brand cliccabile, nessuna fascia colorata o
 * indicatore "da errore", link ufficiale etichettato, CTA al setup del Radar.
 */
function verificaStruttura(avviso: InterpelloCanale, testo: string): string[] {
  const problemi: string[] = [];
  const categoria = classificaCategoriaPost(avviso);
  const blocchi = testo
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  // Sezioni: brand, header, dettagli, fonte/email, CTA Radar, CTA Notizie, hashtag.
  if (blocchi.length !== 7) {
    problemi.push(`attese 7 sezioni separate da riga vuota, trovate ${blocchi.length}`);
  }
  // 1) BRAND: icona + nome ufficiale INTERAMENTE cliccabile verso la home.
  if (!testo.startsWith('📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>')) {
    problemi.push('manca la testata brand cliccabile "📡 <a href=\'https://www.scuoleradar.it\'>Scuole Radar.it</a>"');
  }
  // 2) HEADER tipografico pulito (nessuna fascia colorata, nessuna parentesi).
  if (!testo.includes(HEADER_ATTESO[categoria])) {
    problemi.push(`manca la testata ${HEADER_ATTESO[categoria]}`);
  }
  for (const indicatore of INDICATORI_VIETATI) {
    if (testo.includes(indicatore)) {
      problemi.push(`trovata fascia/indicatore vietato "${indicatore}" (sembra un errore di sistema)`);
    }
  }
  if (/\[(?:INTERPELLO DOCENTI|AVVISO ATA|BANDO \/ PNRR \/ ESPERTO)\]/.test(testo)) {
    problemi.push('trovata testata tra parentesi quadre (stile "badge di sistema")');
  }
  // NIENTE media: un post canale è testo puro (niente foto/album/documenti).
  if (/<img\b|!\[|\[foto\]/i.test(testo)) {
    problemi.push('trovato elemento media/immagine nel post (deve essere solo testo)');
  }
  // 3) DETTAGLI: righe informative con etichette.
  if (!testo.includes('📍 Provincia: <b>')) problemi.push('manca la riga "📍 Provincia:"');
  if (!testo.includes('🏫 Scuola: <b>')) problemi.push('manca la riga "🏫 Scuola:"');
  // Ruolo/Categoria è OPZIONALE: viene omesso quando ripete la Classe/Materia
  // (nessuna riga ridondante). Resta però obbligatoria la Classe/Materia.
  if (!testo.includes('📚 Classe/Materia: <b>')) problemi.push('manca la riga "📚 Classe/Materia:"');
  if (!testo.includes('🎓 Ordine di scuola: <b>')) problemi.push('manca la riga "🎓 Ordine di scuola:"');
  // La scadenza compare SOLO quando la fonte la dichiara (mai date inventate).
  if (avviso.expirationDate && !testo.includes('📅 Scadenza: <b>')) {
    problemi.push('manca la riga "📅 Scadenza:"');
  }
  // 4) FONTE: riga iperlinkata con l'etichetta canonica
  //    "🔗 Fonte Ufficiale" (l'URL ufficiale resta solo nell'href).
  if (!/<a href="https?:\/\/[^"]+"><b>🔗 Fonte Ufficiale<\/b><\/a>/.test(testo)) {
    problemi.push('manca la riga canonica "🔗 Fonte Ufficiale"');
  }
  if (/candidat/i.test(testo.replace(/Candidature:/g, ''))) {
    problemi.push('trovata la parola vietata "candidati"');
  }
  // Email candidature: mostrata SOLO se estratta; mai "Email non disponibile".
  if (testo.includes('Email non disponibile')) {
    problemi.push('trovata la dicitura vietata "Email non disponibile"');
  }
  if (avviso.contactEmail && !testo.includes('📧 Candidature:')) {
    problemi.push('email contatto presente ma riga "📧 Candidature:" assente');
  }
  if (!avviso.contactEmail && testo.includes('📧 Candidature:')) {
    problemi.push('riga "📧 Candidature:" presente senza email estratta');
  }
  // 5) CTA di conversione: LEAD GENERATION verso il SETUP del Radar (mai la home
  //    generica) — invito esplicito a creare il Radar personalizzato.
  if (!testo.includes('👉 Crea il tuo Radar personalizzato:')) {
    problemi.push('manca la CTA di lead generation ("Crea il tuo Radar personalizzato")');
  }
  if (!testo.includes(RADAR_SETUP_URL)) {
    problemi.push(`la CTA deve puntare al setup del Radar (${RADAR_SETUP_URL})`);
  }
  if (!/\/dashboard\/radar\b/.test(RADAR_SETUP_URL)) {
    problemi.push('RADAR_SETUP_URL non punta a /dashboard/radar');
  }
  // 6) CTA Notizie: due righe esatte (una sola occorrenza di 📌).
  const occorrenzePin = (testo.match(/📌/g) ?? []).length;
  if (occorrenzePin !== 1) {
    problemi.push(`la CTA Notizie deve comparire UNA volta (trovate ${occorrenzePin} righe 📌)`);
  }
  if (!testo.includes('📌 https://www.scuoleradar.it/notizie')) {
    problemi.push('manca la CTA Notizie "📌 https://www.scuoleradar.it/notizie"');
  }
  // 7) HASHTAG.
  if (!testo.includes('#ScuoleRadar')) problemi.push("manca l'hashtag #ScuoleRadar");
  if (avviso.link && !testo.includes(avviso.link)) problemi.push('il link ufficiale non compare nel post');

  // 4-bis) LINK SAFETY STRICT: il link di fonte deve essere l'AVVISO SPECIFICO
  // (mai home regionali, archivi, elenchi o pagine di ricerca) e va esposto SOLO
  // come href del bottone standard: nessun URL ufficiale "in chiaro" nel post.
  if (avviso.link && !eUrlAvvisoDiretto(avviso.link)) {
    problemi.push('il link dell\'avviso NON è diretto (home regionale/archivio/ricerca)');
  }
  const hrefUfficiali = [...testo.matchAll(/<a href="(https?:[^"]+)"/g)].map((m) => m[1]);
  if (avviso.link && !hrefUfficiali.includes(avviso.link)) {
    problemi.push('il link ufficiale non è nell\'href del bottone standard');
  }
  // Ogni URL presente nel post come TESTO (fuori da un href) deve appartenere a
  // ScuoleRadar (CTA Radar / CTA Notizie): nessun URL ufficiale in chiaro.
  const urlsInChiaro = [...testo.matchAll(/(?<!href=")https?:\/\/[^\s<)]+/g)].map((m) => m[0]);
  for (const url of urlsInChiaro) {
    if (!/^https?:\/\/(?:www\.)?scuoleradar\.(?:it|com)\b/.test(url)) {
      problemi.push(`URL ufficiale esposto in chiaro nel post: ${url}`);
    }
  }
  if (avviso.link && urlsInChiaro.includes(avviso.link)) {
    problemi.push('URL ufficiale mostrato come testo (deve stare solo nell\'href del bottone)');
  }

  return problemi;
}

/**
 * Matrice di routing: una provincia rappresentativa per ciascuna delle 9
 * regioni attive, con il canale ufficiale atteso.
 */
const MATRICE_ROUTING: { provincia: string; regione: string; canale: string }[] = [
  { provincia: 'TO', regione: 'Piemonte', canale: '@scuoleradar_piemonte' },
  { provincia: 'MI', regione: 'Lombardia', canale: '@scuoleradar_lombardia' },
  { provincia: 'VE', regione: 'Veneto', canale: '@scuoleradar_veneto' },
  { provincia: 'BO', regione: 'Emilia-Romagna', canale: '@scuoleradar_emiliaromagna' },
  { provincia: 'FI', regione: 'Toscana', canale: '@scuoleradar_toscana' },
  { provincia: 'RM', regione: 'Lazio', canale: '@scuoleradar_lazio' },
  { provincia: 'NA', regione: 'Campania', canale: '@scuoleradar_campania' },
  { provincia: 'PA', regione: 'Sicilia', canale: '@scuoleradar_sicilia' },
  { provincia: 'BA', regione: 'Puglia', canale: '@scuoleradar_puglia' },
];

/**
 * Verifica la mappatura provincia → canale regionale su TUTTE le regioni attive:
 *   - un avviso va SOLO sul canale della propria regione (mai "tutte sul Piemonte");
 *   - un avviso ATA va SEMPRE anche su @scuoleradar_ata;
 *   - una regione NON attiva non ha canale regionale, ma l'ATA resta nazionale.
 */
function verificaMatriceRouting(): string[] {
  const problemi: string[] = [];
  const ata = canaleAtaNazionale();

  for (const { provincia, regione, canale } of MATRICE_ROUTING) {
    const docenti: InterpelloCanale = {
      title: `Interpello supplenza — Classe A-026, ${regione}`,
      province: provincia,
      classCodes: ['A-026'],
    };
    const destDocenti = destinazioniPubblicazione(docenti);
    if (destDocenti.length !== 1 || destDocenti[0] !== canale) {
      problemi.push(
        `[${provincia}/${regione}] atteso solo ${canale}, trovato ${
          destDocenti.join(', ') || '(nessun canale)'
        }`,
      );
    }
    if (regione !== 'Piemonte' && destDocenti.includes('@scuoleradar_piemonte')) {
      problemi.push(`[${provincia}] un avviso non-Piemonte non deve finire su @scuoleradar_piemonte`);
    }

    // Stesso profilo ATA ma riconosciuto dal CODICE CLASSE (non dal titolo).
    const ataAvviso: InterpelloCanale = {
      title: `Avviso di selezione per incarico temporaneo — ${regione}`,
      province: provincia,
      classCodes: ['ATA-AA'],
    };
    const destAta = destinazioniPubblicazione(ataAvviso);
    if (!destAta.includes(canale)) {
      problemi.push(`[${provincia}/${regione}] l'avviso ATA deve andare anche su ${canale}`);
    }
    if (ata && !destAta.includes(ata)) {
      problemi.push(`[${provincia}/${regione}] l'avviso ATA deve andare su ${ata}`);
    }
    if (ata && destAta.length !== 2) {
      problemi.push(
        `[${provincia}/${regione}] l'avviso ATA deve avere 2 destinazioni, trovate ${destAta.length}`,
      );
    }
  }

  // Regione NON attiva (Liguria): nessun canale regionale.
  const inattivaDocenti: InterpelloCanale = {
    title: 'Interpello supplenza — Classe A-026, Genova',
    province: 'GE',
    classCodes: ['A-026'],
  };
  if (destinazioniPubblicazione(inattivaDocenti).length !== 0) {
    problemi.push('[GE/Liguria] regione non attiva: nessun canale regionale atteso');
  }
  const inattivaAta: InterpelloCanale = {
    title: 'Avviso di selezione per incarico temporaneo',
    province: 'GE',
    classCodes: ['ATA-CS'],
  };
  const destInattivaAta = destinazioniPubblicazione(inattivaAta);
  if (ata && (destInattivaAta.length !== 1 || destInattivaAta[0] !== ata)) {
    problemi.push(`[GE/Liguria] ATA in regione non attiva: atteso solo ${ata}`);
  }

  return problemi;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--send');
  const invioReale = !dryRun;
  const canaleAta = canaleAtaNazionale();

  console.log('──────────────────────────────────────────────────────────');
  console.log('📡 TEST CANALI TELEGRAM — formattazione & routing');
  console.log(`   Modalità: ${invioReale ? 'INVIO REALE (--send)' : 'DRY-RUN (nessun messaggio inviato)'}`);
  console.log(`   Canale ATA nazionale: ${canaleAta ?? 'NON configurato'}`);
  console.log('──────────────────────────────────────────────────────────');

  const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (invioReale && (!token || token.includes('xxxx') || token.includes('ExampleToken'))) {
    console.error('✗ --send richiede TELEGRAM_BOT_TOKEN valido nel file .env');
    console.error('  Aggiungi: TELEGRAM_BOT_TOKEN=<token del bot @ScuoleRadar_bot>');
    process.exitCode = 1;
    return;
  }

  let erroriTotali = 0;
  let inviiOk = 0;
  let inviiTotali = 0;

  for (const { nome, avviso } of campioni) {
    const testo = formattaPostCanaleTelegram(avviso);
    const categoria = classificaCategoriaPost(avviso);
    const destinazioni = destinazioniPubblicazione(avviso);
    const problemi = verificaStruttura(avviso, testo);

    if (categoria === 'avviso_ata' && canaleAta && !destinazioni.includes(canaleAta)) {
      problemi.push(`l'avviso ATA deve essere instradato ANCHE su ${canaleAta}`);
    }
    if (categoria !== 'avviso_ata' && canaleAta && destinazioni.includes(canaleAta)) {
      problemi.push(`un avviso NON-ATA non deve finire su ${canaleAta}`);
    }

    console.log('\n──────────────────────────────────────────────────────────');
    console.log(`📄 ${nome}`);
    console.log(`   Categoria: ${categoria}`);
    console.log(`   Destinazioni: ${destinazioni.length > 0 ? destinazioni.join(', ') : '(nessun canale attivo per questa regione)'}`);
    if (problemi.length > 0) {
      console.log('   VERIFICA STRUTTURA: ✗ FALLITA');
      for (const p of problemi) console.log(`     • ${p}`);
    } else {
      console.log('   VERIFICA STRUTTURA: ✓ OK (7 sezioni, routing corretto)');
    }
    console.log('\n   ——— Anteprima post ———');
    console.log(testo.split('\n').map((riga) => `   ${riga}`).join('\n'));

    erroriTotali += problemi.length;

    if (invioReale) {
      for (const canale of destinazioni) {
        inviiTotali += 1;
        const esito = await inviaMessaggioTelegram(canale, testo);
        if (esito.ok) {
          inviiOk += 1;
          console.log(`   ✓ Inviato su ${canale}`);
        } else {
          console.error(`   ✗ Invio fallito su ${canale}: ${esito.error ?? 'errore sconosciuto'}`);
        }
      }
    }
  }

  // Verifica STATICA del generatore e dell'invio: nessun media, anteprime native
  // disattivate (i riquadri giganti coprivano l'avviso), nessuna fascia colorata.
  const srcTelegram = senzaCommenti(readFileSync('src/lib/telegram.ts', 'utf8'));
  const problemiStatici: string[] = [];
  if (/sendPhoto|sendMediaGroup|sendDocument|sendAnimation/.test(srcTelegram)) {
    problemiStatici.push('il modulo Telegram invia media (sendPhoto/sendMediaGroup/sendDocument): i canali devono restare solo testo');
  }
  if (!/link_preview_options:\s*\{\s*is_disabled:\s*true\s*\}/.test(srcTelegram)) {
    problemiStatici.push('anteprime native NON disattivate (manca link_preview_options.is_disabled)');
  }
  if (!/disable_web_page_preview:\s*true/.test(srcTelegram)) {
    problemiStatici.push('manca disable_web_page_preview: true (fallback per i client senza link_preview_options)');
  }
  if (/🟢 \[INTERPELLO DOCENTI\]|🔵 \[AVVISO ATA\]|🟣 \[BANDO \/ PNRR \/ ESPERTO\]/.test(srcTelegram)) {
    problemiStatici.push('testate con fasce colorate/parentesi ancora presenti nel generatore');
  }
  // LINK SAFETY nel generatore: il link di fonte deve passare da `eUrlAvvisoDiretto`
  // e la pubblicazione deve avere il gate (`saltato`) per le fonti non dirette.
  if (!/eUrlAvvisoDiretto/.test(srcTelegram)) {
    problemiStatici.push('il generatore dei post non verifica il link diretto (eUrlAvvisoDiretto)');
  }
  if (!/saltato/.test(srcTelegram)) {
    problemiStatici.push('manca il gate di pubblicazione per le fonti non dirette (campo `saltato`)');
  }

  console.log('\n──────────────────────────────────────────────────────────');
  console.log('🧱 MESSAGGI CANALE: solo testo, anteprime disattivate, nessuna fascia');
  if (problemiStatici.length > 0) {
    console.log('   VERIFICA: ✗ FALLITA');
    for (const p of problemiStatici) console.log(`     • ${p}`);
  } else {
    console.log('   VERIFICA: ✓ OK — nessun media, anteprime disattivate, testate tipografiche');
  }
  erroriTotali += problemiStatici.length;

  // ── GATE DI LINK SAFETY ────────────────────────────────────────────────────
  // Con una fonte NON diretta (home regionale, elenco/tag, landing regionale,
  // pagina di ricerca) l'avviso non deve comparire sui canali: niente link
  // "Apri l'avviso ufficiale" nel post e pubblicazione annullata a monte.
  console.log('\n──────────────────────────────────────────────────────────');
  console.log('🔒 GATE LINK DIRETTO — fonti non dirette mai pubblicate');
  const fontiNonDirette: { nome: string; link: string }[] = [
    { nome: 'home regionale', link: 'https://www.istruzione.piemonte.it/' },
    { nome: 'elenco/tag', link: 'https://www.scuolainterpelli.it/tag/interpelli-scuola-piemonte/' },
    { nome: 'landing regionale', link: 'https://www.scuolainterpelli.it/interpelli-lombardia/' },
    { nome: 'pagina di ricerca', link: 'https://www.usp-asti.gov.it/?s=interpello' },
    { nome: 'nessun link', link: '' },
  ];
  const problemiGate: string[] = [];
  for (const fonte of fontiNonDirette) {
    const avviso: InterpelloCanale = {
      title: 'Interpello supplenza A-026 Matematica — Liceo "Augusto Monti" di Asti',
      schoolName: 'Liceo "Augusto Monti" di Asti',
      province: 'AT',
      classCodes: ['A-026'],
      contactEmail: 'prot@liceomonti.edu.it',
      expirationDate: '2026-12-31',
      link: fonte.link,
    };
    const testo = formattaPostCanaleTelegram(avviso);
    if (testo.includes('Leggi la Fonte Ufficiale')) {
      problemiGate.push(`${fonte.nome}: il post contiene il link all'avviso nonostante la fonte non diretta`);
    }
    if (fonte.link && testo.includes(fonte.link)) {
      problemiGate.push(`${fonte.nome}: il post espone l'URL non diretto`);
    }
    if (!testo.startsWith('📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>')) {
      problemiGate.push(`${fonte.nome}: manca la testata brand in testa`);
    }
    // Il gate blocca PRIMA di ogni invio: è sicuro invocarlo anche qui.
    const esito = await pubblicaInterpelloSuCanali(avviso);
    if (!esito.saltato) {
      problemiGate.push(`${fonte.nome}: pubblicazione NON annullata (campo saltato assente)`);
    }
    if (esito.destinazioni.length > 0 || esito.pubblicati > 0 || esito.errori.length > 0) {
      problemiGate.push(`${fonte.nome}: il gate non è scattato prima dell'invio`);
    }
  }
  // Controllo POSITIVO (solo formattazione: nessun invio): una fonte diretta
  // produce il bottone standard con l'URL nell'href.
  const avvisoDiretto: InterpelloCanale = {
    title: 'Interpello supplenza A-026 Matematica — Liceo "Augusto Monti" di Asti',
    schoolName: 'Liceo "Augusto Monti" di Asti',
    province: 'AT',
    classCodes: ['A-026'],
    expirationDate: '2026-12-31',
    link: 'https://www.usp-asti.gov.it/interpelli/avviso-a026',
  };
  const postDiretto = formattaPostCanaleTelegram(avvisoDiretto);
  if (!postDiretto.includes(`<a href="${avvisoDiretto.link}"><b>🔗 Fonte Ufficiale</b></a>`)) {
    problemiGate.push('fonte diretta: manca la riga canonica "🔗 Fonte Ufficiale"');
  }
  // L'URL ufficiale NON deve comparire in chiaro: si controlla il testo SENZA gli
  // attributi `href`, così la verifica vale per qualsiasi impaginazione.
  if (postDiretto.replace(/<a\s+href="[^"]*"/g, '<a').includes(avvisoDiretto.link)) {
    problemiGate.push('fonte diretta: URL ufficiale esposto in chiaro');
  }
  if (problemiGate.length > 0) {
    console.log('   VERIFICA: ✗ FALLITA');
    for (const p of problemiGate) console.log(`     • ${p}`);
  } else {
    console.log('   VERIFICA: ✓ OK — fonti non dirette scartate, link solo nel bottone standard');
  }
  erroriTotali += problemiGate.length;

  // Matrice di routing su tutte le regioni attive (solo con configurazione di
  // default: gli override da env cambiano volutamente le destinazioni).
  const overrideAttivi = Boolean(
    (process.env.TELEGRAM_CHANNELS ?? '').trim() ||
      (process.env.TELEGRAM_CHANNELS_REGIONALI ?? '').trim(),
  );
  console.log('\n──────────────────────────────────────────────────────────');
  console.log('🧭 MATRICE DI ROUTING — provincia → canale regionale + ATA');
  if (overrideAttivi) {
    console.log(
      '   VERIFICA: ⊘ saltata (override TELEGRAM_CHANNELS/TELEGRAM_CHANNELS_REGIONALI attivi)',
    );
  } else {
    const problemiMatrice = verificaMatriceRouting();
    if (problemiMatrice.length > 0) {
      console.log('   VERIFICA: ✗ FALLITA');
      for (const p of problemiMatrice) console.log(`     • ${p}`);
    } else {
      console.log('   VERIFICA: ✓ OK — ogni regione sul proprio canale, ATA su @scuoleradar_ata');
    }
    erroriTotali += problemiMatrice.length;
  }

  console.log('\n──────────────────────────────────────────────────────────');
  if (invioReale) {
    console.log(`📊 INVII: ${inviiOk}/${inviiTotali} riusciti`);
  }
  console.log(
    erroriTotali === 0
      ? '✅ STRUTTURA & ROUTING: nessun problema rilevato'
      : `❌ VERIFICA: ${erroriTotali} problema/i rilevato/i`,
  );
  console.log('──────────────────────────────────────────────────────────');
  // Un problema di STRUTTURA è un errore del test (prima veniva solo stampato e
  // il test usciva comunque 0: le regressioni di formato passavano inosservate).
  if (erroriTotali > 0) process.exitCode = 1;
  if (invioReale && inviiOk !== inviiTotali) process.exitCode = 1;
}

void main();

