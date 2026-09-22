/**
 * Pannello Admin · «Email & Automazioni» — anteprima visiva + editor del copy.
 *
 * Mostra il messaggio come lo riceve l'utente (dati di esempio per le variabili
 * `{{nome}}`, `{{giorni}}`, `{{scadenza}}` e per i link canonici) e consente di
 * personalizzare OGGETTO, INTRO e — quando il messaggio nasce da un template
 * centralizzato — anche il CORPO. Gli oggetti vincolati dalle checklist di
 * comunicazione (es. «Nuove opportunità per te!») restano in sola lettura.
 */
import { Check, Eye, Loader2, Pencil, RotateCcw, X } from 'lucide-react';
import logoScuoleRadar from '@/assets/logo.png';
import {
  corpoModificabile,
  oggettoModificabile,
  type AutomazioneEmail,
} from '@/config/automazioniEmail';
import { btnAdmin, btnGhost, btnPrim, inputAdmin } from '../adminUi';
import type { BozzaTesti, TestiAnteprima } from './automazioniSupporto';

export interface PannelloCopyAutomazioneProps {
  automazione: AutomazioneEmail;
  /** Testi interpolati mostrati nell'anteprima. */
  testi: TestiAnteprima;
  /** Bozza dei testi in modifica. */
  bozza: BozzaTesti;
  inSalvataggio: boolean;
  onBozza: (patch: Partial<BozzaTesti>) => void;
  onSalva: () => void;
  onRipristina: () => void;
  onChiudi: () => void;
}

export function PannelloCopyAutomazione({
  automazione,
  testi,
  bozza,
  inSalvataggio,
  onBozza,
  onSalva,
  onRipristina,
  onChiudi,
}: PannelloCopyAutomazioneProps) {
  const oggettoEditabile = oggettoModificabile(automazione);
  const corpoEditabile = corpoModificabile(automazione);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Anteprima VISIVA del messaggio (dati di esempio) */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-400">
          <Eye className="h-3.5 w-3.5" /> Anteprima visiva ·{' '}
          {testi.corpoPersonalizzato ? 'copy personalizzato' : 'copy del codice'}
        </p>
        <div className="rounded-xl border border-primary-100 bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2 border-b border-primary-50 pb-2">
            <img src={logoScuoleRadar} alt="" className="h-5 w-auto object-contain" />
            <span className="text-[11px] font-bold text-primary-700">Scuole Radar.it</span>
          </div>
          <p className="mt-3 text-xs font-bold text-primary-800">{testi.oggetto}</p>
          {testi.intro && (
            <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-primary-700">
              {testi.intro}
            </p>
          )}
          <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-primary-600">
            {testi.corpo}
          </p>
          <p className="mt-3 border-t border-primary-50 pt-2 text-[10px] leading-relaxed text-primary-400">
            I tuoi colleghi di Scuole Radar · footer standard (CTA Notizie, link Radar, avviso «non
            rispondere»)
          </p>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-primary-400">
          Variabili di esempio: {'{{nome}}'} → Maria · {'{{giorni}}'} → 3 · {'{{scadenza}}'} →
          15/10/2026 · link canonici (Radar, checkout, prezzi, PureFocus) sostituiti.
        </p>
      </div>

      {/* Editor dei testi */}
      <div className="space-y-3">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-400">
          <Pencil className="h-3.5 w-3.5" /> Copy modificabile
        </p>
        <label className="block">
          <span className="text-[11px] font-semibold text-primary-600">Oggetto</span>
          <input
            type="text"
            value={bozza.oggetto}
            onChange={(e) => onBozza({ oggetto: e.target.value })}
            disabled={!oggettoEditabile}
            placeholder={automazione.oggetto}
            className={`${inputAdmin} mt-1 ${oggettoEditabile ? '' : 'bg-slate-100 text-slate-400'}`}
          />
          {!oggettoEditabile && (
            <span className="mt-1 block text-[10px] text-primary-400">
              Oggetto vincolato dalle checklist di comunicazione: non modificabile.
            </span>
          )}
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-primary-600">Intro (paragrafo in testa)</span>
          <textarea
            rows={3}
            value={bozza.intro}
            onChange={(e) => onBozza({ intro: e.target.value })}
            placeholder="Testo facoltativo, es. «Ciao {{nome}}, una novità importante per il tuo Radar.»"
            className={`${inputAdmin} mt-1 resize-y font-mono text-[11px]`}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-primary-600">Corpo del messaggio</span>
          <textarea
            rows={9}
            value={bozza.corpo}
            onChange={(e) => onBozza({ corpo: e.target.value })}
            disabled={!corpoEditabile}
            placeholder={
              corpoEditabile
                ? 'Vuoto = copy ufficiale del codice.'
                : 'Corpo generato in codice: usa l’intro per aggiungere un messaggio.'
            }
            className={`${inputAdmin} mt-1 resize-y font-mono text-[11px] ${
              corpoEditabile ? '' : 'bg-slate-100 text-slate-400'
            }`}
          />
          <span className="mt-1 block text-[10px] leading-relaxed text-primary-400">
            {corpoEditabile
              ? 'Le righe «[ ETICHETTA ] -> {{link}}» diventano pulsanti; i paragrafi si separano con una riga vuota. Campo vuoto = copy del codice.'
              : 'Corpo generato in codice (digest, alert, promemoria, messaggi step): si personalizzano oggetto e intro.'}
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSalva}
            disabled={inSalvataggio}
            className={`${btnAdmin} ${btnPrim}`}
          >
            {inSalvataggio ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Salva testi
          </button>
          <button
            type="button"
            onClick={onRipristina}
            disabled={inSalvataggio}
            className={`${btnAdmin} ${btnGhost}`}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Ripristina copy del codice
          </button>
          <button type="button" onClick={onChiudi} className={`${btnAdmin} ${btnGhost}`}>
            <X className="h-3.5 w-3.5" /> Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
