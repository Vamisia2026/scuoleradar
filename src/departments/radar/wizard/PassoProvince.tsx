/**
 * Wizard Radar — PASSO 2 «Dove vuoi cercare?» (province monitorate).
 *
 * Presentazione pura: pill dei codici già scelti, ricerca live e lista con
 * limite per piano. Stato e persistenza restano nel contenitore.
 */
import { AlertCircle, MapPin, Search } from 'lucide-react';
import { Pill } from '@/components/Pill';
import { province, type Provincia } from '@/data/province';
import type { PianoLimits } from '@/lib/planLimits';

interface PassoProvinceProps {
  /** Codici delle province selezionate. */
  provinceCodici: string[];
  /** Aggiunge/rimuove una provincia dalla selezione. */
  toggleProvincia: (codice: string) => void;
  /** Province da mostrare (già filtrate dalla query nel contenitore). */
  provinceFiltrate: Provincia[];
  /** Testo di ricerca corrente. */
  queryProvincia: string;
  setQueryProvincia: (valore: string) => void;
  /** Tetto di province del piano corrente. */
  maxProvince: number;
  /** true quando l'utente ha provato a superare il tetto. */
  provinceWarning: boolean;
  /** Limiti del piano (per il copy Base/PRO). */
  limitiPiano: PianoLimits;
}

export function PassoProvince({
  provinceCodici,
  toggleProvincia,
  provinceFiltrate,
  queryProvincia,
  setQueryProvincia,
  maxProvince,
  provinceWarning,
  limitiPiano,
}: PassoProvinceProps) {
  return (
            <div className="animate-fade-in">
              <h2 className="text-lg font-bold text-primary-800">Dove vuoi cercare?</h2>
              <p className="mt-1 text-sm leading-relaxed text-primary-500">
                Scegli dove vuoi cercare. Il Radar elimina la necessità di controllare manualmente
                decine di siti provinciali.
              </p>

              {provinceCodici.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {provinceCodici.map((c) => (
                    <Pill
                      key={c}
                      label={province.find((p) => p.codice === c)?.nome ?? c}
                      onRemove={() => toggleProvincia(c)}
                      color="primary"
                    />
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
                  <input
                    type="text"
                    value={queryProvincia}
                    onChange={(e) => setQueryProvincia(e.target.value)}
                    placeholder="Cerca provincia (nome o sigla)…"
                    className="w-full rounded-xl border border-primary-200 bg-white py-2.5 pl-10 pr-4 text-sm text-primary-800"
                  />
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    provinceCodici.length >= maxProvince
                      ? 'bg-secondary-100 text-secondary-700'
                      : 'bg-primary-50 text-primary-600'
                  }`}
                >
                  {provinceCodici.length}/{maxProvince} province
                </span>
              </div>

              {(provinceWarning || provinceCodici.length >= maxProvince) && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {limitiPiano.piano === 'pro'
                    ? `Sei al massimo: PRO include fino a ${maxProvince} province monitorabili.`
                    : 'Il piano Base include 1 provincia. Passa a PRO per avvisi istantanei e fino a 4 province.'}
                </div>
              )}

              <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-2">
                {provinceFiltrate.length === 0 ? (
                  <p className="p-4 text-center text-sm text-primary-400">Nessuna provincia trovata.</p>
                ) : (
                  provinceFiltrate.map((p) => {
                    const selected = provinceCodici.includes(p.codice);
                    const atLimit = provinceCodici.length >= maxProvince && !selected;
                    return (
                      <label
                        key={p.codice}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-primary-50 ${
                          selected ? 'bg-primary-50' : atLimit ? 'opacity-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={atLimit}
                          onChange={() => toggleProvincia(p.codice)}
                          className="h-4 w-4 rounded border-primary-300 text-primary-500"
                        />
                        <MapPin className="h-4 w-4 text-primary-400" />
                        <span className="text-sm text-primary-800">{p.nome}</span>
                        <span className="ml-auto text-xs text-primary-400">{p.codice}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
  );
}
