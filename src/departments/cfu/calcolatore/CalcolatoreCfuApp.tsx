import { useState } from 'react';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import type {
  AllegatoCfu,
  DiagnosiCFU,
  DossierCFU,
  Esame,
  ObiettivoUtenteCfu,
} from '../shared/types';
import { CfuErrorBoundary } from '../shared/CfuErrorBoundary';
import { allegatoDaFile } from '../shared/ocrUtils';
import { caricaEsamiDemo } from './demo';
import { creaDossier, scaricaDossier } from '../dossier/dossierService';
import { StepObiettivo } from './components/StepObiettivo';
import { StepDocumenti } from './components/StepDocumenti';
import { StepAnalisi } from './components/StepAnalisi';
import { StepDiagnosi } from './components/StepDiagnosi';
import { StepDossier } from './components/StepDossier';
import { StepWelcome } from './components/StepWelcome';

type Fase = 'benvenuto' | 'obiettivo' | 'documenti' | 'analisi' | 'diagnosi' | 'dossier';

const ORDINE_FASI: Exclude<Fase, 'benvenuto'>[] = [
  'obiettivo',
  'documenti',
  'analisi',
  'diagnosi',
  'dossier',
];

const ETICHETTE_FASI: Record<Fase, string> = {
  benvenuto: '0 · Benvenuto',
  obiettivo: '1 · Obiettivo',
  documenti: '2 · Documenti',
  analisi: '3 · Calcolo',
  diagnosi: '4 · Orientamento',
  dossier: '5 · Dossier',
};

function IndicatoreFasi({ attiva, indice }: { attiva: Fase; indice: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Avanzamento">
      {ORDINE_FASI.map((fase, posizione) => {
        const completata = posizione < indice;
        const corrente = fase === attiva;
        return (
          <li
            key={fase}
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition ${
              corrente
                ? 'bg-white text-primary-800 shadow-soft'
                : completata
                  ? 'bg-accent-500/90 text-white'
                  : 'bg-white/10 text-primary-100 ring-1 ring-white/15'
            }`}
          >
            {completata ? '✓ ' : ''}
            {ETICHETTE_FASI[fase]}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Calcolatore CFU — console immersiva del Dipartimento CFU.
 * Percorso guidato: 0 Benvenuto (Tutor) → 1 Obiettivo → 2 Documenti/upload →
 * 3 Calcolo → 4 Orientamento → 5 Dossier per la scuola.
 */
export function CalcolatoreCfuApp() {
  const [fase, setFase] = useState<Fase>('benvenuto');
  const [obiettivo, setObiettivo] = useState<ObiettivoUtenteCfu | null>(null);
  const [esami, setEsami] = useState<Esame[]>([]);
  const [allegati, setAllegati] = useState<AllegatoCfu[]>([]);
  const [diagnosi, setDiagnosi] = useState<DiagnosiCFU | null>(null);
  const [dossier, setDossier] = useState<DossierCFU | null>(null);

  const indiceCorrente = fase === 'benvenuto' ? -1 : ORDINE_FASI.indexOf(fase);
  const aggiungiEsame = (esame: Esame) => setEsami((p) => [...p, esame]);
  const rimuoviEsame = (id: string) => setEsami((p) => p.filter((e) => e.id !== id));
  const impostaEsami = (nuovi: Esame[]) => setEsami(nuovi);
  const aggiungiAllegati = (file: File[]) => {
    const validi = file
      .map((f) => allegatoDaFile(f))
      .filter((a): a is AllegatoCfu => a !== null);
    setAllegati((p) => [...p, ...validi]);
  };
  const rimuoviAllegato = (id: string) => setAllegati((p) => p.filter((a) => a.id !== id));
  const caricaDemo = () => setEsami(caricaEsamiDemo());
  const completaAnalisi = (risultato: DiagnosiCFU) => {
    setDiagnosi(risultato);
    setFase('diagnosi');
  };
  const apriDossier = () => {
    if (!diagnosi) return;
    setDossier(creaDossier(diagnosi));
    setFase('dossier');
  };
  const ricomincia = () => {
    setObiettivo(null);
    setEsami([]);
    setAllegati([]);
    setDiagnosi(null);
    setDossier(null);
    setFase('benvenuto');
  };

  return (
    <CfuErrorBoundary>
      <div>
        <div className="overflow-hidden rounded-3xl border border-primary-100 bg-white shadow-card">
          {/* Testata Dipartimento CFU — stile dark/slate (PureFocus) */}
          <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-accent-300 ring-1 ring-white/15">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent-300">
                  Dipartimento CFU
                </p>
                <h2 className="text-xl font-extrabold text-white sm:text-2xl">
                  Calcolatore CFU
                </h2>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-200 ring-1 ring-white/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Calcolo in tempo reale
            </span>
          </div>
          {fase !== 'benvenuto' && (
            <div className="mt-4">
              <IndicatoreFasi attiva={fase} indice={indiceCorrente} />
            </div>
          )}
        </div>

        {/* Corpo del percorso */}
        <div className="px-4 py-4 sm:px-6">
          {/* Step 0 — Benvenuto / presentazione del Tutor */}
          {fase === 'benvenuto' && <StepWelcome onInizia={() => setFase('obiettivo')} />}

          {fase === 'obiettivo' && (
            <StepObiettivo
              selezionato={obiettivo}
              onSeleziona={setObiettivo}
              onContinua={() => setFase('documenti')}
            />
          )}

          {fase === 'documenti' && (
            <StepDocumenti
              esami={esami}
              allegati={allegati}
              onAggiungiEsame={aggiungiEsame}
              onRimuoviEsame={rimuoviEsame}
              onImpostaEsami={impostaEsami}
              onAggiungiAllegati={aggiungiAllegati}
              onRimuoviAllegato={rimuoviAllegato}
              onCaricaDemo={caricaDemo}
              onContinua={() => setFase('analisi')}
            />
          )}

          {fase === 'analisi' && obiettivo && (
            <StepAnalisi
              esami={esami}
              allegati={allegati}
              obiettivo={obiettivo}
              onCompletata={completaAnalisi}
            />
          )}

          {fase === 'diagnosi' && diagnosi && (
            <StepDiagnosi
              diagnosi={diagnosi}
              onModificaEsami={() => setFase('documenti')}
              onVaiDossier={apriDossier}
            />
          )}

          {fase === 'diagnosi' && !diagnosi && (
            <div className="py-6 text-center text-base text-primary-500">
              L&apos;orientamento non è ancora pronto: torna alla raccolta documenti.
            </div>
          )}

          {fase === 'dossier' && dossier && (
            <StepDossier
              dossier={dossier}
              onScarica={() => scaricaDossier(dossier)}
              onTornaDiagnosi={() => setFase('diagnosi')}
              onRicomincia={ricomincia}
            />
          )}
        </div>
        </div>
      </div>
    </CfuErrorBoundary>
  );
}
