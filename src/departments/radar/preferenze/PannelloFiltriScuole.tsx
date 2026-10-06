/**
 * Preferenze Radar — pannello «Filtri Avanzati Scuole».
 *
 * Due liste: scuole PREFERITE (badge «Scuola Preferita» + priorità) e scuole
 * ESCLUSE (gli avvisi vengono nascosti). Il campo resta a testo libero, ma i
 * suggerimenti arrivano SOLO dalle scuole delle province da cercare
 * (`scuoleConosciute`, già limitate e RIPULITE a monte: `scuolePresentabili`,
 * §26.59): un nome fuori da quell'ambito resta scrivibile, però la FORZATURA è
 * DICHIARATA — avviso sotto il campo e badge sulla pill (§26.62).
 *
 * §26.65 — DUE CAMPI DISTINTI. Accanto al campo scuola c'è un **selettore di
 * PROVINCIA**: scegliendo una provincia i suggerimenti si restringono
 * istantaneamente a quella (l'elenco resta quello delle proprie province +
 * 60 km). È il comportamento di un input di indirizzi: prima la provincia, poi —
 * digitando — la scuola. Ogni campo ha la sua tendina (`CampoScuola`), quindi le
 * due liste non si scambiano i suggerimenti.
 */
import { useState } from 'react';
import { AlertTriangle, Ban, ChevronDown, Star } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { Pill } from '@/components/Pill';
import type { AmbitoScolastico, ScuolaNota } from '@/lib/filtriScuole';
import type { ProvinciaSuggerita } from '@/lib/scuolePresentabili';
import { CampoScuola } from './components/CampoScuola';

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
  /** Suggerimenti del campo scuola: istituti PRESENTABILI delle province da cercare. */
  scuoleConosciute: ScuolaNota[];
  /** Province offerte dal selettore accanto al campo (una voce = una sigla). */
  provinceSuggerite: ProvinciaSuggerita[];
  /** Nomi leggibili delle province da cercare (proprie + entro 60 km). */
  provinceSeguite: string[];
  /** Ambito provinciale di un nome di scuola: `dentro`, `fuori` o `sconosciuta`. */
  verificaAmbito: (nome: string) => AmbitoScolastico;
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
  provinceSuggerite,
  provinceSeguite,
  verificaAmbito,
}: PannelloFiltriScuoleProps) {
  /** Provincia scelta per il campo scuola (`''` = tutte le proprie province). */
  const [provincia, setProvincia] = useState('');

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

        {/* §26.65 — DUE CAMPI DISTINTI: prima la PROVINCIA, poi la scuola.
            Il selettore restringe i suggerimenti del campo sotto; l'elenco delle
            scuole resta comunque quello delle proprie province + 60 km. */}
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-primary-700">Provincia</span>
          <div className="relative">
            <select
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              className="w-full appearance-none rounded-xl border border-primary-200 bg-white px-3 py-2.5 pr-9 text-sm text-primary-800 transition focus:border-primary-500"
            >
              <option value="">
                {provinceSuggerite.length > 0
                  ? `Tutte le tue province (${provinceSuggerite.length})`
                  : 'Tutte le tue province'}
              </option>
              {provinceSuggerite.map((p) => (
                <option key={p.codice} value={p.codice}>
                  {p.nome} ({p.codice})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
          </div>
        </label>
        <p className="mt-1.5 text-xs text-primary-400">
          Scegli la provincia per restringere i suggerimenti del campo scuola qui sotto.
        </p>

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
            <div className="mt-3">
              <CampoScuola
                placeholder="Nome della scuola da preferire"
                value={favoriteScuolaInput}
                onChange={setFavoriteScuolaInput}
                onAdd={addFavoriteScuola}
                scuoleConosciute={scuoleConosciute}
                provincia={provincia}
                verificaAmbito={verificaAmbito}
                colore="accent"
              />
            </div>
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
            <div className="mt-3">
              <CampoScuola
                placeholder="Nome della scuola da ignorare"
                value={ignoredScuolaInput}
                onChange={setIgnoredScuolaInput}
                onAdd={addIgnoredScuola}
                scuoleConosciute={scuoleConosciute}
                provincia={provincia}
                verificaAmbito={verificaAmbito}
                colore="secondary"
              />
            </div>
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
