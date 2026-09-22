/**
 * Modulistica — stato e logica di dominio del modulo (data layer).
 *
 * Estratto da `ModuliModule.tsx`: stato (vista, macroarea, filtro, anteprima,
 * modelli salvati), caricamento da Edge Function, download cache-first, ricerca
 * e navigazione a tab. Il componente resta di sola presentazione: monta i
 * sotto-componenti con i valori restituiti da questo hook.
 *
 * Ritorna un oggetto con i valori usati dal JSX (nessuna logica di render).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/components/Toast';
import { haTemplatePrescrittivo } from '../creator/templatePrescrittivi';
import {
  conAggiuntaInCima,
  moduli,
  trovaDocumentoModulisticaById,
  STORAGE_KEY_MODULI_SCARICATI,
  type DocumentoModulistica,
  type MacroAreaModulistica,
  type Modulo,
  type ModuloScaricato,
} from '@/data/moduli';
import type { ModuloSalvatoDB, VistaModulistica, VoceModulo } from '../types';
import {
  caricaDocumentoGenerato,
  creaDocumentoLocale,
  elencaDownload,
  generaDocumento,
  registraDownloadCatalogo,
  registraDownloadGenerato,
  rimuoviDownload,
  type DocumentoGenerato,
} from '../creator/cacheService';

/**
 * Stato e azioni del modulo Modulistica.
 * I consumatori destrutturano solo ciò che serve al proprio render.
 */
