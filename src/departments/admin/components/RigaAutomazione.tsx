/**
 * Pannello Admin · «Email & Automazioni» — riga della tabella.
 *
 * Presentazione pura: riceve testi e stato già calcolati e inoltra le azioni
 * all'hook (`useAutomazioniEmail`) tramite i callback. Con l'editor aperto,
 * sotto la riga compare il pannello con anteprima visiva e copy modificabile.
 */
import { Copy, Eye, X } from 'lucide-react';
import type { AutomazioneEmail, StatoAutomazione } from '@/config/automazioniEmail';
import { btnAdmin, btnGhost, btnPrim } from '../adminUi';
import { BadgeTrigger, Interruttore } from './AutomazioniInterruttore';
import { PannelloCopyAutomazione } from './PannelloCopyAutomazione';
import { personalizzata, type BozzaTesti, type TestiAnteprima } from './automazioniSupporto';

export interface RigaAutomazioneProps {
  automazione: AutomazioneEmail;
  stato: StatoAutomazione;
  /** Testi interpolati per la colonna «Anteprima copy». */
  testi: TestiAnteprima;
  /** Bozza dei testi (presente solo con l'editor aperto). */
  bozza: BozzaTesti | null;
  aperta: boolean;
  inSalvataggio: boolean;
  copiato: boolean;
  onToggle: () => void;
  onApri: () => void;
  onChiudi: () => void;
  onCopia: () => void;
  onBozza: (patch: Partial<BozzaTesti>) => void;
  onSalva: () => void;
  onRipristina: () => void;
}

export function RigaAutomazione({
  automazione: a,
  stato,
  testi,
  bozza,
  aperta,
  inSalvataggio,
  copiato,
  onToggle,
  onApri,
  onChiudi,
  onCopia,
  onBozza,
  onSalva,
  onRipristina,
}: RigaAutomazioneProps) {
  const modificata = personalizzata(stato);

  return (
    <>
      <tr
        className={`border-t border-primary-50 align-top transition ${
          aperta ? 'bg-primary-50/50' : 'hover:bg-primary-50/30'
        }`}
      >
        <td className="px-3 py-3">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-primary-800">
            <span aria-hidden>{a.emoji}</span>
            {a.nome}
            {modificata && (
              <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-700">
                personalizzata
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-primary-400">
            {a.gruppo} · {a.canale}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-primary-500">{a.motore}</p>
        </td>
        <td className="px-3 py-3">
          <BadgeTrigger automazione={a} />
          <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-primary-600">{a.quando}</p>
        </td>
        <td className="px-3 py-3">
          <p className="max-w-[220px] text-xs font-semibold text-primary-700">{testi.oggetto}</p>
          {a.oggettoBloccato ? (
            <p className="mt-0.5 text-[10px] text-primary-400">
              oggetto standard vincolato dalla checklist
            </p>
          ) : stato.oggetto ? (
            <p className="mt-0.5 text-[10px] font-semibold text-secondary-600">
              personalizzato dal pannello
            </p>
          ) : null}
        </td>
        <td className="px-3 py-3">
          <p className="line-clamp-4 max-w-sm whitespace-pre-line text-[11px] leading-relaxed text-primary-500">
            {testi.corpo}
          </p>
          {a.nota && (
            <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-primary-400">{a.nota}</p>
          )}
        </td>
        <td className="px-3 py-3">
          <Interruttore abilitata={stato.abilitata} inCorso={inSalvataggio} onCambia={onToggle} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={aperta ? onChiudi : onApri}
              className={`${btnAdmin} ${aperta ? btnGhost : btnPrim}`}
            >
              {aperta ? <X className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {aperta ? 'Chiudi' : 'Anteprima & copy'}
            </button>
            <button
              type="button"
              title="Copia oggetto e testo dell'anteprima"
              onClick={onCopia}
              className={`${btnAdmin} ${btnGhost}`}
            >
              <Copy className="h-3.5 w-3.5" />
              {copiato ? 'Copiato' : 'Copia'}
            </button>
          </div>
        </td>
      </tr>
      {aperta && bozza && (
        <tr className="border-t border-primary-50 bg-slate-50/70">
          <td colSpan={5} className="px-3 py-4">
            <PannelloCopyAutomazione
              automazione={a}
              testi={testi}
              bozza={bozza}
              inSalvataggio={inSalvataggio}
              onBozza={onBozza}
              onSalva={onSalva}
              onRipristina={onRipristina}
              onChiudi={onChiudi}
            />
          </td>
        </tr>
      )}
    </>
  );
}
