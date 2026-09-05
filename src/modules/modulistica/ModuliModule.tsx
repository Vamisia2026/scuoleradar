import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderOpen, UserPlus, X } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/components/Toast';
import {
  conAggiuntaInCima,
  macroAreaById,
  moduli,
  trovaDocumentoModulisticaById,
  STORAGE_KEY_MODULI_SCARICATI,
  type DocumentoModulistica,
  type Modulo,
  type ModuloScaricato,
} from '@/data/moduli';
import type { ModuloSalvatoDB, VistaModulistica, VoceModulo } from './types';
import { ModuliNavigation } from './components/ModuliNavigation';
import { MacroAreaMenu } from './components/MacroAreaMenu';
import { EsploraArchivio } from './components/EsploraArchivio';
import { RicercaArchivista } from './components/RicercaArchivista';
import { VetrinaModulistica } from './components/VetrinaModulistica';
import { ModuliProLockModal } from './components/ModuliProLockModal';
import { SavedModuli } from './components/SavedModuli';
import { TeaserArchivistaModal } from './components/TeaserArchivistaModal';
import { ModuloPreview } from './creator/ModuloPreview';
import {
  caricaDocumentoGenerato,
  creaDocumentoLocale,
  elencaDownload,
  generaDocumento,
  registraDownloadCatalogo,
  registraDownloadGenerato,
  rimuoviDownload,
  type DocumentoGenerato,
} from './creator/cacheService';

/**
 * Modulo Modulistica — contenitore principale isolato.
 *
 * Struttura (interfaccia dell'Archivista Capo):
 *  - barra di ricerca larga in cima → filtro LIVE sul catalogo dei moduli
 *  - menu delle Macroaree (Sostegno per prima) → archivio a drill-down
 *  - contenitore rettangolare: griglia 3×3 delle sottocategorie con
 *    paginazione, doppio click per scendere fino al singolo documento
 *  - ogni documento è UN SOLO modulo profilato (cache `generated_modules`
 *    tramite l'impronta dell'intervista) e al download viene salvato
 *    automaticamente in `user_saved_modules` ("I miei Modelli Scaricati")
 */
