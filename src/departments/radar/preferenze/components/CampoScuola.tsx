/**
 * Preferenze Radar — CAMPO SCUOLA con suggerimenti MIRATI (§26.65).
 *
 * Un solo campo, due garanzie:
 *   · i suggerimenti contengono SOLO istituti presentabili (`scuolePresentabili`,
 *     il gate §26.59): mai voci di menu, materie o dump di codici;
 *   · il filtro è ISTANTANEO sulla provincia scelta e sul testo digitato
 *     (`cercaScuole`, confronto per sottostringa normalizzata): digitando «J»
 *     esce la scuola che contiene «Jona», senza scorrere elenchi sterminati.
 *
 * Il `datalist` è per-campo, con id proprio (`useId`): le due liste (preferite /
 * escluse) non si scambiano i suggerimenti. Il valore salvato resta il NOME
 * dell'istituto; la sigla di provincia è solo l'etichetta del suggerimento.
 */
import { useId } from 'react';
import { AlertTriangle, Check, Info, Plus } from 'lucide-react';
import {
  cercaScuole,
  messaggioAmbitoScuola,
  type AmbitoScolastico,
  type ScuolaNota,
} from '@/lib/filtriScuole';

/** Massimo numero di suggerimenti proposti in una tendina. */
export const LIMITE_SUGGERIMENTI_SCUOLA = 25;

interface CampoScuolaProps {
  /** Testo dell'etichetta del campo (`Nome della scuola da preferire`). */
  placeholder: string;
  value: string;
  onChange: (valore: string) => void;
  onAdd: () => void;
  /** Scuole suggeribili (già ripulite a monte: `scuolePresentabili`). */
  scuoleConosciute: ScuolaNota[];
  /** Sigla della provincia scelta nel pannello (`''` = tutte le tue province). */
  provincia: string;
  /** Ambito provinciale di un nome: `dentro`, `fuori` o `sconosciuta`. */
  verificaAmbito: (nome: string) => AmbitoScolastico;
  /** Colore del pulsante «Aggiungi» (una resa per entrambe le liste). */
  colore: 'accent' | 'secondary';
}

/**
 * Avviso dell'ambito provinciale sotto il campo: resta muto finché non c'è
 * qualcosa di scritto, così il pannello non parla a vuoto.
 */
function NotaAmbito({ nome, ambito }: { nome: string; ambito: AmbitoScolastico }) {
  if (!nome.trim()) return null;
  const fuori = ambito.stato === 'fuori';
  const Icona = fuori ? AlertTriangle : ambito.stato === 'dentro' ? Check : Info;
  return (
    <p
      role="status"
      className={`mt-2 flex items-start gap-1.5 text-xs ${fuori ? 'text-warning-700' : 'text-primary-400'}`}
    >
      <Icona className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{messaggioAmbitoScuola(ambito)}</span>
    </p>
  );
}

export function CampoScuola({
  placeholder,
  value,
  onChange,
  onAdd,
  scuoleConosciute,
  provincia,
  verificaAmbito,
  colore,
}: CampoScuolaProps) {
  const idSuggerimenti = useId();
  // Filtro istantaneo: provincia scelta + testo digitato (sottostringa sul nome).
  const suggerimenti = cercaScuole(scuoleConosciute, {
    provincia,
    query: value,
    limite: LIMITE_SUGGERIMENTI_SCUOLA,
  });
  const classiPulsante =
    colore === 'accent'
      ? 'bg-accent-500 hover:bg-accent-600'
      : 'bg-secondary-500 hover:bg-secondary-600';

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder={placeholder}
          list={idSuggerimenti}
          className="input"
        />
        <datalist id={idSuggerimenti}>
          {suggerimenti.map((s) => (
            <option key={`${s.nome}|${s.provinciaCodice}`} value={s.nome} label={s.provinciaCodice} />
          ))}
        </datalist>
        <button
          onClick={onAdd}
          disabled={!value.trim()}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition disabled:opacity-50 ${classiPulsante}`}
        >
          <Plus className="h-4 w-4" />
          Aggiungi
        </button>
      </div>
      <NotaAmbito nome={value} ambito={verificaAmbito(value)} />
    </div>
  );
}
