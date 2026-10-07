/** TEMP: provenienza delle righe "dump di codici". Da cancellare. */
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
const { data, error } = await svc.from('interpelli').select('*').limit(1);
console.log('errore:', error?.message ?? 'ok');
if (data && data[0]) console.log('COLONNE:', Object.keys(data[0]).join(', '));

const { data: rows, error: e2 } = await svc
  .from('interpelli')
  .select('id,province,class_codes,title,source_url,school_name,school_code,expiration_date,region,city_slug,materia')
  .limit(2000);
console.log('errore2:', e2?.message ?? 'ok', '| righe:', rows?.length ?? 0);

const isDump = (t: string | null) =>
  /^[A-Za-z0-9]{3,}(\s*[|·]\s*[A-Za-z0-9]{2,}){1,}$/.test((t ?? '').trim());
console.log('\n--- righe DUMP ---');
for (const r of rows ?? []) {
  if (!isDump(r.title)) continue;
  console.log(
    `[${r.province}] classi=${JSON.stringify(r.class_codes)} scad=${r.expiration_date} reg=${r.region}\n` +
      `   title="${r.title}"\n` +
      `   source_url=${r.source_url}\n` +
      `   school=${JSON.stringify(r.school_name)} code=${JSON.stringify(r.school_code)} city=${r.city_slug}`,
  );
}
