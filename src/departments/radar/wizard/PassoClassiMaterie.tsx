/**
 * Wizard Radar — PASSO 3 «Per quali insegnamenti sei abilitato?» — COMPOSITORE.
 *
 * Layout a PROVA DI SCROLL (desktop): un solo campo di RICERCA UNIFICATA in cima
 * (classi di concorso + competenze + parole chiave) e sotto DUE colonne affiancate
 * — classi a sinistra, competenze a destra — così l'intero passo rientra nel
 * viewport senza barre di scorrimento della modale.
 *
 * Stato, validazione e persistenza vivono nel contenitore (`RadarWizardModal`);
 * i contratti delle selezioni sono in `./tipiSelezione` (ri-esportati).
 */
import type { PianoLimits } from '@/lib/planLimits';
import { RicercaSelezioni } from '../components/RicercaSelezioni';
import type { RicercaSelezioniStato, SelezioneClassi, SelezioneMaterie } from './tipiSelezione';
import { SezioneClassiConcorso } from './components/SezioneClassiConcorso';
import { SezioneCompetenzeExtra } from './components/SezioneCompetenzeExtra';

export type { RicercaSelezioniStato, SelezioneClassi, SelezioneMaterie };

interface PassoClassiMaterieProps {
  selezioneClassi: SelezioneClassi;
  selezioneMaterie: SelezioneMaterie;
  /** Ricerca unificata: un solo campo per entrambe le colonne. */
  ricerca: RicercaSelezioniStato;
  limitiPiano: PianoLimits;
}

export function PassoClassiMaterie({
  selezioneClassi,
  selezioneMaterie,
  ricerca,
  limitiPiano,
}: PassoClassiMaterieProps) {
  return (
    <div className="animate-fade-in">
      <h2 className="text-base font-bold text-primary-800">
        Per quali insegnamenti sei abilitato o qualificato?
      </h2>

      <div className="mt-2">
        <RicercaSelezioni
          query={ricerca.query}
          setQuery={ricerca.setQuery}
          gruppi={ricerca.gruppi}
          onScegli={ricerca.onScegli}
          onParolaChiave={ricerca.onParolaChiave}
          helper="Un solo campo per tutto: digita il codice (A-18), la materia (Filosofia) o una competenza (robotica, stop motion)."
        />
      </div>

      <div className="mt-2.5 grid gap-2.5 md:grid-cols-2 md:items-start">
        <SezioneClassiConcorso
          selezione={selezioneClassi}
          limitiPiano={limitiPiano}
          ricercaAttiva={ricerca.query.trim().length > 0}
        />
        <SezioneCompetenzeExtra selezione={selezioneMaterie} />
      </div>
    </div>
  );
}
