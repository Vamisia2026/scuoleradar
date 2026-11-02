/**
 * PULIZIA — Rimuove da `interpelli` le righe il cui TITOLO è un atto amministrativo (§26.130).
 *
 * Perché esiste. Il pre-filtro del rumore giudica una voce PRIMA di aprirla, ma fino a
 * §26.130 lo faceva solo sulle righe di tabella e sul CORPO della pagina: un titolo di
 * elenco («Sciopero 30 ottobre 2026 – promemoria») entrava in tabella, e la bacheca
 * provinciale lo mostrava come opportunità. L'ingestione ora giudica il titolo nelle tre
 * porte di scrittura (`table-reporter.ts`); questo script applica la STESSA regola alle
 * righe già scritte, perché una bacheca non resti con il solo rumore.
 *
 * NON inventa giudizi: la regola è `isAdministrativeNoise(titolo, titolo)` — la funzione
 * dei tre percorsi di scrittura. Il titolo fa da corpo perché prima di aprire l'avviso
 * non c'è altro testo: è esattamente la condizione in cui la riga è stata scritta.
 *
 * SICUREZZA. Il piano si dichiara SOSPETTO oltre `SOGLIA_ALLARME` di titoli di rumore su
 * almeno `MINIMO_ALLARME` righe lette (una regola troppo larga si vedrebbe come
 * cancellazione di massa): in quel caso non si applica nulla senza `--forza`. Un titolo
 * assente non è un giudizio (dato mancante) e la riga resta.
 *
 * DRY-RUN di default: stampa cosa uscirebbe, non tocca nulla. `--apply` per cancellare.
 * Uso: npx tsx scripts/pulisci-rumore.ts [--apply] [--forza]
 */
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { isAdministrativeNoise } from '../src/lib/noiseFilter.ts';

try {
  process.loadEnvFile();
} catch {
  /* nessun .env */
}

const APPLY = process.argv.includes('--apply');
const FORZA = process.argv.includes('--forza');

const URL_ = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Id per singolo DELETE: 500 UUID ≈ 19 KB di URL, ben sotto i limiti del gateway. */
const ID_PER_LOTTO = 500;

/** Conteggio massimo per lettura (`limit`): oltre, il numero è un MINIMO. */
const TETTO_LETTURA = 5000;

/** Quota di titoli di rumore oltre la quale il piano è sospetto (regola troppo larga). */
const SOGLIA_ALLARME = 0.2;

/** Sotto questo numero di righe lette non c'è abbastanza materiale per un allarme. */
const MINIMO_ALLARME = 20;

const COLONNE = 'id,title,province,school_name,expiration_date';

interface RigaRumore {
  id: string;
  title: string | null;
  province: string | null;
  school_name: string | null;
  expiration_date: string | null;
}

interface Scarto {
  id: string;
  titolo: string;
  provincia: string;
  motivo: string;
}

/** Divide in lotti contigui di al più `dimensione` elementi. */
function aLotti<T>(elementi: T[], dimensione: number): T[][] {
  const lotti: T[][] = [];
  for (let i = 0; i < elementi.length; i += dimensione) {
    lotti.push(elementi.slice(i, i + dimensione));
  }
  return lotti;
}

async function main(): Promise<void> {
  if (!URL_ || !SERVICE) {
    console.log('✗ servono VITE_SUPABASE_URL (o SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exitCode = 1;
    return;
  }
  console.log(`Pulizia titoli di rumore — modalità ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const sb = createClient(URL_, SERVICE);
  const { data, error } = await sb.from('interpelli').select(COLONNE).limit(TETTO_LETTURA);
  if (error) {
    console.log(`✗ lettura interpelli: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const righe = (data ?? []) as unknown as RigaRumore[];

  const scarti: Scarto[] = [];
  const perMotivo = new Map<string, number>();
  for (const riga of righe) {
    const titolo = (riga.title ?? '').trim();
    if (!titolo) continue;
    const verdetto = isAdministrativeNoise(titolo, titolo);
    if (!verdetto.isNoise) continue;
    const motivo = verdetto.reason ?? 'rumore amministrativo';
    scarti.push({ id: riga.id, titolo, provincia: riga.province ?? '??', motivo });
    perMotivo.set(motivo, (perMotivo.get(motivo) ?? 0) + 1);
  }

  console.log(
    `interpelli in tabella: ${righe.length} · titoli di rumore: ${scarti.length} ` +
      `(opportunità reali: ${righe.length - scarti.length})`,
  );
  for (const [motivo, n] of perMotivo) console.log(`   · ${motivo}: ${n}`);
  for (const s of scarti.slice(0, 30)) {
    console.log(`   · [${s.provincia}] ${s.titolo.slice(0, 60)} — ${s.motivo}`);
  }
  if (scarti.length > 30) console.log(`   … e altri ${scarti.length - 30}`);
  if (righe.length >= TETTO_LETTURA) {
    console.log(
      `   ⚠ tetto di lettura raggiunto (${TETTO_LETTURA}): il numero è un MINIMO — ` +
        'rilancia dopo la pulizia per il resto',
    );
  }

  const quota = righe.length > 0 ? scarti.length / righe.length : 0;
  const sospetto = scarti.length >= MINIMO_ALLARME && quota > SOGLIA_ALLARME;
  if (sospetto) {
    console.log(
      `   ⚠ ${Math.round(quota * 100)}% dei titoli è rumore (soglia ${Math.round(SOGLIA_ALLARME * 100)}%): ` +
        'il piano è sospetto, verifica i motivi prima di applicare',
    );
  }

  if (!APPLY) {
    console.log('(DRY-RUN: nessuna cancellazione. Rilancia con --apply.)');
    return;
  }
  if (scarti.length === 0) return;
  if (sospetto && !FORZA) {
    console.log('✗ nessuna cancellazione: piano sospetto (rilancia con --forza se i motivi sono corretti)');
    process.exitCode = 1;
    return;
  }

  const lotti = aLotti(
    scarti.map((s) => s.id),
    ID_PER_LOTTO,
  );
  let rimossi = 0;
  const errori: string[] = [];
  for (let i = 0; i < lotti.length; i += 1) {
    const lotto = lotti[i];
    const { error: errDel } = await sb.from('interpelli').delete().in('id', lotto);
    if (errDel) {
      errori.push(`lotto ${i + 1}/${lotti.length}: ${errDel.message}`);
      continue;
    }
    rimossi += lotto.length;
    if (lotti.length > 1) {
      console.log(`  · lotto ${i + 1}/${lotti.length}: rimossi ${lotto.length} (totale ${rimossi}/${scarti.length})`);
    }
  }
  if (errori.length > 0) {
    console.log(
      `  ✗ delete fallita su ${errori.length}/${lotti.length} lotti (rimossi ${rimossi}/${scarti.length}):\n` +
        `     ${errori.join('\n     ')}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`  ✓ rimossi ${rimossi} titoli di rumore (non erano opportunità)`);
}

void main();
