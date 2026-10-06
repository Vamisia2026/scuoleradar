/**
 * Preferenze Radar — pannello «Filtri Avanzati Scuole».
 *
 * Due liste: scuole PREFERITE (badge «Scuola Preferita» + priorità) e scuole
 * ESCLUSE (gli avvisi vengono nascosti). Il campo resta a testo libero, ma i
 * suggerimenti arrivano SOLO dalle scuole delle province da cercare
 * (`scuoleConosciute`, già limitate a monte): un nome fuori da quell'ambito resta
 * scrivibile, però la FORZATURA è DICHIARATA — avviso sotto il campo e badge
 * sulla pill (§26.62).
 */
import { AlertTriangle, Ban, Check, Info, Plus, Star } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { Pill } from '@/components/Pill';
import { messaggioAmbitoScuola, type AmbitoScolastico, type ScuolaNota } from '@/lib/filtriScuole';

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
  /** Suggerimenti (datalist): le scuole delle province da cercare, con provincia. */
  scuoleConosciute: ScuolaNota[];
  /** Nomi leggibili delle province da cercare (proprie + entro 60 km). */
  provinceSeguite: string[];
  /** Ambito provinciale di un nome di scuola: `dentro`, `fuori` o `sconosciuta`. */
  verificaAmbito: (nome: string) => AmbitoScolastico;
}

/**
 * Avviso dell'ambito provinciale sotto il campo: resta muto finché non c'è
 * qualcosa di scritto, così il pannello non parla a vuoto.
 */
function NotaAmbito({ nome, ambito }: { nome: string; ambito: AmbitoScolastico }) {
  if (!nome.trim()) return null;
  const fuori = ambito.stato === 'fuori';
  const Icona = fuori ? AlertTriangle : ambito.stato === 'dentro' ? Check : Info;
  return (
    <p
      role="status"
      className={`mt-2 flex items-start gap-1.5 text-xs ${fuori ? 'text-warning-700' : 'text-primary-400'}`}
    >
      <Icona className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{messaggioAmbitoScuola(ambito)}</span>
    </p>
  );
}

/** Badge della pill: una scuola forzata dichiara da dove arriva. */
function BadgeForzatura({ provincia }: { provincia?: string }) {
  return (
    <span
      title={`Scuola fuori dalle province da cercare${provincia ? ` (${provincia})` : ''}: forzatura dichiarata.`}
      className="inline-flex items-center gap-1 rounded-full border border-warning-500/40 bg-warning-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700"
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      Fuori ambito{provincia ? ` · ${provincia}` : ''}
    </span>
  );
}

/** Pill + badge di forzatura: una sola resa per entrambe le liste. */
function PillScuola({
  nome,
  color,
  onRemove,
  ambito,
}: {
  nome: string;
  color: 'accent' | 'secondary';
  onRemove: () => void;
  ambito: AmbitoScolastico;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Pill label={nome} onRemove={onRemove} color={color} />
      {ambito.stato === 'fuori' && <BadgeForzatura provincia={ambito.provincia} />}
    </span>
  );
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
  provinceSeguite,
  verificaAmbito,
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
        <p data-ambito-scuole className="mt-2 text-xs leading-relaxed text-primary-400">
          {provinceSeguite.length > 0
            ? `I suggerimenti mostrano solo le scuole delle province da cercare (${provinceSeguite.join(', ')}). Una scuola di un’altra provincia resta scrivibile, ma la forzatura viene dichiarata.`
            : 'Nessuna provincia selezionata: scegli le province in «Dove vuoi cercare?» per ricevere i suggerimenti delle scuole.'}
        </p>

        {/* Il valore salvato resta il NOME della scuola: la provincia è solo
            l'etichetta del suggerimento (`label`), così le liste restano confrontabili. */}
        <datalist id="scuole-conosciute">
          {scuoleConosciute.map((s) => (
            <option key={`${s.nome}|${s.provinciaCodice}`} value={s.nome} label={s.provinciaCodice} />
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
                placeholder="Nome della scuola da preferire"
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
            <NotaAmbito nome={favoriteScuolaInput} ambito={verificaAmbito(favoriteScuolaInput)} />
            {favoriteSchools.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {favoriteSchools.map((s) => (
                  <PillScuola
                    key={s}
                    nome={s}
                    color="accent"
                    onRemove={() => removeFavoriteScuola(s)}
                    ambito={verificaAmbito(s)}
                  />
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
                placeholder="Nome della scuola da ignorare"
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
            <NotaAmbito nome={ignoredScuolaInput} ambito={verificaAmbito(ignoredScuolaInput)} />
            {ignoredSchools.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {ignoredSchools.map((s) => (
                  <PillScuola
                    key={s}
                    nome={s}
                    color="secondary"
                    onRemove={() => removeIgnoredScuola(s)}
                    ambito={verificaAmbito(s)}
                  />
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
