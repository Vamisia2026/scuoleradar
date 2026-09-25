import { FolderOpen, UserPlus, X } from 'lucide-react';
import { ModuliNavigation } from './components/ModuliNavigation';
import { MacroAreaMenu } from './components/MacroAreaMenu';
import { EsploraArchivio } from './components/EsploraArchivio';
import { RicercaArchivista } from './components/RicercaArchivista';
import { VetrinaModulistica } from './components/VetrinaModulistica';
import { ModuliProLockModal } from './components/ModuliProLockModal';
import { SavedModuli } from './components/SavedModuli';
import { TabDocumentiPersonali } from './components/TabDocumentiPersonali';
import { TeaserArchivistaModal } from './components/TeaserArchivistaModal';
import { ModuloPreview } from './creator/ModuloPreview';
import { ModuleCreatorErrorBoundary } from './creator/ModuleCreatorErrorBoundary';
import { registraDownloadGenerato } from './creator/cacheService';
import { useModulistica } from './hooks/useModulistica';

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
  const {
    anteprima, apriDocumento, apriGenerato, apriTab, caricamentoMiei, chiudiNotaAccesso, compattato,
    eseguiRicerca, filtro, gestisciRimozione, handleDownload, isSearching, macroArea, macroAreaId,
    notaAccesso, openAuthModal, proLockAperto, setAnteprima, setAreaSelezionata, setProLockAperto,
    setTeaserAperto, teaserAperto, user, vista, vociMiei,
  } = useModulistica();

  return (
    <div className={compattato ? 'space-y-3' : 'space-y-6'}>
      {/* Hero banner per gli utenti NON registrati: benvenuto + invito a
          esplorare. La dashboard (macroaree + ricerca) resta disponibile
          SUBITO qui sotto, senza schermate intermedie. */}
      {!user && <VetrinaModulistica />}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-400">
          Dipartimento Modulistica
        </p>
        <div className={compattato ? 'mt-1 flex flex-wrap items-center gap-1.5' : 'mt-1 flex flex-wrap items-center gap-2'}>
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
          setAreaSelezionata(area);
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

        {/* «I Miei Documenti»: spazio personale dell'utente (upload/drag & drop) */}
        {vista === 'documenti' && <TabDocumentiPersonali compatto={compattato} />}
      </div>

      {/* Modale teaser Archivista Capo (In arrivo a Ottobre per i PRO) */}
      <TeaserArchivistaModal open={teaserAperto} onClose={() => setTeaserAperto(false)} />

      {/* Modale "Moduli scaricati — Funzionalità PRO" (utenti Base) */}
      <ModuliProLockModal open={proLockAperto} onClose={() => setProLockAperto(false)} />

      {/* Anteprima di un documento generato (intervista o archivio).
          Boundary dedicato del SOTTO-MODULO CREATOR: un guasto del generatore/
          anteprima resta confinato a questa modale: l'archivio e gli altri
          dipartimenti restano perfettamente funzionanti. */}
      {anteprima && (
        <ModuleCreatorErrorBoundary>
          <ModuloPreview
            open
            onClose={() => setAnteprima(null)}
            modulo={anteprima.modulo}
            cache={anteprima.cache}
            onSalva={(m) => registraDownloadGenerato(m)}
          />
        </ModuleCreatorErrorBoundary>
      )}
    </div>
  );
}
