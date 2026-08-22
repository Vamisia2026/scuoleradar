import { useMemo, useState } from 'react';
import { Search, ChevronDown, Radar, BellRing } from 'lucide-react';
import { classiConcorso } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { Pill } from './Pill';

export function SimulatorRadar() {
  const [provCodice, setProvCodice] = useState('');
  const [classeCodice, setClasseCodice] = useState('');
  const [simulato, setSimulato] = useState(false);

  const provinceSorted = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);
  const classiSorted = useMemo(() => [...classiConcorso].sort((a, b) => a.codice.localeCompare(b.codice)), []);

  const handleSimula = () => setSimulato(true);

  return (
    <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card sm:p-7">
      <div className="mb-4 flex items-center gap-2 text-primary-700">
        <Radar className="h-5 w-5" />
        <h3 className="text-lg font-bold">Prova il Radar</h3>
      </div>
      <p className="mb-5 text-sm text-primary-600">
        Scegli una provincia e una classe di concorso per vedere un esempio di notifica.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-primary-700">Provincia</span>
          <div className="relative">
            <select
              value={provCodice}
              onChange={(e) => setProvCodice(e.target.value)}
              className="w-full appearance-none rounded-xl border border-primary-200 bg-white px-4 py-2.5 pr-10 text-sm text-primary-800 transition focus:border-primary-500"
            >
              <option value="">Seleziona provincia…</option>
              {provinceSorted.map((p) => (
                <option key={p.codice} value={p.codice}>
                  {p.nome} ({p.codice})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-primary-700">Classe di concorso</span>
          <div className="relative">
            <select
              value={classeCodice}
              onChange={(e) => setClasseCodice(e.target.value)}
              className="w-full appearance-none rounded-xl border border-primary-200 bg-white px-4 py-2.5 pr-10 text-sm text-primary-800 transition focus:border-primary-500"
            >
              <option value="">Seleziona classe…</option>
              {classiSorted.map((c) => (
                <option key={c.codice} value={c.codice}>
                  {c.codice} – {c.denominazione}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
          </div>
        </label>
      </div>

      <button
        onClick={handleSimula}
        disabled={!provCodice || !classeCodice}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <Search className="h-4 w-4" />
        Simula
      </button>

      {simulato && provCodice && classeCodice && (
        <div className="mt-6 animate-fade-in rounded-xl border border-accent-200 bg-accent-50 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
              <BellRing className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-accent-800">
                Oggi c'è 1 interpello per te. Le altre 141 non ti servono.
              </p>
              <p className="mt-1 text-sm text-accent-700">
                Abbiamo filtrato gli interpelli per la provincia di{' '}
                <strong>{province.find((p) => p.codice === provCodice)?.nome}</strong> e la classe{' '}
                <strong>{classeCodice}</strong>. Solo ciò che ti riguarda davvero.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill label={classeCodice} color="accent" />
                <Pill label={province.find((p) => p.codice === provCodice)?.nome ?? ''} color="primary" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
