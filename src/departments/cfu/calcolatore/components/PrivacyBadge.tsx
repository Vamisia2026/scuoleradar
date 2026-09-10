import { ShieldCheck } from 'lucide-react';
import { PRIVACY_PROMESSA_CFU } from '../../shared/privacy';

/**
 * Badge privacy esposto nell'area documenti (Step B):
 * promessa pulita e diretta — nessun salvataggio, calcolo in tempo reale.
 */
export function PrivacyBadge() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-2xl border border-accent-200 bg-accent-50/70 px-4 py-3"
    >
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
        <ShieldCheck className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium leading-relaxed text-accent-900 sm:text-base">
        {PRIVACY_PROMESSA_CFU}
      </p>
    </div>
  );
}
