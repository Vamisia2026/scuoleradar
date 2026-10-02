/**
 * ScuoleRadar.it — Manutenzione DATI: BACKFILL del nome istituto sulle righe ESISTENTI.
 *
 * Perché serve: lo scraper inserisce con `ignoreDuplicates` sull'`hash_id`
 * (`provincia|titolo|scadenza`), che NON contiene il nome della scuola. Una volta che
 * un avviso è in tabella, un nuovo run dello scraper non lo aggiorna più: le righe
 * salvate PRIMA della correzione dell'estrazione (`scuolaDaRiga`) restano senza nome,
 * il gate di vetrina (`preparaRigheBoard`) le scarta e la bacheca resta corta e
 * mono-banda (§26.22/§26.23 di docs/SYSTEM_HANDOVER.md).
 *
 * Qui si colma SOLO quel buco, sulle righe che possono entrare in bacheca (scadenza
 * non passata), in ordine rigoroso di affidabilità:
 *   1. nome ricavato dal TITOLO con lo stesso parser dello scraper (`estraiScuola`);
 *   2. nome che la FONTE pubblica accanto al codice meccanografico (`scuolaDaRiga`,
 *      pagina `source_url`, al massimo un fetch per pagina);
 *   3. registro scuole per codice (`nomeScuolaDaCodice`).
 *
 * Regole rispettate:
 *  · non si sovrascrive MAI un nome già presentabile (`nomeIstitutoPresentabile`);
 *  · niente inventato: se nessuna delle tre strade supera il gate la riga resta com'è
 *    e finisce fra le «non risolte» (mai un'etichetta di materia in `school_name`);
 *  · si scrivono SOLO `school_name` e — se mancava — `school_code`: titolo, date,
 *    link e classi non vengono toccati;
 *  · dry-run per default, `--apply` per scrivere (service role), `--max-fetch=N` per
 *    limitare le richieste alle fonti regionali.
 *
 * Uso:
 *   npm run dati:backfill-scuole                  # dry-run (mostra cosa cambierebbe)
 *   npm run dati:backfill-scuole -- --apply       # applica le modifiche
 *   npm run dati:backfill-scuole -- --max-fetch=15
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { nomeIstitutoPresentabile } from '../src/lib/nomeIstituto.ts';
import { normalizzaCodiceMeccanografico } from '../src/lib/emailScuola.ts';
import { calcolaUrgenza } from '../src/lib/urgency.ts';
import { creaRisolutore, type RigaInterpello } from './lib/scuolaDaPagina.ts';

process.loadEnvFile?.();

const argomento = (nome: string, predefinito: string): string =>
  (process.argv.find((a) => a.startsWith(`--${nome}=`)) ?? `--${nome}=${predefinito}`).split('=')[1] ??
  predefinito;

const apply = process.argv.includes('--apply');
const maxFetch = Number(argomento('max-fetch', '30'));
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main(): Promise<void> {
  if (!url || !key) {
    console.error('✗ Mancano SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nel file .env');
    process.exitCode = 1;
    return;
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  const risolutore = creaRisolutore({ maxFetch });
  const oggi = new Date();
  const oggiIso = oggi.toISOString().slice(0, 10);

  const totale = await client.from('interpelli').select('id', { count: 'exact', head: true });
  const { data, error } = (await client
    .from('interpelli')
    .select('id, title, school_name, school_code, province, expiration_date, source_url')
    .gte('expiration_date', oggiIso)
    .order('expiration_date', { ascending: true })
    .limit(1000)) as never as {
    data: RigaInterpello[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error(`✗ Lettura interpelli non riuscita: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const righe = (data ?? []) as RigaInterpello[];
  console.log('──────────────────────────────────────────────────────────');
  console.log('🩹 BACKFILL nome istituto (`interpelli`)');
  console.log('──────────────────────────────────────────────────────────');
  console.log(
    `• Righe in tabella: ${totale.count ?? 'n/d'} · con scadenza non passata: ${righe.length}`,
  );
  console.log(
    `• Modalità: ${apply ? 'APPLICA (service role)' : 'dry-run (nessuna scrittura)'} · budget fetch: ${maxFetch}`,
  );

  const conteggi = { giaOk: 0, titolo: 0, fonte: 0, registro: 0, nonRisolte: 0, patch: 0 };
  let erroriScrittura = 0;
  const modificate: RigaInterpello[] = [];
  const nonRisolte: RigaInterpello[] = [];

  for (const riga of righe) {
    if (nomeIstitutoPresentabile(riga.school_name)) {
      conteggi.giaOk += 1;
      modificate.push(riga);
      continue;
    }
    const esito = await risolutore.risolvi(riga);
    if (!esito) {
      conteggi.nonRisolte += 1;
      nonRisolte.push(riga);
      continue;
    }

    const patch: Record<string, string> = {};
    if (esito.nome !== riga.school_name) patch.school_name = esito.nome;
    if (esito.codice && !normalizzaCodiceMeccanografico(riga.school_code)) {
      patch.school_code = esito.codice;
    }
    if (Object.keys(patch).length === 0) {
      conteggi.giaOk += 1;
      modificate.push(riga);
      continue;
    }

    conteggi[esito.via] += 1;
    conteggi.patch += 1;
    console.log(
      `  [${riga.province ?? '--'}] ${esito.codice ?? 'senza codice'} · via ${esito.via} · ` +
        `«${(riga.school_name ?? 'null').slice(0, 34)}» → «${esito.nome}»`,
    );
    if (apply) {
      const { error: errUpd } = await client.from('interpelli').update(patch).eq('id', riga.id);
      if (errUpd) {
        console.warn(`    ✗ ${riga.id.slice(0, 8)}… ${errUpd.message}`);
        erroriScrittura += 1;
        conteggi.nonRisolte += 1;
        nonRisolte.push(riga);
        continue;
      }
    }
    modificate.push({ ...riga, ...patch });
  }

  // ── Impatto in bacheca: `preparaRigheBoard` mostra solo righe con scadenza VALIDA e
  // con un nome d'istituto reale (`nomeScuolaRiga`): qui si contano le righe che dopo il
  // backfill hanno entrambe le cose, con la banda di urgenza (§26.22).
  const visibili = modificate.filter(
    (r) => Boolean(r.expiration_date) && Boolean(nomeIstitutoPresentabile(r.school_name)),
  );
  const bande = new Map<string, number>();
  for (const r of visibili) {
    const banda = calcolaUrgenza(r.expiration_date, oggi).banda;
    bande.set(banda, (bande.get(banda) ?? 0) + 1);
  }

  console.log('\n— Esito —');
  console.log(`  · nome già presentabile (non toccate): ${conteggi.giaOk}`);
  console.log(`  · corrette dal titolo:   ${conteggi.titolo}`);
  console.log(`  · corrette dalla fonte:  ${conteggi.fonte}`);
  console.log(`  · corrette dal registro: ${conteggi.registro}`);
  console.log(`  · NON risolte (restano fuori bacheca): ${conteggi.nonRisolte}`);
  console.log(
    `  · patch ${apply ? 'applicate' : 'da applicare'}: ${conteggi.patch}` +
      (erroriScrittura > 0 ? ` · errori: ${erroriScrittura}` : ''),
  );
  console.log(`  · righe che la bacheca può mostrare: ${visibili.length}/${righe.length}`);
  console.log(
    '  · bande di urgenza: ' +
      (bande.size === 0
        ? 'nessuna (nessuna riga con scuola + scadenza)'
        : [...bande.entries()].map(([b, n]) => `${b}=${n}`).join(' · ')),
  );
  const pagineLette = risolutore.pagineLette();
  if (pagineLette > 0) console.log(`  · pagine di fonte lette: ${pagineLette}`);
  if (visibili.length > 0) {
    console.log('\n  Righe che la bacheca mostra ora (scuola · banda · scadenza):');
    for (const r of visibili.slice(0, 12)) {
      const u = calcolaUrgenza(r.expiration_date, oggi);
      console.log(
        `   · [${r.province ?? '--'}] ${r.school_name} · ${u.label} · ${(r.expiration_date ?? '').slice(0, 10)}`,
      );
    }
    if (visibili.length > 12) console.log(`   … e altre ${visibili.length - 12}`);
  }
  if (nonRisolte.length > 0) {
    console.log("\n  Righe non risolte (nessun nome d'istituto ricavabile, invariate):");
    for (const r of nonRisolte.slice(0, 8)) {
      console.log(`   · [${r.province ?? '--'}] ${(r.title ?? '').slice(0, 78)}`);
    }
    if (nonRisolte.length > 8) console.log(`   … e altre ${nonRisolte.length - 8}`);
  }
  console.log(
    apply
      ? '\n✓ BACKFILL applicato.'
      : '\n(dry-run) nessuna scrittura su Supabase — usa `-- --apply` per applicare.',
  );
}

void main();
