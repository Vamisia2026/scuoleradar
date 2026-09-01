/* ReferralSection — codice promo stile Satispay (parte 1).
   Uso: node scripts/_referral-satispay.mjs */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const f = 'src/components/profile/ReferralSection.tsx';

const blocco1 = `      {/* Codice promo — stile Satispay */}
      <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50 p-4">
        <p className="text-xs uppercase tracking-wide text-primary-500">Il tuo codice promo personale</p>
        <div className="mt-2.5 rounded-xl border-2 border-dashed border-secondary-300 bg-white px-4 py-3.5">
          <p className="font-mono text-2xl font-extrabold uppercase tracking-[0.15em] text-primary-900 sm:text-3xl">
            {codice || 'NOMECOGNOME'}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-primary-600">
            Usa il codice promo: <strong className="font-mono uppercase">{codice || 'NOMECOGNOME'}</strong> su{' '}
            <strong>scuoleradar.it</strong>
          </p>
        </div>

        {editMode ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => void handleInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSalva()}
              placeholder="IL TUO CODICE"
              className="input w-52 font-mono text-sm"
              autoFocus
            />
            <button
              onClick={() => void handleSalva()}
              disabled={salvataggio || !input || disponibile === false}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-600 disabled:opacity-50"
            >
              {salvataggio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Salva
            </button>
            <button
              onClick={() => {
                setEditMode(false);
                setInput('');
                setErrore('');
                setDisponibile(null);
              }}
              className="rounded-lg px-2 py-2 text-xs font-medium text-primary-500 transition hover:text-primary-700"
            >
              Annulla
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditMode(true);
              setInput(codice);
              setDisponibile(null);
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Personalizza il codice
          </button>
        )}
`;
const blocco2 = `
        {editMode && (
          <p className="mt-2 text-xs">
            {disponibile === true && <span className="text-accent-600">✓ Codice disponibile</span>}
            {disponibile === false && <span className="text-error-600">✗ Codice già in uso</span>}
          </p>
        )}
        {errore && <p className="mt-2 text-xs text-error-600">{errore}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleCopia()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
          >
            {copiato ? <Check className="h-3.5 w-3.5 text-accent-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copiato ? 'Codice copiato!' : 'Copia codice'}
          </button>
          <a
            href={\`https://wa.me/?text=\${testoCondivisione}\`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-600"
          >
            <Share2 className="h-3.5 w-3.5" />
            WhatsApp
          </a>
          <a
            href={\`https://t.me/share/url?url=\${encodeURIComponent(linkReferral)}&text=\${testoCondivisione}\`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-600"
          >
            <Send className="h-3.5 w-3.5" />
            Telegram
          </a>
        </div>
      </div>
`;

const txt = fs.readFileSync(f, 'utf8');
const startMarker = '      {/* Codice promo */}';
const endMarker = '      {/* KPI */}';
const startIdx = txt.indexOf(startMarker);
const endIdx = txt.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  throw new Error('Marcatori non trovati in ReferralSection');
}
let nuovo = txt.slice(0, startIdx) + blocco1 + blocco2 + txt.slice(endIdx);

// Testo di condivisione in stile Satispay
nuovo = nuovo.replace(
  '`Invita un collega a ScuoleRadar 🎯 — -10€ sul piano PRO con il tuo codice ${codice}. ${linkReferral}`',
  '`Usa il codice promo ${codice} su scuoleradar.it 🎯 — -10€ sul piano PRO. ${linkReferral}`',
);

const eol = /\r\n/.test(txt) ? '\r\n' : '\n';
fs.writeFileSync(f, nuovo.split(/\r?\n/).join('\n').split('\n').join(eol), 'utf8');
console.log('  ✓ ReferralSection: codice promo stile Satispay + etichetta "Usa il codice promo"');

