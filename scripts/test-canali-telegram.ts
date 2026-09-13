/**
 * TEST CANALI TELEGRAM — DRY-RUN / INVIO REALE
 * --------------------------------------------
 * Simula la pubblicazione degli avvisi scraper con 3 esempi rappresentativi
 * (1 Docenti, 1 ATA, 1 PNRR), verifica la STRUTTURA UFFICIALE del post
 * (5 sezioni fisse) e mostra il ROUTING verso i canali:
 *   - avviso regionale  → canale della regione attiva (o nessuno, se la regione
 *                         non è tra i canali attivi);
 *   - 🔵 [AVVISO ATA]   → SEMPRE anche @scuoleradar_ata (ATA nazionale).
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

import {
  canaleAtaNazionale,
  classificaCategoriaPost,
  destinazioniPubblicazione,
  formattaPostCanaleTelegram,
  inviaMessaggioTelegram,
  type CategoriaPost,
  type InterpelloCanale,
} from '../src/lib/telegram.ts';

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

/** Testata attesa per ciascuna categoria (verifica struttura). */
const HEADER_ATTESO: Record<CategoriaPost, string> = {
  interpello_docenti: '🟢 [INTERPELLO DOCENTI]',
  avviso_ata: '🔵 [AVVISO ATA]',
  bando_pnrr_esperto: '🟣 [BANDO / PNRR / ESPERTO]',
};

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
      expirationDate: '2026-09-18',
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
      expirationDate: '2026-09-12',
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

/** Verifica che il post rispetti le 5 sezioni fisse della struttura ufficiale. */
function verificaStruttura(avviso: InterpelloCanale, testo: string): string[] {
  const problemi: string[] = [];
  const categoria = classificaCategoriaPost(avviso);
  const blocchi = testo
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocchi.length !== 5) {
    problemi.push(`attesi 5 blocchi separati da riga vuota, trovati ${blocchi.length}`);
  }
  if (!testo.includes(HEADER_ATTESO[categoria])) {
    problemi.push(`manca la testata ${HEADER_ATTESO[categoria]}`);
  }
  if (!testo.includes('📍 Provincia: <b>')) problemi.push('manca la riga "📍 Provincia:"');
  if (!testo.includes('🏫 Scuola: <b>')) problemi.push('manca la riga "🏫 Scuola:"');
  if (!testo.includes('👩🏫 Ruolo / Categoria: <b>')) {
    problemi.push('manca la riga "👩🏫 Ruolo / Categoria:"');
  }
  if (!testo.includes('🎓 Ordine di scuola: <b>')) problemi.push('manca la riga "🎓 Ordine di scuola:"');
  if (!testo.includes('📅 Scadenza: <b>')) problemi.push('manca la riga "📅 Scadenza:"');
  if (!testo.includes('🔗 <a href="') || !testo.includes('Leggi l\'Avviso Originale')) {
    problemi.push('manca il blocco link "🔗 Leggi l\'Avviso Originale"');
  }
  // La riga email deve essere SEMPRE presente nel blocco contatti: se l'email è
  // disponibile si mostra, altrimenti la dicitura "Email non disponibile".
  if (!/📧 (Candidature:|Email non disponibile)/.test(testo)) {
    problemi.push('manca la riga email candidature (📧 Candidature: … oppure 📧 Email non disponibile)');
  }
  if (!testo.includes('⚡ Ricevi solo gli avvisi per la tua provincia e classe in privato:')) {
    problemi.push('manca la CTA "⚡ Ricevi solo gli avvisi…"');
  }
  if (!testo.includes('👉 https://scuoleradar.it')) problemi.push('manca il link CTA https://scuoleradar.it');
  if (!testo.includes('#ScuoleRadar')) problemi.push('manca l\'hashtag #ScuoleRadar');
  if (testo.includes('📌')) problemi.push('trovata riga 📌 extra: il post deve avere solo 5 sezioni');
  if (avviso.link && !testo.includes(avviso.link)) problemi.push('il link ufficiale non compare nel post');

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
      console.log('   VERIFICA STRUTTURA: ✓ OK (5 sezioni, routing corretto)');
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
  if (invioReale && inviiOk !== inviiTotali) process.exitCode = 1;
}

void main();

