/**
 * scripts/sync-targets-whitelist.ts
 *
 * Semina la CODA NAZIONALE: porta in `discovered_links` tutte le fonti
 * verificate del registro (`src/scraper/fonti.ts`) — hub USR/USP/ATP di ogni
 * regione più gli aggregatori — così il discovery engine non parte dalla
 * homepage di poche province ma dalla whitelist del Paese (§26.93).
 *
 * COMPORTAMENTO
 *  · dry-run per default: dice quante fonti nuove entrerebbero, quante sono già
 *    in coda e quante sono state disattivate, con il riepilogo per regione;
 *  · `--apply`: inserisce i target MANCANTI come `pending` (è lo stato che il
 *    discovery engine consuma) e ripara `region`/`province`/`domain` mancanti;
 *  · `--riattiva` (con `--apply`): rimette in `pending` anche i target già
 *    disattivati o in errore. Senza il flag una disattivazione deliberata non
 *    viene toccata: la coda non si "riaccende" da sola;
 *  · `--attiva` (con `--apply`): promuove ad `active_crawler` i target della
 *    whitelist rimasti `pending`. È lo stato che legge `table-reporter`: senza
 *    questa promozione una fonte verificata resta discovery-only e non entra
 *    nei giri di ingestione (§26.94);
 *  · `--disabilita-morti`: risolve in DNS l'host di ogni target attivo e mette
 *    in `disabled` quelli che rispondono `ENOTFOUND` (dominio che non esiste
 *    più, es. i vecchi `www.istruzioneveneto.it/wpusr/*`). In dry-run elenca
 *    soltanto; con `--apply` scrive. Nessuna lista di URL scritta a mano: la
 *    prova è il DNS;
 *  · `--solo-hub`: considera solo gli hub istituzionali (UST/USP), escludendo
 *    gli aggregatori di post (già letti da `src/scraper/index.ts`).
 *
 * Le URL sono SOLO quelle verificate dal registro: nessuna è inventata qui.
 *
 * Uso:
 *   npx tsx scripts/sync-targets-whitelist.ts                (dry-run)
 *   npx tsx scripts/sync-targets-whitelist.ts --apply
 *   npx tsx scripts/sync-targets-whitelist.ts --apply --riattiva
 *   npx tsx scripts/sync-targets-whitelist.ts --apply --attiva --disabilita-morti
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  STATO_ATTIVO,
  STATO_PENDING,
  STATO_SPENTO,
  aggiornaStato,
  daPromuovere as righePending,
  inserisciTargets,
  rilevaDominiMorti,
  riparaMetadati,
  righePresenti,
  type RigaCoda,
} from './lib/codaTargets.ts';
import {
  chiaveTarget,
  riepilogoWhitelist,
  targetWhitelist,
  type TargetWhitelist,
} from '../src/scraper/whitelistTargets.ts';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const RIATTIVA = process.argv.includes('--riattiva');
const SOLO_HUB = process.argv.includes('--solo-hub');
/** Promuove i target della whitelist da `pending` ad `active_crawler`. */
const ATTIVA = process.argv.includes('--attiva');
/** Spegne i domini che il DNS dichiara inesistenti (`ENOTFOUND`). */
const DISABILITA_MORTI = process.argv.includes('--disabilita-morti');

/** Stato che il discovery engine consuma (`fetchPendingTargets`). */
const STATO_CODA = STATO_PENDING;
/** Stati che `--riattiva` riporta in coda. */
const STATI_RIATTIVABILI = [
  'disabled',
  'error_internal',
  'empty_view',
  'disqualified_noise',
  'parked_low_score',
  'parked_for_pdf',
];

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('[sync-whitelist] Credenziali Supabase mancanti nel file .env');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Riga di coda: stessa forma del modulo condiviso (`lib/codaTargets.ts`). */
type RigaDb = RigaCoda;

/** Righe esistenti per i domini della whitelist (match per URL canonica). */
async function righeEsistenti(targets: readonly TargetWhitelist[]): Promise<Map<string, RigaDb>> {
  return righePresenti(supabase, targets, chiaveTarget);
}

function descrivi(t: TargetWhitelist): string {
  return `${t.region ?? 'nazionale'}${t.province ? `/${t.province}` : ''} — ${t.etichetta} (${t.url})`;
}

/** Target presenti in coda con stato `pending` (da promuovere con `--attiva`). */
function daPromuovere(presenti: readonly TargetWhitelist[], esistenti: Map<string, RigaDb>): RigaDb[] {
  return righePending(presenti, esistenti, chiaveTarget);
}

