import { useState } from 'react';
import { Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { useApp, type Esame } from '@/contexts/AppContext';
import { classiConcorso, type ClasseConcorso } from '@/data/classiConcorso';

interface RisultatoClasse {
  classe: ClasseConcorso;
  ammissibile: boolean;
  dettagli: { ambito: string; richiesto: number; presente: number; mancante: number }[];
}

function valutaCfu(esami: Esame[]): RisultatoClasse[] {
  return classiConcorso.map((classe) => {
    const dettagli = classe.requisitiCfu.map((req) => {
      // match semplice: somma CFU esami che contengono parole chiave dell'ambito
      const parole = req.ambito.toLowerCase().split(/[\s,]+/).filter((p) => p.length > 4);
      const presente = esami
        .filter((e) =>
          parole.some((p) => e.materia.toLowerCase().includes(p) || e.settore.toLowerCase().includes(p)),
        )
        .reduce((sum, e) => sum + e.cfu, 0);
      return {
        ambito: req.ambito,
        richiesto: req.cfu,
        presente: Math.min(presente, req.cfu),
        mancante: Math.max(0, req.cfu - presente),
      };
    });
    const ammissibile = dettagli.every((d) => d.mancante === 0);
    return { classe, ammissibile, dettagli };
  });
}

export function CfuTool() {
  const { esami, setEsami } = useApp();
  const [materia, setMateria] = useState('');
  const [cfu, setCfu] = useState(6);
  const [settore, setSettore] = useState('');

  const aggiungi = () => {
    if (!materia.trim() || cfu <= 0) return;
    setEsami([
      ...esami,
      { id: crypto.randomUUID(), materia: materia.trim(), cfu, settore: settore.trim() },
    ]);
    setMateria('');
    setCfu(6);
    setSettore('');
  };

  const rimuovi = (id: string) => setEsami(esami.filter((e) => e.id !== id));

  const risultati = valutaCfu(esami);
  const ammissibili = risultati.filter((r) => r.ammissibile);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <h3 className="text-base font-bold text-primary-800">I tuoi esami universitari</h3>
        <p className="mt-1 text-sm text-primary-600">
          Inserisci materia, CFU e settore scientifico-disciplinare. Verificheremo le classi di concorso accessibili.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px_1fr_auto]">
          <input
            type="text"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            placeholder="Materia (es. Letteratura italiana)"
            className="input"
          />
          <input
            type="number"
            min={1}
            value={cfu}
            onChange={(e) => setCfu(parseInt(e.target.value) || 0)}
            placeholder="CFU"
            className="input"
          />
          <input
            type="text"
            value={settore}
            onChange={(e) => setSettore(e.target.value)}
            placeholder="Settore (es. L-FIL-LET/10)"
            className="input"
          />
          <button
            onClick={aggiungi}
            disabled={!materia.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Aggiungi
          </button>
        </div>

        {esami.length > 0 && (
          <div className="mt-4 space-y-2">
            {esami.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-primary-100 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-primary-800">{e.materia}</p>
                  <p className="text-xs text-primary-500">
                    {e.cfu} CFU{e.settore ? ` · ${e.settore}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => rimuovi(e.id)}
                  aria-label="Rimuovi esame"
                  className="rounded-lg p-1.5 text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-primary-800">Classi di concorso accessibili</h3>
          <span className="rounded-full bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-700">
            {ammissibili.length} ammissibili
          </span>
        </div>

        {esami.length === 0 ? (
          <p className="mt-4 text-sm text-primary-400">
            Aggiungi almeno un esame per vedere le classi di concorso accessibili.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {risultati.map((r) => (
              <div
                key={r.classe.codice}
                className={`rounded-xl border p-4 ${
                  r.ammissibile ? 'border-accent-200 bg-accent-50' : 'border-primary-100 bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-primary-800">
                      {r.classe.codice} – {r.classe.denominazione}
                    </p>
                    <p className="mt-0.5 text-xs text-primary-500">
                      {r.classe.materie.join(', ')}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      r.ammissibile ? 'bg-accent-500 text-white' : 'bg-error-50 text-error-700'
                    }`}
                  >
                    {r.ammissibile ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ammissibile
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        Non ammissibile
                      </>
                    )}
                  </span>
                </div>

                {!r.ammissibile && (
                  <div className="mt-3 space-y-1">
                    {r.dettagli
                      .filter((d) => d.mancante > 0)
                      .map((d, i) => (
                        <p key={i} className="text-xs text-error-600">
                          Mancano <strong>{d.mancante} CFU</strong> in: {d.ambito} (presenti {d.presente}/{d.richiesto})
                        </p>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-primary-400">
          Valutazione indicativa basata su requisiti minimi. Verifica sempre la normativa vigente e il bando di riferimento.
        </p>
      </div>
    </div>
  );
}