export function ModuliModule() {
  const { user, abbonato, openVetrina, openAuthModal } = useApp();
  const { mostraToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vista, setVista] = useState<VistaModulistica>(() => {
    const tab = searchParams.get('tab');
    return tab === 'miei' ? 'miei' : 'archivio';
  });
  const [macroAreaId, setMacroAreaId] = useState<string | null>(null);
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

  const macroArea = useMemo(() => macroAreaById(macroAreaId), [macroAreaId]);

  /** Compatta banner e padding quando l'utente cerca o esplora una macroarea. */
  const compattato = macroAreaId !== null || filtro.trim() !== '';

  const caricaMieiDB = useCallback(async () => {
    if (!user) {
      setModuliDB([]);
      return;
    }
    setCaricamentoMiei(true);
    const res = await elencaDownload();
    if (res.ok && res.moduli) setModuliDB(res.moduli);
    else if (res.errore === 'NON_AUTENTICATO') richiediAccesso();
    else if (res.errore) console.warn('ModuliModule — elencaDownload:', res.errore);
    setCaricamentoMiei(false);
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
      void registraDownloadCatalogo(m).then((res) => {
        if (res.ok) mostraToast('successo', 'Modulo salvato nei tuoi "Modelli Scaricati".');
      });
      // Il documento esiste già nell'archivio: anteprima istantanea da template locale.
      const completo = trovaDocumentoModulisticaById(m.id);
      if (completo) {
        setAnteprima({
          modulo: creaDocumentoLocale(completo.nome, completo.profilo, completo.catalogoId),
          cache: false,
        });
      }
    },
    [user, openVetrina, moduliScaricati, setModuliScaricati, mostraToast],
  );

  /** Registra automaticamente il download nei "Modelli Scaricati" (user_saved_modules). */
  const registraEAvvisa = useCallback(
    (modulo: DocumentoGenerato) => {
      if (!modulo.id) return;
      void registraDownloadGenerato(modulo).then((res) => {
        if (res.ok) {
          mostraToast('successo', 'Modulo salvato nei tuoi "Modelli Scaricati".');
        } else if (res.errore === 'NON_AUTENTICATO') {
          richiediAccesso();
        } else if (res.errore) {
          console.warn('ModuliModule — auto-salvataggio:', res.errore);
        }
      });
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
      // Apertura immediata: il documento è già pronto localmente.
      apriAnteprima(creaDocumentoLocale(doc.nome, doc.profilo, doc.catalogoId), false);

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
    [user, openVetrina, apriAnteprima, richiediAccesso],
  );

  /** Flusso chat dell'Archivista Capo: momentaneamente disattivato (teaser a Ottobre). */

  const rimuoviModulo = useCallback(
    (id: string) => setModuliScaricati(moduliScaricati.filter((x) => x.id !== id)),
    [moduliScaricati, setModuliScaricati],
  );

  const rimuoviDB = useCallback(
    async (key: string) => {
      const res = await rimuoviDownload(key);
      if (res.ok) {
        setModuliDB((prev) => prev.filter((x) => x.module_key !== key));
        mostraToast('successo', 'Modulo rimosso dai tuoi "Modelli Scaricati".');
      } else {
        mostraToast('errore', res.errore ?? 'Rimozione non riuscita.');
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
      const modulo = await caricaDocumentoGenerato(id);
      if (modulo) apriAnteprima(modulo, true);
      else mostraToast('errore', 'Documento non trovato nell\u2019archivio (o servizio non configurato).');
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

  // Vetrina Freemium: gli utenti NON registrati vedono solo la landing
  // promozionale orientata alla registrazione gratuita.
  if (!user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary-600" />
          <h2 className="text-2xl font-bold text-primary-800">
            Tutti i moduli per la scuola che ti servono, senza cercarli ogni volta.
          </h2>
        </div>
        <VetrinaModulistica />
      </div>
    );
  }

  return (
    <div className={compattato ? 'space-y-3' : 'space-y-6'}>
      <div className={compattato ? 'flex flex-wrap items-center gap-1.5' : 'flex flex-wrap items-center gap-2'}>
        <FolderOpen
          className={compattato ? 'h-4 w-4 text-primary-600' : 'h-5 w-5 text-primary-600'}
        />
        <h2
          className={
            compattato ? 'text-lg font-bold text-primary-800' : 'text-2xl font-bold text-primary-800'
          }
        >
          Tutti i moduli per la scuola che ti servono, senza cercarli ogni volta.
        </h2>
      </div>

      {/* Avviso di accesso (customer care "Bezos style"): visibile SOLO se davvero non sei autenticato */}
      {notaAccesso && !user && (
        <div className={`flex flex-col gap-3 rounded-2xl border border-secondary-200 bg-secondary-50 shadow-card sm:flex-row sm:items-center sm:justify-between ${compattato ? 'p-3' : 'p-4'}`}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-500 text-white">
              <UserPlus className="h-4 w-4" />
            </span>
            <p className="text-sm leading-relaxed text-primary-800">
              Per usare questo servizio devi essere registrato. Registrati ora in un attimo. È
              gratis.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => openAuthModal('registrazione')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"
            >
              Registrati Ora
            </button>
            <button
              onClick={chiudiNotaAccesso}
              aria-label="Chiudi avviso"
              className="rounded-lg p-2 text-primary-400 transition hover:bg-white hover:text-primary-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Menu Macroaree — subito in alto */}
      <MacroAreaMenu
        attiva={macroAreaId}
        compatto={compattato}
        onSeleziona={(area) => {
          setMacroAreaId(area.id);
          apriTab('archivio');
        }}
      />

      {/* Barra di ricerca dell'Archivista Capo — sotto le Macroaree */}
      <RicercaArchivista
        filtro={filtro}
        onCerca={eseguiRicerca}
        onTeaserArchivista={() => setTeaserAperto(true)}
        compatto={compattato}
      />

      {/* Contenitore rettangolare principale */}
      <div
        className={`rounded-2xl border border-primary-100 bg-white shadow-card ${
          compattato ? 'p-3 sm:p-4' : 'p-5'
        }`}
      >
        {/* Navigazione archivio / salvati (la ricerca filtra il catalogo) */}
        <ModuliNavigation vista={vista} onNaviga={apriTab} />

        {/* Archivio: drill-down per macroarea (griglia 3×5 con paginazione) */}
        {vista === 'archivio' && (
          <EsploraArchivio
            key={macroAreaId ?? 'nessuna'}
            macroArea={macroArea}
            filtro={filtro}
            consultando={isSearching}
            compatto={compattato}
            onApriDocumento={(doc) => void apriDocumento(doc)}
          />
        )}

        {/* Intervista guidata dell'Archivista Capo: disattivata (arriva a Ottobre per i PRO). */}

        {/* Archivio: modelli salvati */}
        {vista === 'miei' && (
          <SavedModuli
            caricamento={caricamentoMiei}
            voci={vociMiei}
            onApriGenerato={(key) => void apriGenerato(key)}
            onScarica={handleDownload}
            onRimuovi={gestisciRimozione}
          />
        )}
      </div>

      {/* Modale teaser Archivista Capo (In arrivo a Ottobre per i PRO) */}
      <TeaserArchivistaModal open={teaserAperto} onClose={() => setTeaserAperto(false)} />

      {/* Modale "Moduli scaricati — Funzionalità PRO" (utenti Base) */}
      <ModuliProLockModal open={proLockAperto} onClose={() => setProLockAperto(false)} />

      {/* Anteprima di un documento generato (intervista o archivio) */}
      {anteprima && (
        <ModuloPreview
          open
          onClose={() => setAnteprima(null)}
          modulo={anteprima.modulo}
          cache={anteprima.cache}
          onSalva={(m) => registraDownloadGenerato(m)}
        />
      )}
    </div>
  );
}
