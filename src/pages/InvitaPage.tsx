import { Gift } from 'lucide-react';
import { ReferralSection } from '@/components/profile/ReferralSection';

/**
 * Tab "Invita un Collega" & Affiliazione — ANTEPRIMA (IN ARRIVO A NOVEMBRE).
 *
 * Ribbon diagonale "IN ARRIVO A NOVEMBRE" sopra il corpo della pagina e
 * interfaccia sottostante semi-trasparente e NON interattiva (opacity +
 * pointer-events-none): l'utente può solo ANTEPRIMARE il layout, senza
 * toccare i controlli bloccati. A Novembre basterà rimuovere ribbon e
 * overlay disabilitante per riattivare il modulo.
 */
export function InvitaPage() {
  return (
    <div className="relative space-y-6 overflow-hidden">
      {/* Ribbon "IN ARRIVO A NOVEMBRE" — banda diagonale in cima al corpo */}
      <div className="pointer-events-none absolute inset-x-0 -top-1 z-20 -rotate-2">
        <div className="mx-auto max-w-3xl rounded-b-2xl bg-secondary-500 px-6 py-2.5 text-center shadow-soft ring-1 ring-white/40">
          <span className="text-sm font-extrabold uppercase tracking-[0.25em] text-white">
            IN ARRIVO A NOVEMBRE
          </span>
        </div>
      </div>

      {/* Anteprima disabilitata del layout sottostante */}
      <div className="pointer-events-none select-none space-y-6 opacity-40">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-primary-800">
              <Gift className="h-5 w-5 text-secondary-500" />
              Invita un Collega
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-primary-600">
            Condividi il tuo codice promo: ogni collega che si abbonerà al piano PRO riceve 10€ di
            sconto e tu guadagni 10€ di ricompensa. Nessun limite, nessun dato personale degli
            invitati condiviso.
          </p>
        </div>

        <ReferralSection />
      </div>
    </div>
  );
}
