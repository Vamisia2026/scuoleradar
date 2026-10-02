/**
 * ScuoleRadar.it — DEV Toolbar: sezione «Editor Testi Rapido» (UNIVERSALE e contestuale).
 *
 * Elenca i blocchi di testo che la pagina attiva ha DAVVERO a schermo — titoli, paragrafi,
 * voci di elenco, celle, pulsanti, didascalie — scandendo il DOM (`src/lib/testiDom.ts`):
 * non serve nessuna voce di dizionario né nessun cablaggio nei componenti. Si scrive in una
 * casella e il testo cambia SUBITO dove è usato, salvato in `localStorage:
 * sr_dom_text_overrides`; se React ri-renderizza, la scansione (montata dalla DEV Toolbar)
 * riapplica l'override. «Reset testi» riporta tutto ai default del codice.
 *
 * L'elenco è contestuale per costruzione: cambiando pagina, aprendo una modale o caricando
 * dati compare ciò che c'è in quel momento (l'header mostra la rotta e quanti testi ci sono
 * qui). Il registro dei testi (`src/data/editableTexts.ts`) resta il livello «con chiave»
 * usato dalle pagine: il reset azzera anche quello, così non resta nessun testo modificato
 * invisibile al pannello.
 *
 * Montata esclusivamente dalla DEV Toolbar (che esiste solo con `import.meta.env.DEV`).
 */
import { useState } from 'react';
import { ChevronDown, PenLine, RotateCcw, Undo2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { STORAGE_KEY_TESTI_DOM } from '@/lib/testiDomOverride';
import type { TestoDomRilevato } from '@/lib/testiDom';
import { useTestiDomInPagina } from '@/hooks/useTestiDom';
import { useTestiInPagina } from '@/hooks/useTestiEditabili';

/** Righe della casella: i testi lunghi ne meritano di più (resta ridimensionabile). */
function righe(voce: TestoDomRilevato): number {
  return Math.min(5, Math.max(2, Math.ceil(voce.testo.length / 55)));
}

/** Anteprima compatta di un testo, per capire a colpo d'occhio cosa si sta cambiando. */
function anteprima(testo: string): string {
  return testo.length > 60 ? `${testo.slice(0, 60)}…` : testo;
}

export function EditorTestiRapido() {
  const { pathname } = useLocation();
  const { testi, imposta, azzera } = useTestiDomInPagina();
  const { azzera: azzeraRegistro, modificati: modificatiRegistro } = useTestiInPagina();
  const [aperto, setAperto] = useState(false);

  const modificati = testi.filter((voce) => voce.modificato).length;

  return (
    <section data-sr-dev-toolbar="">
      <button
        type="button"
        onClick={() => setAperto((o) => !o)}
        aria-expanded={aperto}
        className="flex w-full items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary-400 transition hover:text-primary-600"
      >
        <PenLine className="h-4 w-4" />
        Editor Testi Rapido
        <span
          title="blocchi di testo rilevati nella vista attiva"
          className="rounded-full bg-primary-50 px-1.5 text-[10px] font-normal text-primary-500"
        >
          {testi.length} qui
        </span>
        {modificati + modificatiRegistro > 0 && (
          <span
            title={`override attivi: ${modificati} sul DOM · ${modificatiRegistro} sul registro`}
            className="rounded-full bg-secondary-100 px-1.5 text-[10px] text-secondary-700"
          >
            {modificati + modificatiRegistro} modificati
          </span>
        )}
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${aperto ? 'rotate-180' : ''}`} />
      </button>

      {aperto && (
        <div className="mt-2 space-y-2">
          {/* Contestualità: si mostra ciò che la pagina ha davanti adesso, come nel DOM. */}
          <p className="text-[11px] leading-relaxed text-primary-400">
            Testi rilevati nella vista attiva (
            <code className="rounded bg-slate-50 px-1 py-0.5 text-[10px]">{pathname}</code>): cambiando
            pagina l&apos;elenco si aggiorna da sé · modifica immediata, senza reload · svuotare una
            casella riporta il testo al default · salvataggio in{' '}
            <code className="rounded bg-slate-50 px-1 py-0.5 text-[10px]">{STORAGE_KEY_TESTI_DOM}</code>
          </p>
          {testi.length === 0 ? (
            <p className="rounded-xl border border-dashed border-primary-200 bg-slate-50 px-3 py-2 text-[11px] text-primary-500">
              Nessun testo rilevato in questa vista: se la pagina sta caricando, l&apos;elenco si popola
              da sé.
            </p>
          ) : (
            testi.map((voce) => (
              <div
                key={voce.chiave}
                className={`rounded-xl border px-3 py-2 ${
                  voce.modificato ? 'border-secondary-300 bg-secondary-50' : 'border-primary-100 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-primary-700">{voce.dove}</span>
                  <span className="ml-auto font-mono text-[10px] text-primary-400" title={voce.chiave}>
                    {voce.tag.toLowerCase()}
                  </span>
                  {voce.modificato && (
                    <button
                      type="button"
                      onClick={() => imposta(voce.chiave, voce.originale)}
                      title="Ripristina questo testo (default)"
                      aria-label={`Ripristina ${voce.chiave}`}
                      className="rounded p-0.5 text-primary-400 transition hover:bg-white hover:text-error-600"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <textarea
                  value={voce.testo}
                  onChange={(e) => imposta(voce.chiave, e.target.value)}
                  rows={righe(voce)}
                  spellCheck={false}
                  aria-label={`Testo ${voce.dove} (${voce.tag.toLowerCase()})`}
                  className="mt-1 w-full resize-y rounded-lg border border-primary-200 bg-white p-2 text-xs leading-relaxed text-primary-700"
                />
                {voce.modificato && (
                  <p className="mt-0.5 truncate text-[10px] text-primary-400" title={voce.originale}>
                    default: {anteprima(voce.originale)}
                  </p>
                )}
              </div>
            ))
          )}

          <button
            type="button"
            onClick={() => {
              azzera();
              azzeraRegistro();
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-error-700 transition hover:bg-error-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset testi (default)
          </button>
        </div>
      )}
    </section>
  );
}
