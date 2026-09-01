/* Fix CTA DashboardPage (terminologia) — parte rimanente.
   Uso: node scripts/_fix-dashboard-cta.mjs */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const leggi = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const scrivi = (f, txt) => {
  const eol = /\r\n/.test(txt) ? '\r\n' : '\n';
  fs.writeFileSync(path.join(root, f), txt.split(/\r?\n/).join('\n').split('\n').join(eol), 'utf8');
};
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

const f = 'src/pages/DashboardPage.tsx';
applicaOp(f, [
  { type: 'replaceLine', line: 76, new: '    openAuthModal,' },
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
console.log('  ✓ DashboardPage: openAuthModal nel destructure + CTA non-loggati');
