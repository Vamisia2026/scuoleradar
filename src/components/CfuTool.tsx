import { CheckCircle2, AlertTriangle } from 'lucide-react';

/** Righe della Matrice CFU mostrata nel mockup (anteprima illustrativa). */
const matrice = [
  {
    codice: 'A-28',
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
 * Check CFU — Anteprima ad alta fedeltà (mockup) della Matrice CFU che il
 * calcolatore genererà a Ottobre per i membri PRO.
 */
export function CfuTool() {
  return (
    <div className="space-y-4">
      {/* Banner riservato ai membri PRO */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-secondary-200 bg-gradient-to-r from-secondary-50 via-white to-accent-50 px-4 py-3">
        <span className="rounded-full bg-secondary-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-soft">
          IN ARRIVO AD OTTOBRE
        </span>
        <p className="text-sm font-semibold leading-relaxed text-primary-800">
          Riservato ai membri PRO. La tua Matrice CFU: classi di concorso, requisiti per ambito e
          piano di recupero.
        </p>
      </div>

      {/* Mockup glassmorphism della Matrice CFU */}
      <div className="rounded-3xl border border-white/50 bg-gradient-to-br from-white/80 via-accent-50/40 to-primary-50/50 p-4 shadow-card backdrop-blur sm:p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/60 bg-white/75 shadow-soft backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary-100/70 px-5 py-3">
            <p className="text-sm font-extrabold text-primary-900">Matrice CFU — classi di concorso</p>
            <span className="rounded-full bg-accent-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-700 ring-1 ring-accent-200">
              Anteprima PRO
            </span>
          </div>
          <div className="space-y-2.5 p-4">
            {matrice.map((r) => (
              <div key={r.codice} className="rounded-xl border border-primary-100/70 bg-white/70 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-primary-800">
                    {r.codice} · {r.nome}
                  </p>
                  {r.ammissibile ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-bold text-accent-700 ring-1 ring-accent-200">
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
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-primary-600">
                  {r.requisiti.map((q) => (
                    <span key={q.ambito} className="rounded-lg bg-slate-50 px-2.5 py-1">
                      {q.ambito}: {q.presenti}/{q.richiesti} CFU
                      {q.presenti >= q.richiesti ? (
                        <span className="font-bold text-accent-700"> ✓</span>
                      ) : (
                        <span className="font-bold text-secondary-700">
                          {' '}(mancano {q.richiesti - q.presenti})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 max-w-2xl text-xs font-medium text-primary-400">
          Anteprima illustrativa della Matrice CFU che vedrai a Ottobre, riservata ai membri PRO.
        </p>
      </div>
    </div>
  );
}
