import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, Radar, BellRing, ArrowRight, Loader2, ExternalLink } from 'lucide-react';
import { classiConcorso } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';

/** Riga reale della tabella `interpelli` (solo i campi serviti al simulatore). */
interface OpportunitaReale {
  id: string;
  title: string;
  school_name: string | null;
  province: string;
  source_url: string | null;
  expiration_date: string | null;
}

export function SimulatorRadar() {
  const { openVetrina } = useApp();
  const [provCodice, setProvCodice] = useState('');
  const [classeCodice, setClasseCodice] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [risultati, setRisultati] = useState<OpportunitaReale[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const provinceSorted = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);
  const classiSorted = useMemo(() => [...classiConcorso].sort((a, b) => a.codice.localeCompare(b.codice)), []);

  const provinciaNome = provCodice
    ? province.find((p) => p.codice === provCodice)?.nome ?? provCodice
    : '';

  /**
   * Query REALE e STRETTA su Supabase: nessun fallback, nessun dato di esempio.
   * Solo le opportunità con provincia === selezionata E classe_concorso === selezionata.
   */
  const cercaSuSupabase = async (provincia: string, classe: string): Promise<OpportunitaReale[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('interpelli')
      .select('id, title, school_name, province, source_url, expiration_date')
      .eq('province', provincia)
      .contains('class_codes', [classe])
      .order('expiration_date', { ascending: true })
      .limit(10);
    if (error) {
      console.warn('Simulatore Radar — lettura interpelli:', error.message);
      return [];
    }
    return (data ?? []) as OpportunitaReale[];
  };

  /** Avvia la scansione: 3 secondi di feedback, poi la query reale su Supabase. */
  const handleSimula = () => {
    if (!provCodice || !classeCodice || isSearching) return;
    const query = { provincia: provCodice, classe: classeCodice };
    setRisultati(null);
    setIsSearching(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void cercaSuSupabase(query.provincia, query.classe)
        .then((r) => setRisultati(r))
        .catch(() => setRisultati([]))
        .finally(() => setIsSearching(false));
    }, 3000);
  };

  /** Azzera i risultati e la scansione quando cambiano i filtri. */
  const resettaRicerca = () => {
    setRisultati(null);
    setIsSearching(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card sm:p-7">
      <div className="mb-4 flex items-center gap-2 text-primary-700">
        <Radar className="h-5 w-5" />
        <h3 className="text-lg font-bold">Prova il Radar</h3>
      </div>
      <p className="mb-5 text-sm text-primary-600">
        Scegli una provincia e una classe di concorso: cerchiamo subito nel nostro database reale
        (interpelli, PON, PNRR e selezioni di esperti) le opportunità che ti riguardano.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-primary-700">Provincia</span>
          <div className="relative">
            <select
              value={provCodice}
              onChange={(e) => {
                setProvCodice(e.target.value);
                resettaRicerca();
              }}
              className="w-full appearance-none rounded-xl border border-primary-200 bg-white px-4 py-2.5 pr-10 text-sm text-primary-800 transition focus:border-primary-500"
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

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-primary-700">Classe di concorso</span>
          <div className="relative">
            <select
              value={classeCodice}
              onChange={(e) => {
                setClasseCodice(e.target.value);
                resettaRicerca();
              }}
              className="w-full appearance-none rounded-xl border border-primary-200 bg-white px-4 py-2.5 pr-10 text-sm text-primary-800 transition focus:border-primary-500"
            >
              <option value="">Seleziona classe…</option>
              {classiSorted.map((c) => (
                <option key={c.codice} value={c.codice}>
                  {c.codice} – {c.denominazione}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
          </div>
        </label>
      </div>

      <button
        onClick={handleSimula}
        disabled={!provCodice || !classeCodice}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <Search className="h-4 w-4" />
        Cerca ora
      </button>

      {isSearching && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-4 animate-fade-in">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-500" />
          <p className="text-sm font-medium text-primary-700">
            Scansione albi pretori e bandi in corso...
          </p>
        </div>
      )}

      {!isSearching && risultati && (
        <div className="mt-6 animate-fade-in">
          {risultati.length > 0 ? (
            <div className="rounded-xl border border-accent-200 bg-accent-50 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
                  <BellRing className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-accent-800">
                    Trovate {risultati.length} opportunità attive per la classe {classeCodice} in
                    provincia di {provinciaNome}.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {risultati.map((o) => (
                      <li key={o.id}>
                        <a
                          href={o.source_url ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-lg border border-accent-200 bg-white px-3 py-2 transition hover:border-accent-300"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-primary-800">
                                {o.title}
                              </span>
                              <span className="block text-xs text-primary-500">
                                {o.school_name ?? 'Scuola non indicata'} · {o.province}
                              </span>
                            </span>
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-500" />
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-accent-700">
                    Dati reali, aggiornati in tempo reale dal database ScuoleRadar.
                  </p>
                  <button
                    onClick={() => openVetrina('radar')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-600"
                  >
                    <BellRing className="h-4 w-4" />
                    Attiva le notifiche
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
                  <Radar className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-primary-800">
                    Oggi non ci sono opportunità attive per la classe {classeCodice} in provincia
                    di {provinciaNome}. Attiva il tuo Radar e rilassati: ti avvisiamo noi appena
                    troviamo qualcosa di interessante per te.
                  </p>
                  <button
                    onClick={() => openVetrina('radar')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                  >
                    <BellRing className="h-4 w-4" />
                    Attiva il tuo Radar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
