import { useState, type FormEvent } from 'react';
import { Sparkles, Send, Bot, User as UserIcon } from 'lucide-react';
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
  const { abbonato } = useApp();
  const [messaggi, setMessaggi] = useState<Messaggio[]>([benvenuto]);
  const [testo, setTesto] = useState('');

  // Riservato ESCLUSIVAMENTE agli abbonati PRO (piano annuo o mensile).
  if (!abbonato) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-bold text-primary-800">Assistente AI</h2>
        </div>
        <ServiziPaywall
          titolo="Assistente AI riservato ai PRO"
          messaggio="L'Assistente AI è incluso esclusivamente nel piano PRO (annuo o mensile). È la leva per i docenti: passa a PRO per usarlo senza limiti."
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
