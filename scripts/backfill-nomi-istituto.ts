/**
 * ScuoleRadar.it — Manutenzione DATI: BACKFILL del nome istituto sulle righe ESISTENTI.
 *
 * Utilizza l'anagrafica ufficiale e i resolver per riempire i campi scuola mancanti
 * sulle righe esistenti, preservando il rigore del gate di vetrina.
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { nomeIstitutoPresentabile } from '../src/lib/nomeIstituto.ts';
import { normalizzaCodiceMeccanografico } from '../src/lib/emailScuola.ts';
import { giorniRimanenti, eOpportunitaConScadenza } from '../src/lib/scadenza.ts';
import { stileScadenza } from '../src/lib/scadenzaSemaforo.ts';
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

  const visibili = modificate.filter(
    (r) =>
      eOpportunitaConScadenza(r.expiration_date, oggi) &&
      Boolean(nomeIstitutoPresentabile(r.school_name)),
  );
  const bande = new Map<string, number>();
  for (const r of visibili) {
    const banda = stileScadenza(giorniRimanenti(r.expiration_date, oggi)).livello;
    bande.set(banda, (bande.get(banda) ?? 0) + 1);
  }

  console.log('\n— Esito —');
  console.log(`  · nome già presentabile (non toccate): ${conteggi.giaOk}`);
  console.log(`  · corrette dal titolo:    ${conteggi.titolo}`);
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
      const u = stileScadenza(giorniRimanenti(r.expiration_date, oggi));
      console.log(
        `    · [${r.province ?? '--'}] ${r.school_name} · ${u.label} · ${(r.expiration_date ?? '').slice(0, 10)}`,
      );
    }
    if (visibili.length > 12) console.log(`    … e altre ${visibili.length - 12}`);
  }
  if (nonRisolte.length > 0) {
    console.log("\n  Righe non risolte (nessun nome d'istituto ricavabile, invariate):");
    for (const r of nonRisolte.slice(0, 8)) {
      console.log(`    · [${r.province ?? '--'}] ${(r.title ?? '').slice(0, 78)}`);
    }
    if (nonRisolte.length > 8) console.log(`    … e altre ${nonRisolte.length - 8}`);
  }
  console.log(
    apply
      ? '\n✓ BACKFILL applicato.'
      : '\n(dry-run) nessuna scrittura su Supabase — usa `-- --apply` per applicare.',
  );
}

void main();