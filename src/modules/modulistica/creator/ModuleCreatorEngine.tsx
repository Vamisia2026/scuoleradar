import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { BookOpen, HelpCircle, Lightbulb, RotateCcw, Search, Send, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import {
  caricaDocumentoGenerato,
  cercaDocumento,
  generaDocumento,
  registraDownloadGenerato,
  type DomandaChiarimento,
  type DocumentoGenerato,
} from './cacheService';
import { PensieriArchivista } from './PensieriArchivista';
import { ModuloPreview } from './ModuloPreview';

/* ------------------------------------------------------------------ */
/*  State machine del ModuleCreator (logica "Archivista Premuroso")     */
/* ------------------------------------------------------------------ */

type StatoCreator =
  | { fase: 'idle' }
  | { fase: 'ricerca'; query: string }
  | {
      fase: 'chiarimento';
      query: string;
      domande: DomandaChiarimento[];
      suggerimento: { id: string; title: string } | null;
    }
  | { fase: 'generazione'; query: string }
  | { fase: 'pronto'; modulo: DocumentoGenerato; cache: boolean }
  | { fase: 'errore'; messaggio: string; query: string };

function useModuleCreatorEngine() {
  const [stato, setStato] = useState<StatoCreator>({ fase: 'idle' });
  /** Query originale dell'utente (senza le risposte ai chiarimenti). */
  const queryBase = useRef('');
  /** Risposte già date per dimensione (tipo, ordine…) — id domanda → opzione scelta. */
  const risposte = useRef<Record<string, string>>({});

  const genera = useCallback(async (query: string, catalogoId?: string) => {
    setStato({ fase: 'generazione', query });
    const res = await generaDocumento(query, catalogoId);
    if (!res.ok || !res.esito) {
      setStato({ fase: 'errore', messaggio: res.errore ?? 'Errore durante la generazione.', query });
      return;
    }
    setStato({ fase: 'pronto', modulo: res.esito.modulo, cache: res.esito.cache });
  }, []);

  const riesegui = useCallback(
    async (query: string) => {
      setStato({ fase: 'ricerca', query });
      const res = await cercaDocumento(query);
      if (!res.ok || !res.esito) {
        setStato({ fase: 'errore', messaggio: res.errore ?? 'Errore durante la ricerca.', query });
        return;
      }
      if (res.esito.esito === 'prosegui') {
        await genera(query, res.esito.catalogo?.id ?? undefined);
        return;
      }
      // Chiarimento: mostriamo solo le domande non ancora risposte.
      const nuove = res.esito.domande.filter((d) => !risposte.current[d.id]);
      if (nuove.length === 0) {
        // Tutti i dubbi erano già stati chiariti ma il server non procede:
        // generiamo comunque con le informazioni accumulate.
        await genera(query);
        return;
      }
      setStato({
        fase: 'chiarimento',
        query,
        domande: nuove,
        suggerimento: res.esito.suggerimento ?? null,
      });
    },
    [genera],
  );

  const cerca = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      queryBase.current = q;
      risposte.current = {};
      await riesegui(q);
    },
    [riesegui],
  );

  /** Aggiunge l'opzione scelta alla query e riprova la ricerca. */
  const scegliOpzione = useCallback(
    async (domandaId: string, opzione: string) => {
      risposte.current[domandaId] = opzione;
      const q = [queryBase.current, ...Object.values(risposte.current)].join(' ').trim();
      await riesegui(q);
    },
    [riesegui],
  );

  /** Salta i chiarimenti rimanenti e genera direttamente. */
  const generaDirettamente = useCallback(async () => {
    const q = [queryBase.current, ...Object.values(risposte.current)].join(' ').trim();
    await genera(q);
  }, [genera]);

  /** Registra il documento nei "Modelli Scaricati" dell'utente (user_saved_modules). */
  const salvaModulo = useCallback(async (modulo: DocumentoGenerato) => registraDownloadGenerato(modulo), []);

  /** Apre direttamente un documento già in cache (suggerito dalla ricerca). */
  const apriSuggerimento = useCallback(async (id: string) => {
    const modulo = await caricaDocumentoGenerato(id);
    if (modulo) setStato({ fase: 'pronto', modulo, cache: true });
  }, []);

  const reset = useCallback(() => {
    queryBase.current = '';
    risposte.current = {};
    setStato({ fase: 'idle' });
  }, []);

  return { stato, cerca, scegliOpzione, generaDirettamente, salvaModulo, apriSuggerimento, reset };
}

/* ------------------------------------------------------------------ */
/*  ModuleCreatorEngine — UI "Archivista Premuroso"                    */
/* ------------------------------------------------------------------ */

/**
 * Il creatore dinamico dei documenti scolastici:
 * 1. L'utente descrive con parole proprie il documento che gli serve.
 * 2. Il sistema cerca (catalogo + cache) e, se la richiesta è ambigua, si
 *    ferma e chiede chiarimenti in modalità collaborativa
 *    ("Consigliamo di precisare se…" — mai la forma impersonale).
 * 3. Genera il documento via DeepSeek (cache-first: query già viste a costo
 *    API zero), lo mostra in anteprima stampabile e ne registra il download
 *    nel profilo utente.
 */
