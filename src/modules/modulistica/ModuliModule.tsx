import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/components/Toast';
import {
  conAggiuntaInCima,
  moduli,
  STORAGE_KEY_MODULI_SCARICATI,
  type Modulo,
  type ModuloScaricato,
} from '@/data/moduli';
import type { ModuloSalvatoDB, VistaModulistica, VoceModulo } from './types';
import { ModuliNavigation } from './components/ModuliNavigation';
import { ModuliCatalog } from './components/ModuliCatalog';
import { SavedModuli } from './components/SavedModuli';
import { ModuleCreatorEngine } from './creator/ModuleCreatorEngine';
import { ModuleCreatorErrorBoundary } from './creator/ModuleCreatorErrorBoundary';
import { ModuloPreview } from './creator/ModuloPreview';
import {
  caricaDocumentoGenerato,
  elencaDownload,
  registraDownloadCatalogo,
  registraDownloadGenerato,
  rimuoviDownload,
  type DocumentoGenerato,
} from './creator/cacheService';

/**
 * Modulo Modulistica — contenitore principale isolato.
 *
 * Struttura:
 *  - `components/` → archivio e navigazione (catalogo, lista salvati)
 *  - `creator/`    → creatore dinamico, protetto da un Error Boundary dedicato
 *                    così che un errore interno non faccia crollare la pagina
 *                    né gli altri servizi di ScuoleRadar.
 */
export function ModuliModule() {
  const { user, openVetrina } = useApp();
  const { mostraToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vista, setVista] = useState<VistaModulistica>(() => {
    const tab = searchParams.get('tab');
    return tab === 'miei' ? 'miei' : tab === 'genera' ? 'genera' : 'catalogo';
  });
  const [scaricato, setScaricato] = useState<string | null>(null);
  const [moduliScaricati, setModuliScaricati] = useLocalStorage<ModuloScaricato[]>(
    STORAGE_KEY_MODULI_SCARICATI,
    [],
  );
  /** Download registrati su user_saved_modules. */
  const [moduliDB, setModuliDB] = useState<ModuloSalvatoDB[]>([]);
  const [caricamentoMiei, setCaricamentoMiei] = useState(false);
  const [anteprima, setAnteprima] = useState<DocumentoGenerato | null>(null);

  const caricaMieiDB = useCallback(async () => {
    if (!user) {
      setModuliDB([]);
      return;
    }
    setCaricamentoMiei(true);
    const res = await elencaDownload();
    if (res.ok && res.moduli) setModuliDB(res.moduli);
    else if (res.errore !== 'NON_AUTENTICATO') console.warn('ModuliModule — elencaDownload:', res.errore);
    setCaricamentoMiei(false);
  }, [user]);

  // Ricarica i download registrati quando si apre la tab "I miei".
  useEffect(() => {
    if (vista === 'miei') void caricaMieiDB();
  }, [vista, caricaMieiDB]);

  /** Download dal catalogo: storico locale + persistenza su user_saved_modules. */
  const handleDownload = useCallback(
    (m: Pick<Modulo, 'id' | 'nome' | 'tipo'>) => {
      // Vetrina: i download sono riservati agli account registrati (Free o PRO).
      if (!user) {
        openVetrina('moduli');
        return;
      }
      setScaricato(m.nome);
      setModuliScaricati(conAggiuntaInCima(moduliScaricati, m));
      void registraDownloadCatalogo(m).then((res) => {
        if (res.ok) mostraToast('successo', 'Modulo salvato nei tuoi "Modelli Scaricati".');
      });
      alert(`Download simulato di "${m.nome}" (${m.tipo}).`);
    },
    [user, openVetrina, moduliScaricati, setModuliScaricati, mostraToast],
  );

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
      if (modulo) setAnteprima(modulo);
      else mostraToast('errore', 'Documento non trovato nell\u2019archivio (o servizio non configurato).');
    },
    [mostraToast],
  );

  const apriTab = (v: VistaModulistica) => {
    setVista(v);
    setSearchParams(v === 'catalogo' ? {} : { tab: v }, { replace: true });
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-primary-600" />
        <h2 className="text-2xl font-bold text-primary-800">
          Tutti i moduli che ti servono, senza cercarli ogni volta.
        </h2>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <p className="text-lg leading-relaxed text-primary-600">
          Qui trovi la modulistica per il tuo lavoro a scuola. Il servizio è gratis: devi solo
          registrarti, così teniamo in memoria i moduli che hai già scaricato, e quando ti serviranno
          di nuovo (o serviranno a un collega) saprai dove trovarli, senza perdere tempo a cercarli da
          capo.
        </p>
        {!user && (
          <button
            onClick={() => openVetrina('moduli')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
          >
            Registrati qui
          </button>
        )}

        {/* Navigazione archivio / creatore / salvati */}
        <ModuliNavigation vista={vista} onNaviga={apriTab} />

        {/* Creatore dinamico — isolato dall'Error Boundary dedicato */}
        {vista === 'genera' && (
          <ModuleCreatorErrorBoundary>
            <ModuleCreatorEngine />
          </ModuleCreatorErrorBoundary>
        )}

        {/* Archivio: catalogo */}
        {vista === 'catalogo' && <ModuliCatalog onScarica={handleDownload} scaricato={scaricato} />}

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

      {/* Anteprima di un documento generato aperto dalla tab "I miei Modelli" */}
      {anteprima && (
        <ModuloPreview
          open
          onClose={() => setAnteprima(null)}
          modulo={anteprima}
          cache
          onSalva={(m) => registraDownloadGenerato(m)}
        />
      )}
    </div>
  );
}
