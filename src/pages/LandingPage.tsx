import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Radar, BellRing, ShieldCheck, Heart, ArrowRight, UserPlus, Send, CreditCard, MapPin, Calendar, Sparkles,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { SimulatorRadar } from '@/components/SimulatorRadar';
import { useApp } from '@/contexts/AppContext';
import { servizi } from '@/data/servizi';

export function LandingPage() {
  const { user, openAuthModal, openVetrina, openRadarWizard } = useApp();
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

  const handleInizia = () => {
    // Nessun paywall e nessun login anticipato: si configura subito il Radar.
    // La registrazione gratuita (per salvare le preferenze e attivare i 3 avvisi
    // inclusi) arriva SOLO alla fine del percorso di configurazione.
    openRadarWizard();
  };

  const handleAccedi = () => {
    if (user) navigate('/dashboard/radar');
    else openAuthModal('login');
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-white to-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-secondary-100/60 blur-3xl" />
        <div className="pointer-events-none absolute top-40 -left-24 h-72 w-72 rounded-full bg-primary-100/60 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10 sm:pb-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="animate-fade-in">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-bold text-primary-600 shadow-soft">
                <Radar className="h-3.5 w-3.5 text-secondary-500" />
                La piattaforma per gli Scuolatori: chi vive la scuola ogni giorno
              </span>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-primary-900 sm:text-5xl">
                Ogni giorno decine di opportunità scolastiche scappano via.
                <br />
                <span className="text-secondary-500">Noi intercettiamo solo quelle perfette per te.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-primary-700">
                Scansioniamo h24 interpelli e bandi per TUTTI i lavoratori della scuola: docenti,
                supplenti, personale ATA ed esperti esterni. Progetti retribuiti, PON/PNRR, CPIA e
                supplenze: ti avvisiamo solo quando esce un&apos;opportunità reale nella tua provincia.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleInizia}
                  className={`btn-glint inline-flex items-center justify-center gap-2 rounded-xl bg-[#2B6F9E] px-6 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-[#225a82]${
                    glintOn ? ' btn-glint-on' : ''
                  }`}
                >
                  <Radar className="h-5 w-5" />
                  ATTIVA IL TUO RADAR
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={handleAccedi}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-6 py-3 text-base font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                  Accedi
                </button>
              </div>
              <p className="mt-4 text-sm text-primary-500">
                3 segnalazioni incluse nel tuo account Base. Nessuna carta richiesta.
              </p>
            </div>

            <div className="animate-fade-in">
              <SimulatorRadar />
            </div>
          </div>
        </div>
      </section>

      {/* Plan explanation */}
      <section className="bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-primary-900">Come funziona</h2>
            <p className="mt-3 text-primary-600">Tre passaggi per non perdere più una sola opportunità.</p>
          </div>
          <div className="animate-fade-in grid gap-6 md:grid-cols-3">
            <StepCard
              icon={<UserPlus className="h-6 w-6" />}
              step="1"
              title="Registrati e imposta il tuo profilo"
              text="Dicci ordine di scuola, materie, classi di concorso e province che ti interessano. Bastano pochi secondi."
            />
            <StepCard
              icon={<Send className="h-6 w-6" />}
              step="2"
              title="Ricevi 3 segnalazioni incluse"
              text="Ti avvisiamo su Telegram e via email solo quando c'è un interpello, un bando o un progetto in linea con te."
            />
            <StepCard
              icon={<CreditCard className="h-6 w-6" />}
              step="3"
              title="Se vuoi continuare, 49€ all'anno"
              text="Si ripaga con un'ora di lavoro. Se trovi posto grazie a noi, ci raccomandi. Tutto qui."
            />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-primary-50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <ValueCard
              icon={<BellRing className="h-6 w-6" />}
              title="Solo ciò che conta"
              text="Nessun contatore aggressivo, nessun risultato sfocato. Se oggi non c'è nulla di rilevante, te lo diciamo."
            />
            <ValueCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Trasparenza prima di tutto"
              text="Niente sorprese in fattura, niente rinnovi automatici nascosti. Il piano è chiaro."
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
      <section className="bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-primary-900">I nostri strumenti</h2>
            <p className="mt-3 text-primary-600">Tutto in un&apos;unica dashboard, per non perdere tempo.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {servizi.map((s) => (
              <Link
                key={s.slug}
                to={`/servizi/${s.slug}`}
                className="group rounded-2xl border border-primary-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-2xl">
                  {s.emoji}
                </span>
                <h3 className="mt-4 text-lg font-bold text-primary-800">{s.titolo}</h3>
                <p className="mt-1 text-sm text-primary-500">{s.sottotitolo}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Vetrina dimostrativa */}
      <section className="bg-primary-50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-primary-900">Ecco cosa riceverai</h2>
            <p className="mt-3 text-primary-600">
              Un assaggio degli avvisi che il radar ti segnala, filtrati per il tuo profilo.
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
              scuola="IC Incisa Scapaccino"
              provincia="AL"
              scadenza="05/10/2026"
            />
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-left text-sm text-primary-500">
            Inserisci il tuo profilo e vedrai solo le opportunità davvero pertinenti per te.
          </p>
        </div>
      </section>

      {/* PureFocus */}
      <section className="bg-white py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 p-8 text-white shadow-card sm:p-10">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl">
                🧘
              </span>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-primary-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Incluso nel piano PRO
                </span>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">PureFocus</h2>
              </div>
            </div>
            <p className="mt-4 leading-relaxed text-primary-100">
              La piattaforma che trasforma YouTube in un ambiente di studio e lavoro: elimina
              distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve
              per ottimizzare il tuo tempo.
            </p>
            <div className="mt-6">
              {user ? (
                <Link
                  to="/dashboard/purefocus"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-primary-800 shadow-soft transition hover:bg-primary-50"
                >
                  Scopri PureFocus
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  onClick={() => openVetrina('purefocus')}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-primary-800 shadow-soft transition hover:bg-primary-50"
                >
                  Registrati qui
                  <ArrowRight className="h-4 w-4" />
                </button>
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
      <section className="bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-primary-900 sm:text-4xl">
            ATTIVA IL TUO RADAR
          </h2>
          <button
            onClick={handleInizia}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-8 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600"
          >
            <Radar className="h-5 w-5" />
            ATTIVA IL TUO RADAR
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
      <p className="mt-2 text-sm leading-relaxed text-primary-600">{text}</p>
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
      <p className="mt-2 text-sm leading-relaxed text-primary-600">{text}</p>
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
  // Trigger segreto Admin: 3 click sul copyright → /admin
  const [clicksCop, setClicksCop] = useState(0);

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
          <button
            type="button"
            onClick={() => {
              const nuovo = clicksCop + 1;
              setClicksCop(nuovo);
              if (nuovo >= 3) {
                setClicksCop(0);
                navigate('/admin');
              }
            }}
            className="transition hover:text-primary-600"
            title=""
          >
            © 2026 ScuoleRadar
          </button>
          <span aria-hidden="true">·</span>
          Tutti i diritti riservati.
        </p>
      </div>
    </footer>
  );
}
