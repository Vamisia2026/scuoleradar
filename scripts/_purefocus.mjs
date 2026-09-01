/* PureFocus sponsor card (parte 1).
   Uso: node scripts/_purefocus.mjs */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const scrivi = (f, txt) => {
  const norm = txt.split('\n').join('\r\n');
  fs.writeFileSync(path.join(root, f), norm, 'utf8');
};

scrivi(
  'src/pages/PureFocusPage.tsx',
  `import { Link } from 'react-router-dom';
import { ExternalLink, PenLine, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

/**
 * PureFocus — sponsor esterno (purefocus.one) incluso nel piano PRO.
 * Card pubblicitaria ad alto impatto (stile homepage) con CTA dinamica in
 * base allo stato dell'utente:
 *  - Base / non registrati: bottone arancione "PASSA A PRO" → /prezzi.
 *  - PRO: "VAI SU PUREFOCUS.ONE" con messaggio di stato personalizzato.
 */
export function PureFocusPage() {
  const { abbonato } = useApp();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PenLine className="h-5 w-5 text-primary-600" />
        <h2 className="text-3xl font-bold text-primary-800">PureFocus</h2>
      </div>

      {/* Card sponsor ad alto impatto (gradiente dark, stile homepage) */}
      <div className="rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 p-8 text-white shadow-card sm:p-10">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-3xl">
            🧘
          </span>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-primary-100">
              <Sparkles className="h-3.5 w-3.5" />
              Incluso nel piano PRO
            </span>
            <h3 className="mt-2 text-2xl font-bold sm:text-3xl">PureFocus · purefocus.one</h3>
          </div>
        </div>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-primary-100">
          PureFocus trasforma YouTube in un ambiente di studio e lavoro: elimina distrazioni,
          suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve per ottimizzare il
          tuo tempo. Uno strumento essenziale per studiare, ripassare e preparare le tue lezioni
          senza perdere la concentrazione.
        </p>

        {abbonato ? (
          <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
            <p className="max-w-2xl text-sm leading-relaxed text-primary-100">
              🎉 Grazie al tuo account PRO a ScuoleRadar, hai sbloccato l&apos;accesso PRO a PureFocus
              (valore 29$/anno)! Usalo subito per studiare e lavorare su YouTube senza distrazioni.
            </p>
            <a
              href="https://purefocus.one"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary-800 shadow-soft transition hover:bg-primary-50"
            >
              VAI SU PUREFOCUS.ONE
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
            <p className="max-w-2xl text-sm leading-relaxed text-primary-100">
              PureFocus costa 29$/anno ed è <strong>INCLUSO GRATUITAMENTE</strong> nel tuo
              abbonamento PRO a ScuoleRadar.
            </p>
            <Link
              to="/prezzi"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-secondary-500 px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"
            >
              PASSA A PRO
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
`,
);
console.log('  ✓ PureFocusPage: card sponsor + CTA dinamica');
