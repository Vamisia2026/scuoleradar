/* Refactor UI (parte 1): Header, Dashboard, Profilo, spazzatura text-center.
   Uso: node scripts/_refactor-ui.mjs  (dal root del progetto) */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const leggi = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const scrivi = (f, txt) => {
  const eol = /\r\n/.test(txt) ? '\r\n' : '\n';
  const norm = txt.split(/\r?\n/).join('\n');
  fs.writeFileSync(path.join(root, f), eol === '\r\n' ? norm.split('\n').join('\r\n') : norm, 'utf8');
};
const righe = (f) => leggi(f).split(/\r?\n/);

/** Applica operazioni line-based a un file (ordine ascendente di riga). */
function applicaOp(f, ops) {
  const lines = righe(f);
  const sorted = [...ops].sort((a, b) => (a.line ?? a.start) - (b.line ?? b.start));
  let delta = 0;
  for (const op of sorted) {
    if (op.type === 'replaceLine') {
      lines[op.line - 1 + delta] = op.new;
    } else if (op.type === 'removeLine') {
      lines.splice(op.line - 1 + delta, 1);
      delta -= 1;
    } else if (op.type === 'removeRange') {
      const s = op.start - 1 + delta;
      const e = op.end - 1 + delta;
      lines.splice(s, e - s + 1);
      delta -= e - s + 1;
    } else if (op.type === 'insertAfter') {
      const idx = op.line + delta;
      const parts = op.text.split('\n');
      lines.splice(idx, 0, ...parts);
      delta += parts.length;
    } else {
      throw new Error(`Operazione sconosciuta: ${op.type} in ${f}`);
    }
  }
  scrivi(f, lines.join('\n'));
}

/** Sostituzione testuale semplice. */
function sostituisci(f, vecchia, nuova, deveEsserci = true) {
  const txt = leggi(f);
  const n = txt.split(vecchia).length - 1;
  if (n === 0 && deveEsserci) throw new Error(`Stringa non trovata in ${f}: ${vecchia.slice(0, 70)}`);
  scrivi(f, txt.split(vecchia).join(nuova));
}

const log = (msg) => console.log(`  ✓ ${msg}`);

/* ================= 1. HEADER ================= */
{
  const f = 'src/components/Header.tsx';
  const dropdownExtra = [
    '                      <Link',
    '                        to="/dashboard/moduli"',
    '                        onClick={chiudiMenuUtente}',
    '                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"',
    '                      >',
    '                        <FileText className="h-4 w-4 text-primary-400" />',
    '                        Documenti scaricati',
    '                        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-50 px-1.5 text-[11px] font-bold text-primary-600">',
    '                          {moduliScaricati}',
    '                        </span>',
    '                      </Link>',
    '                      {!abbonato && (',
    '                        <Link',
    '                          to="/prezzi"',
    '                          onClick={chiudiMenuUtente}',
    '                          className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-secondary-500 px-3 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"',
    '                        >',
    '                          <Sparkles className="h-4 w-4" />',
    '                          PASSA A PRO',
    '                        </Link>',
    '                      )}',
  ].join('\n');

  const moduliScaricatiBlock = [
    '',
    '  // Documenti scaricati dall\u2019utente (conteggio condiviso con la pagina Moduli).',
    '  const moduliScaricati = useMemo(() => {',
    '    try {',
    "      const raw = localStorage.getItem('scuoleradar:moduli_scaricati');",
    '      if (!raw) return 0;',
    '      const arr = JSON.parse(raw) as unknown[];',
    '      return Array.isArray(arr) ? arr.length : 0;',
    '    } catch {',
    '      return 0;',
    '    }',
    '  }, []);',
  ].join('\n');

  applicaOp(f, [
    { type: 'replaceLine', line: 1, new: "import { useMemo, useState } from 'react';" },
    {
      type: 'replaceLine',
      line: 3,
      new: "import { LogOut, User as UserIcon, Menu, X, Sparkles, ChevronDown, CreditCard, FileText } from 'lucide-react';",
    },
    { type: 'removeLine', line: 5 },
    { type: 'replaceLine', line: 23, new: '/** Ordine ufficiale della barra servizi (Guest, Base, PRO): Radar Scuole \u2192 ... */' },
    { type: 'removeLine', line: 25 },
    { type: 'replaceLine', line: 36, new: '  const { user, abbonato, logout, openAuthModal, avatarUrl } = useApp();' },
    { type: 'removeLine', line: 40 },
    { type: 'insertAfter', line: 43, text: moduliScaricatiBlock },
    { type: 'removeRange', start: 114, end: 121 },
    { type: 'insertAfter', line: 182, text: dropdownExtra },
    { type: 'removeLine', line: 382 },
  ]);
  log('Header: crediti rimossi, Profilo fuori dalla barra servizi, PASSA A PRO + Documenti aggiunti');
}

