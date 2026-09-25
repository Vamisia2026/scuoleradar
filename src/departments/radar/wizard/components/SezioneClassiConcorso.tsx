/**
 * Wizard Radar — PASSO 3 · colonna «Classi di concorso» + adesione al SOSTEGNO.
 *
 * Presentazione pura: la selezione (e la ricerca unificata) vivono nel
 * contenitore `RadarWizardModal`. Qui restano i chip delle classi scelte e
 * l'elenco FILTRATO dalla ricerca unificata: nessun elenco statico separato,
 * nessuna seconda casella di ricerca.
 */
import { AlertCircle, Check } from 'lucide-react';
import { Pill } from '@/components/Pill';
import { SostegnoToggle } from '@/components/SostegnoToggle';
import { codiciSostegno, isCodiceSostegno } from '@/data/classiConcorso';
import { etichettaMateria } from '@/lib/ricercaSelezioniRadar';
import { contieneClasse, normalizzaClasse } from '@/lib/matchingEngine';
import type { PianoLimits } from '@/lib/planLimits';
import type { SelezioneClassi } from '../tipiSelezione';

interface SezioneClassiConcorsoProps {
  selezione: SelezioneClassi;
  limitiPiano: PianoLimits;
  /** true quando la ricerca unificata ha testo attivo (mostra il conteggio). */
  ricercaAttiva: boolean;
}

export function SezioneClassiConcorso({
  selezione,
  limitiPiano,
  ricercaAttiva,
}: SezioneClassiConcorsoProps) {
  const {
    classiCodici,
    classiFiltrate,
    classiWarning,
    maxClassiConcorso,
    toggleClasse,
    sostegno,
    toggleSostegno,
  } = selezione;

  return (
    <div className="rounded-xl border border-primary-100 p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-primary-700">Classi di concorso</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-600">
          {classiCodici.length}/{maxClassiConcorso} selezionate
        </span>
      </div>

      {limitiPiano.piano === 'base' && (
        <p className="mb-1.5 text-[11px] text-secondary-700">
          Piano Base: fino a 2 classi di concorso. Con PRO arrivi a 4.
        </p>
      )}
      {(classiWarning || classiCodici.length >= maxClassiConcorso) && (
        <p className="mb-1.5 flex items-start gap-1.5 rounded-lg border border-secondary-200 bg-secondary-50 px-2.5 py-1.5 text-[11px] text-secondary-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {limitiPiano.piano === 'pro'
            ? `Sei al massimo: PRO include fino a ${maxClassiConcorso} classi di concorso.`
            : 'Il piano Base include 2 classi di concorso. Passa a PRO per aggiungerne fino a 4.'}
        </p>
      )}

      {classiCodici.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {classiCodici.map((c) => (
            <Pill key={c} label={c} onRemove={() => toggleClasse(c)} color="accent" />
          ))}
        </div>
      )}

      <p className="mb-1 text-[11px] text-primary-500">
        {ricercaAttiva
          ? `${classiFiltrate.length} classi trovate — tocca per selezionare`
          : 'Tocca una classe per selezionarla, oppure cercala nel campo qui sopra'}
      </p>

      <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-xl border border-primary-100 p-1">
        {classiFiltrate.length === 0 ? (
          <p className="p-3 text-center text-sm text-primary-400">
            Nessuna classe trovata per questa ricerca.
          </p>
        ) : (
          classiFiltrate.map((c) => {
            const selected = contieneClasse(classiCodici, c.codice);
            const atLimit = classiCodici.length >= maxClassiConcorso && !selected;
            return (
              <button
                key={c.codice}
                type="button"
                disabled={atLimit}
                onClick={() => toggleClasse(c.codice)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                  selected
                    ? 'border-accent-300 bg-accent-50'
                    : atLimit
                      ? 'cursor-not-allowed border-transparent opacity-50 hover:bg-transparent'
                      : 'border-transparent hover:bg-primary-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-primary-800">
                    {c.codice} – {c.denominazione}
                  </span>
                  <span className="block truncate text-[11px] text-primary-500">
                    {(c.materie ?? []).map(etichettaMateria).join(', ')}
                  </span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-accent-600" />}
              </button>
            );
          })
        )}
      </div>

      {/* Preferenza SOSTEGNO: domanda esplicita (abilitazione separata: senza
          adesione gli avvisi ADEE/ADMM/ADSS non vengono notificati). */}
      <div className="mt-2 border-t border-primary-100 pt-2">
        <SostegnoToggle
          attivo={sostegno}
          onCambia={toggleSostegno}
          classiSostegno={classiCodici.filter((c) => isCodiceSostegno(normalizzaClasse(c)))}
          idPrefisso="wizard-sostegno"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-primary-400">
          Classi di sostegno del catalogo: {codiciSostegno.join(', ')}.
        </p>
      </div>
    </div>
  );
}
