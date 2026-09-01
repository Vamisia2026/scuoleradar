import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Sparkles, Send, ShieldCheck, Gift } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { STORAGE_KEY_INTENDED_PLAN, STORAGE_KEY_INTENDED_PLAN_DATA, type PianoId } from '@/lib/pricing';
import { track } from '@/lib/analytics';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';

interface Vantaggio {
  testo: string;
  /** true → spunta verde; false → X rossa (limitazione del piano Base / a consumo). */
  incluso: boolean;
}

interface Piano {
  plan: PianoId;
  nome: string;
  prezzo: string;
  periodo: string;
  descrizione: string;
  evidenziato: boolean;
  badge?: string;
  notaPrezzo?: string;
  sottotitolo?: string;
  vantaggi: Vantaggio[];
  cta: string;
}

/** Opzioni di ricarica crediti a consumo (blocchi da 5 crediti, 1 credito = 1€). */
const OPZIONI_CREDITI = [5, 10, 15, 20] as const;

/** Vantaggi identici dei piani PRO (Mensile e Annuale) — spunte verdi. */
const VANTAGGI_PRO: Vantaggio[] = [
  { testo: 'Segnalazioni e notifiche illimitate', incluso: true },
  { testo: 'Crea CV', incluso: true },
  { testo: 'Calcolatore CFU', incluso: true },
  { testo: 'Assistente Sindacalista Virtuale', incluso: true },
  { testo: 'Modulistica', incluso: true },
  { testo: 'Assistente alla Modulistica', incluso: true },
  { testo: 'Abbonamento a Pure Focus incluso', incluso: true },
];

/** Vantaggi e limitazioni del piano a consumo (Base) — misto ✓ / ✗. */
const VANTAGGI_CONSUMO: Vantaggio[] = [
  { testo: 'Segnalazioni e notifiche illimitate (solo 3 segnalazioni di prova)', incluso: false },
  { testo: 'Crea CV', incluso: true },
  { testo: 'Calcolatore CFU', incluso: false },
  { testo: 'Assistente Sindacalista Virtuale', incluso: false },
  { testo: 'Modulistica', incluso: true },
  { testo: 'Assistente alla Modulistica', incluso: false },
  { testo: 'Abbonamento a Pure Focus', incluso: false },
  { testo: '5 crediti per ogni servizio', incluso: true },
  { testo: 'Nessun abbonamento automatico', incluso: true },
  { testo: 'Credito valido 12 mesi dall\u2019acquisto', incluso: true },
];

const piani: Piano[] = [
  {
    plan: 'pro_mensile',
    nome: 'PRO Mensile',
    prezzo: '9€',
    periodo: 'mese',
    descrizione: 'Massima flessibilità, disdici quando vuoi.',
    evidenziato: false,
    vantaggi: VANTAGGI_PRO,
    cta: 'Attiva PRO Mensile',
  },
  {
    plan: 'pro_annuale',
    nome: 'PRO Annuale',
    prezzo: '49€',
    periodo: 'anno',
    descrizione: 'Il massimo dell\u2019offerta, al prezzo migliore.',
    evidenziato: true,
    badge: '🏆 IL PIÙ SCELTO (Risparmi il 55%)',
    notaPrezzo: 'equivalente a circa 4€/mese',
    vantaggi: VANTAGGI_PRO,
    cta: 'Passa a PRO Annuale',
  },
  {
    plan: 'a_consumo',
    nome: 'Credito a Consumo',
    prezzo: '5€',
    periodo: 'per 5 crediti',
    descrizione: 'Paghi quando ti serve: 5 crediti, un servizio.',
    evidenziato: false,
    sottotitolo: '5 crediti = 5€ · Paghi solo quando ti serve, senza abbonamento.',
    vantaggi: VANTAGGI_CONSUMO,
    cta: 'Acquista crediti',
  },
];

