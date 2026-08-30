import { useState, type FormEvent } from 'react';
import { Sparkles, Send, Bot, User as UserIcon, Lock, MapPin } from 'lucide-react';
import { ExperimentalBanner } from '@/components/ExperimentalBanner';
import { useApp } from '@/contexts/AppContext';
import { AbbonamentoModal } from '@/components/AbbonamentoModal';
import { province } from '@/data/province';
import { useToast } from '@/components/Toast';

interface Messaggio {
  autore: 'bot' | 'utente';
  testo: string;
}

const benvenuto: Messaggio = {
  autore: 'bot',
  testo:
    'Ciao! Sono l\u2019Assistente Sindacalista Virtuale di ScuoleRadar. Presto potrai chiedermi qualsiasi cosa su graduatorie, mobilità, supplenze, requisiti e normativa scolastica. Sto ancora imparando: ti faccio sapere appena sarò pronto.',
};

/** Province ordinate per nome per il select "Provincia di riferimento". */
const provinceOrdinate = [...province].sort((a, b) => a.nome.localeCompare(b.nome));

/** Disclaimer legale obbligatorio: l'assistente è uno strumento informativo, non una consulenza. */
function DisclaimerLegale() {
  return (
    <div className="rounded-xl border border-warning-500/30 bg-warning-50 px-4 py-3 text-xs leading-relaxed text-warning-700">
      L'Assistente Sindacalista Virtuale è uno strumento informativo automatizzato basato su
      intelligenza artificiale. Non costituisce consulenza legale o sindacale formale.
    </div>
  );
}

export function AssistenteAIPage() {
  const { abbonato, user, avviaCheckout, openVetrina } = useApp();
  const { mostraToast } = useToast();
  const [messaggi, setMessaggi] = useState<Messaggio[]>([benvenuto]);
  const [testo, setTesto] = useState('');
  const [emailAccesso, setEmailAccesso] = useState('');
  // Beta waitlist: profilo dell'utente in lista d'attesa.
  const [nomeCognome, setNomeCognome] = useState('');
  const [provinciaRif, setProvinciaRif] = useState('');
  const [inquadramento, setInquadramento] = useState('');
  const [materiaClasse, setMateriaClasse] = useState('');
  const [eta, setEta] = useState('');
  const [apriPro, setApriPro] = useState(false);

  const handleRichiediAccesso = (e: FormEvent) => {
    e.preventDefault();
    if (!nomeCognome.trim() || !emailAccesso.trim() || !provinciaRif || !inquadramento) return;
    try {
      localStorage.setItem(
        'scuoleradar:richiesta_assistente',
        JSON.stringify({
          nomeCognome: nomeCognome.trim(),
          email: emailAccesso.trim(),
          provincia: provinciaRif,
          inquadramento,
          materiaClasse: materiaClasse.trim(),
          eta,
          data: new Date().toISOString(),
        }),
      );
    } catch {
      // localStorage non disponibile
    }
    setNomeCognome('');
    setEmailAccesso('');
    setProvinciaRif('');
    setInquadramento('');
    setMateriaClasse('');
    setEta('');
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
          <h2 className="text-3xl font-bold text-primary-800">Assistente Sindacalista Virtuale</h2>
        </div>

        <div className="rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
          <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-600">
            <Lock className="h-3.5 w-3.5" />
            Beta · solo su invito · riservato ai PRO
          </span>
          <h3 className="mt-4 text-2xl font-bold text-primary-800">Assistente Sindacalista Virtuale</h3>
          <p className="mx-auto mt-1 max-w-2xl text-lg leading-relaxed text-primary-500">
            L'Assistente Sindacalista Virtuale risponde alle domande che normalmente faresti a un
            sindacalista: ti aiuta a capire le leggi che riguardano il tuo lavoro, i tuoi diritti e
            gli adempimenti da fare, indicandoti anche i moduli che ti servono. È un servizio di
            consulenza pensato per darti una risposta chiara per non perdere tempo. Il servizio è
            riservato agli abbonati annuali e mensili ed è attualmente in fase sperimentale,
            disponibile in versione Beta, solo su invito.
          </p>

          <form
            onSubmit={handleRichiediAccesso}
            className="mx-auto mt-5 max-w-2xl space-y-4 rounded-2xl border border-primary-100 bg-primary-50/50 p-5 text-left"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-primary-700">
                  Nome e Cognome
                </span>
                <input
                  type="text"
                  required
                  value={nomeCognome}
                  onChange={(e) => setNomeCognome(e.target.value)}
                  placeholder="Mario Rossi"
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-primary-700">
                  Email (per la lista d'attesa)
                </span>
                <input
                  type="email"
                  required
                  value={emailAccesso}
                  onChange={(e) => setEmailAccesso(e.target.value)}
                  placeholder="mario@esempio.it"
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary-700">
                  <MapPin className="h-3.5 w-3.5" />
                  Provincia di riferimento
                </span>
                <select
                  required
                  value={provinciaRif}
                  onChange={(e) => setProvinciaRif(e.target.value)}
                  className="input"
                >
                  <option value="">Seleziona la provincia…</option>
                  {provinceOrdinate.map((p) => (
                    <option key={p.codice} value={p.codice}>
                      {p.nome} ({p.codice})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-primary-700">
                  Inquadramento
                </span>
                <select
                  required
                  value={inquadramento}
                  onChange={(e) => setInquadramento(e.target.value)}
                  className="input"
                >
                  <option value="">Seleziona…</option>
                  <option value="ruolo">Insegnante di ruolo</option>
                  <option value="gps">Inserito in GPS</option>
                  <option value="interpelli">Cerco interpelli e supplenze</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-primary-700">
                  Materia / Classe di concorso
                </span>
                <input
                  type="text"
                  value={materiaClasse}
                  onChange={(e) => setMateriaClasse(e.target.value)}
                  placeholder="Es. A-22, sostegno ADEE…"
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-primary-700">Età (anni)</span>
                <input
                  type="number"
                  min={18}
                  max={99}
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                  placeholder="Es. 34"
                  className="input"
                />
              </label>
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 sm:w-auto"
            >
              <Send className="h-4 w-4" />
              Richiedi l'accesso in prova
            </button>
          </form>

          <div className="mx-auto mt-5 max-w-2xl text-left">
            <DisclaimerLegale />
          </div>

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
        <h2 className="text-lg font-bold text-primary-800">Assistente Sindacalista Virtuale</h2>
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
            placeholder="Fai una domanda al Sindacalista Virtuale…"
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

      <DisclaimerLegale />
    </div>
  );
}
