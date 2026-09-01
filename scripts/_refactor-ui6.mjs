/* Refactor UI (parte 6): ArchivistaCapo (purge crediti) + VetrinaModal (copy CFU).
   Uso: node scripts/_refactor-ui6.mjs */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const leggi = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const scrivi = (f, txt) => {
  const norm = txt.split('\r\n').join('\n');
  fs.writeFileSync(path.join(root, f), norm.split('\n').join('\r\n'), 'utf8');
};

function applicaOp(f, ops) {
  const lines = leggi(f).split('\r\n');
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
    }
  }
  scrivi(f, lines.join('\n'));
}

const f = 'src/modules/modulistica/creator/ArchivistaCapo.tsx';
const gate4 = `    if (!accessoConsentito) {
      setBusy(false);
      onAccessoRichiesto();
      return;
    }`;
const gate6 = `      if (!accessoConsentito) {
        setBusy(false);
        onAccessoRichiesto();
        return;
      }`;

applicaOp(f, [
  { type: 'removeLine', line: 58 },
  { type: 'replaceLine', line: 60, new: '  const { user } = useApp();' },
  { type: 'replaceLine', line: 62, new: '  const accessoConsentito = Boolean(user);' },
  { type: 'removeRange', start: 63, end: 66 },
  {
    type: 'insertAfter',
    line: 126,
    text: `    // Sessione assente: il parent gestisce l'avviso di accesso.
${gate4}`,
  },
  { type: 'removeRange', start: 127, end: 133 },
  { type: 'replaceLine', line: 183, new: '  }, [gestisciPronto, onAccessoRichiesto, accessoConsentito]);' },
  { type: 'insertAfter', line: 186, text: gate6 },
  { type: 'removeRange', start: 187, end: 192 },
  { type: 'replaceLine', line: 207, new: '    [chiediProssimo, accessoConsentito],' },
  { type: 'insertAfter', line: 217, text: gate4 },
  { type: 'removeRange', start: 218, end: 223 },
  { type: 'removeRange', start: 337, end: 363 },
  { type: 'replaceLine', line: 367, new: "          {fase === 'domanda' && !busy && (" },
]);
console.log('  ✓ ArchivistaCapo: gate a crediti rimosso (solo sessione)');

// VetrinaModal: copy Check CFU senza crediti.
{
  const g = 'src/components/VetrinaModal.tsx';
  const txt = leggi(g);
  const nuova = `      'Verifica le classi di concorso accessibili dal tuo percorso di studi: in arrivo a Ottobre, riservato ai membri PRO.',`;
  if (!txt.includes('procedi con 1 credito a consumo')) {
    console.error('  ✗ VetrinaModal: stringa CFU non trovata');
  } else {
    scrivi(
      g,
      txt.replace(
        "'Verifica le classi di concorso accessibili dal tuo percorso di studi: procedi con 1 credito a consumo oppure con il piano PRO senza limiti.',",
        nuova,
      ),
    );
    console.log('  ✓ VetrinaModal: copy CFU senza crediti');
  }
}
