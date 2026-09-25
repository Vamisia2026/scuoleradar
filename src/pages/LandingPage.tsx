import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, ShieldCheck, Heart, UserPlus, Send, CreditCard, Sparkles } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FlightBoardInterpelli } from '@/departments/radar';
import { LandingBenefici } from '@/components/landing/LandingBenefici';
import { LandingCta } from '@/components/landing/LandingCta';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingStrumenti } from '@/components/landing/LandingStrumenti';
import { Stat, StepCard, ValueCard } from '@/components/landing/LandingCards';
import { useApp } from '@/contexts/AppContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

export function LandingPage() {
  const { user, openAuthModal, hasProAccess, radarAttivo, openRadarSetup } = useApp();
  // Feature flags: la vetrina pubblica (strumenti, bacheca radar, CTA) segue lo
  // stato dei dipartimenti. Nessun link «in chiaro» a un modulo spento e nessun
  // redirect su una rotta disattivata: si atterra sul primo dipartimento visibile.
  const { visibile, primaRottaVisibile } = useFeatureFlags();
  const navigate = useNavigate();

  // Shimmer pseudo-casuale sul CTA "ATTIVA IL TUO RADAR": ogni 10–15 s (intervallo
  // random) il beam attraversa il pulsante (~0,7 s) e poi si rischedula. Discreto,
  // quasi impercettibile: attira l'occhio senza distrarre.
  const [glintOn, setGlintOn] = useState(false);
  /** Timer del glint in un ref: non viene MAI invalidato dai re-render del componente. */
  const glintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let attivo = true;

    const accendiGlint = () => {
      if (!attivo) return;
      setGlintOn(true);
      // Durata della traversata del beam (~0,7 s), poi si spegne e si rischedula.
      glintTimerRef.current = setTimeout(() => {
        if (!attivo) return;
        setGlintOn(false);
        glintTimerRef.current = setTimeout(accendiGlint, 10000 + Math.random() * 5000);
      }, 700);
    };

    // Primo passaggio dopo 10–15 s (mai subito: il sito resta pulito).
    glintTimerRef.current = setTimeout(accendiGlint, 10000 + Math.random() * 5000);

    return () => {
      attivo = false;
      if (glintTimerRef.current) clearTimeout(glintTimerRef.current);
    };
  }, []);

  /** True se l'utente ha già configurato il Radar (preferenze + radar_attivo=true). */
  const radarPronto = Boolean(user && radarAttivo);

  /**
   * CTA "ATTIVA IL TUO RADAR": prima si fa impostare il Radar (wizard), poi si
   * chiedono i dati di registrazione (solo al termine del percorso, se guest).
   * Nessun paywall e nessun login anticipato.
   */
  const handleRadarClick = () => {
    // Radar disattivato (feature flag `off`): mai aprire il wizard di un modulo
    // spento — si va al primo dipartimento disponibile.
    if (!visibile('radar')) {
      navigate(primaRottaVisibile());
      return;
    }
    // Radar già attivo → gestione direttamente nella dashboard (preferenze precompilate).
    if (radarPronto) {
      navigate('/dashboard/radar');
      return;
    }
    openRadarSetup();
  };

  const handleAccedi = () => {
    if (user) navigate(primaRottaVisibile());
    else openAuthModal('login');
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden">
      <Header />

      {/* Hero */}
      <LandingHero
        glintOn={glintOn}
        handleAccedi={handleAccedi}
        handleRadarClick={handleRadarClick}
        radarPronto={radarPronto}
      />

      {/* Radar Live — flight board interpelli (subito sotto la CTA hero).
          Visibile SOLO con il dipartimento Radar attivo: mai la bacheca «in chiaro»
          di un modulo spento (feature flags). */}
      {visibile('radar') && <FlightBoardInterpelli />}

      {/* Ecco cosa riceverai — subito sotto l'hero, prima di "Come funziona". */}
      <LandingBenefici />

      {/* Plan explanation */}
      <section className="bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-primary-900">Come funziona</h2>
            <p className="mt-3 text-primary-600">Tre passaggi, poi ci pensa il Radar a cercare per te.</p>
          </div>
          <div className="animate-fade-in grid gap-6 md:grid-cols-3">
            <StepCard
              icon={<UserPlus className="h-6 w-6" />}
              step="1"
              title="Imposta il tuo profilo"
              text="Seleziona ordine di scuola, classi di concorso e province di tuo interesse in pochi secondi."
            />
            <StepCard
              icon={<Send className="h-6 w-6" />}
              step="2"
              title="Ricevi le notifiche"
              text="Ti avvisiamo su Telegram ed email appena esce un bando o interpello pertinente."
            />
            <StepCard
              icon={<CreditCard className="h-6 w-6" />}
              step="3"
              title="Candidati con i link ufficiali"
              text="Accedi ai link ufficiali con un click e invia la tua candidatura."
            />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-primary-50 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <ValueCard
              icon={<BellRing className="h-6 w-6" />}
              title="Solo ciò che conta"
              text="Nessun contatore aggressivo, nessun risultato sfocato. Se oggi non c'è nulla di rilevante, te lo diciamo."
            />
            <ValueCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Niente rumore, solo ciò che conta"
              text="Inviamo notifiche solo quando c'è un'opportunità in linea con il tuo profilo."
            />
            <ValueCard
              icon={<Heart className="h-6 w-6" />}
              title="Rispetto per il tuo tempo"
              text="Pensiamo noi alla ricerca. Tu pensa a insegnare."
            />
          </div>
        </div>
      </section>

      {/* Servizi (griglia filtrata dalle feature flags) */}
      <LandingStrumenti />

      {/* PureFocus — partner / sponsor ufficiale: accesso esterno per tutti */}
      <section className="bg-white py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-white shadow-card">
            {/* Fascia partner */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 px-6 py-3 sm:px-8">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-primary-200">
                <Sparkles className="h-3.5 w-3.5" />
                Partner ufficiale
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-300">
                Sponsor Ufficiale
              </span>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl">
                  🧘
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-bold sm:text-3xl">PureFocus</h2>
                  <p className="mt-1 text-sm text-primary-200">purefocus.one — studio e lavoro su YouTube senza distrazioni</p>
                </div>
                <a
                  href="https://purefocus.one"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25"
                >
                  Scopri PureFocus ↗
                </a>
              </div>

              <p className="mt-5 max-w-2xl leading-relaxed text-primary-100">
                La piattaforma che trasforma YouTube in un ambiente di studio e lavoro: elimina
                distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve
                per ottimizzare il tuo tempo.
              </p>

              {hasProAccess ? (
                <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-accent-300 ring-1 ring-inset ring-accent-300/40">
                        <Sparkles className="h-3 w-3" />
                        Incluso nel tuo piano
                      </span>
                      <p className="mt-2 text-sm leading-relaxed text-primary-100">
                        Hai PureFocus già incluso nel piano PRO (mensile, annuale o Free Forever):
                        nessun costo aggiuntivo, entra e inizia subito.
                      </p>
                    </div>
                    <a
                      href="https://purefocus.one"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary-800 shadow-soft transition hover:bg-primary-50"
                    >
                      ACCEDI A PUREFOCUS ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
                  <p className="max-w-2xl text-sm leading-relaxed text-primary-100">
                    PureFocus costa 29$/anno ed è{' '}
                    <strong className="text-white">INCLUSO GRATUITAMENTE</strong> per tutti gli utenti
                    PRO di ScuoleRadar.
                  </p>
                  <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <Link
                      to="/prezzi"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary-500 px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600"
                    >
                      PASSA A PRO
                    </Link>
                    <a
                      href="https://purefocus.one"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/15 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25"
                    >
                      Visita purefocus.one ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats / social proof */}
      <section className="bg-primary-900 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 text-center md:grid-cols-4">
            <Stat numero="8.000+" label="Scuole e istituti monitorati ogni giorno" />
            <Stat numero="500+" label="Nuove opportunità settimanali tra Docenti e ATA" />
            <Stat numero="24/7" label="Notifiche automatiche sugli interpelli della tua provincia" />
            <Stat numero={'< 48 ore'} label="Tempo medio di scadenza degli avvisi di supplenza" />
          </div>
        </div>
      </section>

      {/* CTA finale — solo con il Radar attivo (feature flags) */}
      {visibile('radar') && (
        <LandingCta handleRadarClick={handleRadarClick} radarPronto={radarPronto} />
      )}

      <Footer />
    </div>
  );
}

