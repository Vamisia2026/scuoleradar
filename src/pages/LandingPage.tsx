import { Link, useNavigate } from 'react-router-dom';
import { Radar, BellRing, ShieldCheck, Heart, ArrowRight, UserPlus, Send, CreditCard } from 'lucide-react';
import { Header } from '@/components/Header';
import { SimulatorRadar } from '@/components/SimulatorRadar';
import { useApp } from '@/contexts/AppContext';
import { servizi } from '@/data/servizi';

export function LandingPage() {
  const { user, openAuthModal } = useApp();
  const navigate = useNavigate();

  const handleInizia = () => {
    if (user) navigate('/dashboard/radar');
    else openAuthModal('registrazione');
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
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="animate-fade-in">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-sm font-medium text-accent-700">
                <ShieldCheck className="h-4 w-4" />
                Trasparente. Niente dark pattern.
              </span>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-primary-900 sm:text-5xl">
                Ogni giorno centinaia di interpelli e bandi.
                <br />
                <span className="text-secondary-500">Noi ti mandiamo solo quello giusto per te.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-primary-700">
                Non perdere tempo a spulciare annunci inutili. Dedica le tue energie a chi insegni,
                non alla ricerca. ScuoleRadar filtra interpelli per supplenze, bandi per esperti, CPIA e progetti scolastici,
                e ti avvisa solo quando c'è qualcosa che ti riguarda davvero.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleInizia}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600"
                >
                  <Radar className="h-5 w-5" />
                  Inizia il tuo Radar
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
                3 notifiche incluse nell&apos;Offerta per provare. Nessuna carta richiesta.
              </p>
            </div>

            <div className="animate-fade-in">
              <SimulatorRadar />
            </div>
          </div>
        </div>
      </section>

      {/* Plan explanation */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-primary-900">Come funziona</h2>
            <p className="mt-3 text-primary-600">Tre passi. Semplice e onesto.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <StepCard
              icon={<UserPlus className="h-6 w-6" />}
              step="1"
              title="Registrati e imposta il tuo profilo"
              text="Dicci ordine di scuola, materie, classi di concorso e province che ti interessano. Bastano due minuti."
            />
            <StepCard
              icon={<Send className="h-6 w-6" />}
              step="2"
              title="Ricevi 3 notifiche incluse"
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
      <section className="bg-primary-50 py-16 sm:py-20">
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
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 text-center">
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

      {/* CTA */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-primary-900 sm:text-4xl">
            Inizia il tuo Radar
          </h2>
          <p className="mt-4 text-lg text-primary-600">
            3 notifiche incluse nell&apos;Offerta per provare. Se trovi lavoro grazie a noi, ci raccomandi.
            Altrimenti, se vuoi continuare, 49€ all&apos;anno con PureFocus incluso.
          </p>
          <button
            onClick={handleInizia}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-8 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600"
          >
            <Radar className="h-5 w-5" />
            Crea il mio profilo
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

export function Footer() {
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
              Monitoriamo interpelli e bandi per docenti e ti avvisiamo solo quando c&apos;è
              qualcosa di davvero pertinente.
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
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-primary-100 pt-6 text-center text-sm text-primary-400">
          Dati di esempio a scopo dimostrativo. Nessun invio di domande.
        </p>
      </div>
    </footer>
  );
}
