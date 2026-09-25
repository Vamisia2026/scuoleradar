/**
 * Header — menu utente (chip profilo + tendina) per la top bar desktop.
 *
 * Raccoglie: avatar, nome, badge del piano, freccia di apertura e la tendina con
 * profilo, Radar, «I Miei Documenti», upgrade PRO, prezzi e uscita.
 * Stato di apertura e azioni arrivano dal contenitore: nessun accesso a `useApp()`.
 * «I Miei Documenti» è lo spazio personale dell'utente: porta alla terza tab della
 * Modulistica (`/dashboard/moduli?tab=documenti`) e, se quel dipartimento è spento
 * (FEATURE FLAGS), ricade sulla sezione Documenti del profilo: mai un link morto.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  CreditCard,
  FileText,
  LogOut,
  Radar,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import type { User } from '@/contexts/AppContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { BadgePianoCompatto } from './BadgePianoCompatto';
import type { PianoUtente, StatoPiano } from './tipiUtente';

interface MenuUtenteProps {
  /** Utente autenticato (il contenitore monta questo menu solo se presente). */
  user: User;
  /** Avatar da OAuth, oppure null → si mostra l'icona utente. */
  avatarUrl: string | null;
  /** true con abbonamento PRO attivo (o piano PRO in prova). */
  abbonato: boolean;
  piano: PianoUtente;
  /** 'loading' finché il piano non è confermato dal DB. */
  pianoStato: StatoPiano;
  /** Numero di documenti dell'archivio moduli (badge di «I Miei Documenti»). */
  moduliScaricati: number;
  /** Tendina aperta/chiusa. */
  menuUtenteOpen: boolean;
  /** Cambia lo stato della tendina (toggle da avatar e da freccia). */
  setMenuUtenteOpen: Dispatch<SetStateAction<boolean>>;
  /** Chiude la tendina (click su overlay o su una voce). */
  chiudiMenuUtente: () => void;
  /** Esce dall'account. */
  logout: () => void;
}

export function MenuUtente({
  user,
  avatarUrl,
  abbonato,
  piano,
  pianoStato,
  moduliScaricati,
  menuUtenteOpen,
  setMenuUtenteOpen,
  chiudiMenuUtente,
  logout,
}: MenuUtenteProps) {
  // Feature flags: le voci di un dipartimento chiuso spariscono dal menu utente.
  const { visibile } = useFeatureFlags();
  // Etichetta del piano: la fonte è `piano`, letto dal DB (`profiles.piano`).
  // `abbonato` (rinnovo/pagamento attivo) resta come rete per gli stati locali e
  // NON può mai far leggere «Piano Base» a un PRO concesso dal backend.
  const ePianoPro = piano === 'pro' || abbonato;
  return (
            <div className="relative hidden md:block">
              <div className="flex items-center gap-0.5 rounded-full border border-primary-200 bg-white py-1 pl-1 pr-1 shadow-soft">
                {/* Foto profilo cliccabile → apre/chiude il menu utente (come la freccia) */}
                <button
                  type="button"
                  onClick={() => setMenuUtenteOpen((o) => !o)}
                  aria-expanded={menuUtenteOpen}
                  aria-label="Apri il menu del profilo"
                  className="shrink-0 rounded-full transition hover:opacity-90"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user.nome}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
                      <UserIcon className="h-4 w-4" />
                    </span>
                  )}
                </button>
                <Link
                  to="/dashboard/radar"
                  aria-label="Torna al Radar Scuole"
                  className="flex items-center gap-2 rounded-full pr-2 transition hover:opacity-90"
                >
                  <span className="max-w-[60px] truncate text-sm font-semibold text-primary-800 lg:max-w-[110px]">
                    {user.nome}
                  </span>
                  <BadgePianoCompatto pianoStato={pianoStato} piano={piano} abbonato={abbonato} />
                </Link>
                <button
                  onClick={() => setMenuUtenteOpen((o) => !o)}
                  aria-expanded={menuUtenteOpen}
                  aria-label="Menu utente"
                  className="inline-flex h-8 w-6 items-center justify-center rounded-full text-primary-400 transition hover:bg-primary-50"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${menuUtenteOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>

              {menuUtenteOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={chiudiMenuUtente} />
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card"
                  >
                    <div className="flex items-center gap-3 border-b border-primary-100 bg-primary-50/60 px-4 py-3">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={user.nome}
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
                          <UserIcon className="h-5 w-5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-primary-800">
                          {user.nome} {user.cognome}
                        </p>
                        <p className="truncate text-xs text-primary-500">{user.email}</p>
                        <span
                          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            ePianoPro ? 'bg-accent-500 text-white' : 'bg-primary-50 text-primary-600'
                          }`}
                        >
                          {ePianoPro ? (
                            <>
                              <Sparkles className="h-3 w-3" /> Piano PRO
                            </>
                          ) : (
                            'Piano Base'
                          )}
                        </span>
                      </div>
                    </div>
                    <nav className="p-1.5">
                      <Link
                        to="/dashboard/profilo"
                        onClick={chiudiMenuUtente}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                      >
                        <UserIcon className="h-4 w-4 text-primary-400" />
                        Il mio profilo
                      </Link>
                      <Link
                        to="/dashboard/radar"
                        onClick={chiudiMenuUtente}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                      >
                        <Radar className="h-4 w-4 text-primary-400" />
                        Il mio Radar
                      </Link>
                      {/* «I Miei Documenti»: spazio personale dell'utente. Con la
                          Modulistica attiva apre la sua terza tab; altrimenti ricade
                          sulla sezione Documenti del profilo (mai un link morto).
                          Il badge conta i moduli ufficiali, solo con Modulistica attiva. */}
                      <Link
                        to={
                          visibile('modulistica')
                            ? '/dashboard/moduli?tab=documenti'
                            : '/dashboard/profilo?sezione=documenti'
                        }
                        onClick={chiudiMenuUtente}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                      >
                        <FileText className="h-4 w-4 text-primary-400" />
                        I Miei Documenti
                        {visibile('modulistica') && moduliScaricati > 0 && (
                          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-50 px-1.5 text-[11px] font-bold text-primary-600">
                            {moduliScaricati}
                          </span>
                        )}
                      </Link>
                      {!ePianoPro && (
                        <Link
                          to="/prezzi"
                          onClick={chiudiMenuUtente}
                          className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-secondary-500 px-3 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"
                        >
                          <Sparkles className="h-4 w-4" />
                          PASSA A PRO
                        </Link>
                      )}
                      <Link
                        to="/prezzi"
                        onClick={chiudiMenuUtente}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                      >
                        <CreditCard className="h-4 w-4 text-primary-400" />
                        Prezzi e abbonamento
                      </Link>
                      <button
                        onClick={logout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-error-600 transition hover:bg-error-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Esci
                      </button>
                    </nav>
                  </div>
                </>
              )}
            </div>
  );
}
