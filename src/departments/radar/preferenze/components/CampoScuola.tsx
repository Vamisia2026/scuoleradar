/**
 * Preferenze Radar — CAMPO SCUOLA con selettore di provincia (§26.67).
 *
 * UNA RIGA, TRE COMANDI:
 *   [ Provincia ▾ ]  [ Nome della scuola ]  [ + Aggiungi ]
 *
 * Il selettore di provincia sta ACCANTO al nome — uno PER LISTA, mai uno solo per
 * il pannello — perché è la provincia a togliere l'ambiguità: lo stesso istituto
 * esiste in province diverse, e dire DOVE sta la scuola è l'unico modo per
 * preferirla o ignorarla senza sbagliare. Scegliere la provincia restringe i
 * suggerimenti all'istante; senza provincia arrivano da tutte le proprie province
 * e la riga lo dichiara SOLO se ci sono omonimie da sciogliere.
 *
 * I suggerimenti contengono SOLO istituti presentabili (`scuolePresentabili`, il
 * gate §26.59 — mai voci di menu, materie o dump di codici) e il filtro è
 * istantaneo su provincia + testo digitato (`cercaScuole`, sottostringa
 * normalizzata): digitando «J» esce la scuola che contiene «Jona».
 *
 * Il `datalist` è per-campo, con id proprio (`useId`): le due liste non si
 * scambiano né provincia né suggerimenti. Il valore salvato resta il NOME
 * dell'istituto; la sigla di provincia è solo l'etichetta del suggerimento.
 */
import { useId, useMemo } from 'react';
import { AlertTriangle, Check, ChevronDown, Info, Plus } from 'lucide-react';
import {
  cercaScuole,
  messaggioAmbitoScuola,
  type AmbitoScolastico,
  type ScuolaNota,
} from '@/lib/filtriScuole';
import { omonimieScuole, type ProvinciaSuggerita } from '@/lib/scuolePresentabili';

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
  /** Sigla della provincia scelta accanto al nome (`''` = nessuna scelta). */
  provincia: string;
  /** Cambia la provincia DEL CAMPO: i suggerimenti si restringono all'istante. */
  onProvinciaChange: (codice: string) => void;
  /** Province offerte dal selettore: le stesse per ogni campo, una scelta per lista. */
  provinceSuggerite: ProvinciaSuggerita[];
  /** Ambito provinciale di un nome: `dentro`, `fuori` o `sconosciuta`. */
  verificaAmbito: (nome: string) => AmbitoScolastico;
  /** Colore del pulsante «Aggiungi» (una resa per entrambe le liste). */
  colore: 'accent' | 'secondary';
  /** Nome accessibile del selettore (`Provincia della scuola da preferire`…). */
  etichettaProvincia: string;
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

/**
 * Riga di servizio del selettore: parla solo quando serve davvero — nessun
 * istituto in ambito, oppure omonimie da sciogliere. Mai un avviso a vuoto.
 */
function NotaProvincia({
  provincia,
  senzaIstituti,
  omonimie,
}: {
  provincia: string;
  senzaIstituti: boolean;
  omonimie: string[];
}) {
  if (senzaIstituti) {
    return (
      <p className="mt-1.5 text-xs text-primary-400">
        Nessun istituto nel feed per le tue province: scrivi il nome a mano — la forzatura resta
        dichiarata.
      </p>
    );
  }
  if (provincia || omonimie.length === 0) return null;
  return (
    <p className="mt-1.5 text-xs text-primary-400">
      {omonimie.length === 1
        ? `«${omonimie[0]}» compare in più province: scegli la provincia per non confondere l’istituto.`
        : `${omonimie.length} nomi d’istituto compaiono in più province: scegli la provincia per non confonderli.`}
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
  onProvinciaChange,
  provinceSuggerite,
  verificaAmbito,
  colore,
  etichettaProvincia,
}: CampoScuolaProps) {
  const idSuggerimenti = useId();
  // Filtro istantaneo: provincia scelta + testo digitato (sottostringa sul nome).
  const suggerimenti = cercaScuole(scuoleConosciute, {
    provincia,
    query: value,
    limite: LIMITE_SUGGERIMENTI_SCUOLA,
  });
  // Le omonimie dell'ambito: la sola ragione per cui la provincia va scelta.
  const omonimie = useMemo(() => omonimieScuole(scuoleConosciute), [scuoleConosciute]);
  const senzaIstituti = provinceSuggerite.length === 0;
  const classiPulsante =
    colore === 'accent'
      ? 'bg-accent-500 hover:bg-accent-600'
      : 'bg-secondary-500 hover:bg-secondary-600';

  return (
    <div>
      {/* §26.67 — la PROVINCIA è un comando del campo, non un default del pannello:
          sta sulla stessa riga del nome, con la sua tendina per lista. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative w-full shrink-0 sm:w-52">
          <span className="sr-only">{etichettaProvincia}</span>
          <select
            value={provincia}
            onChange={(e) => onProvinciaChange(e.target.value)}
            disabled={senzaIstituti}
            aria-label={etichettaProvincia}
            className="w-full appearance-none rounded-xl border border-primary-200 bg-white px-3 py-2.5 pr-9 text-sm text-primary-800 transition focus:border-primary-500 disabled:opacity-60"
          >
            <option value="">Seleziona provincia…</option>
            {provinceSuggerite.map((p) => (
              <option key={p.codice} value={p.codice}>
                {p.nome} ({p.codice})
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400"
            aria-hidden="true"
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder={placeholder}
          list={idSuggerimenti}
          className="input min-w-0 flex-1"
        />
        <datalist id={idSuggerimenti}>
          {suggerimenti.map((s) => (
            <option key={`${s.nome}|${s.provinciaCodice}`} value={s.nome} label={s.provinciaCodice} />
          ))}
        </datalist>
        <button
          onClick={onAdd}
          disabled={!value.trim()}
          className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition disabled:opacity-50 ${classiPulsante}`}
        >
          <Plus className="h-4 w-4" />
          Aggiungi
        </button>
      </div>
      <NotaAmbito nome={value} ambito={verificaAmbito(value)} />
      <NotaProvincia provincia={provincia} senzaIstituti={senzaIstituti} omonimie={omonimie} />
    </div>
  );
}
