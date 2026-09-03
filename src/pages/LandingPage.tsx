import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Radar, BellRing, ShieldCheck, Heart, ArrowRight, UserPlus, Send, CreditCard, MapPin, Calendar, Sparkles,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { FlightBoardInterpelli } from '@/components/FlightBoardInterpelli';
import { SimulatorRadar } from '@/components/SimulatorRadar';
import { useApp } from '@/contexts/AppContext';
import { AdminAccessModal } from '@/pages/admin/AdminAccessModal';
import { ADMIN_EMAILS } from '@/pages/admin/types';
import { servizi } from '@/data/servizi';

export function LandingPage() {
  const { user, openAuthModal, hasProAccess, radarAttivo, openRadarWizard } = useApp();
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

  const handleInizia = () => {
    // Radar già attivo → gestione direttamente nella dashboard (preferenze precompilate).
    if (radarPronto) {
      navigate('/dashboard/radar');
      return;
    }
    // Nessun paywall e nessun login anticipato: si configura subito il Radar.
    // La registrazione gratuita arriva SOLO alla fine del percorso di configurazione.
    openRadarWizard();
  };

  const handleAccedi = () => {
    if (user) navigate('/dashboard/radar');
    else openAuthModal('login');
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-white to-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-secondary-100/60 blur-3xl" />
        <div className="pointer-events-none absolute top-40 -left-24 h-72 w-72 rounded-full bg-primary-100/60 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-14">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="animate-fade-in">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-bold text-primary-600 shadow-soft">
                <Radar className="h-3.5 w-3.5 text-secondary-500" />
                La piattaforma per chi vive la scuola ogni giorno
              </span>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-primary-900 sm:text-5xl">
                Ogni giorno decine di opportunità.
                <br />
                <span className="text-secondary-500">Noi intercettiamo solo quelle per te.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-primary-700">
                Scansioniamo h24 interpelli e bandi per TUTTI i lavoratori della scuola: docenti,
                supplenti, personale ATA ed esperti esterni. Progetti retribuiti, PON/PNRR, CPIA e
                supplenze: ti avvisiamo solo quando esce un&apos;opportunità reale nella tua provincia.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleInizia}
                  className={`btn-glint inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white shadow-soft transition ${
                    radarPronto ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#2B6F9E] hover:bg-[#225a82]'
                  }${glintOn && !radarPronto ? ' btn-glint-on' : ''}`}
                >
                  {radarPronto ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                      </span>
                      RADAR ATTIVO 🟢
                    </>
                  ) : (
                    <>
                      <Radar className="h-5 w-5" />
                      ATTIVA IL TUO RADAR
                    </>
                  )}
                  {!radarPronto && <ArrowRight className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleAccedi}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-6 py-3 text-base font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                  Accedi
                </button>
              </div>
            </div>

            <div className="animate-fade-in">
              <SimulatorRadar />
            </div>
          </div>
        </div>
      </section>

      {/* Radar Live — flight board interpelli (subito sotto la CTA hero) */}
      <FlightBoardInterpelli />

      {/* Ecco cosa riceverai — subito sotto l'hero, prima di "Come funziona". */}
      <section className="bg-primary-50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-primary-900">Cosa riceverai</h2>
            <p className="mt-3 text-primary-600">
              Esempi degli avvisi che il radar ti segnala, filtrati per il tuo profilo.
            </p>
          </div>
          <div className="animate-fade-in grid gap-5 md:grid-cols-3">
            <VetrinaCard
              tipo="Supplenza"
              tipoClasse="bg-primary-50 text-primary-600"
              classe="A-18"
              titolo="Interpello supplenza Filosofia e Scienze Umane"
              scuola="Liceo Classico A. Manzoni"
              provincia="AT"
              scadenza="30/09/2026"
            />
            <VetrinaCard
              tipo="Bando PNRR"
              tipoClasse="bg-secondary-50 text-secondary-700"
              classe="A-050"
              titolo="Esperto esterno Biologia e Chimica"
              scuola="IIS G. Carducci"
              provincia="RM"
              scadenza="12/09/2026"
            />
            <VetrinaCard
              tipo="Sostegno"
              tipoClasse="bg-accent-50 text-accent-700"
              classe="ADEE"
              titolo="Supplenza sostegno scuola primaria"
              scuola="IC Dante Alighieri"
              provincia="AL"
              scadenza="05/10/2026"
            />
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-base font-medium leading-relaxed text-primary-700">
            Inserisci il tuo profilo e vedrai solo le opportunità davvero pertinenti per te.
          </p>
        </div>
      </section>

      {/* Plan explanation */}
      <section className="bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-primary-900">Come funziona</h2>
            <p className="mt-3 text-primary-600">Tre passaggi per non perdere più una sola opportunità.</p>
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
              text="Ti avvisiamo tempestivamente su Telegram ed email appena esce un bando o interpello pertinente."
            />
            <StepCard
              icon={<CreditCard className="h-6 w-6" />}
              step="3"
              title="Candidati subito"
              text="Accedi ai link ufficiali con un click e invia la tua candidatura prima degli altri."
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

      {/* Servizi */}
      <section className="bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-primary-900">I nostri strumenti</h2>
            <p className="mt-3 text-primary-600">Tutto in un&apos;unica dashboard, per non perdere tempo.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              to="/servizi/radar-interpelli"
              className="group rounded-2xl border border-primary-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-2xl">📡</span>
              <h3 className="mt-4 text-lg font-bold text-primary-800">Radar Scuole</h3>
              <p className="mt-1.5 text-base text-primary-600">Solo le opportunità che ti riguardano davvero</p>
            </Link>
            <Link
              to="/servizi/moduli"
              className="group rounded-2xl border border-primary-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-2xl">📁</span>
              <h3 className="mt-4 text-lg font-bold text-primary-800">Moduli</h3>
              <p className="mt-1.5 text-base text-primary-600">Documenti e modulistica pronti all&apos;uso</p>
            </Link>
            <Link
              to="/dashboard/purefocus"
              className="group rounded-2xl border border-primary-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-2xl">🧘</span>
              <h3 className="mt-4 text-lg font-bold text-primary-800">Pure Focus</h3>
              <p className="mt-1.5 text-base text-primary-600">Studia e lavora su YouTube senza distrazioni</p>
            </Link>
          </div>
        </div>
      </section>

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

      {/* CTA */}
      <section className="bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-primary-900 sm:text-4xl">
            {radarPronto ? 'Il tuo Radar è attivo' : 'ATTIVA IL TUO RADAR'}
          </h2>
          <button
            onClick={handleInizia}
            className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white shadow-soft transition ${
              radarPronto
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-primary-500 hover:bg-primary-600'
            }`}
          >
            {radarPronto ? 'GESTRISCI RADAR 🟢' : (
              <>
                <Radar className="h-5 w-5" />
                ATTIVA IL TUO RADAR
              </>
            )}
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function StepCard({
  icon,
  step,
  title,
  text,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className="relative rounded-2xl border border-primary-100 bg-white p-6 shadow-card transition hover:shadow-soft">
      <span className="absolute -top-3 -left-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary-500 text-sm font-bold text-white shadow-soft">
        {step}
      </span>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-bold text-primary-800">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-primary-600">{text}</p>
    </div>
  );
}

function ValueCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white text-primary-600 shadow-soft">
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-bold text-primary-800">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-primary-600">{text}</p>
    </div>
  );
}

function VetrinaCard({
  tipo,
  tipoClasse,
  classe,
  titolo,
  scuola,
  provincia,
  scadenza,
}: {
  tipo: string;
  tipoClasse: string;
  classe: string;
  titolo: string;
  scuola: string;
  provincia: string;
  scadenza: string;
}) {
  return (
    <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tipoClasse}`}>{tipo}</span>
        <span className="rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
          {classe}
        </span>
      </div>
      <h3 className="mt-3 text-base font-bold text-primary-800">{titolo}</h3>
      <p className="mt-1 truncate text-sm text-primary-500">{scuola}</p>
      <div className="mt-3 flex items-center gap-3 text-xs text-primary-500">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {provincia}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          Scade il {scadenza}
        </span>
      </div>
    </div>
  );
}