async function semina(): Promise<void> {
  const targets = targetWhitelist(undefined, { soliHub: SOLO_HUB });
  const riepilogo = riepilogoWhitelist(targets);

  console.log(
    `[sync-whitelist] Whitelist verificata: ${riepilogo.totale} fonti ` +
      `(${riepilogo.hub} hub USR/USP + ${riepilogo.aggregatori} aggregatori) · ` +
      `${riepilogo.regioni.length} regioni · ${riepilogo.province.length} province` +
      (SOLO_HUB ? ' · solo hub' : ''),
  );
  for (const voce of riepilogo.perRegione) {
    console.log(
      `  ${voce.regione.padEnd(24)} ${String(voce.hub).padStart(2)} hub  ` +
        `${String(voce.totale).padStart(2)} fonti`,
    );
  }

  const esistenti = await righeEsistenti(targets);
  const nuovi = targets.filter((t) => !esistenti.has(chiaveTarget(t.url)));
  const presenti = targets.filter((t) => esistenti.has(chiaveTarget(t.url)));
  // Da riparare solo se la FONTE ha il dato e la riga no: un aggregatore
  // nazionale non ha provincia, non è un metadato mancante da riempire.
  const daRiparare = presenti.filter((t) => {
    const riga = esistenti.get(chiaveTarget(t.url));
    if (!riga) return false;
    return (
      (Boolean(t.region) && !riga.region) ||
      (Boolean(t.province) && !riga.province) ||
      (Boolean(t.domain) && !riga.domain)
    );
  });
  const daRiattivare = presenti.filter((t) => {
    const riga = esistenti.get(chiaveTarget(t.url));
    return (
      Boolean(riga) &&
      riga?.status !== STATO_CODA &&
      STATI_RIATTIVABILI.includes(String(riga?.status))
    );
  });

  // `--attiva`: i target della whitelist rimasti `pending` sono fonti
  // VERIFICATE che il runner non legge (legge `active_crawler`): si promuovono.
  const pendingDaPromuovere = daPromuovere(presenti, esistenti);
  const daAttivare = ATTIVA ? pendingDaPromuovere : [];

  console.log(
    `\n[sync-whitelist] Stato della coda: ${presenti.length} già presenti · ` +
      `${nuovi.length} da inserire · ${daRiparare.length} da riparare · ` +
      `${daRiattivare.length} disattivati/in errore · ${pendingDaPromuovere.length} pending`,
  );
  for (const t of nuovi) console.log(`  + ${descrivi(t)}`);
  if (daRiparare.length > 0) {
    console.log('  ~ metadati mancanti (region/province/domain):');
    for (const t of daRiparare) console.log(`    ${descrivi(t)}`);
  }
  if (daRiattivare.length > 0) {
    console.log('  ! disattivati/in errore (serve --riattiva):');
    for (const t of daRiattivare) console.log(`    ${descrivi(t)}`);
  }
  if (daAttivare.length > 0) {
    console.log('  ^ in coda `pending` → `active_crawler`:');
    for (const riga of daAttivare) console.log(`    ${riga.region ?? 'nazionale'} — ${riga.url}`);
  } else if (!ATTIVA && pendingDaPromuovere.length > 0) {
    console.log(
      `  ^ ${pendingDaPromuovere.length} target restano \`pending\`: usa --attiva per darli al runner.`,
    );
  }

  // `--disabilita-morti`: la prova è il DNS, non una lista scritta a mano
  // (`lib/codaTargets.ts`). Un dominio che non risolve più non merita un
  // tentativo (e un ritentativo) a ogni giro nazionale.
  const dominiMorti = DISABILITA_MORTI ? await rilevaDominiMorti(supabase) : null;

  if (!APPLY) {
    console.log(
      '\n[sync-whitelist] Dry-run: nessuna scrittura. Per seminare la coda: --apply' +
        (daRiattivare.length > 0 ? ' (--riattiva per rimettere in coda i disattivati)' : '') +
        (daAttivare.length > 0 || ATTIVA ? ' (--attiva per promuovere i pending)' : ''),
    );
    return;
  }

  let errori = 0;
  errori += await inserisciTargets(supabase, nuovi);
  errori += await riparaMetadati(supabase, daRiparare, esistenti, chiaveTarget);

  if (RIATTIVA) {
    const ids = daRiattivare
      .map((t) => esistenti.get(chiaveTarget(t.url))?.id)
      .filter((id): id is string => Boolean(id));
    errori += await aggiornaStato(supabase, ids, STATO_CODA, 'riattivazione');
  } else if (daRiattivare.length > 0) {
    console.log(
      `[sync-whitelist] ${daRiattivare.length} target restano disattivati: usa --riattiva per rimetterli in coda.`,
    );
  }

  // PROMOZIONE (§26.94): `pending` è lo stato del discovery engine,
  // `active_crawler` quello che `table-reporter` legge. Senza questo passaggio
  // una fonte verificata resta invisibile all'ingestione.
  if (daAttivare.length > 0) {
    errori += await aggiornaStato(
      supabase,
      daAttivare.map((riga) => riga.id),
      STATO_ATTIVO,
      'promozione ad active_crawler',
    );
  } else if (ATTIVA) {
    console.log('[sync-whitelist] Nessun target `pending` da promuovere: coda già allineata.');
  }

  // DOMINI MORTI (§26.94): spenti con la prova del DNS. Reversibile con
  // `--riattiva` (che li rimette in `pending`, da promuovere di nuovo).
  if (dominiMorti) {
    if (dominiMorti.righe.length === 0) {
      console.log('[sync-whitelist] Nessun dominio inesistente fra i target attivi.');
    } else {
      errori += await aggiornaStato(
        supabase,
        dominiMorti.righe.map((riga) => riga.id),
        STATO_SPENTO,
        'spegnimento domini inesistenti',
      );
    }
  }

  console.log(
    `\n[sync-whitelist] Completato${errori > 0 ? ` con ${errori} errore/i` : ''}. ` +
      'Prossimo passo: `npm run ingest:nazionale:apply` legge la coda.',
  );
  if (errori > 0) process.exitCode = 1;
}

semina().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[sync-whitelist] Errore fatale: ${msg}`);
  process.exit(1);
});
