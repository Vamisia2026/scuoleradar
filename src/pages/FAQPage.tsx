import { HelpCircle, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';

/** Domande frequenti del servizio (pagina pubblica /faq) — copy sales-oriented. */
const FAQ_ITEMS = [
  {
    q: 'Come funzionano i radar personalizzati su di me?',
    a: 'Imposti i parametri come la provincia, la materia e l’ordine di scuola a cui sei interessato e ogni giorno facciamo tre ricerche al giorno per trovare se c’è qualcosa che ci sembra adatto a te. Se lo troviamo te lo mandiamo subito via Telegram e email (per questo raccomandiamo di attivare Telegram). Spesso queste opportunità hanno scadenze temporali molto brevi, quindi trovarle in tempo è importantissimo e l’alternativa è passare la vita a cercarle.',
  },
  {
    q: 'Perché non ricevo le vostre notifiche tutti i giorni?',
    a: 'Per scelta personale e professionale, abbiamo deciso di non mettere angoscia alle persone intasando la casella di notifiche inutili. Quando ricevete un messaggio da Scuole Radar è perché dovete aprirlo. Se non ricevete niente è perché non c’è niente di adatto: state tranquilli e dedicatevi ad altro.',
  },
  {
    q: 'Non ho un curriculum pronto o aggiornato, come faccio?',
    a: 'Abbiamo a disposizione il nostro strumento per costruire il CV. Puoi copiare e incollare un vecchio CV o ti aiutiamo noi a costruirne uno da zero. Si può usare liberamente anche con l’account Base.',
  },
  {
    q: 'Non so a quali classi di concorso posso accedere col mio titolo.',
    a: 'Abbiamo messo a disposizione il nostro Calcolatore CFU: basta inserire i tuoi titoli di studio e gli esami sostenuti per avere una stima delle classi di concorso a cui puoi accedere o di quali crediti devi integrare.',
  },
  {
    q: 'Ho un dubbio o un problema sul lavoro a scuola, posso parlarne con qualcuno?',
    a: 'Mettiamo a disposizione il nostro Assistente Sindacalista Virtuale, addestrato per dare un parere il più accurato possibile su situazioni e normative lavorative scolastiche. Questa funzionalità è riservata agli abbonati PRO.',
  },
  {
    q: 'Mi serve un modulo specifico ma non riesco a trovarlo. Potete aiutarmi?',
    a: 'Abbiamo una sezione Modulistica con oltre 1.000 modelli organizzati. Se hai dubbi su quale sia quello giusto per la tua situazione, puoi chiedere direttamente al nostro Archivista Capo AI presente nella stessa pagina.',
  },
  {
    q: 'Come posso regalare un anno di abbonamento a un collega?',
    a: 'Ci stiamo attrezzando per il regalo diretto. Per il momento puoi usare il tuo codice personale nella sezione "Invita un collega": il tuo amico riceve 10€ di sconto sull’abbonamento annuale e tu ottieni un buono da 10€.',
  },
];

/** Pagina Domande Frequenti (FAQ) — pubblica, raggiungibile da /faq. */
export function FAQPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main>
        <section className="bg-gradient-to-b from-primary-50 to-white">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-primary-600" />
              <h1 className="text-3xl font-bold text-primary-900">Domande frequenti</h1>
            </div>
            <p className="mt-3 max-w-2xl text-lg text-primary-600">
              Le risposte alle domande più comuni su ScuoleRadar. Se non trovi quello che cerchi,
              scrivici tramite il{' '}
              <Link to="/contatti" className="font-semibold text-primary-600 underline hover:text-primary-800">
                modulo contatti
              </Link>
              .
            </p>

            <div className="mt-8 space-y-3">
              {FAQ_ITEMS.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-2xl border border-primary-100 bg-white p-5 shadow-card"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-base font-semibold text-primary-800">
                    {f.q}
                    <span className="text-primary-400 transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-primary-600">{f.a}</p>
                </details>
              ))}
            </div>

            <p className="mt-8 flex items-center gap-1.5 text-sm text-primary-500">
              <MessageCircle className="h-4 w-4" />
              Altre domande? Scrivici tramite il{' '}
              <Link to="/contatti" className="font-semibold text-primary-600 underline hover:text-primary-800">
                modulo contatti
              </Link>
              , di solito rispondiamo entro 1-2 giorni lavorativi.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
