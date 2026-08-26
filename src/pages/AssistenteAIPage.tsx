import { useState, type FormEvent } from 'react';
import { Sparkles, Send, Bot, User as UserIcon, Lock } from 'lucide-react';
import { ExperimentalBanner } from '@/components/ExperimentalBanner';
import { useApp } from '@/contexts/AppContext';
import { ServiziPaywall } from '@/components/ServiziPaywall';

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
  const { abbonato, crediti, consumaCredito } = useApp();
  const [messaggi, setMessaggi] = useState<Messaggio[]>([benvenuto]);
  const [testo, setTesto] = useState('');
  const [sbloccato, setSbloccato] = useState(false);

  // Riservato agli abbonati PRO, oppure sbloccabile a consumo con 1 credito per sessione.
  if (!abbonato && !sbloccato) {
    return crediti > 0 ? (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-bold text-primary-800">Assistente AI</h2>
        </div>
        <div className="rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <Lock className="h-7 w-7 text-primary-400" />
          </span>
          <h3 className="mt-4 text-lg font-bold text-primary-800">Sessione riservata</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-primary-500">
            L&apos;Assistente AI è riservato agli abbonati PRO oppure sbloccabile a consumo con{' '}
            <strong>1 credito per sessione</strong> (ne hai {crediti}).
          </p>
          <button
            onClick={() => void consumaCredito().then((esito) => esito.ok && setSbloccato(true))}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
          >
            <Sparkles className="h-4 w-4" />
            Consuma 1 credito e avvia la sessione
          </button>
        </div>
      </div>
    ) : (
      <ServiziPaywall
        titolo="Assistente AI riservato"
        messaggio="L'Assistente AI richiede il piano PRO oppure 1 credito a consumo per sessione."
      />
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
