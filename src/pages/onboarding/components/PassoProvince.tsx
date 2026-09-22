/**
 * Onboarding · PASSO 3 — province di interesse.
 *
 * Pill delle province scelte, ricerca per nome/sigla, contatore fair use e
 * avviso al raggiungimento del tetto. Presentazione pura: stato e handler
 * arrivano dalla pagina.
 */
import { AlertCircle, MapPin, Search } from 'lucide-react';
import { Pill } from '@/components/Pill';
import { province, type Provincia } from '@/data/province';

interface PassoProvinceProps {
  /** Tetto di province monitorabili (fair use). */
  LIMITE_PROVINCE: number;
  /** Codici delle province selezionate. */
  provinceCodici: string[];
  /** Province già ordinate/filtrate dalla pagina. */
  provinceFiltrate: Provincia[];
  /** true quando l'utente ha provato a superare il tetto. */
  provinceWarning: boolean;
  queryProvincia: string;
  setQueryProvincia: (valore: string) => void;
  toggleProvincia: (codice: string) => void;
}

export function PassoProvince({
  LIMITE_PROVINCE,
  provinceCodici,
  provinceFiltrate,
  provinceWarning,
  queryProvincia,
  setQueryProvincia,
  toggleProvincia,
}: PassoProvinceProps) {
  return (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-primary-800">Province di interesse</h2>
              <p className="mt-1 text-sm text-primary-600">
                Seleziona le province in cui vuoi ricevere opportunità (interpelli, bandi, progetti).
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

              {/* Ricerca + contatore fair use */}
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
                    provinceCodici.length >= LIMITE_PROVINCE
                      ? 'bg-secondary-100 text-secondary-700'
                      : 'bg-primary-50 text-primary-600'
                  }`}
                >
                  {provinceCodici.length}/{LIMITE_PROVINCE} province
                </span>
              </div>

              {(provinceWarning || provinceCodici.length >= LIMITE_PROVINCE) && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Puoi selezionare fino a {LIMITE_PROVINCE} province col tuo piano attuale.
                </div>
              )}

              <div className="mt-3 max-h-80 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-2">
                {provinceFiltrate.length === 0 ? (
                  <p className="p-4 text-center text-sm text-primary-400">Nessuna provincia trovata.</p>
                ) : (
                  provinceFiltrate.map((p) => {
                    const selected = provinceCodici.includes(p.codice);
                    const atLimit = provinceCodici.length >= LIMITE_PROVINCE && !selected;
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