/* ================= 2. DASHBOARD ================= */
{
  const f = 'src/pages/DashboardPage.tsx';
  applicaOp(f, [
    {
      type: 'replaceLine',
      line: 3,
      new: "import { BellRing, CheckCircle2, Radar, Database, SlidersHorizontal } from 'lucide-react';",
    },
    { type: 'removeLine', line: 7 },
    { type: 'removeLine', line: 8 },
    { type: 'removeLine', line: 23 },
    { type: 'removeLine', line: 78 },
    { type: 'removeLine', line: 79 },
    { type: 'removeRange', start: 84, end: 85 },
    { type: 'removeRange', start: 185, end: 190 },
    { type: 'removeRange', start: 193, end: 212 },
    { type: 'removeRange', start: 300, end: 305 },
  ]);
  sostituisci(f, 'bg-white p-10 text-center shadow-card', 'bg-white p-10 text-left shadow-card');
  sostituisci(f, 'mt-6 text-center text-sm text-primary-500', 'mt-6 max-w-2xl text-left text-sm text-primary-500');
  log('DashboardPage: crediti e "Abbonati 49\u20ac/anno" rimossi, tab Profilo eliminato');
}

/* ================= 3. PROFILO ================= */
{
  const f = 'src/pages/ProfiloPage.tsx';
  applicaOp(f, [
    { type: 'removeLine', line: 21 },
    { type: 'replaceLine', line: 74, new: '  const { preferenze, setPreferenze, salvaProfilo } = useApp();' },
    { type: 'removeRange', start: 153, end: 154 },
    { type: 'removeRange', start: 344, end: 366 },
    { type: 'removeLine', line: 368 },
  ]);
  const dopo = leggi(f);
  if ((dopo.match(/Sparkles/g) || []).length === 0) {
    sostituisci(
      f,
      '  Star, Ban, Download, Trash2, Sparkles, ChevronDown, AlertTriangle, Loader2, FolderOpen,',
      '  Star, Ban, Download, Trash2, ChevronDown, AlertTriangle, Loader2, FolderOpen,',
    );
  }
  log('ProfiloPage: widget "Crediti a consumo" rimosso');
}

/* ================= 4. SPAZZATURA text-center ================= */
{
  const sost = [
    ['src/pages/LandingPage.tsx', 'mt-6 text-center text-sm text-primary-500', 'mx-auto mt-6 max-w-2xl text-left text-sm text-primary-500'],
    ['src/pages/LandingPage.tsx', 'border-t border-primary-100 pt-6 text-center text-sm text-primary-400', 'border-t border-primary-100 pt-6 text-left text-sm text-primary-400'],
    ['src/departments/notizie/components/NotizieGrid.tsx', 'p-10 text-center text-sm text-primary-400', 'p-10 text-left text-sm text-primary-400'],
    ['src/modules/modulistica/components/SavedModuli.tsx', 'p-8 text-center text-sm text-primary-400', 'p-8 text-left text-sm text-primary-400'],
    ['src/modules/modulistica/components/EsploraArchivio.tsx', 'mt-1 text-center text-xs font-medium text-primary-400', 'mt-1 text-left text-xs font-medium text-primary-400'],
    ['src/modules/modulistica/components/EsploraArchivio.tsx', 'p-8 text-center text-sm text-primary-400', 'p-8 text-left text-sm text-primary-400'],
    ['src/pages/ContattiPage.tsx', 'mt-6 text-center text-xs text-primary-400', 'mt-6 text-left text-xs text-primary-400'],
    ['src/components/VetrinaModal.tsx', 'text-center text-sm font-medium text-primary-500', 'text-left text-sm font-medium text-primary-500'],
    ['src/components/AbbonamentoModal.tsx', 'text-center text-xs text-primary-400', 'text-left text-xs text-primary-400'],
  ];
  for (const [f, v, n] of sost) sostituisci(f, v, n);
  log('Spazzatura text-center: paragrafi multilinea allineati a sinistra');
}

console.log('\nRefactor UI (parte 1) completata.');

