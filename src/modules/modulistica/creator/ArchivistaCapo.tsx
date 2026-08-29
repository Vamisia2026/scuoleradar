import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, FileText, RotateCcw, Send, Sparkles } from 'lucide-react';
import {
  creaDocumentoLocale,
  generaDocumento,
  inviaIntervista,
  trovaModuloLocale,
  type DocumentoGenerato,
  type EsitoIntervista,
} from './cacheService';
import { PensieriArchivista } from './PensieriArchivista';

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

type Fase = 'domanda' | 'recupero' | 'pronto' | 'errore';

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
  const [messaggio, setMessaggio] = useState('Buongiorno, di che modulo hai bisogno?');
  const [domanda, setDomanda] = useState<DomandaCorrente | null>(null);
  const [rispostaUtente, setRispostaUtente] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pronto, setPronto] = useState<{ modulo: DocumentoGenerato; cache: boolean } | null>(null);

  const queryRef = useRef('');
  const risposteRef = useRef<Record<string, string>>({});
  const attesaPassoRef = useRef<string | null>(null);

  const gestisciPronto = useCallback(
    async (esito: Exclude<EsitoIntervista, { esito: 'domanda' | 'ripeti' }>) => {
      if (esito.modulo) {
        // Cache hit a costo zero: trovato nel registro.
        setPronto({ modulo: esito.modulo, cache: true });
        setMessaggio('Eccolo: ho esattamente quello che ti serve.');
        setFase('pronto');
        setBusy(false);
        onDocumentoPronto(esito.modulo, true);
        return;
      }
      // Profilo completo → recupero del documento.
      setMessaggio('Ho esattamente quello che ti serve. Vado a prenderlo…');
      setFase('recupero');
      const gen = await generaDocumento(queryRef.current, esito.profilo, esito.catalogo?.id);
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
        setMessaggio('Ecco il documento: è esattamente quello che ti serve.');
        setFase('pronto');
        onDocumentoPronto(locale, false);
        return;
      }
      setPronto({ modulo: gen.esito.modulo, cache: gen.esito.cache });
      setMessaggio('Ecco il documento: è esattamente quello che ti serve.');
      setFase('pronto');
      onDocumentoPronto(gen.esito.modulo, gen.esito.cache);
    },
    [onAccessoRichiesto, onDocumentoPronto],
  );

  const chiediProssimo = useCallback(async () => {
    setBusy(true);
    const res = await inviaIntervista(queryRef.current, risposteRef.current);
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
          'Ecco il modulo che cercavi, direttamente dall\u2019archivio (la consultazione remota è momentaneamente non raggiungibile).',
        );
        setFase('pronto');
        setBusy(false);
        onDocumentoPronto(modulo, false);
        return;
      }
      setFase('errore');
      setMessaggio(
        'Ops, non sono riuscito a consultare il registro. Riprova tra un istante oppure esplora le macroaree qui sopra.',
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
  }, [gestisciPronto, onAccessoRichiesto]);

  const avvia = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      queryRef.current = q;
      risposteRef.current = {};
      attesaPassoRef.current = null;
      setRispostaUtente(q);
      setMessaggio('Sto cercando nel registro…');
      await chiediProssimo();
    },
    [chiediProssimo],
  );

  // Avvio della consultazione al mount (il parent rimonta il componente per ogni nuova query).
  useEffect(() => {
    if (queryIniziale.trim()) void avvia(queryIniziale);
    else void chiediProssimo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rispondi = (testo: string) => {
    const t = testo.trim();
    if (!t || busy) return;
    const passo = attesaPassoRef.current;
    if (passo) risposteRef.current[passo] = t;
    attesaPassoRef.current = null;
    setRispostaUtente(t);
    setInput('');
    setMessaggio('Perfetto, ho capito. Un attimo…');
    void chiediProssimo();
  };

  const invia = (e: FormEvent) => {
    e.preventDefault();
    rispondi(input);
  };

  const ricomincia = () => {
    setFase('domanda');
    setMessaggio('Buongiorno, di che modulo hai bisogno?');
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
    <div className="animate-fade-in mt-4 overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
      {/* Intestazione minima */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary-900 via-primary-800 to-primary-700 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <Sparkles className="h-5 w-5" />
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

          {/* Messaggio dell'Archivista — GRANDE, con fade-in */}
          <p
            key={messaggio}
            className="animate-fade-in text-2xl font-bold leading-snug text-primary-900 sm:text-4xl"
          >
            {messaggio}
          </p>

          {/* Opzioni della domanda (come in "Indovina Chi?") */}
          {fase === 'domanda' && domanda && domanda.opzioni.length > 0 && !busy && (
            <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
              {domanda.opzioni.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => rispondi(op)}
                  className="rounded-xl border border-primary-200 bg-white px-5 py-4 text-left text-base font-semibold text-primary-800 shadow-soft transition hover:border-primary-400 hover:bg-primary-50"
                >
                  {op}
                </button>
              ))}
            </div>
          )}

          {/* Input minimale */}
          {fase === 'domanda' && !busy && (
            <form onSubmit={invia} className="mx-auto mt-6 flex max-w-md items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Scrivi la risposta…"
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

