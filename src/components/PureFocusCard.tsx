/**
 * PureFocus — wordmark e vetrina ufficiali (partner/sponsor di ScuoleRadar).
 *
 * Il marchio è TIPOGRAFICO e va reso esattamente com'è: «Pure» in nero #0E0C0A,
 * «Focus» in blu cobalto #0047AB, senza spazi, font sans-serif nero (black) —
 * nessuna icona estranea (la vecchia emoji della figura in posizione yoga non è
 * il marchio di PureFocus).
 *
 * `PureFocusWordmark` è la primitiva (riusabile dove serve solo il nome);
 * `PureFocusCard` è la vetrina pulita condivisa da homepage, pagina Prezzi e
 * pagina PureFocus: badge verde «INCLUSO NEL PIANO PRO», descrizione e link in
 * evidenza a purefocus.one.
 */
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Colori ufficiali del wordmark (specifica del partner). */
const NERO = '#0E0C0A';
const BLU_COBALTO = '#0047AB';

interface PureFocusWordmarkProps {
  /** Taglia e spaziatura tipografica (il colore è SEMPRE quello ufficiale). */
  className?: string;
}

/** Wordmark ufficiale: «Pure» nero + «Focus» blu cobalto, senza spazi. */
export function PureFocusWordmark({ className = 'text-2xl' }: PureFocusWordmarkProps) {
  return (
    <span
      className={`inline-flex items-baseline font-sans font-black leading-none tracking-tight ${className}`}
      aria-label="PureFocus"
    >
      <span style={{ color: NERO }} aria-hidden="true">
        Pure
      </span>
      <span style={{ color: BLU_COBALTO }} aria-hidden="true">
        Focus
      </span>
    </span>
  );
}

/** Badge verde di stato: il partner è compreso nel piano PRO. */
export function BadgeInclusoPro() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-accent-700 ring-1 ring-inset ring-accent-300">
      <Sparkles className="h-3 w-3" />
      Incluso nel piano PRO
    </span>
  );
}

interface PureFocusCardProps {
  /** true se l'utente ha il piano PRO attivo (o Free Forever). */
  hasProAccess: boolean;
  /** Titolo di contesto sopra la descrizione. */
  titolo?: string;
  /** Mostra la CTA «Passa a PRO» quando il piano non è attivo. */
  mostraUpsell?: boolean;
}

/** Vetrina PureFocus pulita e coordinata fra le superfici pubbliche. */
export function PureFocusCard({
  hasProAccess,
  titolo = 'Studio e lavoro su YouTube senza distrazioni',
  mostraUpsell = true,
}: PureFocusCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary-100 bg-primary-50/60 px-5 py-2.5">
        <BadgeInclusoPro />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500">
          Sponsor ufficiale
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <PureFocusWordmark className="text-2xl sm:text-3xl" />
        <h3 className="mt-2 text-base font-bold text-primary-800">{titolo}</h3>
        <p className="mt-1.5 leading-relaxed text-primary-600">
          La piattaforma che trasforma YouTube in un ambiente di studio e lavoro: elimina
          distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve per
          ottimizzare il tuo tempo.
        </p>

        <a
          href="https://purefocus.one"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-base font-bold text-[#0047AB] underline decoration-2 underline-offset-4 transition hover:text-[#00368a]"
        >
          purefocus.one ↗
        </a>

        {hasProAccess ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-50 px-4 py-3">
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-accent-800">
              PureFocus è già incluso nel tuo piano (mensile, annuale o Free Forever): entra e inizia
              subito, senza costi aggiuntivi.
            </p>
            <a
              href="https://purefocus.one"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-primary-600"
            >
              ACCEDI A PUREFOCUS ↗
            </a>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-50 px-4 py-3">
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-primary-600">
              PureFocus costa 29 $/anno ed è{' '}
              <strong className="text-primary-800">incluso nell&apos;offerta PRO</strong> di
              ScuoleRadar: con il piano PRO attivo non paghi nulla in più.
            </p>
            {mostraUpsell && (
              <Link
                to="/prezzi"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"
              >
                Passa a PRO
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
