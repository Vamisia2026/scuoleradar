import { AlertTriangle, CheckCircle2, GraduationCap, Sparkles } from 'lucide-react';

/** Righe dell'analisi CFU mostrate nel mockup. */
const analisi = [
  {
    codice: 'A-27',
    nome: 'Matematica e Fisica',
    ammissibile: true,
    requisiti: [
      { ambito: 'Matematico-informatico', presenti: 24, richiesti: 24 },
      { ambito: 'Fisico', presenti: 18, richiesti: 18 },
    ],
  },
  {
    codice: 'A-26',
    nome: 'Matematica',
    ammissibile: false,
    requisiti: [{ ambito: 'Matematico-informatico', presenti: 18, richiesti: 24 }],
  },
  {
    codice: 'A-20',
    nome: 'Fisica',
    ammissibile: false,
    requisiti: [{ ambito: 'Fisico', presenti: 12, richiesti: 24 }],
  },
] as const;

/**
 * Calcolatore CFU — Anteprima ad alta fedeltà dell'analisi del piano di studi
 * che il calcolatore genererà a Ottobre per i membri PRO.
 */
export function CfuTool() {
  return (
    <div className="space-y-5">
      {/* Feature highlight */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-secondary-200 bg-gradient-to-r from-secondary-50 via-white to-accent-50 px-4 py-3">
        <span className="rounded-full bg-secondary-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-soft">
          IN ARRIVO AD OTTOBRE
        </span>
        <p className="text-sm font-semibold leading-relaxed text-primary-800">
          Analisi automatica del tuo piano di studi: scopri subito quali classi di concorso puoi
          insegnare e i CFU esatti che ti mancano.
        </p>
      </div>

      {/* Mockup dell'analisi CFU */}
      <div className="rounded-3xl border border-primary-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-card sm:p-6">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-soft">
          {/* Header del pannello */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-primary-700 to-primary-900 px-5 py-3.5">
            <p className="flex items-center gap-2 text-sm font-extrabold text-white">
              <GraduationCap className="h-4 w-4 text-accent-300" />
              La tua analisi CFU
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-200 ring-1 ring-white/20">
              <Sparkles className="h-3 w-3" />
              PRO
            </span>
          </div>

          <div className="space-y-2.5 p-4">
            {analisi.map((r) => (
              <div
                key={r.codice}
                className={`rounded-xl border p-4 ${
                  r.ammissibile ? 'border-accent-200 bg-accent-50/60' : 'border-primary-100 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-bold text-primary-800">
                    <span className="rounded-lg bg-primary-800 px-2 py-0.5 font-mono text-[11px] text-white">
                      {r.codice}
                    </span>
                    {r.nome}
                  </p>
                  {r.ammissibile ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-soft">
                      <CheckCircle2 className="h-3 w-3" />
                      AMMISSIBILE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary-50 px-2.5 py-0.5 text-[11px] font-bold text-secondary-700 ring-1 ring-secondary-200">
                      <AlertTriangle className="h-3 w-3" />
                      DA INTEGRARE
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-2.5">
                  {r.requisiti.map((q) => {
                    const pct = Math.round((q.presenti / q.richiesti) * 100);
                    const ok = q.presenti >= q.richiesti;
                    return (
                      <div key={q.ambito}>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-primary-600">
                          <span className="font-semibold">{q.ambito}</span>
                          <span className={`font-bold ${ok ? 'text-accent-700' : 'text-secondary-700'}`}>
                            {q.presenti}/{q.richiesti} CFU
                            {ok ? ' ✓' : ` (mancano ${q.richiesti - q.presenti})`}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${ok ? 'bg-accent-500' : 'bg-secondary-400'}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-2xl text-xs font-medium text-primary-400">
          Inserisci i tuoi esami e scopri subito dove sei ammesso e cosa ti manca per insegnare la
          classe che vuoi.
        </p>
      </div>
    </div>
  );
}
