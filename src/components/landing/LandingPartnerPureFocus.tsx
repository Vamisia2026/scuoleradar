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
      {/* Stessa larghezza della bacheca centrale «Radar Live»: il box del partner
          è una vetrina alla pari delle altre sezioni della homepage. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PureFocusCard
          hasProAccess={hasProAccess}
          descrizione="PureFocus è incluso nel piano annuale. Entrate con le stesse credenziali di Scuole Radar!"
        />
      </div>
    </section>
  );
}