export function ModuleCreatorEngine() {
  const { user, openVetrina } = useApp();
  const [query, setQuery] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const { stato, cerca, scegliOpzione, generaDirettamente, salvaModulo, apriSuggerimento, reset } =
    useModuleCreatorEngine();

  // Quando la generazione completa, apriamo automaticamente l'anteprima.
  useEffect(() => {
    if (stato.fase === 'pronto') setPreviewOpen(true);
  }, [stato]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    // Vetrina Freemium: la generazione è riservata agli account registrati.
    if (!user) {
      openVetrina('moduli');
      return;
    }
    void cerca(query);
  };

  return (
    <div className="mt-4 space-y-5">
      {/* Intro + form di ricerca */}
      <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-primary-800">Descrivi il documento che ti serve</h3>
            <p className="mt-1 text-sm leading-relaxed text-primary-600">
              Raccontaci con parole tue di cosa hai bisogno: che tipo di modulo, per quale ordine di
              scuola, per quale situazione. Se qualcosa non è chiaro ci fermiamo e ti chiediamo un
              paio di dettagli — meglio un minuto in più ora che un documento sbagliato dopo.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="Es. «Domanda di messa a disposizione per la scuola primaria a Roma» oppure «modello PEI per osservazioni sostegno»…"
            className="input resize-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!query.trim() || stato.fase === 'ricerca' || stato.fase === 'generazione'}
              className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              Cerca e genera il documento
            </button>
            {stato.fase !== 'idle' && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-600 transition hover:bg-primary-50"
              >
                <RotateCcw className="h-4 w-4" />
                Ricomincia
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Ricerca / generazione in corso */}
      {(stato.fase === 'ricerca' || stato.fase === 'generazione') && (
        <PensieriArchivista etichetta="Stiamo preparando tutto con calma…" />
      )}

      {/* Chiarimenti collaborativi */}
      {stato.fase === 'chiarimento' && (
        <div className="animate-fade-in space-y-4 rounded-2xl border border-secondary-200 bg-secondary-50/60 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-500 text-white">
              <HelpCircle className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-secondary-800">
                Un paio di dettagli e siamo subito operativi
              </h4>
              <p className="mt-0.5 text-sm text-secondary-700">
                Per darti il documento più adatto, tocca l&apos;opzione che ti riguarda:
              </p>
            </div>
          </div>

          {stato.domande.map((d) => (
            <div key={d.id}>
              <p className="text-sm font-semibold text-primary-800">{d.testo}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {d.opzioni.map((opzione) => (
                  <button
                    key={opzione}
                    onClick={() => void scegliOpzione(d.id, opzione)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-secondary-300 bg-white px-4 py-2 text-sm font-medium text-secondary-800 transition hover:border-secondary-500 hover:bg-secondary-100"
                  >
                    {opzione}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {stato.suggerimento && (
            <button
              onClick={() => void apriSuggerimento(stato.suggerimento!.id)}
              className="inline-flex w-full items-start gap-2 rounded-xl border border-primary-200 bg-white p-4 text-left transition hover:border-primary-400 hover:bg-primary-50"
            >
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
              <span className="text-sm leading-relaxed text-primary-700">
                <strong>Intanto, abbiamo trovato in archivio un documento simile già pronto:</strong>{' '}
                &quot;{stato.suggerimento.title}&quot;. Puoi aprirlo subito, a costo zero.
              </span>
            </button>
          )}

          <button
            onClick={() => void generaDirettamente()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
          >
            <Send className="h-4 w-4" />
            Genera comunque con queste informazioni
          </button>
        </div>
      )}

      {/* Errore */}
      {stato.fase === 'errore' && (
        <div className="animate-fade-in rounded-2xl border border-error-200 bg-error-50/60 p-5">
          <h4 className="text-sm font-bold text-error-700">
            Non siamo riusciti a completare la richiesta
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-error-700">
            {stato.messaggio === 'NON_AUTENTICATO'
              ? 'Per generare e salvare i tuoi documenti serve un account: accedi o registrati in un attimo.'
              : stato.messaggio}
          </p>
          <button
            onClick={reset}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-error-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-error-700"
          >
            <RotateCcw className="h-4 w-4" />
            Riprova
          </button>
        </div>
      )}

      {/* Suggerimenti di partenza */}
      {stato.fase === 'idle' && (
        <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
            <BookOpen className="h-4 w-4 text-primary-500" />
            Alcuni esempi per iniziare
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              'Domanda di messa a disposizione per la scuola secondaria di II grado',
              'Autocertificazione dei titoli di studio (DPR 445/2000)',
              'Lettera di presentazione per candidatura da supplente',
              'Modulo PEI per osservazioni sostegno nella scuola primaria',
              'Checklist mobilità annuale per docente di ruolo',
            ].map((esempio) => (
              <button
                key={esempio}
                onClick={() => {
                  setQuery(esempio);
                  if (!user) {
                    openVetrina('moduli');
                    return;
                  }
                  void cerca(esempio);
                }}
                className="rounded-full border border-primary-200 bg-primary-50 px-3.5 py-1.5 text-left text-xs font-medium text-primary-700 transition hover:border-primary-400 hover:bg-primary-100"
              >
                {esempio}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Anteprima documento pronto */}
      {stato.fase === 'pronto' && (
        <ModuloPreview
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            reset();
          }}
          modulo={stato.modulo}
          cache={stato.cache}
          onSalva={salvaModulo}
        />
      )}

      <p className="text-center text-xs text-primary-400">
        Ogni documento viene composto con segnaposto [Tra Parentesi Quadre]: nessun dato personale
        viene inventato o conservato oltre al testo che hai richiesto.
      </p>

    </div>
  );
}
