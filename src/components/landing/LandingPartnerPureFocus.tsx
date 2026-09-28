/**
 * Landing — fascia PARTNER (PureFocus, sponsor ufficiale).
 *
 * Vetrina PULITA: wordmark ufficiale del partner (nessuna emoji), badge verde
 * «INCLUSO NEL PIANO PRO», descrizione e link in evidenza a purefocus.one. Il
 * markup della card è condiviso con la pagina Prezzi e la pagina PureFocus
 * (`@/components/PureFocusCard`), così il coordinamento fra le superfici è
 * garantito da un'unica fonte.
 *
 * Presentazione pura: lo stato PRO arriva come prop.
 */
import { PureFocusCard } from '@/components/PureFocusCard';

export function LandingPartnerPureFocus({ hasProAccess }: { hasProAccess: boolean }) {
  return (
    <section className="bg-primary-50 py-10" aria-label="Partner ufficiale PureFocus">
      {/* Stessa larghezza delle colonne dei piani di prezzo: il box del partner
          non è più una fascia stretta ma una vetrina alla pari dell'offerta. */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <PureFocusCard hasProAccess={hasProAccess} />
      </div>
    </section>
  );
}
