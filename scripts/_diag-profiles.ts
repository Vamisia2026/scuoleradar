/**
 * DIAGNOSTICA TEMPORANEA — profili utente reali (perché la dashboard mostra 0).
 * Da cancellare dopo l'uso.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
) as Record<string, string>;

const svc = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await svc.from('profiles').select('*').limit(50);
console.log('profiles:', error?.message ?? 'ok', '→', data?.length ?? 0);
for (const p of data ?? []) {
  console.log('———');
  console.log(JSON.stringify(p, null, 2));
}
