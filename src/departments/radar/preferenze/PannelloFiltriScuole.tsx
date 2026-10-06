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
 * §26.67 — LA PROVINCIA È DI OGNI LISTA, non del pannello. Il selettore di
 * provincia sta DENTRO il campo (`CampoScuola`), sulla stessa riga del nome e del
 * pulsante «Aggiungi»: preferite ed escluse hanno ciascuna la propria provincia,
 * così scegliere una scuola non è più ambiguo (lo stesso istituto esiste in
 * province diverse) e le due liste non si scambiano né provincia né suggerimenti.
 * Sceglierla restringe i suggerimenti all'istante; senza scelta i suggerimenti
 * arrivano da tutte le proprie province e la riga lo dichiara SOLO se ci sono
 * omonimie da sciogliere (`omonimieScuole`) — niente più default «tutte le tue
 * province» su un selettore unico in cima al pannello.
 */
import { useState } from 'react';
import { AlertTriangle, Ban, Star } from 'lucide-react';
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
  /** Province offerte dal selettore DI OGNI CAMPO (una voce = una sigla). */
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
  /**
   * §26.67 — UNA PROVINCIA PER LISTA (`''` = nessuna scelta: tutte le proprie
   * province). Preferite ed escluse non condividono la scelta: chi cerca una
   * scuola da preferire e una da ignorare sta guardando due province diverse.
   */
  const [provinciaPreferite, setProvinciaPreferite] = useState('');
  const [provinciaEscluse, setProvinciaEscluse] = useState('');

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
            ? `I suggerimenti mostrano solo le scuole delle province da cercare (${provinceSeguite.join(', ')}). Scegli la provincia NEL CAMPO, accanto al nome, per non confondere istituti omonimi. Una scuola di un’altra provincia resta scrivibile, ma la forzatura viene dichiarata.`
            : 'Nessuna provincia selezionata: scegli le province in «Dove vuoi cercare?» per ricevere i suggerimenti delle scuole.'}
        </p>

        {/* §26.67 — Qui NON c'è più il selettore unico con il default «tutte le
            tue province»: la provincia è un comando di ciascun campo (sotto),
            sulla stessa riga del nome — una per lista. */}

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
                provincia={provinciaPreferite}
                onProvinciaChange={setProvinciaPreferite}
                provinceSuggerite={provinceSuggerite}
                verificaAmbito={verificaAmbito}
                colore="accent"
                etichettaProvincia="Provincia della scuola da preferire"
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
                provincia={provinciaEscluse}
                onProvinciaChange={setProvinciaEscluse}
                provinceSuggerite={provinceSuggerite}
                verificaAmbito={verificaAmbito}
                colore="secondary"
                etichettaProvincia="Provincia della scuola da ignorare"
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
