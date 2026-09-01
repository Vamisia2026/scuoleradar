/* Refactor UI/UX — Assistente Sindacalista: copy, placeholder, Età, Ruolo.
   Uso: node scripts/_assistente-cleanup.mjs */
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
    else if (op.type === 'removeLine') { lines.splice(op.line - 1 + delta, 1); delta -= 1; }
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

const f = 'src/pages/AssistenteAIPage.tsx';
applicaOp(f, [
  {
    type: 'replaceLine',
    line: 66,
    new: "          Stiamo cercando scuolatori che vogliono provare il servizio in anteprima. Lascia i tuoi dati",
  },
  {
    type: 'replaceLine',
    line: 67,
    new: "          qui: ti contatteremo appena apriremo l'accesso.",
  },
  { type: 'removeLine', line: 83 }, // placeholder="Mario Rossi"
  { type: 'removeLine', line: 94 }, // placeholder="mario@esempio.it"
  {
    type: 'removeRange',
    start: 124,
    end: 126, // vecchie opzioni Ruolo
  },
  {
    type: 'insertAfter',
    line: 123,
    text: `              <option value="docente">Docente</option>
              <option value="ata_segreteria">ATA (Segreteria)</option>
              <option value="ata_tecnico">ATA (Tecnico)</option>
              <option value="ata_collaboratore">ATA (Collaboratore scolastico / Bidello)</option>
              <option value="educatore">Educatore</option>
              <option value="dirigente">Dirigente</option>
              <option value="altro">Altro</option>`,
  },
  { type: 'replaceLine', line: 130, new: '            <span className="mb-1 block text-xs font-semibold text-primary-700">Età</span>' },
  { type: 'removeLine', line: 137 }, // placeholder="Es. 34"
]);
console.log('  ✓ AssistenteAIPage: copy, placeholder rimossi, Età senza (anni), Ruolo espanso');
