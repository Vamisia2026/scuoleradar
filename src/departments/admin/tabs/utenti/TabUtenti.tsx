/**
 * Dipartimento Admin · tab «Utenti» — gestione completa degli account.
 *
 * Ricerca e filtri rapidi, tabella con colonne configurabili ed esportazione CSV,
 * modifica inline, reset password, creazione e cancellazione (con conferma
 * testuale), dettaglio utente. Stato e logica restano qui: i formattatori e il
 * dettaglio vivono nei moduli dedicati della cartella `utenti/`.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  DEV,
  caricaUtenti,
  aggiornaUtente,
  inviaResetPassword,
  creaUtente,
  eliminaUtente,
  AdminApiError,
  type NuovoUtenteInput,
} from '../../adminService';
import { ConfermaDialog, type ConfermaStato } from '../../adminUi';
import type { AdminUtente } from '../../types';
import { BarraFiltriUtenti } from './BarraFiltriUtenti';
import { DettaglioUtente } from './DettaglioUtente';
import { ModaleEliminazioneUtente } from './ModaleEliminazioneUtente';
import { ModaleNuovoUtente } from './ModaleNuovoUtente';
import { TabellaUtenti } from './TabellaUtenti';
import { COLONNE, filtraUtenti, testoCell, type IdColonna } from './utentiHelpers';

export function TabUtenti() {
  const { mostraToast } = useToast();
  const [utenti, setUtenti] = useState<AdminUtente[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [filtroPiano, setFiltroPiano] = useState('');
  const [filtroProvincia, setFiltroProvincia] = useState('');
  const [colonneMenu, setColonneMenu] = useState(false);
  const [colonne, setColonne] = useState<Set<IdColonna>>(() => new Set(COLONNE.filter((c) => c.def).map((c) => c.id)));
  const [conferma, setConferma] = useState<ConfermaStato | null>(null);
  const [dettaglio, setDettaglio] = useState<AdminUtente | null>(null);

  const carica = async (): Promise<void> => {
    setCaricamento(true);
    setErrore(null);
    try {
      setUtenti(await caricaUtenti());
    } catch (err) {
      const messaggio = err instanceof AdminApiError ? err.message : (err as Error).message;
      console.error('[admin] caricamento utenti fallito', err);
      setErrore(messaggio);
      mostraToast('errore', messaggio);
    } finally {
      setCaricamento(false);
    }
  };
  useEffect(() => {
    void carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrati = useMemo(
    () => filtraUtenti(utenti, ricerca, filtroPiano, filtroProvincia),
    [utenti, ricerca, filtroPiano, filtroProvincia],
  );

  const aggiornaRiga = (id: string, updates: Record<string, unknown>): void => {
    setUtenti((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
  };

  const salva = async (id: string, updates: Record<string, unknown>, messaggio: string): Promise<void> => {
    try {
      await aggiornaUtente(id, updates);
      aggiornaRiga(id, updates);
      mostraToast('successo', messaggio);
    } catch (err) {
      const msg = err instanceof AdminApiError ? err.message : (err as Error).message;
      mostraToast('errore', msg);
    }
  };

  const resetPassword = (u: AdminUtente): void => {
    setConferma({
      titolo: 'Invia reset password',
      messaggio: `Invieremo una email di recupero a ${u.email}. Continuare?`,
      onConferma: async () => {
        try {
          await inviaResetPassword(u.email);
          mostraToast('successo', `Reset password inviato a ${u.email}`);
        } catch (err) {
          const msg = err instanceof AdminApiError ? err.message : (err as Error).message;
          mostraToast('errore', msg);
        }
      },
    });
  };

  const toggleColonna = (c: IdColonna): void => {
    setColonne((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  // Aggiunta / eliminazione utenti (con conferma esplicita).
  const [nuovoAperto, setNuovoAperto] = useState(false);
  const [nuovo, setNuovo] = useState<NuovoUtenteInput>({
    email: '',
    password: 'Scuoleradar2026',
    nome: '',
    cognome: '',
    telefono: '',
    piano: 'base',
    isBetaTester: false,
  });
  const [creazione, setCreazione] = useState(false);
  const [eliminaTarget, setEliminaTarget] = useState<AdminUtente | null>(null);
  const [testoEliminazione, setTestoEliminazione] = useState('');

  const salvaNuovo = async (): Promise<void> => {
    const em = nuovo.email.trim().toLowerCase();
    if (!em || nuovo.password.length < 6) {
      mostraToast('errore', 'Servono una email valida e una password di almeno 6 caratteri.');
      return;
    }
    setCreazione(true);
    try {
      if (DEV) {
        // Demo locale: riga simulata (nessun account reale).
        const rigaDemo: AdminUtente = {
          id: `demo-${Date.now()}`,
          email: em,
          nome: nuovo.nome ?? '',
          cognome: nuovo.cognome ?? '',
          telefono: nuovo.telefono ?? '',
          piano: nuovo.piano ?? 'base',
          created_at: new Date().toISOString(),
          onboarded: true,
          province_interesse: [],
          classi_concorso: [],
          materie_id: [],
          telegram_chat_id: null,
          telegram_username: '',
          _demo: true,
        };
        setUtenti((prev) => [rigaDemo, ...prev]);
        mostraToast('successo', 'Utente aggiunto (modalità demo).');
      } else {
        await creaUtente(nuovo);
        mostraToast('successo', 'Utente creato con successo.');
        void carica();
      }
      setNuovoAperto(false);
    } catch (err) {
      const msg = err instanceof AdminApiError ? err.message : (err as Error).message;
      mostraToast('errore', msg);
    } finally {
      setCreazione(false);
    }
  };

  const richiediEliminazione = (u: AdminUtente): void => {
    setTestoEliminazione('');
    setEliminaTarget(u);
  };

  const confermaEliminazione = async (): Promise<void> => {
    if (!eliminaTarget) return;
    if (testoEliminazione.trim().toUpperCase() !== 'DELETE') {
      mostraToast('errore', 'Digita DELETE per confermare l\'eliminazione.');
      return;
    }
    setCreazione(true);
    try {
      if (DEV) {
        setUtenti((prev) => prev.filter((x) => x.id !== eliminaTarget.id));
        mostraToast('successo', 'Utente rimosso (modalità demo).');
      } else {
        await eliminaUtente(eliminaTarget.id);
        setUtenti((prev) => prev.filter((x) => x.id !== eliminaTarget.id));
        mostraToast('successo', 'Utente eliminato definitivamente.');
      }
      setEliminaTarget(null);
    } catch (err) {
      const msg = err instanceof AdminApiError ? err.message : (err as Error).message;
      mostraToast('errore', msg);
    } finally {
      setCreazione(false);
    }
  };

  const [modifica, setModifica] = useState<{ id: string; campo: string; valore: string } | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);

  const iniziaModifica = (u: AdminUtente, campo: string, valore: string): void => {
    setModifica({ id: u.id, campo, valore });
  };

  const proponiSalvataggio = (id: string, campo: string, valore: string): void => {
    const updates: Record<string, unknown> = {};
    if (campo === 'nome') updates.nome = valore.trim();
    if (campo === 'cognome') updates.cognome = valore.trim();
    if (campo === 'telegram') updates.telegram_username = valore.trim();
    if (campo === 'telefono') updates.telefono = valore.trim();
    if (campo === 'province') {
      const lista = valore.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      updates.province_interesse = lista;
      updates.province_attive = lista;
    }
    if (Object.keys(updates).length === 0) return;
    setConferma({
      titolo: 'Conferma modifica su database',
      messaggio: `Campo "${campo}" dell'utente ${id.slice(0, 8)}… sarà aggiornato: "${valore.trim() || '—'}". Procedere?`,
      onConferma: async () => {
        setSalvataggio(true);
        await salva(id, updates, `Campo "${campo}" aggiornato.`);
        setSalvataggio(false);
        setModifica(null);
      },
    });
  };

  const visibile = (c: IdColonna): boolean => colonne.has(c);

  return (
    <div>
      {/* Barra strumenti: filtri rapidi + esportazione */}
      <BarraFiltriUtenti
        carica={carica}
        ricerca={ricerca}
        setRicerca={setRicerca}
        filtroPiano={filtroPiano}
        setFiltroPiano={setFiltroPiano}
        filtroProvincia={filtroProvincia}
        setFiltroProvincia={setFiltroProvincia}
        filtrati={filtrati}
        setNuovoAperto={setNuovoAperto}
        colonneMenu={colonneMenu}
        setColonneMenu={setColonneMenu}
        toggleColonna={toggleColonna}
        visibile={visibile}
        mostraToast={mostraToast}
      />

      {caricamento ? (
        <div className="flex items-center justify-center gap-2 p-12 text-primary-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Caricamento utenti…
        </div>
      ) : errore ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-sm text-red-600">
          {errore}
        </div>
      ) : (
        <TabellaUtenti
          filtrati={filtrati}
          visibile={visibile}
          testoCell={testoCell}
          modifica={modifica}
          setModifica={setModifica}
          iniziaModifica={iniziaModifica}
          proponiSalvataggio={proponiSalvataggio}
          resetPassword={resetPassword}
          richiediEliminazione={richiediEliminazione}
          setDettaglio={setDettaglio}
        />
      )}

      {dettaglio && <DettaglioUtente utente={dettaglio} onChiudi={() => setDettaglio(null)} />}
      {nuovoAperto && (
        <ModaleNuovoUtente
          nuovo={nuovo}
          setNuovo={setNuovo}
          creazione={creazione}
          salvaNuovo={salvaNuovo}
          setNuovoAperto={setNuovoAperto}
        />
      )}

      {eliminaTarget && (
        <ModaleEliminazioneUtente
          setEliminaTarget={setEliminaTarget}
          testoEliminazione={testoEliminazione}
          setTestoEliminazione={setTestoEliminazione}
          creazione={creazione}
          confermaEliminazione={confermaEliminazione}
        />
      )}

      <ConfermaDialog
        stato={conferma}
        inCorso={salvataggio}
        onChiudi={() => {
          if (!salvataggio) setConferma(null);
        }}
      />
    </div>
  );
}
