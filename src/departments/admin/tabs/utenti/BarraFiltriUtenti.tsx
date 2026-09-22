/**
 * Dipartimento Admin · tab Utenti — barra strumenti (filtri + azioni).
 *
 * Contiene: ricerca libera, filtro piano, filtro provincia, ricarica elenco,
 * esportazione CSV, menu di configurazione delle colonne, CTA «Aggiungi utente»
 * e la nota di modalità sviluppo. Presentazione pura: stato e dati arrivano dal
 * contenitore `TabUtenti`.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Copy, Download, Eye, RefreshCw, Search, UserPlus } from 'lucide-react';
import { DEV } from '../../adminService';
import { btnAdmin, btnGhost, btnPrim, inputAdmin } from '../../adminUi';
import type { AdminUtente } from '../../types';
import { COLONNE, scaricaCsv, type IdColonna } from './utentiHelpers';

interface BarraFiltriUtentiProps {
  /** Ricarica l'elenco dal backend. */
  carica: () => Promise<void>;
  /** Ricerca libera su nome/email/scuola. */
  ricerca: string;
  setRicerca: (valore: string) => void;
  /** Filtro rapido per piano ('' = tutti). */
  filtroPiano: string;
  setFiltroPiano: (valore: string) => void;
  /** Filtro rapido per sigla provincia ('' = tutte). */
  filtroProvincia: string;
  setFiltroProvincia: (valore: string) => void;
  /** Righe attualmente filtrate (per l'export CSV). */
  filtrati: AdminUtente[];
  /** Apre la modale di creazione account. */
  setNuovoAperto: (aperto: boolean) => void;
  /** Menu di scelta delle colonne: aperto/chiuso. */
  colonneMenu: boolean;
  setColonneMenu: Dispatch<SetStateAction<boolean>>;
  /** Alterna la visibilità di una colonna. */
  toggleColonna: (colonna: IdColonna) => void;
  /** true se la colonna è visibile nell'elenco. */
  visibile: (colonna: IdColonna) => boolean;
  /** Notifiche all'utente (esito export). */
  mostraToast: (tipo: 'successo' | 'errore', messaggio: string) => void;
}

export function BarraFiltriUtenti({
  carica,
  ricerca,
  setRicerca,
  filtroPiano,
  setFiltroPiano,
  filtroProvincia,
  setFiltroProvincia,
  filtrati,
  setNuovoAperto,
  colonneMenu,
  setColonneMenu,
  toggleColonna,
  visibile,
  mostraToast,
}: BarraFiltriUtentiProps) {
  return (
    <>
      {/* Barra strumenti: filtri rapidi + esportazione */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary-300" />
          <input
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca per nome, email o ID…"
            className={`${inputAdmin} w-64 pl-8`}
          />
        </label>
        <select value={filtroPiano} onChange={(e) => setFiltroPiano(e.target.value)} className={`${inputAdmin} w-36`}>
          <option value="">Tutti i piani</option>
          <option value="base">Base</option>
          <option value="pro">PRO</option>
          <option value="free_forever">Free Forever</option>
        </select>
        <input
          value={filtroProvincia}
          onChange={(e) => setFiltroProvincia(e.target.value)}
          placeholder="Provincia (es. AT)"
          className={`${inputAdmin} w-32`}
        />
        <button type="button" onClick={() => { void carica(); }} className={`${btnAdmin} ${btnGhost}`}>
          <RefreshCw className="h-3.5 w-3.5" /> Ricarica
        </button>
        <button type="button" onClick={() => setNuovoAperto(true)} className={`${btnAdmin} ${btnPrim}`}>
          <UserPlus className="h-3.5 w-3.5" /> Aggiungi Utente
        </button>

        <div className="relative ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setColonneMenu((v) => !v)}
            className={`${btnAdmin} ${btnGhost}`}
          >
            <Eye className="h-3.5 w-3.5" /> Colonne
          </button>
          {colonneMenu && (
            <div className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-primary-100 bg-white p-2 shadow-card">
              {COLONNE.filter((c) => c.id !== 'azioni').map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-primary-700 hover:bg-primary-50">
                  <input type="checkbox" checked={visibile(c.id)} onChange={() => toggleColonna(c.id)} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              scaricaCsv(filtrati);
              mostraToast('successo', 'CSV esportato.');
            }}
            className={`${btnAdmin} ${btnGhost}`}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(
                  ['id;email;nome;cognome;piano;province;telegram',
                    ...filtrati.map((u) => [u.id, u.email, u.nome ?? '', u.cognome ?? '', u.piano ?? 'base', (u.province_interesse ?? u.province_attive ?? []).join('|'), u.telegram_chat_id ?? ''].join(';'))].join('\n'),
                )
                .then(() => mostraToast('successo', 'Dati copiati per Google Sheets.'));
            }}
            className={`${btnAdmin} ${btnGhost}`}
          >
            <Copy className="h-3.5 w-3.5" /> Google Sheets
          </button>
        </div>
      </div>

      {/* Nota demo / sviluppo */}
      {DEV && (
        <p className="mb-2 rounded-lg bg-warning-50 px-3 py-2 text-[11px] text-warning-700">
          Modalità sviluppo: senza sessione Supabase vengono mostrati dati demo e le modifiche non vengono
          scritte sul database (il pannello completo richiede il login reale).
        </p>
      )}
    </>
  );
}
