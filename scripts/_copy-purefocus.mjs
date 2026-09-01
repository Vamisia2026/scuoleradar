/* Copy PureFocus unificata + CTA bottom PrezziPage.
   Uso: node scripts/_copy-purefocus.mjs */
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
function sostituisci(f, vecchia, nuova) {
  const txt = leggi(f);
  if (txt.split(vecchia).length - 1 === 0) throw new Error(`Non trovato in ${f}: ${vecchia.slice(0, 70)}`);
  scrivi(f, txt.split(vecchia).join(nuova));
}

const definizionePureFocus = `              La piattaforma che trasforma YouTube in un ambiente di studio e lavoro: elimina
              distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve
              per ottimizzare il tuo tempo.`;

/* ============ PREZZIPAGE ============ */
{
  const f = 'src/pages/PrezziPage.tsx';
  applicaOp(f, [
    { type: 'insertAfter', line: 221, text: definizionePureFocus },
    { type: 'removeRange', start: 222, end: 223 },
    {
      type: 'replaceLine',
      line: 255,
      new: '          <h2 className="mt-4 text-3xl font-bold text-white">Attiva il tuo Radar Scuole</h2>',
    },
    { type: 'insertAfter', line: 255, text: '          <p className="mt-3 text-lg text-primary-200">Crea il tuo profilo in 5 secondi!</p>' },
    { type: 'removeRange', start: 256, end: 259 },
    { type: 'replaceLine', line: 265, new: '            Inizia Ora' },
  ]);
  console.log('  ✓ PrezziPage: definizione PureFocus + CTA bottom (Attiva il tuo Radar Scuole / Inizia Ora)');
}

/* ============ LANDINGPAGE ============ */
{
  const f = 'src/pages/LandingPage.tsx';
  applicaOp(f, [
    { type: 'insertAfter', line: 226, text: definizionePureFocus },
    { type: 'removeRange', start: 227, end: 230 },
  ]);
  console.log('  ✓ LandingPage: definizione PureFocus nel banner');
}

/* ============ PUREFOCUSPAGE ============ */
{
  const f = 'src/pages/PureFocusPage.tsx';
  applicaOp(f, [
    { type: 'insertAfter', line: 37, text: definizionePureFocus },
    { type: 'removeRange', start: 38, end: 41 },
  ]);
  console.log('  ✓ PureFocusPage: definizione PureFocus');
}

/* ============ VETRINAMODAL ============ */
{
  const f = 'src/components/VetrinaModal.tsx';
  sostituisci(
    f,
    "'PureFocus è una piattaforma straordinaria che trasforma YouTube in un ambiente di studio e lavoro: elimina distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve per ottimizzare il tuo tempo. PureFocus costa 29$ all\\u2019anno ed è incluso nel tuo abbonamento a Scuole Radar.',",
    "'La piattaforma che trasforma YouTube in un ambiente di studio e lavoro: elimina distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve per ottimizzare il tuo tempo.',",
  );
  console.log('  ✓ VetrinaModal: definizione PureFocus');
}

console.log('\nCopy PureFocus unificata completata.');
