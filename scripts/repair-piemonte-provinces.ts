// scripts/repair-piemonte-provinces.ts
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('✗ Credenziali Supabase mancanti nel file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const PROVINCE_VALIDE: ReadonlySet<string> = new Set([
  'AG','AL','AN','AO','AP','AQ','AR','AT','AV',
  'BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ',
  'CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ',
  'EN','FC','FE','FG','FI','FM','FR',
  'GE','GO','GR',
  'IM','IS',
  'KR',
  'LC','LE','LI','LO','LT','LU',
  'MB','MC','ME','MI','MN','MO','MS','MT',
  'NA','NO','NU',
  'OR',
  'PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ',
  'RA','RC','RE','RG','RI','RM','RN','RO',
  'SA','SI','SO','SP','SR','SS','SU','SV',
  'TA','TE','TN','TO','TP','TR','TS','TV',
  'UD',
  'VA','VB','VC','VE','VI','VR','VT','VV',
]);

function estraiProvincia(schoolCode: string): string | null {
  const s = (schoolCode || '').trim();
  if (s.length < 2) return null;
  const codice = s.slice(0, 2).toUpperCase();
  return PROVINCE_VALIDE.has(codice) ? codice : null;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`• Avvio riparazione province EE (dryRun: ${dryRun})`);

  const { data: rows, error } = await supabase
    .from('interpelli')
    .select('id, school_code')
    .eq('province', 'EE')
    .not('school_code', 'is', null);

  if (error) {
    console.error('✗ Errore lettura Supabase:', error);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('✓ Nessun record con province = "EE" trovato.');
    return;
  }

  console.log(`• Trovati ${rows.length} record con province='EE'. Analisi in corso...`);

  let riparati = 0;
  let saltati = 0;

  for (const row of rows) {
    const nuovaProv = estraiProvincia(row.school_code);
    if (!nuovaProv) {
      saltati++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ID ${row.id}: school_code=${row.school_code} → ${nuovaProv}`);
      riparati++;
    } else {
      const { error: updateErr } = await supabase
        .from('interpelli')
        .update({ province: nuovaProv })
        .eq('id', row.id);

      if (updateErr) {
        console.error(`✗ Errore update ID ${row.id}:`, updateErr.message);
      } else {
        riparati++;
      }
    }
  }

  console.log('──────────────────────────────────────────');
  console.log(`Completato! Riparati: ${riparati}${dryRun ? ' (dry-run)' : ''}, Saltati: ${saltati}`);
}

main().catch((err) => {
  console.error('✗ Errore fatale:', err);
  process.exit(1);
});