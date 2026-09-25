/**
 * Wizard Radar — PASSO 2 «Dove vuoi cercare?» (province monitorate).
 *
 * Presentazione pura: pill dei codici già scelti, ricerca live e lista con
 * limite per piano. Stato e persistenza restano nel contenitore.
 */
import { AlertCircle, MapPin, Search, Star } from 'lucide-react';
import { province, type Provincia } from '@/data/province';
import { provinciaPrincipale } from '@/lib/provinceRadar';
import type { PianoLimits } from '@/lib/planLimits';
import { ProvinciaPill } from '../components/ProvinciaPill';

interface PassoProvinceProps {
  /** Codici delle province selezionate. */
  provinceCodici: string[];
  /** Aggiunge/rimuove una provincia dalla selezione. */
  toggleProvincia: (codice: string) => void;
  /** Promuove una provincia di contorno a provincia PRINCIPALE (prima della lista). */
  onPromuoviPrincipale: (codice: string) => void;
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
  onPromuoviPrincipale,
  provinceFiltrate,
  queryProvincia,
  setQueryProvincia,
  maxProvince,
  provinceWarning,
  limitiPiano,
}: PassoProvinceProps) {
  /** Prima provincia selezionata = provincia di riferimento del Radar. */
  const principale = provinciaPrincipale(provinceCodici);
  return (
            <div className="animate-fade-in">
              <h2 className="text-base font-bold text-primary-800">Dove vuoi cercare?</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-primary-500">
                Scegli dove vuoi cercare. Il Radar elimina la necessità di controllare manualmente
                decine di siti provinciali.
              </p>

              {provinceCodici.length > 0 && (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {provinceCodici.map((c, indice) => (
                      <ProvinciaPill
                        key={c}
                        nome={province.find((p) => p.codice === c)?.nome ?? c}
                        codice={c}
                        principale={c === principale}
                        inAttesa={indice >= maxProvince}
                        onRimuovi={() => toggleProvincia(c)}
                        onPromuovi={() => onPromuoviPrincipale(c)}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-primary-500">
                    <Star className="mt-0.5 h-3 w-3 shrink-0 fill-current text-accent-500" />
                    <span>
                      La provincia <strong>principale</strong> è la prima che scegli: gli avvisi
                      della tua zona hanno priorità. Promuovi le altre con la ☆
                      {provinceCodici.length > maxProvince
                        ? ' — quelle marcate PRO restano salvate e si attivano con il piano PRO.'
                        : '.'}
                    </span>
                  </p>
                </>
              )}

              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
                  <input
                    type="text"
                    value={queryProvincia}
                    onChange={(e) => setQueryProvincia(e.target.value)}
                    placeholder="Cerca provincia (nome o sigla)…"
                    className="w-full rounded-xl border border-primary-200 bg-white py-1.5 pl-9 pr-3 text-sm text-primary-800"
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
                <div className="mt-2 flex items-start gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-3 py-2 text-xs text-secondary-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {limitiPiano.piano === 'pro'
                    ? `Sei al massimo: PRO include fino a ${maxProvince} province monitorabili.`
                    : 'Il piano Base include 1 provincia. Passa a PRO per avvisi istantanei e fino a 4 province.'}
                </div>
              )}

              <div className="mt-2 max-h-36 space-y-0.5 overflow-y-auto rounded-xl border border-primary-100 p-1">
                {provinceFiltrate.length === 0 ? (
                  <p className="p-3 text-center text-sm text-primary-400">Nessuna provincia trovata.</p>
                ) : (
                  provinceFiltrate.map((p) => {
                    const selected = provinceCodici.includes(p.codice);
                    const atLimit = provinceCodici.length >= maxProvince && !selected;
                    return (
                      <label
                        key={p.codice}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 transition hover:bg-primary-50 ${
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
