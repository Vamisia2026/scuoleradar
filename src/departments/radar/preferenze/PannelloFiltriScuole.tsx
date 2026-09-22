/**
 * Preferenze Radar — pannello «Filtri Avanzati Scuole».
 *
 * Due liste: scuole PREFERITE (badge «Scuola Preferita» + priorità) e scuole
 * ESCLUSE (gli avvisi vengono nascosti). Il campo resta a testo libero, con i
 * suggerimenti presi dal feed reale dell'utente (`scuoleConosciute`).
 */
import { Ban, Plus, Star } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { Pill } from '@/components/Pill';

interface PannelloFiltriScuoleProps {
  /** Mappa di apertura degli accordion (chiave → stato). */
  accordionAperti: Record<string, boolean>;
  /** Apre/chiude un accordion per chiave. */
  toggleAccordion: (chiave: string) => void;
  /** Whitelist: scuole preferite. */
  favoriteSchools: string[];
  favoriteScuolaInput: string;
  setFavoriteScuolaInput: (valore: string) => void;
  addFavoriteScuola: () => void;
  removeFavoriteScuola: (scuola: string) => void;
  /** Blacklist: scuole da ignorare. */
  ignoredSchools: string[];
  ignoredScuolaInput: string;
  setIgnoredScuolaInput: (valore: string) => void;
  addIgnoredScuola: () => void;
  removeIgnoredScuola: (scuola: string) => void;
  /** Suggerimenti (datalist) dalle scuole presenti nel feed dell'utente. */
  scuoleConosciute: string[];
}

export function PannelloFiltriScuole({
  accordionAperti,
  toggleAccordion,
  favoriteSchools,
  favoriteScuolaInput,
  setFavoriteScuolaInput,
  addFavoriteScuola,
  removeFavoriteScuola,
  ignoredSchools,
  ignoredScuolaInput,
  setIgnoredScuolaInput,
  addIgnoredScuola,
  removeIgnoredScuola,
  scuoleConosciute,
}: PannelloFiltriScuoleProps) {
  return (
      <Accordion
        icona="🏫"
        titolo="Filtri Avanzati Scuole"
        badge={
          favoriteSchools.length + ignoredSchools.length
            ? `${favoriteSchools.length + ignoredSchools.length} scuole`
            : undefined
        }
        aperto={!!accordionAperti.filtri}
        onToggle={() => toggleAccordion('filtri')}
      >
        <p className="text-sm text-primary-500">
          Tieni d&apos;occhio le scuole che ti interessano (priorità) e nascondi quelle che non vuoi
          più vedere.
        </p>

        <datalist id="scuole-conosciute">
          {scuoleConosciute.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div className="mt-4 space-y-4">
          {/* Preferite (whitelist) */}
          <div className="rounded-xl border border-accent-200 bg-accent-50/50 p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-accent-800">
              <Star className="h-4 w-4 text-accent-500" />
              Scuole preferite (Notifiche Prioritarie)
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-accent-700">
              Hai una scuola che vuoi tenere d&apos;occhio? Aggiungila per ricevere le sue pubblicazioni
              anche se non c&apos;è un match perfetto col profilo.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={favoriteScuolaInput}
                onChange={(e) => setFavoriteScuolaInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFavoriteScuola()}
                placeholder="Es. Media Jona Asti, ITIS Artom Asti"
                list="scuole-conosciute"
                className="input"
              />
              <button
                onClick={addFavoriteScuola}
                disabled={!favoriteScuolaInput.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-600 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Aggiungi
              </button>
            </div>
            {favoriteSchools.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {favoriteSchools.map((s) => (
                  <Pill key={s} label={s} onRemove={() => removeFavoriteScuola(s)} color="accent" />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-primary-400">Nessuna scuola preferita.</p>
            )}
          </div>

          {/* Escluse (blacklist) */}
          <div className="rounded-xl border border-secondary-200 bg-secondary-50/50 p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-secondary-800">
              <Ban className="h-4 w-4 text-secondary-500" />
              Scuole escluse (Blacklist)
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-secondary-700">
              C&apos;è una scuola che non vuoi più vedere? Mettila in blacklist: smetteremo di segnalartela.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={ignoredScuolaInput}
                onChange={(e) => setIgnoredScuolaInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addIgnoredScuola()}
                placeholder="Es. IC Castell'Alfero, IC Incisa Scapaccino"
                list="scuole-conosciute"
                className="input"
              />
              <button
                onClick={addIgnoredScuola}
                disabled={!ignoredScuolaInput.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Aggiungi
              </button>
            </div>
            {ignoredSchools.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {ignoredSchools.map((s) => (
                  <Pill key={s} label={s} onRemove={() => removeIgnoredScuola(s)} color="secondary" />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-primary-400">Nessuna scuola esclusa.</p>
            )}
          </div>
        </div>
      </Accordion>
  );
}
