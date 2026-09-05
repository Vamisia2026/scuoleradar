/**
 * PRO-GIFT "Sorpresa" (Soft Onboarding) — welcome interstitial esplicitamente
 * richiesto dall'utente.
 *
 * NIENTE auto-apertura al load/refresh/post-login: questo modal viene mostrato
 * SOLO quando un utente Base senza regole Radar clicca una CTA "Attiva il tuo
 * Radar" o avvia il setup del Radar (vedi `openRadarSetup` in AppContext).
 *
 * Account NON elegibili (regole Radar già configurate oppure piano
 * PRO / Free Forever / abbonamento attivo) → il modal resta soppresso.
 *
 * Il pulsante primario chiude il regalo e apre il wizard a 4 passi
 * (`RadarWizardModal`) per completare il profilo.
 */
import { useEffect } from 'react';
import { Gift, Radar, Sparkles, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export function SoftOnboardingModal() {
  const {
    user,
    supabaseUserId,
    loading,
    pianoStato,
    preferenze,
    hasProAccess,
    abbonato,
    softOnboardingOpen,
    closeSoftOnboarding,
    openRadarWizard,
  } = useApp();

  /** Regole Radar presenti sul profilo (province + classi/materie), anche se Radar in pausa. */
  const radarConfigurato =
    preferenze.provinceCodici.length > 0 &&
    (preferenze.classiCodici.length > 0 ||
      preferenze.materieId.length > 0 ||
      preferenze.materieCustom.length > 0);

  /** Elegibile: autenticato, profilo letto dal DB, piano Base, nessuna regola Radar. */
  const elegibile =
    Boolean(user || supabaseUserId) &&
    pianoStato === 'pronto' &&
    !hasProAccess &&
    !abbonato &&
    !radarConfigurato;

  // Guardia di sicurezza: se nel frattempo l'account non è più elegibile
  // (regole salvate, piano cambiato, logout) il modal si chiude da solo.
  useEffect(() => {
    if (softOnboardingOpen && !elegibile) closeSoftOnboarding();
  }, [softOnboardingOpen, elegibile, closeSoftOnboarding]);

  if (loading || !softOnboardingOpen || !elegibile) return null;

  /** Chiude il regalo e lancia il wizard "Attiva il tuo Radar" (4 passi). */
  const completaProfilo = (): void => {
    closeSoftOnboarding();
    openRadarWizard();
  };

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Sorpresa: hai 1 mese PRO gratis"
    >
      {/* Backdrop soft: chiusura non bloccante */}
      <div
        className="absolute inset-0 animate-fade-in bg-primary-900/30 backdrop-blur-[2px]"
        onClick={closeSoftOnboarding}
      />

      <div className="relative w-full max-w-lg animate-fade-in-lenta overflow-hidden rounded-2xl bg-white shadow-card">
        {/* Header regalo */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-500 px-6 pb-8 pt-6 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white shadow-soft backdrop-blur">
            <Gift className="h-6 w-6" />
          </span>
          <button
            type="button"
            onClick={closeSoftOnboarding}
            aria-label="Chiudi"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-white transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="mt-4 text-2xl font-black leading-tight">
            🎁 Sorpresa: hai 1 mese PRO gratis!
          </h2>
        </div>

        {/* Corpo */}
        <div className="p-6">
          <p className="text-sm leading-relaxed text-primary-600">
            Benvenuto su ScuoleRadar! Invece del profilo base, per i primi 30
            giorni ti regaliamo la versione PRO per provare la ricerca
            personalizzata senza limiti. Non te l&apos;aspettavi, eh?
          </p>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent-50 px-3.5 py-2.5 text-xs text-accent-700">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            <p>
              Durante il mese PRO potrai usare tutti i filtri di ricerca e le
              notifiche senza limiti. Alla scadenza il tuo account tornerà
              semplicemente sul piano Base.
            </p>
          </div>

          {/* Footer */}
          <div className="mt-5 flex flex-col-reverse items-stretch gap-2 border-t border-primary-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={closeSoftOnboarding}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-600 transition hover:bg-primary-50"
            >
              Non ora
            </button>
            <button
              type="button"
              onClick={completaProfilo}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-primary-600"
            >
              <Radar className="h-4 w-4" />
              Completa il tuo profilo per iniziare
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
