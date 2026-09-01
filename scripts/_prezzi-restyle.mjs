/* Restyling PrezziPage — layout orizzontale psicologico.
   Sinistra: Mensile (9€) | Centro: PRO Annuale (49€) in evidenza | Destra: A consumo (5€).
   Uso: node scripts/_prezzi-restyle.mjs */
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
    if (op.type === 'removeRange') {
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

const pianiNuovi = `const piani: Piano[] = [
  {
    plan: 'pro_mensile',
    nome: 'PRO Mensile',
    prezzo: '9€',
    periodo: 'al mese · 108€/anno',
    descrizione: 'Stessi vantaggi del piano PRO, con fatturazione mensile flessibile.',
    evidenziato: false,
    caratteristiche: [
      'Segnalazioni e notifiche illimitate',
      'Tutti i tool completi: Crea CV, Calcolatore CFU, Assistente AI',
      'PDF ufficiali senza watermark',
      'Accesso completo a PureFocus incluso',
    ],
    cta: 'Scegli PRO Mensile',
  },
  {
    plan: 'pro_annuale',
    nome: 'PRO Annuale',
    prezzo: '49€',
    periodo: 'all\\u2019anno',
    descrizione: 'Il massimo dell\\u2019offerta, al prezzo migliore.',
    evidenziato: true,
    badge: 'Più Scelto',
    risparmio: 'Solo ~4€/mese — Risparmi il 55%',
    caratteristiche: [
      'Segnalazioni e notifiche illimitate',
      'Tutti i tool completi: Crea CV, Calcolatore CFU, Assistente AI',
      'PDF ufficiali senza watermark',
      'Accesso completo a PureFocus incluso',
    ],
    cta: 'Passa a PRO Annuale',
  },
  {
    plan: 'a_consumo',
    nome: 'A consumo',
    prezzo: '5€',
    periodo: 'per 5 crediti',
    descrizione: 'Paghi solo quando ti serve: un credito, un servizio.',
    evidenziato: false,
    sottotitolo: '1 credito = 1€ · paghi solo quando ti serve, senza abbonamento.',
    caratteristiche: [
      'Un credito per ogni servizio',
      'Nessun abbonamento automatico',
      'Credito valido 12 mesi dall\\u2019acquisto',
    ],
    cta: 'Acquista crediti a consumo',
  },
];`;

applicaOp('src/pages/PrezziPage.tsx', [
  { type: 'insertAfter', line: 22, text: pianiNuovi },
  { type: 'removeRange', start: 23, end: 71 },
  {
    type: 'insertAfter',
    line: 141,
    text: `            <p className="mx-auto mt-3 max-w-xl text-lg text-primary-600">
              Tre notifiche di prova in assoluto, una tantum. Poi scegli tu: PRO Annuale 49€,
              PRO Mensile 9€ o crediti a consumo. Niente rinnovi automatici nascosti.
            </p>`,
  },
  { type: 'removeRange', start: 142, end: 145 },
  {
    type: 'insertAfter',
    line: 147,
    text: `          <div className="mx-auto mt-12 grid max-w-5xl items-stretch gap-6 md:grid-cols-3">
            {piani.map((p) => (
              <div
                key={p.nome}
                className={\`relative flex flex-col rounded-3xl border p-6 shadow-card transition \${
                  p.evidenziato
                    ? 'border-secondary-200 bg-gradient-to-b from-secondary-50 to-white shadow-soft ring-1 ring-secondary-200 md:-my-2 md:py-9'
                    : 'border-primary-100 bg-white'
                }\`}
              >
                {p.evidenziato && p.badge && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-secondary-500 px-4 py-1 text-xs font-bold text-white shadow-soft">
                    <Sparkles className="h-3.5 w-3.5" />
                    {p.badge} · Consigliato
                  </span>
                )}

                <div className="text-center">
                  <h2 className="text-lg font-bold text-primary-800">{p.nome}</h2>
                  <p className="mx-auto mt-1 min-h-[40px] max-w-[240px] text-sm text-primary-500">
                    {p.descrizione}
                  </p>
                  <p className="mt-4">
                    <span className="text-4xl font-extrabold text-primary-900">{p.prezzo}</span>{' '}
                    <span className="text-sm font-medium text-primary-500">/ {p.periodo}</span>
                  </p>
                  {p.risparmio && (
                    <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-accent-100 px-3 py-1 text-xs font-bold text-accent-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      {p.risparmio}
                    </span>
                  )}
                  {p.sottotitolo && (
                    <p className="mt-3 rounded-xl bg-secondary-50 px-3 py-2 text-xs font-semibold text-secondary-800">
                      {p.sottotitolo}
                    </p>
                  )}
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.caratteristiche.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm text-primary-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                      {c}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCta(p.plan)}
                  className={\`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-soft transition \${
                    p.evidenziato
                      ? 'bg-secondary-500 hover:bg-secondary-600'
                      : 'bg-primary-500 hover:bg-primary-600'
                  }\`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>`,
  },
  { type: 'removeRange', start: 148, end: 207 },
]);
console.log('  ✓ griglia orizzontale 3 colonne con PRO Annuale al centro in evidenza');
console.log('\nRestyling PrezziPage completato.');

