/**
 * Wizard Radar — PASSO 1 «Dove vuoi lavorare?» (ordini di scuola & PNRR).
 *
 * Componente di sola presentazione: la selezione vive nel contenitore
 * (`RadarWizardModal`) e arriva qui come props. Nessuno stato locale.
 * In testa il blocco ANAGRAFICA facoltativo: i dati raccolti qui viaggiano nella
 * bozza di registrazione e vengono precompilati nel form finale (nessun dato
 * richiesto due volte).
 */
import { Check } from 'lucide-react';
import { ordiniScuola, type OrdineScuola } from '@/data/ordiniMaterie';
import { BloccoAnagrafica, type DatiAnagrafica } from '@/components/BloccoAnagrafica';
import { creaIconeOrdine } from '../ordineIcone';

/** Icone degli ordini di scuola nella taglia grande usata dal wizard. */
const ordineIcons = creaIconeOrdine('h-6 w-6');

interface PassoOrdiniProps {
  /** Ordini di scuola attualmente selezionati. */
  ordini: OrdineScuola[];
  /** Aggiunge/rimuove un ordine di scuola dalla selezione. */
  toggleOrdine: (id: OrdineScuola) => void;
  /** Anagrafica dichiarata nel wizard (facoltativa): finisce nella registrazione. */
  anagrafica: DatiAnagrafica;
  onChangeAnagrafica: (patch: Partial<DatiAnagrafica>) => void;
}

export function PassoOrdini({
  ordini,
  toggleOrdine,
  anagrafica,
  onChangeAnagrafica,
}: PassoOrdiniProps) {
  return (
            <div className="animate-fade-in">
              {/* Anagrafica rapida: evita di richiedere nome/cognome/genere/età alla
                  registrazione finale (i dati viaggiano nella bozza). */}
              <div className="mb-5">
                <BloccoAnagrafica
                  dati={anagrafica}
                  onChange={onChangeAnagrafica}
                  nota="Facoltativo. Lo salviamo nel tuo profilo: alla registrazione non te lo chiediamo di nuovo."
                />
              </div>
              <h2 className="text-lg font-bold text-primary-800">
                Dove vuoi lavorare?
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {ordiniScuola.map((o) => {
                  const selected = ordini.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleOrdine(o.id)}
                      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                        selected
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                          : 'border-primary-200 bg-white hover:border-primary-300'
                      }`}
                    >
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          selected ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-600'
                        }`}
                      >
                        {ordineIcons[o.id]}
                      </span>
                      <span className="flex-1">
                        <span className="block font-semibold text-primary-800">{o.nome}</span>
                        <span className="block text-xs text-primary-500">{o.descrizione}</span>
                      </span>
                      {selected && <Check className="h-5 w-5 shrink-0 text-primary-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
  );
}
