import { useState } from 'react';
import { Sparkles, Download } from 'lucide-react';

interface SezioneCv {
  titolo: string;
  righe: string[];
}

function parseCv(testo: string): SezioneCv[] {
  const righe = testo.split('\n').map((r) => r.trim()).filter(Boolean);
  const sezioni: SezioneCv[] = [];
  const keywords = [
    { k: /esperienz[ae]/i, label: 'Esperienze' },
    { k: /formazione|istruzion/i, label: 'Formazione' },
    { k: /competenz[ae]/i, label: 'Competenze' },
    { k: /lingu[ae]/i, label: 'Lingue' },
    { k: /contatt[oi]/i, label: 'Contatti' },
    { k: /profilo|presentazion/i, label: 'Profilo' },
    { k: /certificazion/i, label: 'Certificazioni' },
    { k: /pubblicazion/i, label: 'Pubblicazioni' },
  ];

  let corrente: SezioneCv | null = null;
  for (const riga of righe) {
    const match = keywords.find((kw) => kw.k.test(riga));
    if (match && riga.length < 40) {
      if (corrente) sezioni.push(corrente);
      corrente = { titolo: match.label, righe: [] };
    } else if (corrente) {
      corrente.righe.push(riga);
    } else {
      corrente = { titolo: 'Profilo', righe: [riga] };
    }
  }
  if (corrente) sezioni.push(corrente);
  return sezioni;
}

export function CvTool() {
  const [testo, setTesto] = useState('');
  const [anteprima, setAnteprima] = useState<SezioneCv[] | null>(null);

  const handleGenera = () => {
    if (!testo.trim()) return;
    setAnteprima(parseCv(testo));
  };

  const handlePdf = () => {
    alert('Download PDF simulato. In una versione completa, qui verrebbe generato un PDF del tuo CV.');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <h3 className="text-base font-bold text-primary-800">Incolla il tuo vecchio CV</h3>
        <p className="mt-1 text-sm text-primary-600">
          Incolla il testo del tuo CV. Lo trasformiamo in un layout ordinato.
        </p>
        <textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          rows={14}
          placeholder={`Esperienze\nDocente di Matematica - Liceo Galilei (2020-2024)\n...\n\nFormazione\nLaurea in Matematica - Università di Milano\n...\n\nCompetenze\nItaliano (madrelingua), Inglese (B2), Excel, ...`}
          className="input mt-4 font-mono text-xs"
        />
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleGenera}
            disabled={!testo.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Genera anteprima
          </button>
          {anteprima && (
            <button
              onClick={handlePdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
            >
              <Download className="h-4 w-4" />
              Scarica PDF
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <h3 className="text-base font-bold text-primary-800">Anteprima moderna</h3>
        {!anteprima ? (
          <div className="mt-6 flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-primary-100 text-sm text-primary-400">
            Genera un'anteprima per vedere il tuo CV ristrutturato.
          </div>
        ) : (
          <div className="mt-4 animate-fade-in">
            <CvPreview sezioni={anteprima} />
          </div>
        )}
      </div>
    </div>
  );
}

function CvPreview({ sezioni }: { sezioni: SezioneCv[] }) {
  const contatti = sezioni.find((s) => s.titolo === 'Contatti');
  const profilo = sezioni.find((s) => s.titolo === 'Profilo');
  const altre = sezioni.filter((s) => s.titolo !== 'Contatti' && s.titolo !== 'Profilo');

  return (
    <div className="rounded-xl border border-primary-100 bg-slate-50 p-5">
      {contatti && (
        <div className="border-b border-primary-100 pb-3">
          {contatti.righe.map((r, i) => (
            <p key={i} className={i === 0 ? 'text-lg font-bold text-primary-800' : 'text-xs text-primary-500'}>
              {r}
            </p>
          ))}
        </div>
      )}
      {profilo && (
        <div className="mt-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary-400">Profilo</h4>
          <p className="mt-1 text-sm text-primary-700">{profilo.righe.join(' ')}</p>
        </div>
      )}
      {altre.map((s) => (
        <div key={s.titolo} className="mt-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary-400">{s.titolo}</h4>
          <ul className="mt-1 space-y-1">
            {s.righe.map((r, i) => (
              <li key={i} className="text-sm text-primary-700">
                <span className="mr-1.5 text-primary-300">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
