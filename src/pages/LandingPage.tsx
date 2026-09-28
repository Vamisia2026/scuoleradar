import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, ShieldCheck, Heart, UserPlus, Send, CreditCard } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FlightBoardInterpelli } from '@/departments/radar';
import { LandingBenefici } from '@/components/landing/LandingBenefici';
import { LandingCta } from '@/components/landing/LandingCta';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingOffertaPro } from '@/components/landing/LandingOffertaPro';
import { LandingPartnerPureFocus } from '@/components/landing/LandingPartnerPureFocus';
import { LandingRegistrazioneRapida } from '@/components/landing/LandingRegistrazioneRapida';
import { LandingStrumenti } from '@/components/landing/LandingStrumenti';
import { Stat, StepCard, ValueCard } from '@/components/landing/LandingCards';
import { useApp } from '@/contexts/AppContext';
import { aggiornaBozzaRegistrazione } from '@/lib/bozzaRegistrazione';
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

  /**
   * Registrazione rapida (Nome, Cognome, Email sotto l'hero): i dati scritti qui
   * finiscono nella BOZZA (`lib/bozzaRegistrazione.ts`) e si apre la modale di
   * onboarding/configurazione del Radar, che li trova già compilati — un solo
   * passaggio, nessun doppione di modali. Fuori dai campi compilati non si
   * sovrascrive nulla della bozza (patch solo sui valori presenti).
   */
  const handleRegistrazioneRapida = (dati: { nome: string; cognome: string; email: string }) => {
    if (user) {
      openRadarSetup();
      return;
    }
    aggiornaBozzaRegistrazione({
      ...(dati.nome ? { nome: dati.nome } : {}),
      ...(dati.cognome ? { cognome: dati.cognome } : {}),
      ...(dati.email ? { email: dati.email } : {}),
    });
    openRadarSetup();
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

      {/* Form rapido — solo per i visitatori: nome, cognome ed email dei tre campi
          vanno nella bozza e si apre la modale di onboarding/configurazione del
          Radar, che li trova già compilati (un solo passaggio). */}
      {!user && <LandingRegistrazioneRapida onSubmit={handleRegistrazioneRapida} />}

      {/* Radar Live — flight board interpelli: primo contenuto sotto l'hero e
          protagonista visivo della pagina (nel primo schermo vive il box «Prova il
          Radar»). Visibile SOLO con il dipartimento Radar attivo: mai la bacheca
          «in chiaro» di un modulo spento (feature flags). */}
      {visibile('radar') && <FlightBoardInterpelli />}

      {/* Offerta PRO — 30 giorni di PRO con Telegram in tempo reale, email delle
          17.00 e PureFocus incluso; nessuna via d'uscita verso altri piani. È la
          leva di conversione principale: sta PRIMA di «Cosa riceverai».
          Presentazione pura: la CTA riusa l'handler del Radar del contenitore. */}
      <LandingOffertaPro handleRadarClick={handleRadarClick} radarPronto={radarPronto} />

      {/* Ecco cosa riceverai — cosa arriva all'utente quando il Radar è attivo. */}
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
              title="Imposta il tuo Radar"
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
              title="Zero rumore"
              text="Ti scriviamo solo quando esce un'opportunità nella tua provincia e per la tua classe di concorso."
            />
            <ValueCard
              icon={<Heart className="h-6 w-6" />}
              title="Rispetto per il tuo tempo"
              text="Pensiamo noi alla ricerca. Tu pensa a insegnare."
            />
          </div>
        </div>
      </section>

      {/* Strumenti in vetrina */}
      <LandingStrumenti />

      {/* PureFocus — partner / sponsor ufficiale: fascia dedicata, stato PRO a prop. */}
      <LandingPartnerPureFocus hasProAccess={hasProAccess} />

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

