/* Blocco "Modelli Scaricati" per utenti Base (ProfiloPage + menu Header).
   Uso: node scripts/_modelli-pro-lock.mjs */
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

/* ============ PROFILOPAGE ============ */
{
  const f = 'src/pages/ProfiloPage.tsx';
  const bloccoLock = `          )}
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-primary-200 bg-primary-50/50 p-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-[11px] font-bold text-primary-600 ring-1 ring-primary-200">
              <Lock className="h-3.5 w-3.5" />
              Funzionalità PRO
            </span>
            <p className="text-sm font-semibold leading-relaxed text-primary-800">
              I tuoi modelli scaricati sono salvati nel tuo archivio personale (Funzionalità PRO)
            </p>
            <Link
              to="/prezzi"
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
            >
              Passa a PRO per salvare i tuoi documenti
            </Link>
          </div>
        )}`;

  applicaOp(f, [
    {
      type: 'replaceLine',
      line: 5,
      new: '  Star, Ban, Download, Trash2, Sparkles, ChevronDown, AlertTriangle, Loader2, FolderOpen, Lock,',
    },
    {
      type: 'replaceLine',
      line: 73,
      new: '  const { preferenze, setPreferenze, salvaProfilo, abbonato } = useApp();',
    },
    {
      type: 'replaceLine',
      line: 347,
      new: "        badge={abbonato ? (moduliScaricati.length ? `${moduliScaricati.length} scaricati` : undefined) : 'PRO'}",
    },
    {
      type: 'replaceLine',
      line: 351,
      new: '        {abbonato ? (\n          moduliScaricati.length === 0 ? (',
    },
    { type: 'replaceLine', line: 389, new: bloccoLock },
    { type: 'replaceLine', line: 398, new: '          {abbonato && moduliScaricati.length > 0 && (' },
  ]);
  console.log('  ✓ ProfiloPage: blocco bloccato Funzionalità PRO per Base, lista reale per PRO');
}

/* ============ HEADER (menu utente) ============ */
{
  const f = 'src/components/Header.tsx';
  const blocco = `                      <Link
                        to={abbonato ? '/dashboard/moduli' : '/prezzi'}
                        onClick={chiudiMenuUtente}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                      >
                        {abbonato ? (
                          <FileText className="h-4 w-4 text-primary-400" />
                        ) : (
                          <Lock className="h-4 w-4 text-secondary-500" />
                        )}
                        Documenti scaricati
                        {abbonato ? (
                          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-50 px-1.5 text-[11px] font-bold text-primary-600">
                            {moduliScaricati}
                          </span>
                        ) : (
                          <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-secondary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-700 ring-1 ring-secondary-200">
                            <Lock className="h-3 w-3" />
                            PRO
                          </span>
                        )}
                      </Link>`;

  applicaOp(f, [
    {
      type: 'replaceLine',
      line: 3,
      new: "import { LogOut, User as UserIcon, Menu, X, Sparkles, ChevronDown, CreditCard, FileText, Lock } from 'lucide-react';",
    },
    { type: 'insertAfter', line: 183, text: blocco },
    { type: 'removeRange', start: 184, end: 194 },
  ]);
  console.log('  ✓ Header: voce "Documenti scaricati" con lucchetto/PRO per Base');
}

console.log('\nFeature Lock completata.');
