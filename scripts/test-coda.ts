import { createClient } from '@supabase/supabase-js';
import { claimScanTarget, finishScanTarget, reapStuckScans } from '../src/lib/queue';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Mancano le variabili d’ambiente SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔄 Avvio test coda ScuoleRadar...');
  
  // 1. Libera eventuali lock bloccati
  const reaped = await reapStuckScans(client);
  console.log(`🧹 Lock rasi/liberati: ${reaped}`);

  // 2. Prendi in carico un target
  const target = await claimScanTarget(client, { worker: 'script-test-worker' });
  
  if (!target) {
    console.log('⚠️ Nessun target pronto nella coda.');
    return;
  }

  console.log(`🎯 Target preso con successo: [${target.region}] ${target.city} (id: ${target.id})`);

  // 3. Chiudi il target con successo
  await finishScanTarget(client, { id: target.id, success: true });
  console.log(`✅ Target ${target.city} chiuso e ripianificato.`);
}

main().catch((err) => {
  console.error('❌ Errore durante il test della coda:', err);
  process.exit(1);
});