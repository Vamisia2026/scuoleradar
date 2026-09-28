/**
 * Radar — box «Prova il Radar» (simulatore pubblico dell'hero).
 *
 * SI PROVA CON LA SOLA PROVINCIA: nessun selettore di classe di concorso. La
 * query parte dalla provincia provata su TUTTE le categorie (interpelli e
 * supplenze, PON/POR, PNRR, CPIA, ATA, esperti esterni) e il raggruppamento vive
 * in `@/lib/provaRadarEngine` (puro e testato):
 *   1. tutte le opportunità ATTIVE della provincia (date estese: nessuna scadenza
 *      = attiva): elenco ricco, mai «zero risultati»;
 *   2. COMPLETAMENTO/ripiego NAZIONALE quando la provincia non basta a riempire
 *      l'elenco o è momentaneamente ferma.
 *
 * La provincia provata viene memorizzata (`@/lib/provaRadar`): il wizard la
 * erediterà come provincia PRINCIPALE, senza richiederla una seconda volta.
 * Nessun dato di esempio: solo righe reali della tabella `interpelli`.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Radar, Search } from 'lucide-react';
import { province } from '@/data/province';
import { salvaProvinciaProva } from '@/lib/provaRadar';
import {
  LIMITE_RISULTATI_PROVA,
  selezionaRisultatiProva,
  type EsitoProvaRadar,
} from '@/lib/provaRadarEngine';
import { useApp } from '@/contexts/AppContext';
import {
  ATTESA_SCANSIONE_MS,
  LIMITE_NAZIONALE,
  LIMITE_PROVINCIA,
  leggiInterpelliProva,
} from './services/provaRadarQuery';
import { ResponsoProva } from './components/ResponsoProva';

export function SimulatorRadar() {
  const { openRadarSetup } = useApp();
  const [provCodice, setProvCodice] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [esito, setEsito] = useState<EsitoProvaRadar | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const provinceSorted = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);

  const provinciaNome = provCodice
    ? province.find((p) => p.codice === provCodice)?.nome ?? provCodice
    : '';

  /** Azzera il responso quando cambia la provincia. */
  const resettaRicerca = () => {
    setEsito(null);
    setIsSearching(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  /**
   * Scansione in due tempi: prima la provincia provata (maglia larga su tutte le
   * categorie), poi — solo se serve a riempire l'elenco — il pool nazionale. La
   * provincia provata viene memorizzata per il wizard (`lib/provaRadar.ts`).
   */
  const handleSimula = useCallback(() => {
    if (!provCodice || isSearching) return;
    const provincia = provCodice;
    setEsito(null);
    setIsSearching(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          salvaProvinciaProva(provincia);
          const locali = await leggiInterpelliProva(provincia, LIMITE_PROVINCIA);
          // Provincia già ricca: nessuna seconda query (il box resta scattante).
          if (locali.length >= LIMITE_RISULTATI_PROVA) {
            setEsito(selezionaRisultatiProva(locali));
            return;
          }
          const nazionali = await leggiInterpelliProva(null, LIMITE_NAZIONALE);
          setEsito(selezionaRisultatiProva(locali, nazionali));
        } catch {
          setEsito({ gruppo: 'vuoto', righe: [], daProvincia: 0 });
        } finally {
          setIsSearching(false);
        }
      })();
    }, ATTESA_SCANSIONE_MS);
  }, [provCodice, isSearching]);

  return (
    <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-primary-700">
        <Radar className="h-5 w-5" />
        <h3 className="text-lg font-bold">Prova il Radar</h3>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-primary-600">
        Scegli la provincia: cerchiamo su tutte le categorie — interpelli e supplenze, PON/POR e
        PNRR, CPIA, ATA e bidelli, selezioni di esperti.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-primary-700">Provincia</span>
        <div className="relative">
          <select
            value={provCodice}
            onChange={(e) => {
              setProvCodice(e.target.value);
              resettaRicerca();
            }}
            className="w-full appearance-none rounded-xl border border-primary-200 bg-white px-3 py-2.5 pr-9 text-sm text-primary-800 transition focus:border-primary-500"
          >
            <option value="">Seleziona provincia…</option>
            {provinceSorted.map((p) => (
              <option key={p.codice} value={p.codice}>
                {p.nome} ({p.codice})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
        </div>
      </label>

      {/* CTA «Cerca ora»: sfondo #2B6F9E SEMPRE a piena opacità — anche da
          disabilitata nessun `disabled:opacity-*` (stesso colore dell'hero). */}
      <button
        onClick={handleSimula}
        disabled={!provCodice}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2B6F9E] px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#225a82] disabled:cursor-not-allowed sm:w-auto"
      >
        <Search className="h-4 w-4" />
        Cerca ora
      </button>

      {isSearching && (
        <div className="animate-fade-in mt-4 flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-500" />
          <p className="text-sm font-medium text-primary-700">Scansione albi pretori e bandi in corso…</p>
        </div>
      )}

      {!isSearching && esito && (
        <ResponsoProva esito={esito} provincia={provinciaNome} onAttiva={openRadarSetup} />
      )}
    </div>
  );
}