const faq = [
  {
    q: 'Posso cancellarmi quando voglio?',
    a: 'Sì. Un click e cancelliamo tutto: nessun rinnovo automatico nascosto.',
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
  const [crediti, setCrediti] = useState<number>(5);

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

  const handleCta = (piano: PianoId, quantita?: number) => {
    // Analytics: click sulla CTA del piano (funnel verso il checkout).
    track('cta_pro_click', { piano, ...(quantita !== undefined ? { quantita } : {}) });
    if (user) {
      // Già autenticato: avvia subito il checkout, MAI il modal di login/registrazione.
      void avviaCheckout(piano, undefined, quantita);
      return;
    }
    // Utente anonimo: salva il piano desiderato (e la quantità crediti per A Consumo) così
    // dopo login/registrazione il checkout riparte automaticamente (AppContext).
    try {
      localStorage.setItem(STORAGE_KEY_INTENDED_PLAN, piano);
      if (quantita !== undefined) {
        localStorage.setItem(STORAGE_KEY_INTENDED_PLAN_DATA, JSON.stringify({ promo: '', quantita }));
      } else {
        localStorage.removeItem(STORAGE_KEY_INTENDED_PLAN_DATA);
      }
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
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="text-center">
            <h1 className="mb-8 text-3xl font-bold text-primary-900 sm:text-4xl">
              Smetti di perdere tempo. D&apos;ora in poi ci pensiamo noi.
            </h1>
          </div>

          <div className="mx-auto grid max-w-5xl items-stretch gap-6 md:grid-cols-3">
            {piani.map((p) => (
              <div
                key={p.nome}
                className={`relative flex flex-col rounded-3xl border p-6 shadow-card transition ${
                  p.evidenziato
                    ? 'border-secondary-500 bg-gradient-to-b from-secondary-50 to-white shadow-soft ring-1 ring-secondary-500/25 md:z-10 md:scale-105'
                    : 'border-primary-100 bg-white'
                }`}
              >
                {p.evidenziato && p.badge && (
                  <span className="absolute -top-4 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-500 px-4 py-1.5 text-xs font-bold text-white shadow-soft">
                    <Sparkles className="h-3.5 w-3.5" />
                    {p.badge}
                  </span>
                )}

                <div className="text-center">
                  <h2 className="text-lg font-bold text-primary-800">{p.nome}</h2>
                  <p className="mx-auto mt-1 min-h-[40px] max-w-[240px] text-sm text-primary-500">
                    {p.descrizione}
                  </p>
                  <p className="mt-4">
                    <span className="text-4xl font-extrabold text-primary-900">
                      {p.plan === 'a_consumo' ? `${crediti}€` : p.prezzo}
                    </span>{' '}
                    <span className="text-sm font-medium text-primary-500">
                      / {p.plan === 'a_consumo' ? `per ${crediti} crediti` : p.periodo}
                    </span>
                  </p>
                  {p.notaPrezzo && (
                    <p className="mt-1 text-xs font-semibold text-secondary-700">{p.notaPrezzo}</p>
                  )}
                  {p.sottotitolo && (
                    <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
                      {p.sottotitolo}
                    </p>
                  )}
                </div>

                {p.plan === 'a_consumo' && (
                  <div className="mt-4">
                    <p className="text-center text-[11px] font-bold uppercase tracking-wide text-primary-400">
                      Ricarica a blocchi di 5 crediti
                    </p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {OPZIONI_CREDITI.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setCrediti(n)}
                          aria-pressed={crediti === n}
                          className={`rounded-xl border px-1 py-2 text-center transition ${
                            crediti === n
                              ? 'border-sky-700 bg-sky-700 text-white shadow-soft'
                              : 'border-primary-200 bg-white text-primary-700 hover:bg-primary-50'
                          }`}
                        >
                          <span className="block text-sm font-bold leading-tight">{n}€</span>
                          <span className="block text-[10px] leading-tight opacity-80">{n} crediti</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.vantaggi.map((v) => (
                    <li key={v.testo} className="flex items-start gap-2 text-sm">
                      {v.incluso ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-error-500" />
                      )}
                      <span className={v.incluso ? 'text-primary-700' : 'text-primary-400'}>
                        {v.testo}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCta(p.plan, p.plan === 'a_consumo' ? crediti : undefined)}
                  className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-soft transition ${
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
      <section className="bg-white py-8 sm:py-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 p-8 text-white shadow-card">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-primary-100">
              <Sparkles className="h-4 w-4" />
              Nuovo: incluso nel piano PRO
            </span>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Accesso completo a PureFocus</h2>
            <p className="mt-3 text-primary-100">
              La piattaforma che trasforma YouTube in un ambiente di studio e lavoro: elimina
              distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve
              per ottimizzare il tuo tempo.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-8 sm:py-10">
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

      <section className="bg-primary-900 py-10 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-800 px-3 py-1 text-sm font-medium text-primary-200">
            <ShieldCheck className="h-4 w-4 text-accent-300" />
            Il sito per chi vive la scuola
          </span>
          <h2 className="mt-4 text-3xl font-bold text-white">Attiva il tuo Radar Scuole</h2>
          <p className="mt-3 text-lg text-primary-200">Crea il tuo profilo in 5 secondi!</p>
          <button
            onClick={() => (user ? navigate('/dashboard/radar') : openAuthModal('registrazione'))}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent-500 px-8 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-accent-600"
          >
            <Send className="h-5 w-5" />
            Inizia Ora
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
