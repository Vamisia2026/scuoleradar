/**
 * ScuoleRadar.it — Manutenzione DATI: arricchisce gli interpelli esistenti.
 *
 * Colma i buchi che rendono una riga poco professionale (school_code mancante,
 * email di candidatura assente, nome scuola ricostruibile dal registro):
 *   1. codice meccanografico ricavato dal titolo/nome scuola quando assente;
 *   2. email UFFICIALE (PEO) ricostruita dalla convenzione MIM sul codice;
 *   3. nome reale della scuola dal registro per codice (solo nomi autentici).
 * Non sovrascrive MAI un dato già presente e non inventa nulla: se non c'è un
 * appiglio reale (codice o email in fonte) la riga resta com'è.
 *
 * Uso:
 *   npm run dati:arricchisci            # dry-run (mostra cosa cambierebbe)
 *   npm run dati:arricchisci -- --apply # applica le modifiche (service role)
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import {
  estraiCodiceMeccanograficoDaTesto,
  risolviEmailUfficialeScuola,
} from '../src/lib/emailScuola.ts';
import { nomeScuolaDaCodice } from '../src/lib/school-lookup.ts';

process.loadEnvFile?.();

const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('✗ Mancano SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nel file .env');
  process.exitCode = 1;
} else {
  const client = createClient(url, key, { auth: { persistSession: false } });

  interface Riga {
    id: string;
    title: string;
    school_name: string | null;
    school_code: string | null;
    contact_email: string | null;
  }

  const { data, error } = (await client
    .from('interpelli')
    .select('id, title, school_name, school_code, contact_email')
    .limit(5000)) as never as { data: Riga[] | null; error: { message: string } | null };

  if (error) {
    console.error(`✗ Lettura interpelli non riuscita: ${error.message}`);
    process.exitCode = 1;
  } else {
    const righe = (data ?? []) as Riga[];
    let daCodice = 0;
    let daEmail = 0;
    let daNome = 0;
    let scritti = 0;

    for (const r of righe) {
      const patch: Record<string, string> = {};
      const testo = `${r.title ?? ''} ${r.school_name ?? ''}`;
      const codice = r.school_code?.trim() || estraiCodiceMeccanograficoDaTesto(testo);

      if (codice && !r.school_code?.trim()) {
        patch.school_code = codice;
        daCodice += 1;
      }
      if (!r.contact_email?.trim()) {
        const email = risolviEmailUfficialeScuola({ schoolCode: codice, testo })?.email;
        if (email) {
          patch.contact_email = email;
          daEmail += 1;
        }
      }
      const nomeRegistro = nomeScuolaDaCodice(codice);
      if (nomeRegistro && !r.school_name?.trim()) {
        patch.school_name = nomeRegistro;
        daNome += 1;
      }

      if (Object.keys(patch).length === 0) continue;
      if (apply) {
        const { error: errUpd } = await client.from('interpelli').update(patch).eq('id', r.id);
        if (errUpd) {
          console.warn(`  ✗ ${r.id.slice(0, 8)}… ${errUpd.message}`);
          continue;
        }
      }
      scritti += 1;
    }

    console.log(`— Interpelli esaminati: ${righe.length} —`);
    console.log(`  · codice meccanografico recuperato: ${daCodice}`);
    console.log(`  · email ufficiale ricostruita (PEO): ${daEmail}`);
    console.log(`  · nome scuola dal registro: ${daNome}`);
    console.log(
      apply
        ? `✓ Righe aggiornate: ${scritti}`
        : `(dry-run) righe da aggiornare: ${scritti} — usa -- --apply per applicare`,
    );
  }
}