export function useModulistica() {
  const { user, abbonato, openVetrina, openAuthModal } = useApp();
  const { mostraToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vista, setVista] = useState<VistaModulistica>(() => {
    const tab = searchParams.get('tab');
    return tab === 'miei' ? 'miei' : 'archivio';
  });
  /** Macroarea selezionata dal menu (oggetto: supporta anche la scheda unita "Enti e Altro"). */
  const [areaSelezionata, setAreaSelezionata] = useState<MacroAreaModulistica | null>(null);
  const macroAreaId = areaSelezionata?.id ?? null;
  /** Filtro live della ricerca standard sui moduli. */
  const [filtro, setFiltro] = useState('');
  /** "Labor Illusion": true durante la consultazione (~2s) dopo l'invio della ricerca. */
  const [isSearching, setIsSearching] = useState(false);
  const timerCercaRef = useRef<number | null>(null);

  /** Avvia la ricerca SOLO su invio (Enter/click Cerca): committa la query e mostra il caricamento. */
  const eseguiRicerca = useCallback((q: string) => {
    setFiltro(q);
    if (q.trim().length < 2) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    if (timerCercaRef.current) window.clearTimeout(timerCercaRef.current);
    timerCercaRef.current = window.setTimeout(() => setIsSearching(false), 2000);
  }, []);

  useEffect(
    () => () => {
      if (timerCercaRef.current) window.clearTimeout(timerCercaRef.current);
    },
    [],
  );
  /** Modale teaser "Archivista Capo — In arrivo a Ottobre per utenti PRO!". */
  const [teaserAperto, setTeaserAperto] = useState(false);
  /** Modale "Moduli scaricati — Funzionalità PRO" per gli utenti Base. */
  const [proLockAperto, setProLockAperto] = useState(false);
  const [moduliScaricati, setModuliScaricati] = useLocalStorage<ModuloScaricato[]>(
    STORAGE_KEY_MODULI_SCARICATI,
    [],
  );
  /** Download registrati su user_saved_modules. */
  const [moduliDB, setModuliDB] = useState<ModuloSalvatoDB[]>([]);
  const [caricamentoMiei, setCaricamentoMiei] = useState(false);
  const [anteprima, setAnteprima] = useState<{ modulo: DocumentoGenerato; cache: boolean } | null>(
    null,
  );
  /** Avviso di accesso richiesto / sessione scaduta (customer care "Bezos style"). */
  const [notaAccesso, setNotaAccesso] = useState(false);
  const richiediAccesso = useCallback(() => setNotaAccesso(true), []);
  const chiudiNotaAccesso = useCallback(() => setNotaAccesso(false), []);

  const macroArea = areaSelezionata;

  /** Compatta banner e padding quando l'utente cerca o esplora una macroarea. */
  const compattato = macroAreaId !== null || filtro.trim() !== '';

  const caricaMieiDB = useCallback(async () => {
    if (!user) {
      setModuliDB([]);
      return;
    }
    setCaricamentoMiei(true);
    try {
      const res = await elencaDownload();
      if (res.ok && res.moduli) setModuliDB(res.moduli);
      else if (res.errore === 'NON_AUTENTICATO') richiediAccesso();
      else if (res.errore) console.warn('ModuliModule — elencaDownload:', res.errore);
    } catch (err) {
      // Il servizio di cache non deve MAI lasciare la sezione in caricamento infinito.
      console.warn('ModuliModule — elencaDownload:', err);
    } finally {
      setCaricamentoMiei(false);
    }
  }, [user, richiediAccesso]);

  // Ricarica i download registrati quando si apre la tab "I miei".
  useEffect(() => {
    if (vista === 'miei') void caricaMieiDB();
  }, [vista, caricaMieiDB]);

  /**
   * Download dal catalogo ("Scarica" nei Modelli Salvati): apre SUBITO
   * l'anteprima dal template locale (zero latenza, nessuna attesa di rete,
   * nessun errore visibile) e registra il download nel profilo in background.
   */
  const handleDownload = useCallback(
    (m: Pick<Modulo, 'id' | 'nome' | 'tipo'>) => {
      // Vetrina: i download sono riservati agli account registrati (Free o PRO).
      if (!user) {
        openVetrina('moduli');
        return;
      }
      setModuliScaricati(conAggiuntaInCima(moduliScaricati, m));
      void registraDownloadCatalogo(m)
        .then((res) => {
          if (res.ok) mostraToast('successo', 'Modulo salvato nei tuoi "Modelli Scaricati".');
        })
        .catch((err) => console.warn('ModuliModule — registrazione download dal catalogo:', err));
      // Il documento esiste già nell'archivio: anteprima istantanea da template locale.
      // La generazione locale è best-effort: un guasto del template resta confinato
      // a questa azione, senza propagarsi al resto del dipartimento.
      try {
        const completo = trovaDocumentoModulisticaById(m.id);
        if (completo) {
          setAnteprima({
            modulo: creaDocumentoLocale(completo.nome, completo.profilo, completo.catalogoId),
            cache: false,
          });
        }
      } catch (err) {
        console.warn('ModuliModule — anteprima locale dal catalogo:', err);
        mostraToast('errore', 'Il documento non può essere aperto in questo momento. Riprova tra poco.');
      }
    },
    [user, openVetrina, moduliScaricati, setModuliScaricati, mostraToast],
  );

  /** Registra automaticamente il download nei "Modelli Scaricati" (user_saved_modules). */
  const registraEAvvisa = useCallback(
    (modulo: DocumentoGenerato) => {
      if (!modulo.id) return;
      void registraDownloadGenerato(modulo)
        .then((res) => {
          if (res.ok) {
            mostraToast('successo', 'Modulo salvato nei tuoi "Modelli Scaricati".');
          } else if (res.errore === 'NON_AUTENTICATO') {
            richiediAccesso();
          } else if (res.errore) {
            console.warn('ModuliModule — auto-salvataggio:', res.errore);
          }
        })
        .catch((err) => console.warn('ModuliModule — auto-salvataggio:', err));
    },
    [mostraToast, richiediAccesso],
  );

  /** Apre l'anteprima di un documento generato e lo salva subito nel profilo. */
  const apriAnteprima = useCallback(
    (modulo: DocumentoGenerato, cache: boolean) => {
      setAnteprima({ modulo, cache });
      registraEAvvisa(modulo);
    },
    [registraEAvvisa],
  );

  /**
   * Documento aperto dall'archivio (profilo già completo).
   *
   * Strategia "file pre-esistente": l'anteprima si apre ISTANTANEAMENTE dal
   * template locale (nessuna chiamata di rete, nessuna attesa, nessun toast di
   * errore possibile). La cache del generatore viene interrogata SOLO in
   * background come arricchimento best-effort: qualsiasi esito negativo resta
   * completamente invisibile all'utente (solo console.warn di diagnostica).
   */
  const apriDocumento = useCallback(
    (doc: DocumentoModulistica) => {
      if (!user) {
        openVetrina('moduli');
        return;
      }
      // Apertura immediata: il documento è già pronto localmente. Un errore del
      // template locale non deve svuotare la pagina: si avvisa e si prosegue.
      try {
        apriAnteprima(creaDocumentoLocale(doc.nome, doc.profilo, doc.catalogoId), false);
      } catch (err) {
        console.warn('ModuliModule — anteprima locale dall\'archivio:', err);
        mostraToast('errore', 'Il documento non può essere aperto in questo momento. Riprova tra poco.');
        return;
      }

      // I moduli con template PRESCRITTIVO (cambio turno, verbale dipartimento,
      // congedo L.104) hanno struttura, campi e firme legali definite a mano:
      // NON vengono sovrascritti dall'arricchimento AI in background.
      if (haTemplatePrescrittivo(doc.profilo)) return;

      // Arricchimento silenzioso in background (mai errori/toast all'utente).
      void (async () => {
        try {
          const res = await generaDocumento(doc.nome, doc.profilo, doc.catalogoId);
          if (!res.ok || !res.esito) {
            if (res.errore === 'NON_AUTENTICATO') richiediAccesso();
            else console.warn('ModuliModule — arricchimento documento:', res.errore);
            return;
          }
          // Sostituisce la bozza locale con la versione d'archivio (più ricca)
          // SOLO se l'anteprima è ancora aperta sullo stesso documento.
          setAnteprima((prev) => {
            if (!prev || prev.modulo.title !== doc.nome) return prev;
            return { modulo: res.esito!.modulo, cache: res.esito!.cache };
          });
        } catch (err) {
          console.warn('ModuliModule — arricchimento documento:', err);
        }
      })();
    },
    [user, openVetrina, apriAnteprima, richiediAccesso, mostraToast],
  );

  /** Flusso chat dell'Archivista Capo: momentaneamente disattivato (teaser a Ottobre). */

  const rimuoviModulo = useCallback(
    (id: string) => setModuliScaricati(moduliScaricati.filter((x) => x.id !== id)),
    [moduliScaricati, setModuliScaricati],
  );

  const rimuoviDB = useCallback(
    async (key: string) => {
      try {
        const res = await rimuoviDownload(key);
        if (res.ok) {
          setModuliDB((prev) => prev.filter((x) => x.module_key !== key));
          mostraToast('successo', 'Modulo rimosso dai tuoi "Modelli Scaricati".');
        } else {
          mostraToast('errore', res.errore ?? 'Rimozione non riuscita.');
        }
      } catch (err) {
        console.warn('ModuliModule — rimuoviDownload:', err);
        mostraToast('errore', 'Rimozione non riuscita. Riprova tra un istante.');
      }
    },
    [mostraToast],
  );

  /** Rimozione combinata: locale se presente nello storico, altrimenti DB. */
  const gestisciRimozione = useCallback(
    (voce: VoceModulo) => {
      if (voce.source === 'catalogo' && moduliScaricati.some((m) => `cat:${m.id}` === voce.key)) {
        rimuoviModulo(voce.key.replace(/^cat:/, ''));
      } else {
        void rimuoviDB(voce.key);
      }
    },
    [moduliScaricati, rimuoviModulo, rimuoviDB],
  );

  /** Apre l'anteprima di un documento generato (lettura pubblica della cache). */
  const apriGenerato = useCallback(
    async (key: string) => {
      const id = key.replace(/^gen:/, '');
      try {
        const modulo = await caricaDocumentoGenerato(id);
        if (modulo) apriAnteprima(modulo, true);
        else mostraToast('errore', 'Documento non trovato nell\u2019archivio (o servizio non configurato).');
      } catch (err) {
        // Archivio non raggiungibile: nessuna schermata bianca, solo un avviso.
        console.warn('ModuliModule — caricaDocumentoGenerato:', err);
        mostraToast('errore', 'Archivio non raggiungibile: riprova tra un istante.');
      }
    },
    [apriAnteprima, mostraToast],
  );

  const apriTab = (v: VistaModulistica) => {
    // Paywall soft-sell: "I Miei Moduli Scaricati" è una Funzionalità PRO.
    // Gli utenti Base vedono il modale informativo invece dell'archivio.
    if (v === 'miei' && !abbonato) {
      setProLockAperto(true);
      return;
    }
    setVista(v);
    setSearchParams(v === 'archivio' ? {} : { tab: v }, { replace: true });
  };

  /** Se un utente Base arriva su ?tab=miei (es. link diretto), ripiega sull'archivio
      e mostra il paywall invece dell'elenco dei download. */
  useEffect(() => {
    if (vista === 'miei' && !abbonato) {
      setVista('archivio');
      setSearchParams({}, { replace: true });
      setProLockAperto(true);
    }
  }, [vista, abbonato, setSearchParams]);

  /** Voci combinate: storico locale (catalogo) + DB (catalogo e generati), senza duplicati. */
  const vociMiei = useMemo<VoceModulo[]>(() => {
    const localiKeys = new Set(moduliScaricati.map((m) => `cat:${m.id}`));
    const locali: VoceModulo[] = moduliScaricati.map((m) => ({
      key: `cat:${m.id}`,
      source: 'catalogo',
      title: m.nome,
      tipo: m.tipo,
      data: m.scaricatoIl,
      catalogo: moduli.find((x) => x.id === m.id),
    }));
    const remoti: VoceModulo[] = moduliDB
      .filter((db) => !(db.module_source === 'catalogo' && localiKeys.has(db.module_key)))
      .map((db) => ({
        key: db.module_key,
        source: db.module_source,
        title: db.title,
        tipo: db.tipo,
        data: db.created_at,
        catalogo:
          db.module_source === 'catalogo'
            ? moduli.find((x) => x.id === db.module_key.replace(/^cat:/, ''))
            : undefined,
      }));
    return [...locali, ...remoti];
  }, [moduliScaricati, moduliDB]);
  return {
    user,
    openAuthModal,
    notaAccesso,
    chiudiNotaAccesso,
    compattato,
    vista,
    apriTab,
    macroArea,
    macroAreaId,
    setAreaSelezionata,
    filtro,
    eseguiRicerca,
    isSearching,
    teaserAperto,
    setTeaserAperto,
    proLockAperto,
    setProLockAperto,
    caricamentoMiei,
    vociMiei,
    apriGenerato,
    handleDownload,
    gestisciRimozione,
    anteprima,
    setAnteprima,
    apriDocumento,
  };
}
