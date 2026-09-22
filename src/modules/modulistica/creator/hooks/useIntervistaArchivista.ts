/**
 * Modulistica · motore dell'intervista dell'Archivista Capo (behavior-only).
 *
 * Estratto da `ArchivistaCapo.tsx`: stato del bancone (fase, messaggio, risposta
 * dell'utente, input, busy, documento pronto), catena delle chiamate all'archivio
 * (`inviaIntervista` → `generaDocumento` → `creaDocumentoLocale`) con fallback
 * locale, pause d'attesa dignitose e riavvio.
 *
 * Nessun JSX: il componente resta di sola presentazione e monta i
 * sotto-componenti con i valori restituiti da questo hook.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  creaDocumentoLocale,
  generaDocumento,
  inviaIntervista,
  trovaModuloLocale,
  type DocumentoGenerato,
  type EsitoIntervista,
} from '../cacheService';
import type { DomandaCorrente, Fase } from '../archivistaTipi';

/** Pausa d'attesa dignitosa: ritardo intenzionale prima della risposta. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parametri dell'intervista (dal componente pubblico). */
export interface UseIntervistaArchivistaOptions {
  /** Query scritta nella barra di ricerca in alto (avvia la consultazione). */
  queryIniziale: string;
  /** Chiamato quando il documento è pronto (apre l'anteprima). */
  onDocumentoPronto: (modulo: DocumentoGenerato, cache: boolean) => void;
  /** Accesso richiesto / sessione assente → il parent gestisce l'avviso. */
  onAccessoRichiesto: () => void;
}

/** Stato e azioni del bancone, consumati dal JSX del contenitore. */
export interface IntervistaArchivista {
  /** Fase corrente del bancone. */
  fase: Fase;
  /** Messaggio grande mostrato dall'Archivista. */
  messaggio: string;
  /** Ultima risposta scritta dall'utente (null se non ha ancora risposto). */
  rispostaUtente: string | null;
  /** Testo del campo di risposta libera. */
  input: string;
  /** true mentre l'Archivista consulta il registro. */
  busy: boolean;
  /** Documento consegnato dall'archivio, con l'origine (cache o generato). */
  pronto: { modulo: DocumentoGenerato; cache: boolean } | null;
  /** Aggiorna il campo di risposta libera. */
  setInput: (valore: string) => void;
  /** Submit robusto del form (click su «Invia» o tasto Enter). */
  invia: (e: FormEvent) => void;
  /** Riavvio del bancone (testata e stato di errore). */
  ricomincia: () => void;
  /** Apre l'anteprima del documento consegnato, se presente. */
  apriPronto: () => void;
}

export function useIntervistaArchivista({
  queryIniziale,
  onDocumentoPronto,
  onAccessoRichiesto,
}: UseIntervistaArchivistaOptions): IntervistaArchivista {
  const [fase, setFase] = useState<Fase>('domanda');
  const [messaggio, setMessaggio] = useState('Buongiorno. Indichi la modulistica di cui necessita.');
  const [, setDomanda] = useState<DomandaCorrente | null>(null);
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

  /** Apre l'anteprima del documento consegnato, se presente. */
  const apriPronto = () => {
    if (pronto) onDocumentoPronto(pronto.modulo, pronto.cache);
  };

  return {
    fase,
    messaggio,
    rispostaUtente,
    input,
    setInput,
    busy,
    pronto,
    invia,
    ricomincia,
    apriPronto,
  };
}
