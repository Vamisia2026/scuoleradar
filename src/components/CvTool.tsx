import { useState } from 'react';
import { Sparkles, Download, FileDown } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

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
  const { abbonato, user, openVetrina } = useApp();
  const [testo, setTesto] = useState('');
  const [anteprima, setAnteprima] = useState<SezioneCv[] | null>(null);

  const handleCrea = () => {
    if (!testo.trim()) return;
    // Vetrina: per creare e salvare il CV serve un account (registrazione/login).
    if (!user) {
      openVetrina('cv');
      return;
    }
    setAnteprima(parseCv(testo));
  };

  const handlePdf = () => {
    // Vetrina: al download serve un account (Free con logo) oppure PRO (senza logo).
    if (!user) {
      openVetrina('cv');
      return;
    }
    if (abbonato) {
      alert('Download PDF simulato senza logo: versione pulita per gli abbonati PRO.');
    } else {
      alert(
        'Download PDF simulato con watermark "ScuoleRadar.it" sul documento. Passa al piano PRO per scaricare senza logo.',
      );
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <h3 className="text-base font-bold text-primary-800">Crea CV</h3>
        <p className="mt-2 text-lg leading-relaxed text-primary-600">
          Che succede se ti troviamo un interpello, ma non hai un CV pronto? Perdi questa possibilità
          di lavoro? No, ti aiutiamo noi a costruirlo, rinfrescarlo o adattarlo. Il servizio è gratis.
          Il CV gratuito ha il nostro logo, se hai un abbonamento ScuoleRadar è senza logo e puoi usare
          tutti i nostri servizi per insegnanti senza limiti. La qualità, comunque, è la stessa.
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
            onClick={handleCrea}
            disabled={!testo.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Crea CV
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
        {abbonato ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-700">
            <FileDown className="h-3.5 w-3.5" />
            Incluso nel piano PRO: scarichi il PDF senza logo.
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-primary-400">
            <FileDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Incluso gratuitamente nella registrazione (con logo ScuoleRadar.it nel PDF). Passa a PRO
            o usa 1 credito per la versione senza logo.
          </p>
        )}
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
