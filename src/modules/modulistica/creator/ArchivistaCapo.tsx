import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, FileText, Loader2, RotateCcw, Send } from 'lucide-react';
import {
  creaDocumentoLocale,
  generaDocumento,
  inviaIntervista,
  trovaModuloLocale,
  type DocumentoGenerato,
  type EsitoIntervista,
} from './cacheService';
import { PensieriArchivista } from './PensieriArchivista';
import { useApp } from '@/contexts/AppContext';

interface DomandaCorrente {
  testo: string;
  opzioni: string[];
  passo: string;
}

interface ArchivistaCapoProps {
  /** Query scritta nella barra di ricerca in alto (avvia la consultazione). */
  queryIniziale: string;
  /** Chiamato quando il documento è pronto (apre l'anteprima). */
  onDocumentoPronto: (modulo: DocumentoGenerato, cache: boolean) => void;
  /** Torna alla vista archivio. */
  onTornaAllArchivio: () => void;
  /** Accesso richiesto / sessione assente → il parent gestisce l'avviso. */
  onAccessoRichiesto: () => void;
}

type Fase = 'attesa' | 'domanda' | 'recupero' | 'pronto' | 'errore';

/** Pausa d'attesa dignitosa: ritardo intenzionale prima della risposta. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bancone dell'Archivista Capo — stile "Indovina Chi?".
 *
 * NESSUNA chat: una sola domanda alla volta a schermo, con la risposta
 * dell'Archivista GRANDE e rassicurante (effetto fade-in), opzioni chiare
 * o input minimale. Nessuno storico infinito di messaggi.
 */
