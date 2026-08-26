import { useState, type FormEvent } from 'react';
import { Sparkles, Send, Bot, User as UserIcon, Lock, Mail } from 'lucide-react';
import { ExperimentalBanner } from '@/components/ExperimentalBanner';
import { useApp } from '@/contexts/AppContext';
import { AbbonamentoModal } from '@/components/AbbonamentoModal';
import { useToast } from '@/components/Toast';

interface Messaggio {
  autore: 'bot' | 'utente';
  testo: string;
}

const benvenuto: Messaggio = {
  autore: 'bot',
  testo:
    'Ciao! Sono l\u2019Assistente AI di ScuoleRadar. Presto potrai chiedermi qualsiasi cosa su graduatorie, mobilità, supplenze e requisiti. Sto ancora imparando: ti faccio sapere appena sarò pronto.',
};

export function AssistenteAIPage() {
  const { abbonato, user, avviaCheckout, openVetrina } = useApp();
  const { mostraToast } = useToast();
  const [messaggi, setMessaggi] = useState<Messaggio[]>([benvenuto]);
  const [testo, setTesto] = useState('');
  const [emailAccesso, setEmailAccesso] = useState('');
  const [apriPro, setApriPro] = useState(false);

  const handleRichiediAccesso = (e: FormEvent) => {
    e.preventDefault();
    if (!emailAccesso.trim()) return;
    try {
      localStorage.setItem('scuoleradar:richiesta_assistente', emailAccesso.trim());
    } catch {
      // localStorage non disponibile
    }
    setEmailAccesso('');
    mostraToast(
      'successo',
      'Richiesta inviata: ti faremo sapere appena l\u2019accesso in prova sarà disponibile.',
    );
  };

  // Riservato ESCLUSIVAMENTE agli abbonati PRO (piano annuo o mensile).
  if (!abbonato) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary-600" />
          <h2 className="text-3xl font-bold text-primary-800">Assistente AI</h2>
        </div>

        <div className="rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
          <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-600">
            <Lock className="h-3.5 w-3.5" />
            Beta · solo su invito · riservato ai PRO
          </span>
          <h3 className="mt-4 text-2xl font-bold text-primary-800">Sindacalista Virtuale</h3>
          <p className="mx-auto mt-1 max-w-2xl text-lg leading-relaxed text-primary-500">
            Il Sindacalista Virtuale risponde alle domande che normalmente faresti a un sindacalista:
            ti aiuta a capire le leggi che riguardano il tuo lavoro, i tuoi diritti e gli adempimenti
            da fare, indicandoti anche i moduli che ti servono. È un servizio di consulenza pensato
            per darti una risposta chiara per non perdere tempo. Il servizio è riservato agli abbonati
            annuali e mensili ed è attualmente in fase sperimentale, disponibile in versione Beta,
            solo su invito.
          </p>

          <form
            onSubmit={handleRichiediAccesso}
            className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
              <input
                type="email"
                required
                value={emailAccesso}
                onChange={(e) => setEmailAccesso(e.target.value)}
                placeholder="La tua email per la lista d'attesa"
                className="input pl-9"
              />
            </div>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
            >
              <Send className="h-4 w-4" />
              Richiedi accesso
            </button>
          </form>

          <div className="mt-5">
            <button
              onClick={() => (user ? setApriPro(true) : openVetrina('assistente'))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-secondary-300 px-5 py-2.5 text-sm font-semibold text-secondary-700 transition hover:bg-secondary-50"
            >
              <Sparkles className="h-4 w-4" />
              {user ? 'Passa a PRO' : 'Registrati'}
            </button>
          </div>
        </div>

        <AbbonamentoModal
          open={apriPro}
          onClose={() => setApriPro(false)}
          onConfirm={(promo) => avviaCheckout('pro_annuale', promo)}
        />
      </div>
    );
  }

  const handleInvia = (e: FormEvent) => {
    e.preventDefault();
    if (!testo.trim()) return;
    setMessaggi((prev) => [...prev, { autore: 'utente', testo: testo.trim() }]);
    setTesto('');
    // Risposta simulata: il servizio è in sperimentazione
    window.setTimeout(() => {
      setMessaggi((prev) => [
        ...prev,
        {
          autore: 'bot',
          testo: 'Il servizio è in fase di sperimentazione accessibile solo su invito. Al momento non posso rispondere, ma il tuo messaggio è stato registrato per i test.',
        },
      ]);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-bold text-primary-800">Assistente AI</h2>
      </div>

      <ExperimentalBanner />

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <div className="max-h-96 space-y-4 overflow-y-auto">
          {messaggi.map((m, i) => (
            <div key={i} className={`flex ${m.autore === 'utente' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`flex max-w-[85%] items-start gap-2.5 rounded-2xl px-4 py-3 text-sm ${
                  m.autore === 'utente'
                    ? 'rounded-br-md bg-primary-500 text-white'
                    : 'rounded-bl-md bg-primary-50 text-primary-700'
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {m.autore === 'bot' ? (
                    <Bot className="h-4 w-4 text-primary-400" />
                  ) : (
                    <UserIcon className="h-4 w-4 text-primary-200" />
                  )}
                </span>
                <span className="leading-relaxed">{m.testo}</span>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleInvia} className="mt-4 flex gap-2">
          <input
            type="text"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Fai una domanda sull&apos;assistente AI…"
            className="input"
          />
          <button
            type="submit"
            disabled={!testo.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Invia
          </button>
        </form>
      </div>
    </div>
  );
}
