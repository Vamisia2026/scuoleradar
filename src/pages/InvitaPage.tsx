import { Gift } from 'lucide-react';
import { ReferralSection } from '@/components/profile/ReferralSection';

/** Tab dedicata "Invita un Collega" & Affiliazione (referral). */
export function InvitaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary-800">
          <Gift className="h-5 w-5 text-secondary-500" />
          Invita un Collega
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-primary-600">
          Condividi il tuo codice personale: ogni collega che si abbonerà al piano PRO riceve 10€ di
          sconto e tu guadagni 10€ di ricompensa. Nessun limite, nessun dato personale degli invitati
          condiviso.
        </p>
      </div>

      <ReferralSection />
    </div>
  );
}
