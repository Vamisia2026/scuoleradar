/**
 * Radar — box «Prova il Radar» (simulatore pubblico dell'hero).
 *
 * SI PROVA CON LA SOLA PROVINCIA: nessun selettore di classe di concorso e NESSUN
 * ripiego nazionale. La query legge UNA provincia su TUTTE le categorie (interpelli
 * e supplenze, PON/POR, PNRR, CPIA, ATA, esperti esterni) e il responso vive in
 * `@/lib/provaRadarEngine` (puro e testato): tutte le opportunità ATTIVE della
 * provincia (date estese: nessuna scadenza = attiva), entro il limite dello
 * schermo. Se la provincia non ha nulla di vivo il responso è vuoto e dichiara la
 * verità (`messaggioRadarInScansione`): mai avvisi di altre province spacciati per
 * locali, mai elenchi gonfiati «per riempire».
 *
 * La provincia provata viene memorizzata (`@/lib/provaRadar`): il wizard la
 * erediterà come provincia PRINCIPALE, senza richiederla una seconda volta.
 * Nessun dato di esempio: solo righe reali della tabella `interpelli`.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Radar, Search } from 'lucide-react';
import { province } from '@/data/province';
import { salvaProvinciaProva } from '@/lib/provaRadar';
import { rigaPresentabileVetrina } from '@/lib/liveBoard';
import {
  selezionaRisultatiProva,
  type EsitoProvaRadar,
} from '@/lib/provaRadarEngine';
import { useApp } from '@/contexts/AppContext';
import {
  ATTESA_SCANSIONE_MS,
  LIMITE_PROVINCIA,
  leggiInterpelliProva,
  richiediScansioneProva,
} from './services/provaRadarQuery';
import { ResponsoProva } from './components/ResponsoProva';

interface SimulatorRadarProps {
  /**
   * Classi aggiuntive del contenitore. L'hero non stira più la colonna: il box
   * resta alla sua altezza naturale, quindi qui non serve nessun `h-full` — il
   * responso lungo vive nell'area a scorrimento (`max-h-[24rem]`).
   */
  className?: string;
}

export function SimulatorRadar({ className = '' }: SimulatorRadarProps) {
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
   * Una sola scansione: la provincia provata (maglia larga su tutte le categorie,
   * senza selettore di classe). Nessuna seconda query nazionale: quello che non
   * c'è in provincia non viene mostrato. La provincia provata viene memorizzata
   * per il wizard (`lib/provaRadar.ts`).
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
          // CODA DI SCANSIONE: la provincia provata va ri-scansionata SUBITO, non
          // fra sei ore. Fire-and-forget: il responso non aspetta la coda e un
          // guasto della coda non può toccare la prova (`richiediScansioneProva`
          // non lancia mai).
          void richiediScansioneProva(provincia);
          // VETRINA (§26.59): entrano solo righe con il nome di un istituto REALE
          // risolto (campo, registro per codice o titolo). I dump di codici classe
          // («ADEE | EEEE») e le righe senza istituto restano fuori da una vista
          // pubblica: la prova mostra sempre una scuola.
          const locali = (await leggiInterpelliProva(provincia, LIMITE_PROVINCIA)).filter(
            rigaPresentabileVetrina,
          );
          setEsito(selezionaRisultatiProva(locali));
        } catch {
          setEsito({ gruppo: 'vuoto', righe: [] });
        } finally {
          setIsSearching(false);
        }
      })();
    }, ATTESA_SCANSIONE_MS);
  }, [provCodice, isSearching]);

  return (
    <div
      className={`flex flex-col rounded-2xl border border-primary-100 bg-white p-5 shadow-card ${className}`}
    >
      <div className="mb-1.5 flex items-center gap-2 text-primary-700">
        <Radar className="h-5 w-5" />
        <h3 className="text-lg font-bold">Prova il Radar</h3>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-primary-600">
        Scegli la provincia: cerchiamo su tutte le categorie — interpelli e supplenze, PON/POR e
        PNRR, CPIA, ATA e bidelli, selezioni di esperti.
      </p>

      {/* Provincia e CTA sulla STESSA riga da `sm` in su: il box resta compatto,
          quindi l'hero non lascia spazio bianco verticale sotto il copy. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block sm:flex-1">
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
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2B6F9E] px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#225a82] disabled:cursor-not-allowed sm:w-auto"
        >
          <Search className="h-4 w-4" />
          Cerca ora
        </button>
      </div>

      {isSearching && (
        <div className="animate-fade-in mt-4 flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-500" />
          <p className="text-sm font-medium text-primary-700">Scansione albi pretori e bandi in corso…</p>
        </div>
      )}

      {/* Risultato dentro un'area a SCROLL LIMITATO: quando il responso verde si
          espande la pagina non scatta e il box non si allunga all'infinito — la
          crescita resta fluida e tutta nel primo schermo. */}
      {!isSearching && esito && (
        <div className="mt-3 max-h-[24rem] overflow-y-auto overscroll-contain pr-0.5">
          <ResponsoProva esito={esito} provincia={provinciaNome} onAttiva={openRadarSetup} />
        </div>
      )}
    </div>
  );
}

