/* Terminologia "Calcolatore CFU" + CTA Radar non-loggati.
   Uso: node scripts/_terminology-cta.mjs */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const leggi = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const scrivi = (f, txt) => {
  const eol = /\r\n/.test(txt) ? '\r\n' : '\n';
  fs.writeFileSync(path.join(root, f), txt.split(/\r?\n/).join('\n').split('\n').join(eol), 'utf8');
};
function sostituisci(f, vecchia, nuova) {
  const txt = leggi(f);
  if (txt.split(vecchia).length - 1 === 0) throw new Error(`Non trovato in ${f}: ${vecchia.slice(0, 60)}`);
  scrivi(f, txt.split(vecchia).join(nuova));
}
function applicaOp(f, ops) {
  const lines = leggi(f).split(/\r?\n/);
  const sorted = [...ops].sort((a, b) => (a.line ?? a.start) - (b.line ?? b.start));
  let delta = 0;
  for (const op of sorted) {
    if (op.type === 'replaceLine') lines[op.line - 1 + delta] = op.new;
    else if (op.type === 'removeRange') {
      const s = op.start - 1 + delta;
      const e = op.end - 1 + delta;
      lines.splice(s, e - s + 1);
      delta -= e - s + 1;
    } else if (op.type === 'insertAfter') {
      const idx = op.line + delta;
      const parts = op.text.split('\n');
      lines.splice(idx, 0, ...parts);
      delta += parts.length;
    }
  }
  scrivi(f, lines.join('\n'));
}

/* 1. Header — label tab */
sostituisci('src/components/Header.tsx', "label: '🎓 Check CFU'", "label: '🎓 Calcolatore CFU'");
console.log('  ✓ Header: tab "Calcolatore CFU"');

/* 2. DashboardPage — label tab, import, destructure, CTA non-loggati */
sostituisci('src/pages/DashboardPage.tsx', "label: '🎓 Check CFU'", "label: '🎓 Calcolatore CFU'");
sostituisci(
  'src/pages/DashboardPage.tsx',
  "import { BellRing, CheckCircle2, Radar, Database, SlidersHorizontal } from 'lucide-react';",
  "import { BellRing, CheckCircle2, Radar, Database, SlidersHorizontal, UserPlus } from 'lucide-react';",
);
sostituisci('src/pages/DashboardPage.tsx', '    openVetrina,\n', '    openAuthModal,\n');
applicaOp('src/pages/DashboardPage.tsx', [
  {
    type: 'insertAfter',
    line: 135,
    text: `          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => openAuthModal('registrazione')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
            >
              <UserPlus className="h-4 w-4" />
              Iscriviti Gratis (Account Base)
            </button>
            <Link
              to="/prezzi"
              className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
            >
              Passa a PRO
            </Link>
          </div>`,
  },
  { type: 'removeRange', start: 136, end: 142 },
]);
console.log('  ✓ DashboardPage: CTA non-loggati (Iscriviti Gratis / Passa a PRO), tab rinominato');

/* 3. CfuPage — titolo pagina */
sostituisci(
  'src/pages/CfuPage.tsx',
  '<h2 className="text-3xl font-bold text-primary-800">Check CFU</h2>',
  '<h2 className="text-3xl font-bold text-primary-800">Calcolatore CFU</h2>',
);
console.log('  ✓ CfuPage: titolo "Calcolatore CFU"');

/* 4. servizi.ts */
sostituisci('src/data/servizi.ts', "titolo: 'Check CFU',", "titolo: 'Calcolatore CFU',");
console.log('  ✓ servizi.ts: titolo "Calcolatore CFU"');

/* 5. VetrinaModal */
sostituisci('src/components/VetrinaModal.tsx', "titolo: 'Check CFU',", "titolo: 'Calcolatore CFU',");
console.log('  ✓ VetrinaModal: titolo "Calcolatore CFU"');

/* 6. docs */
sostituisci('docs/SYSTEM_HANDOVER.md', '8. Check CFU & CV Builder', '8. Calcolatore CFU & CV Builder');
sostituisci('docs/SYSTEM_HANDOVER.md', '## 8. Check CFU & CV Builder', '## 8. Calcolatore CFU & CV Builder');
console.log('  ✓ docs: sezione rinominata');

console.log('\nTerminologia & CTA completate.');
