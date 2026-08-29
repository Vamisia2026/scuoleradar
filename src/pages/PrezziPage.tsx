import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Send, ShieldCheck, Gift } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { STORAGE_KEY_INTENDED_PLAN, type PianoId } from '@/lib/pricing';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';

interface Piano {
  plan: PianoId;
  nome: string;
  prezzo: string;
  periodo: string;
  descrizione: string;
  evidenziato: boolean;
  badge?: string;
  risparmio?: string;
  sottotitolo?: string;
  caratteristiche: string[];
  cta: string;
}

const piani: Piano[] = [
  {
    plan: 'pro_annuale',
    nome: 'PRO Annuale',
    prezzo: '49€',
    periodo: 'all\u2019anno',
    descrizione: 'Il massimo dell\u2019offerta, al prezzo migliore.',
    evidenziato: true,
    badge: 'Il Più Scelto',
    risparmio: 'Solo ~4€/mese — Risparmi il 55%',
    caratteristiche: [
      'Segnalazioni e notifiche illimitate',
      'Tutti i tool completi: CV Builder, Check CFU, Assistente AI',
      'PDF ufficiali senza watermark',
      'Accesso completo a PureFocus incluso',
    ],
    cta: 'Passa a PRO Annuale',
  },
  {
    plan: 'pro_mensile',
    nome: 'PRO Mensile',
    prezzo: '9€',
    periodo: 'al mese · 108€/anno',
    descrizione: 'Stessi vantaggi del piano PRO, con fatturazione mensile flessibile.',
    evidenziato: false,
    caratteristiche: [
      'Segnalazioni e notifiche illimitate',
      'Tutti i tool completi: CV Builder, Check CFU, Assistente AI',
      'PDF ufficiali senza watermark',
      'Accesso completo a PureFocus incluso',
    ],
    cta: 'Scegli PRO Mensile',
  },
  {
    plan: 'a_consumo',
    nome: 'A consumo',
    prezzo: '5€',
    periodo: 'per singolo servizio',
    descrizione: 'Paghi solo quando ti serve: un credito, un servizio.',
    evidenziato: false,
    sottotitolo:
      'Con 2 crediti a consumo copri il costo di un mese intero di PRO Illimitato',
    caratteristiche: [
      'Un credito per ogni servizio',
      'Nessun abbonamento automatico',
      'Credito valido 12 mesi dall\u2019acquisto',
    ],
    cta: 'Acquista crediti a consumo',
  },
];

const faq = [
  {
    q: 'Posso cancellarmi quando voglio?',
    a: 'Sì. Un click e cancelliamo tutto: nessun rinnovo automatico nascosto, nessun dark pattern. Onestà prima di tutto.',
  },
  {
    q: 'Come funzionano le 3 notifiche di prova?',
    a: 'Ricevi una volta sola, in assoluto, fino a 3 avvisi di opportunità davvero pertinenti al tuo profilo, senza carta di credito e senza reset mensile. Se ti bastano, puoi fermarti lì; per continuare c\u2019è PRO.',
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
  const navigate = useNavigate();
  const { user, openAuthModal, avviaCheckout } = useApp();
  const [promoUrl, setPromoUrl] = useState<string | null>(null);

  // Se arrivi da un link referral (?promo=CODE), salva il codice per il checkout
  useEffect(() => {
    const promo = new URLSearchParams(window.location.search).get('promo');
    if (promo) {
      const upp = promo.toUpperCase().replace(/[^A-Z0-9]/g, '');
      setPromoUrl(upp);
      try {
        localStorage.setItem('sr_promo', upp);
      } catch {
        // localStorage non disponibile
      }
    }
  }, []);

  const handleCta = (piano: PianoId) => {
    if (user) {
      // Già autenticato: avvia subito il checkout, MAI il modal di login/registrazione.
      void avviaCheckout(piano);
      return;
    }
    // Utente anonimo: salva il piano desiderato e apri l'Auth modal.
    try {
      localStorage.setItem(STORAGE_KEY_INTENDED_PLAN, piano);
    } catch {
      // localStorage non disponibile
    }
    openAuthModal('registrazione');
  };

  return (
    <div className="min-h-screen">
      <Header />

      {promoUrl && (
        <div className="border-b border-accent-200 bg-accent-500/10 px-4 py-2.5 text-center text-sm text-accent-800">
          <Gift className="mr-1.5 inline h-4 w-4" />
          Hai un invito! Il codice <strong>{promoUrl}</strong> verrà applicato automaticamente al
          checkout (-10€ sul piano PRO annuale).
        </div>
      )}

      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary-900 sm:text-4xl">Prezzi onesti, senza sorprese</h1>
            <p className="mx-auto mt-3 max-w-xl text-lg text-primary-600">
              Tre notifiche di prova in assoluto, una tantum. Poi i piani PRO:
              49€ all&apos;anno oppure 9€ al mese. Niente rinnovi automatici nascosti.
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
                {p.evidenziato && p.badge && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-secondary-500 px-3 py-1 text-xs font-bold text-white shadow-soft">
                    <Sparkles className="h-3.5 w-3.5" />
                    {p.badge}
                  </span>
                )}
                <h2 className="text-lg font-bold text-primary-800">{p.nome}</h2>
                <p className="mt-1 text-sm text-primary-500">{p.descrizione}</p>
                <p className="mt-4">
                  <span className="text-3xl font-bold text-primary-900">{p.prezzo}</span>{' '}
                  <span className="text-sm text-primary-500">/ {p.periodo}</span>
                </p>
                {p.risparmio && (
                  <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-accent-100 px-3 py-1 text-xs font-bold text-accent-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    {p.risparmio}
                  </span>
                )}
                {p.sottotitolo && (
                  <p className="mt-3 rounded-xl bg-secondary-50 px-3 py-2 text-xs font-semibold text-secondary-800">
                    {p.sottotitolo}
                  </p>
                )}
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.caratteristiche.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm text-primary-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                      {c}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCta(p.plan)}
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

      {/* PureFocus */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 p-8 text-white shadow-card">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-primary-100">
              <Sparkles className="h-4 w-4" />
              Nuovo: incluso nel piano PRO
            </span>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Accesso completo a PureFocus</h2>
            <p className="mt-3 text-primary-100">
              La suite di concentrazione ed editoria senza distrazioni per docenti: scrivi, prepari e
              pubblichi i tuoi materiali in un ambiente pensato per il lavoro profondo.
            </p>
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
            Crea il tuo profilo in due minuti. Con il piano PRO hai anche PureFocus, la
            suite di concentrazione ed editoria senza distrazioni per docenti.
          </p>
          <button
            onClick={() => (user ? navigate('/dashboard/radar') : openAuthModal('registrazione'))}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent-500 px-8 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-accent-600"
          >
            <Send className="h-5 w-5" />
            Inizia ora
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