function Stat({ numero, label }: { numero: string; label: string }) {
  return (
    <div>
      <p className="text-4xl font-bold text-white">{numero}</p>
      <p className="mx-auto mt-2 max-w-[220px] text-sm text-primary-200">{label}</p>
    </div>
  );
}

export function Footer() {
  const navigate = useNavigate();
  const { user } = useApp();
  // Trigger segreto Admin nascosto nella parola "riservati" (3 click).
  const [clicksSegreti, setClicksSegreti] = useState(0);
  const [adminModalAperto, setAdminModalAperto] = useState(false);

  return (
    <footer className="border-t border-primary-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-primary-700">
              <Radar className="h-5 w-5 text-primary-500" />
              <span className="font-semibold">ScuoleRadar.it</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-primary-500">
              Scansioniamo h24 opportunità per TUTTI i lavoratori della scuola. La piattaforma per chi
              vive la scuola ogni giorno.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-primary-800">Strumenti</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {servizi.map((s) => (
                <li key={s.slug}>
                  <Link
                    to={`/servizi/${s.slug}`}
                    className="text-primary-600 transition hover:text-primary-800"
                  >
                    {s.titolo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-primary-800">Info</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/prezzi" className="text-primary-600 transition hover:text-primary-800">
                  Prezzi
                </Link>
              </li>
              <li>
                <Link to="/chi-siamo" className="text-primary-600 transition hover:text-primary-800">
                  Chi siamo
                </Link>
              </li>
              <li>
                <Link to="/servizi" className="text-primary-600 transition hover:text-primary-800">
                  Tutti i servizi
                </Link>
              </li>
              <li>
                <Link to="/contatti" className="text-primary-600 transition hover:text-primary-800">
                  Contattaci
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 flex w-full flex-wrap items-center justify-center gap-x-1.5 border-t border-primary-100 pt-6 text-center text-sm text-primary-400">
          Realizzato con passione da
          <a
            href="https://vamisia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary-600 transition hover:text-primary-800"
          >
            Vamisia
          </a>
          <span aria-hidden="true">·</span>
          <span>© 2026 ScuoleRadar</span>
          <span aria-hidden="true">·</span>
          Tutti i diritti{' '}
          <button
            type="button"
            onClick={() => {
              const nuovo = clicksSegreti + 1;
              setClicksSegreti(nuovo);
              if (nuovo >= 3) {
                setClicksSegreti(0);
                const autorizzato = user?.email
                  ? ADMIN_EMAILS.includes(user.email.toLowerCase())
                  : false;
                if (autorizzato) {
                  navigate('/admin');
                } else {
                  setAdminModalAperto(true);
                }
              }
            }}
            className="inline cursor-default bg-transparent p-0 align-baseline text-primary-400 hover:text-primary-400"
          >
            riservati
          </button>
          .
        </p>
      </div>
      {adminModalAperto && (
        <AdminAccessModal aperto onChiudi={() => setAdminModalAperto(false)} />
      )}
    </footer>
  );
}
