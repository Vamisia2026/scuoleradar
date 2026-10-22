/**
 * ScuoleRadar.it — VERIFICA dello schema e della coerenza di `interpelli`.
 *
 * Perché esiste: la scadenza di un avviso vive in DUE colonne — `expiration_date`
 * (`timestamptz`, CANONICA: la leggono bacheca «Radar Live», filtro degli avvisi
 * attivi, matching e notifiche) e `deadline` (`text`, LEGACY: residuo storico del
 * table-reporter). Se l'ingestione scrive solo la seconda, il frontend mostra
 * «Scadenza n/d» e la colonna «Scadenza» resta vuota: è esattamente il
 * disallineamento che questa verifica rende VISIBILE e contato.
 *
 * Controlli:
 *   1. `expiration_date` esiste ed è di tipo data/timestamp;
 *   2. `deadline` esiste e di che tipo è (informativo: è la colonna legacy);
 *   3. quante righe hanno la scadenza nella colonna legacy ma NON nella canonica
 *      (= righe da riparare) e quanti formati non ISO ci sono nello specchio;
 *   4. (§26.77) `school_site` — il sito istituzionale dichiarato dall'anagrafica
 *      MIM che serve a `fonteApribile` per sostituire i link di piattaforma con
 *      la home `.edu.it` — esiste, e quante righe ne sono ancora prive.
 *
 * SOLA LETTURA: nessuna riga viene inserita, modificata o cancellata.
 *
 * Uso: npm run db:verifica-interpelli
 *
 * Exit code: 0 = schema e dati coerenti · 1 = c'è qualcosa da riparare (con la
 * remediation stampata).
 */

import process from 'node:process';

try {
  process.loadEnvFile();
} catch {
  /* .env opzionale */
}

const BASE = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Migrazione che ripara le righe storiche (`deadline` → `expiration_date`). */
const MIGRAZIONE_BACKFILL = '20261015120000_allinea_deadline_expiration_interpelli.sql';

/** Migrazione che aggiunge il sito istituzionale (§26.77: home `.edu.it`). */
const MIGRAZIONE_SITO = '20261022120000_add_interpelli_school_site.sql';

/** Letterale volutamente NON-data: su una colonna data/timestamp PostgREST risponde 400 (22007). */
const LETTERALE_NON_DATA = 'non-una-data';

interface Esito {
  ok: boolean;
  dettaglio: string;
}

interface TipoColonna extends Esito {
  /** true se la colonna esiste nello schema (qualunque sia il tipo). */
  esiste: boolean;
}

/** Header di autenticazione condivisi (service role, sola lettura). */
function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, ...extra };
}

/**
 * Rileva esistenza e tipo di una colonna con una sonda di FILTRO: un letterale
 * non-data risponde 400 su una colonna data/timestamp, 200 su una di testo.
 */
async function sondaColonna(colonna: string): Promise<TipoColonna> {
  try {
    const res = await fetch(
      `${BASE}/rest/v1/interpelli?select=${colonna}&${colonna}=eq.${LETTERALE_NON_DATA}&limit=1`,
      { headers: headers() }
    );
    const corpo = await res.text().catch(() => '');

    if (res.ok) {
      return { ok: true, esiste: true, dettaglio: 'esiste · tipo TEXT (accetta qualsiasi letterale)' };
    }
    if (/invalid input syntax for type/i.test(corpo)) {
      const tipo = corpo.match(/type ([a-z_ ]+):/i)?.[1]?.trim() ?? 'data/timestamp';
      return { ok: true, esiste: true, dettaglio: `esiste · tipo ${tipo} (colonna data)` };
    }
    if (/does not exist|could not find the/i.test(corpo)) {
      return { ok: false, esiste: false, dettaglio: `ASSENTE: ${corpo.slice(0, 120)}` };
    }
    return { ok: false, esiste: false, dettaglio: `HTTP ${res.status} ${corpo.slice(0, 140)}` };
  } catch (err) {
    return { ok: false, esiste: false, dettaglio: `errore di rete: ${(err as Error).message}` };
  }
}

/**
 * Esistenza di una colonna di TESTO (sola lettura): `select=<col>&limit=1`.
 * Postgres risponde «column … does not exist», PostgREST «Could not find the
 * '…' column»: entrambe le forme contano come colonna assente.
 */
async function sondaColonnaTesto(colonna: string): Promise<Esito & { esiste: boolean }> {
  try {
    const res = await fetch(`${BASE}/rest/v1/interpelli?select=${colonna}&limit=1`, {
      headers: headers(),
    });
    const corpo = await res.text().catch(() => '');
    if (res.ok) return { ok: true, esiste: true, dettaglio: 'esiste' };
    if (/does not exist|could not find the/i.test(corpo)) {
      return { ok: false, esiste: false, dettaglio: `ASSENTE: ${corpo.slice(0, 120)}` };
    }
    return { ok: false, esiste: false, dettaglio: `HTTP ${res.status} ${corpo.slice(0, 140)}` };
  } catch (err) {
    return { ok: false, esiste: false, dettaglio: `errore di rete: ${(err as Error).message}` };
  }
}

