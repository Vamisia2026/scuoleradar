/**
 * Dipartimento Admin · tab «Radar» — monitoraggio scuole e stato del servizio.
 *
 * Elenco scuole con ricerca, stato del Radar per scuola e interruttore di
 * attivazione (scrittura su Supabase tramite `adminService`). Componente
 * autosufficiente: nessuna prop, nessuna dipendenza dai fratelli.
 *
 * Le preferenze di ogni utente arrivano dal blocco CONDIVISO `PreferenzeUtente`
 * (`components/PreferenzeUtente.tsx`, variante `compatto`): la stessa resa della
 * scheda di dettaglio, con ordini di scuola, classi, materie e tag personalizzati
 * — nessun buco rispetto alla dashboard dell'utente.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Radar as RadarIcon, RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { AdminApiError, DEV, aggiornaUtente, caricaUtenti } from '../adminService';
import { StatoRadarBadge, btnAdmin, btnGhost, inputAdmin, nomeCognome } from '../adminUi';
import { PreferenzeUtente } from '../components/PreferenzeUtente';
import type { AdminUtente } from '../types';

export function TabRadar() {
  const { mostraToast } = useToast();
  const [utenti, setUtenti] = useState<AdminUtente[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [ricerca, setRicerca] = useState('');

  const carica = async (): Promise<void> => {
    setCaricamento(true);
    try {
      setUtenti(await caricaUtenti());
    } catch (err) {
      mostraToast('errore', err instanceof AdminApiError ? err.message : (err as Error).message);
    } finally {
      setCaricamento(false);
    }
  };
  useEffect(() => {
    void carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return utenti.filter((u) =>
      q ? `${u.email} ${u.nome ?? ''} ${u.cognome ?? ''}`.toLowerCase().includes(q) : true,
    );
  }, [utenti, ricerca]);

  const toggle = (u: AdminUtente): void => {
    const attuale = u.radar_attivo !== undefined ? Boolean(u.radar_attivo) : Boolean(u.onboarded);
    const nuovo = !attuale;
    // Se la colonna radar_attivo non esiste ancora nel DB mostriamo l'avviso.
    const colonnaAssente = u.radar_attivo === undefined && !DEV;
    if (colonnaAssente) {
      mostraToast('errore', 'Colonna radar_attivo non presente nel database: applica la migrazione admin.');
      return;
    }
    setUtenti((prev) => prev.map((x) => (x.id === u.id ? { ...x, radar_attivo: nuovo } : x)));
    void aggiornaUtente(u.id, { radar_attivo: nuovo }).then(() =>
      mostraToast('successo', `Radar ${nuovo ? 'attivato' : 'disattivato'} per ${u.email}.`),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-primary-800">Opportunità &amp; controllo Radar</h2>
        <div className="flex items-center gap-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary-300" />
            <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca utente…" className={`${inputAdmin} w-56 pl-8`} />
          </label>
          <button type="button" onClick={() => void carica()} className={`${btnAdmin} ${btnGhost}`}>
            <RefreshCw className="h-3.5 w-3.5" /> Ricarica
          </button>
        </div>
      </div>

      {caricamento ? (
        <div className="flex items-center justify-center gap-2 p-12 text-primary-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Caricamento…
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtrati.map((u) => {
            const attivo = u.radar_attivo !== undefined ? Boolean(u.radar_attivo) : Boolean(u.onboarded);
            return (
              <section key={u.id} className="rounded-2xl border border-primary-100 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-primary-800">{nomeCognome(u)}</p>
                    <p className="truncate text-xs text-primary-400">{u.email}</p>
                  </div>
                  <StatoRadarBadge attivo={attivo} />
                </div>

                {/* Preferenze COMPLETE (stesso blocco della scheda di dettaglio):
                    ordini di scuola, classi, materie, tag personalizzati, province e
                    scuole — nessun buco rispetto alla dashboard dell'utente. */}
                <PreferenzeUtente utente={u} variante="compatto" />

                <div className="mt-3 flex items-center gap-2 border-t border-primary-100 pt-3">
                  <button
                    type="button"
                    onClick={() => toggle(u)}
                    className={`${btnAdmin} px-3 ${attivo ? 'bg-accent-500 text-white hover:bg-accent-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    <RadarIcon className="h-3.5 w-3.5" />
                    {attivo ? 'Disattiva radar' : 'Attiva radar'}
                  </button>
                  <span className="text-[10px] text-primary-400">
                    Toggle istantaneo dello stato radar utente.
                  </span>
                </div>
              </section>
            );
          })}
          {filtrati.length === 0 && (
            <p className="col-span-full p-10 text-center text-sm text-primary-400">Nessun utente.</p>
          )}
        </div>
      )}
    </div>
  );
}
