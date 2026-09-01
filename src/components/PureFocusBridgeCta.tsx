import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Loader2, Lock } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { generatePureFocusBridgeUrl } from '@/lib/purefocus-bridge';
import { ottieniStatoPro } from '@/lib/auth-bridge';

/**
 * Account Bridge — CTA "PureFocus PRO" (dashboard ScuoleRadar).
 * - Utenti PRO (annuale/mensile): genera il token firmato e apre
 *   `https://purefocus.app/auth/bridge?token=...` con `is_pro: true`.
 * - Utenti Base: invito a passare al PRO (PureFocus incluso nel PRO).
 * - Se il bridge non è configurato, ripiega sulla pagina PureFocus interna.
 */
export function PureFocusBridgeCta() {
  const { user, abbonato } = useApp();
  const navigate = useNavigate();
  const [aprendo, setAprendo] = useState(false);

  if (!user) return null;

  const apriPureFocus = async () => {
    if (!user?.email) {
      navigate('/dashboard/purefocus');
      return;
    }
    setAprendo(true);
    try {
      // Stato PRO autorevole (RPC get_user_pro_status); fallback sullo stato client.
      const stato =
        (await ottieniStatoPro()) ?? { is_pro: abbonato, expires_at: null, tier: 'base' };
      const url = await generatePureFocusBridgeUrl(
        user.email,
        stato.is_pro,
        stato.expires_at ?? '',
      );
      if (url) {
        // Launch link cross-app: https://purefocus.app/auth/bridge?token=...
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        // Bridge non configurato (es. dev senza segreto): apri PureFocus interno.
        navigate('/dashboard/purefocus');
      }
    } catch {
      navigate('/dashboard/purefocus');
    } finally {
      setAprendo(false);
    }
  };

  if (abbonato) {
    return (
      <button
        type="button"
        onClick={() => void apriPureFocus()}
        disabled={aprendo}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-sky-800 disabled:cursor-wait disabled:opacity-60"
      >
        {aprendo ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4" />
        )}
        {aprendo ? 'Apertura…' : 'Apri PureFocus PRO'}
      </button>
    );
  }

  return (
    <Link
      to="/prezzi"
      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
    >
      <Lock className="h-4 w-4 text-secondary-500" />
      PureFocus incluso nel PRO
    </Link>
  );
}