export function ArchivistaCapo({
  queryIniziale,
  onDocumentoPronto,
  onTornaAllArchivio,
  onAccessoRichiesto,
}: ArchivistaCapoProps) {
  const [fase, setFase] = useState<Fase>('domanda');
  const [messaggio, setMessaggio] = useState('Buongiorno. Indichi la modulistica di cui necessita.');
  const [domanda, setDomanda] = useState<DomandaCorrente | null>(null);
  const [rispostaUtente, setRispostaUtente] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pronto, setPronto] = useState<{ modulo: DocumentoGenerato; cache: boolean } | null>(null);

  const { user } = useApp();
  /** Bancone consultabile da PRO (illimitato) o da chi ha almeno un credito a consumo. */
  const accessoConsentito = Boolean(user);

  const queryRef = useRef('');
  const risposteRef = useRef<Record<string, string>>({});
  const attesaPassoRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll: all'apertura la conversazione è sempre al centro dello schermo.
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const gestisciPronto = useCallback(
    async (esito: Exclude<EsitoIntervista, { esito: 'domanda' | 'ripeti' }>) => {
      // Il messaggio di consegna arriva sempre dall'archivio (mai replica React).
      const messaggioConsegna =
        esito.messaggio ?? 'La modulistica richiesta è disponibile nell\u2019archivio.';
      if (esito.modulo) {
        // Cache hit a costo zero: trovato nel registro.
        setPronto({ modulo: esito.modulo, cache: true });
        setMessaggio(messaggioConsegna);
        setFase('pronto');
        setBusy(false);
        onDocumentoPronto(esito.modulo, true);
        return;
      }
      // Profilo completo → recupero del documento.
      setMessaggio('Individuata la modulistica richiesta. Procedo alla preparazione.');
      setFase('recupero');
      // Intercettazione errori: mai lasciare la chat bloccata su `busy`.
      let gen: Awaited<ReturnType<typeof generaDocumento>>;
      try {
        gen = await generaDocumento(queryRef.current, esito.profilo, esito.catalogo?.id);
      } catch (err) {
        console.warn('ArchivistaCapo — generaDocumento:', err);
        gen = { ok: false, errore: 'ERRORE_RETE' };
      }
      setBusy(false);
      if (!gen.ok || !gen.esito) {
        if (gen.errore === 'NON_AUTENTICATO') {
          onAccessoRichiesto();
          setFase('domanda');
          return;
        }
        // Fallback locale: il bancone consegna comunque il documento.
        const locale = creaDocumentoLocale(queryRef.current, esito.profilo, esito.catalogo?.id);
        setPronto({ modulo: locale, cache: false });
        setMessaggio(messaggioConsegna);
        setFase('pronto');
        onDocumentoPronto(locale, false);
        return;
      }
      setPronto({ modulo: gen.esito.modulo, cache: gen.esito.cache });
      setMessaggio(messaggioConsegna);
      setFase('pronto');
      onDocumentoPronto(gen.esito.modulo, gen.esito.cache);
    },
    [onAccessoRichiesto, onDocumentoPronto],
  );

  const chiediProssimo = useCallback(async () => {
    // Sessione assente: il parent gestisce l'avviso di accesso.
    if (!accessoConsentito) {
      setBusy(false);
      onAccessoRichiesto();
      return;
    }
    setBusy(true);
    // Intercettazione errori: una chiamata fallita (rete, timeout, risposta
    // inattesa) NON deve MAI lasciare la chat bloccata nello stato `busy`.
    let res: Awaited<ReturnType<typeof inviaIntervista>>;
    try {
      res = await inviaIntervista(queryRef.current, risposteRef.current);
    } catch (err) {
      console.warn('ArchivistaCapo — inviaIntervista:', err);
      res = { ok: false, errore: 'ERRORE_RETE' };
    }
    if (!res.ok || !res.esito) {
      if (res.errore === 'NON_AUTENTICATO') {
        onAccessoRichiesto();
        setFase('domanda');
        setBusy(false);
        return;
      }
      // Fallback LOCALE: cerchiamo nel catalogo moduli.ts un modulo pertinente.
      const locale = trovaModuloLocale(queryRef.current);
      if (locale) {
        const modulo = creaDocumentoLocale(locale.nome, locale.profilo, locale.catalogoId);
        setPronto({ modulo, cache: false });
        setMessaggio(
          'La modulistica richiesta è disponibile nell\u2019archivio (la consultazione remota è momentaneamente non raggiungibile).',
        );
        setFase('pronto');
        setBusy(false);
        onDocumentoPronto(modulo, false);
        return;
      }
      setFase('errore');
      setMessaggio(
        'Non sono riuscito a individuare la modulistica richiesta. Riprova tra un istante oppure consulta le macroaree dell\u2019archivio.',
      );
      setBusy(false);
      return;
    }
    const esito = res.esito;
    if (esito.esito === 'domanda' || esito.esito === 'ripeti') {
      const passo = esito.passo;
      attesaPassoRef.current = passo.id;
      setDomanda({ testo: passo.testo, opzioni: passo.opzioni, passo: passo.id });
      setMessaggio(passo.testo);
      setFase('domanda');
      setBusy(false);
      return;
    }
    const prontoEsito = esito as Extract<EsitoIntervista, { esito: 'pronto' }>;
    await gestisciPronto(prontoEsito);
  }, [gestisciPronto, onAccessoRichiesto, accessoConsentito]);

  const avvia = useCallback(
    async (query: string) => {
      if (!accessoConsentito) {
        setBusy(false);
        onAccessoRichiesto();
        return;
      }
      const q = query.trim();
      if (!q) return;
      queryRef.current = q;
      risposteRef.current = {};
      attesaPassoRef.current = null;
      setRispostaUtente(q);
      // Pausa d'attesa dignitosa: l'Archivista consulta il registro prima di
      // rispondere (micro-indicatore sobrio; la risposta arriva SEMPRE
      // dall'archivio, Edge Function).
      setFase('attesa');
      setBusy(true);
      await sleep(2000);
      await chiediProssimo();
    },
    [chiediProssimo, accessoConsentito],
  );

  // Avvio della consultazione al mount (il parent rimonta il componente per ogni nuova query).
  useEffect(() => {
    if (queryIniziale.trim()) void avvia(queryIniziale);
    else void chiediProssimo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rispondi = async (testo: string) => {
    if (!accessoConsentito) {
      setBusy(false);
      onAccessoRichiesto();
      return;
    }
    const t = testo.trim();
    if (!t || busy) return;
    const passo = attesaPassoRef.current;
    if (!passo) {
      // Nessuna domanda pendente: reazione chiara, mai un invio ignorato in silenzio.
      setFase('errore');
      setMessaggio(
        'Non risulta una domanda in corso. Scrivi una nuova richiesta nella barra di ricerca oppure premi "Ricomincia".',
      );
      setBusy(false);
      return;
    }
    attesaPassoRef.current = null;
    setRispostaUtente(t);
    setInput('');
    // Risposta a una richiesta fuori contesto: la nuova richiesta viene
    // valutata dall'archivio (mai un loop di formule standard).
    if (passo === 'offtopic') {
      void avvia(t);
      return;
    }
    risposteRef.current[passo] = t;
    // Pausa d'attesa dignitosa prima della risposta dell'archivio.
    setFase('attesa');
    setBusy(true);
    await sleep(2000);
    void chiediProssimo();
  };

  const invia = (e: FormEvent) => {
    e.preventDefault();
    // Submit robusto: sia il click su "Invia" sia il tasto Enter passano da qui;
    // la guardia `busy` evita doppi invii consecutivi.
    if (busy) return;
    void rispondi(input);
  };

  const ricomincia = () => {
    setFase('domanda');
    setMessaggio('Buongiorno. Indichi la modulistica di cui necessita.');
    setDomanda(null);
    setRispostaUtente(null);
    setInput('');
    setPronto(null);
    setBusy(false);
    queryRef.current = '';
    risposteRef.current = {};
    attesaPassoRef.current = null;
    void chiediProssimo();
  };

  return (
    <div
      ref={containerRef}
      className={`animate-fade-in finestra-conversazione mt-4 overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card ${
        fase === 'attesa' ? '-translate-y-1 opacity-90' : ''
      }`}
    >
      {/* Intestazione minima */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary-900 via-primary-800 to-primary-700 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <FileText className="h-5 w-5" />
          </span>
          <p className="truncate text-base font-bold text-white">Archivista Capo</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={ricomincia}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Ricomincia
          </button>
          <button
            type="button"
            onClick={onTornaAllArchivio}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Archivio
          </button>
        </div>
      </div>

      {/* Bancone */}
      <div className="flex min-h-[460px] flex-col items-center justify-center bg-slate-50/60 px-6 py-12 text-center">
        <div className="w-full max-w-2xl">
          {/* Risposta dell'utente — discreta e secondaria */}
          {rispostaUtente && (
            <p className="mx-auto mb-8 max-w-md text-sm italic leading-relaxed text-primary-400">
              → {rispostaUtente}
            </p>
          )}

          {/* Messaggio dell'Archivista — GRANDE, fade-in morbido (500ms) */}
          <p
            key={messaggio}
            className="animate-fade-in-lenta text-2xl font-bold leading-snug text-primary-900 sm:text-4xl"
          >
            {messaggio}
          </p>

          {/* Pausa d'attesa dignitosa: micro-indicatore sobrio mentre
              l'Archivista consulta il registro (2 secondi simulati). */}
          {fase === 'attesa' && (
            <div className="animate-fade-in-lenta mx-auto mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              L\u2019Archivista Capo consulta il registro\u2026
            </div>
          )}


          {/* Input libero: SEMPRE attivo durante la conversazione (risposta
              naturale in testo libero, mai bottoni rigidi). */}
          {fase === 'domanda' && !busy && (
            <form onSubmit={invia} className="mx-auto mt-6 flex max-w-md items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Scrivi qui la tua risposta…"
                className="input !py-3 text-base"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-secondary-500 px-5 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Invia
              </button>
            </form>
          )}

          {/* Recupero del documento */}
          {fase === 'recupero' && (
            <div className="mx-auto mt-8 max-w-lg text-left">
              <PensieriArchivista etichetta="Archivista Capo" />
            </div>
          )}

          {/* Documento pronto */}
          {fase === 'pronto' && pronto && (
            <button
              type="button"
              onClick={() => onDocumentoPronto(pronto.modulo, pronto.cache)}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-secondary-500 px-7 py-3.5 text-base font-bold text-white shadow-soft transition hover:bg-secondary-600"
            >
              <FileText className="h-5 w-5" />
              Apri il documento
            </button>
          )}

          {/* Errore neutro */}
          {fase === 'errore' && (
            <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-warning-500/40 bg-warning-50/70 p-4">
              <p className="text-sm leading-relaxed text-warning-700">{messaggio}</p>
              <button
                type="button"
                onClick={ricomincia}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-warning-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-warning-600"
              >
                <RotateCcw className="h-4 w-4" />
                Ricomincia
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