/** Conteggio esatto letto dall'header `content-range` (query leggera, `limit=1`). */
async function conta(filtro = ''): Promise<number | null> {
  try {
    const res = await fetch(`${BASE}/rest/v1/interpelli?select=id&limit=1${filtro}`, {
      headers: headers({ Prefer: 'count=exact' }),
    });
    if (!res.ok) return null;
    const totale = Number((res.headers.get('content-range') ?? '').split('/')[1]);
    return Number.isFinite(totale) ? totale : null;
  } catch {
    return null;
  }
}

/** Valori NON ISO presenti nella colonna legacy (max 1.000 righe: campione dichiarato). */
async function formeLegacyNonIso(): Promise<{ nonIso: number; analizzate: number }> {
  const vuoto = { nonIso: 0, analizzate: 0 };
  try {
    const res = await fetch(
      `${BASE}/rest/v1/interpelli?select=deadline&deadline=not.is.null&limit=1000`,
      { headers: headers() }
    );
    if (!res.ok) return vuoto;
    const righe = (await res.json()) as Array<{ deadline: string | null }>;
    const nonIso = righe.filter((r) => !/^\d{4}-\d{2}-\d{2}$/.test(String(r.deadline ?? ''))).length;
    return { nonIso, analizzate: righe.length };
  } catch {
    return vuoto;
  }
}

function formatta(numero: number | null): string {
  return numero === null ? 'n/d' : String(numero);
}

async function main(): Promise<void> {
  console.log('━━ ScuoleRadar — verifica schema `interpelli` (scadenza) ━━');
  if (!BASE || !KEY) {
    console.error('✗ Credenziali mancanti (.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exitCode = 1;
    return;
  }
  const host = (() => {
    try {
      return new URL(BASE).host;
    } catch {
      return BASE;
    }
  })();
  console.log(`• Progetto: ${host}`);

  const canonica = await sondaColonna('expiration_date');
  const legacy = await sondaColonna('deadline');
  const totale = await conta();
  const canonicaAssente = await conta('&expiration_date=is.null');
  const legacyPiena = await conta('&deadline=not.is.null');
  const disallineate = await conta('&deadline=not.is.null&expiration_date=is.null');
  const forme = await formeLegacyNonIso();
  const sito = await sondaColonnaTesto('school_site');
  const senzaSito = sito.esiste ? await conta('&school_site=is.null') : null;

  console.log(`\n1) Colonna CANONICA \`expiration_date\` → ${canonica.ok ? '✅' : '❌'} ${canonica.dettaglio}`);
  console.log(`2) Colonna LEGACY \`deadline\` → ${legacy.esiste ? '•' : '⚠'} ${legacy.dettaglio}`);
  console.log(
    `3) Copertura: ${formatta(totale)} righe · ${formatta(canonicaAssente)} senza scadenza canonica · ` +
      `${formatta(legacyPiena)} con lo specchio legacy pieno`
  );
  console.log(
    `4) RIGHE DA RIPARARE (scadenza solo in \`deadline\`): ${formatta(disallineate)} → ` +
      `${disallineate === 0 ? '✅ nessuna' : '❌ allineamento mancante'}`
  );
  console.log(
    `5) Formati non ISO nello specchio legacy: ${forme.nonIso} su ${forme.analizzate} analizzati ` +
      `${forme.analizzate >= 1000 ? '(campione di 1.000)' : ''}`
  );
  console.log(
    `6) Colonna SITO ISTITUZIONALE \`school_site\` → ${sito.esiste ? '✅' : '❌'} ${sito.dettaglio}`
  );
  if (sito.esiste) {
    console.log(
      `7) Righe SENZA sito istituzionale (home \`.edu.it\` da arricchire): ${formatta(senzaSito)} ` +
        `→ ${(senzaSito ?? 0) > 0 ? 'eseguire `npm run dati:arricchisci -- --apply`' : '✅ tutte servite'}`
    );
  }

  const problemi: string[] = [];
  if (!canonica.ok) problemi.push('colonna canonica `expiration_date` assente o di tipo non data');
  if ((disallineate ?? 0) > 0) problemi.push(`${disallineate} righe con la scadenza solo in \`deadline\``);
  if (!sito.esiste) problemi.push('colonna `school_site` assente: le righe con soli link di piattaforma escono dalla bacheca');

  if (problemi.length === 0) {
    console.log('\n✅ Scadenza coerente: la colonna canonica è popolata, nessuna riga da riparare.');
    return;
  }

  console.log('\n⚠ Azione richiesta:');
  for (const problema of problemi) console.log(`   · ${problema}`);
  if ((disallineate ?? 0) > 0) {
    console.log(`   · applicare ${MIGRAZIONE_BACKFILL} (normalizza \`deadline\` e riempie \`expiration_date\`)`);
    console.log("   Comando: npx supabase db push — oppure incollare il file SQL nell'SQL Editor del progetto.");
  }
  if (!sito.esiste) {
    console.log(`   · applicare ${MIGRAZIONE_SITO} (aggiunge \`school_site\`, solo host del sito MIM)`);
    console.log("   Comando: npx supabase db push — oppure incollare il file SQL nell'SQL Editor del progetto.");
  }
  console.log('   Poi rieseguire `npm run db:verifica-interpelli`.');
  process.exitCode = 1;
}

void main();
