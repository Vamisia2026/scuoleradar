/* Refactor UI (parte 2): ServiziPaywall, CvPage, CfuPage.
   Uso: node scripts/_refactor-ui2.mjs */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const scrivi = (f, txt) => {
  const norm = txt.split('\n').join('\r\n');
  fs.writeFileSync(path.join(root, f), norm, 'utf8');
};
const log = (m) => console.log(`  ✓ ${m}`);

/* ---- ServiziPaywall: solo PRO, niente crediti ---- */
scrivi(
  'src/components/ServiziPaywall.tsx',
  `import { useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { AbbonamentoModal } from '@/components/AbbonamentoModal';

/** Paywall riusabile per gli strumenti riservati ai membri PRO. */
export function ServiziPaywall({
  titolo = 'Contenuto riservato',
  messaggio = 'Questo strumento è riservato ai membri PRO.',
}: {
  titolo?: string;
  messaggio?: string;
}) {
  const { avviaCheckout } = useApp();
  const [apriPro, setApriPro] = useState(false);

  return (
    <>
      <div className="max-w-2xl rounded-2xl border border-primary-100 bg-white p-8 shadow-card">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
          <Lock className="h-7 w-7 text-primary-400" />
        </span>
        <h3 className="mt-4 text-lg font-bold text-primary-800">{titolo}</h3>
        <p className="mt-1 max-w-md text-sm text-primary-500">{messaggio}</p>
        <button
          onClick={() => setApriPro(true)}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
        >
          <Sparkles className="h-4 w-4" />
          Passa a PRO
        </button>
      </div>

      <AbbonamentoModal
        open={apriPro}
        onClose={() => setApriPro(false)}
        onConfirm={(promo) => avviaCheckout('pro_annuale', promo)}
      />
    </>
  );
}
`,
);
log('ServiziPaywall: rimossi i crediti (solo PRO)');

/* ---- CvPage: niente testi descrittivi ---- */
scrivi(
  'src/pages/CvPage.tsx',
  `import { FileText } from 'lucide-react';
import { CvTool } from '@/components/CvTool';

export function CvPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary-600" />
        <h2 className="text-3xl font-bold text-primary-800">Crea CV</h2>
      </div>
      <CvTool />
    </div>
  );
}
`,
);
log('CvPage: semplificata');

/* ---- CfuPage: niente testi descrittivi ---- */
scrivi(
  'src/pages/CfuPage.tsx',
  `import { Calculator } from 'lucide-react';
import { CfuTool } from '@/components/CfuTool';

export function CfuPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-primary-600" />
        <h2 className="text-3xl font-bold text-primary-800">Check CFU</h2>
      </div>
      <CfuTool />
    </div>
  );
}
`,
);
log('CfuPage: semplificata');

console.log('\nRefactor UI (parte 2) completata.');
