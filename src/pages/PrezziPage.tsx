import { Check, Sparkles, Send, ShieldCheck } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';

const piani = [
  {
    nome: 'Radar Gratis',
    prezzo: '0€',
    periodo: 'per sempre',
    descrizione: 'Per provare il servizio senza impegno.',
    evidenziato: false,
    caratteristiche: [
      '3 notifiche di opportunità pertinenti',
      'Dashboard Radar Interpelli',
      'Filtri di base per profilo e province',
      'Accesso a tutti gli strumenti',
    ],
    cta: 'Inizia gratis',
  },
  {
    nome: 'Radar Pro',
    prezzo: '29€',
    periodo: 'all\u2019anno',
    descrizione: 'Il piano per chi cerca sul serio.',
    evidenziato: true,
    caratteristiche: [
      'Notifiche illimitate su Telegram ed email',
      'Radar con tutti i filtri avanzati',
      'Strumenti completi: CV, Check CFU, AI, Moduli',
      'Supporto prioritario via email',
      'Niente rinnovi automatici nascosti',
    ],
    cta: 'Passa a Pro',
  },
  {
    nome: 'Scuola / Istituzione',
    prezzo: 'Su misura',
    periodo: 'preventivo',
    descrizione: 'Per team e istituti che vogliono supporto dedicato.',
    evidenziato: false,
    caratteristiche: [
      'Accessi multipli per il team',
      'Configurazione assistita dei filtri',
      'Formazione e onboarding dedicato',
      'Fatturazione e contratti dedicati',
    ],
    cta: 'Contattaci',
  },
];

const faq = [
  {
    q: 'Posso cancellarmi quando voglio?',
    a: 'Sì. Un click e cancelliamo tutto: nessun rinnovo automatico nascosto, nessun dark pattern. Onestà prima di tutto.',
  },
  {
    q: 'Come funzionano le 3 notifiche gratuite?',
    a: 'Ricevi fino a 3 avvisi di opportunità davvero pertinenti al tuo profilo, senza carta di credito. Se ti bastano, puoi fermarti lì.',
  },
  {
    q: 'Le notifiche arrivano davvero solo se c\u2019è qualcosa di rilevante?',
    a: 'Sì. Se non c\u2019è nulla di pertinente per te, te lo diciamo invece di inondarti di annunci inutili.',
  },
  {
    q: 'Il pagamento è sicuro?',
    a: 'Nel prototipo il pagamento è simulato. Nella versione completa useremo un circuito di pagamento sicuro e autorizzato.',
  },
];

export function PrezziPage() {
  const { openAuthModal } = useApp();

  const handleCta = (nomePiano: string) => {
    if (nomePiano === 'Scuola / Istituzione') {
      window.location.href = 'mailto:ciao@scuoleradar.it?subject=Richiesta%20preventivo%20Scuola';
      return;
    }
    openAuthModal('registrazione');
  };

  return (
    <div className="min-h-screen">
      <Header />

      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary-900 sm:text-4xl">Prezzi onesti, senza sorprese</h1>
            <p className="mx-auto mt-3 max-w-xl text-lg text-primary-600">
              Tre notifiche gratuite per provare. Se il servizio ti piace, 29€ all\u2019anno.
              Niente rinnovi automatici nascosti.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {piani.map((p) => (
              <div
                key={p.nome}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-card ${
                  p.evidenziato ? 'border-secondary-300 ring-2 ring-secondary-300' : 'border-primary-100'
                }`}
              >
                {p.evidenziato && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-secondary-500 px-3 py-1 text-xs font-bold text-white shadow-soft">
                    <Sparkles className="h-3.5 w-3.5" />
                    Il più scelto
                  </span>
                )}
                <h2 className="text-lg font-bold text-primary-800">{p.nome}</h2>
                <p className="mt-1 text-sm text-primary-500">{p.descrizione}</p>
                <p className="mt-4">
                  <span className="text-3xl font-bold text-primary-900">{p.prezzo}</span>{' '}
                  <span className="text-sm text-primary-500">/ {p.periodo}</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.caratteristiche.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm text-primary-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                      {c}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCta(p.nome)}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-soft transition ${
                    p.evidenziato
                      ? 'bg-secondary-500 hover:bg-secondary-600'
                      : 'bg-primary-500 hover:bg-primary-600'
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold text-primary-900">Domande frequenti</h2>
          <div className="mt-8 space-y-3">
            {faq.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-primary-100 bg-white p-5 shadow-card open:bg-primary-50/50"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-primary-800">
                  {f.q}
                  <span className="text-primary-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-primary-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary-900 py-16 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-800 px-3 py-1 text-sm font-medium text-primary-200">
            <ShieldCheck className="h-4 w-4 text-accent-300" />
            Nessun dark pattern, promesso
          </span>
          <h2 className="mt-4 text-3xl font-bold text-white">Pronto a smettere di perdere tempo?</h2>
          <p className="mt-3 text-lg text-primary-200">
            Crea il tuo profilo in due minuti. La prima notifica utile potrebbe arrivare domani.
          </p>
          <button
            onClick={() => openAuthModal('registrazione')}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent-500 px-8 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-accent-600"
          >
            <Send className="h-5 w-5" />
            Inizia gratis
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
