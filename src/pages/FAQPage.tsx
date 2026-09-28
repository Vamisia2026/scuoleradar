/**
 * Domande frequenti del servizio (pagina pubblica `/faq`).
 *
 * Copy di POSIZIONAMENTO: ogni risposta è un punto di forza commerciale o una
 * istruzione operativa (inserire ScuoleRadar tra le app attendibili della scuola,
 * «Invita un Collega», PureFocus con l'account Gmail, servizi in arrivo). Nessun
 * tono difensivo, nessuna parola di pagamento accostata alla prova inclusa.
 *
 * L'ancora `#animatore-digitale` è pubblica e referenziata da
 * `AuthModal`/`NotaAccessoScolastico`: NON va rinominata.
 */
import { HelpCircle, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const FAQ_ITEMS: Array<{ id?: string; q: string; a: string }> = [
  {
    id: 'radar-personalizzati',
    q: 'Come funziona il Radar e cosa mi arriva?',
    a: 'Decidi tu dove e cosa cercare: provincia, classi di concorso, ordine di scuola e le competenze che puoi mettere in campo (bandi PNRR/PON, laboratori, progetti). Da quel momento il Radar controlla le fonti da solo, ogni giorno: le opportunità compatibili con il tuo profilo ti arrivano su Telegram e via email. Quando non c’è nulla che ti riguarda non ricevi messaggi inutili.',
  },
  {
    id: 'animatore-digitale',
    q: 'Sono Animatore Digitale o Referente Google: come inserisco ScuoleRadar tra i siti sicuri della scuola?',
    a: 'Bastano due minuti e vale per tutto l’Istituto: apri la Google Admin Console, vai su Sicurezza › Controllo dell’accesso e dei dati › Controlli API e App terze, scegli «Aggiungi app», cerca ScuoleRadar (oppure incolla il Client ID che ti forniamo) e contrassegnala come «Attendibile» (Trusted). Da quel momento tutti i docenti della tua scuola accedono con un click, senza email personali e senza blocchi.',
  },
  {
    id: 'accesso-google-edu',
    q: 'Perché con l’email Google della scuola (.edu.it) non riesco ad accedere?',
    a: 'Molti Istituti bloccano per impostazione predefinita le app esterne non autorizzate. Puoi entrare subito con email e password oppure con il tuo account Google personale; se sei il referente digitale della scuola, autorizzando ScuoleRadar come app attendibile (domanda qui sopra) sblocchi l’accesso per tutti i colleghi.',
  },
  {
    id: 'invita-un-collega',
    q: 'Come funziona «Invita un Collega»?',
    a: 'Nella sezione «Invita un Collega» trovi il tuo codice personale e il link pronto da condividere. Chi si abbona al piano PRO annuale con il tuo codice riceve 10 € di sconto; quando l’abbonamento risulta confermato, tu accumuli 10 € di credito. Gli utilizzi li segui dalla tua area, senza vedere alcun dato personale di chi ha usato il codice.',
  },
  {
    id: 'purefocus-gmail',
    q: 'Per usare PureFocus devo creare un account nuovo?',
    a: 'No: funziona nel browser con l’account Google che usi già, anche una normale @gmail.com. Nessun secondo account, nessun browser dedicato. È incluso nel piano PRO e lo apri dal tuo profilo, con il link diretto a purefocus.one.',
  },
  {
    q: 'Non ho un curriculum pronto o aggiornato, come faccio?',
    a: 'Usa il nostro strumento CV: incolla un vecchio curriculum e te lo ristrutturiamo, oppure costruiscilo da zero con i campi guidati. Con il piano PRO scarichi il PDF finito, senza logo.',
  },
  {
    q: 'Non so a quali classi di concorso posso accedere col mio titolo.',
    a: 'Il Calcolatore CFU stima in pochi minuti le classi di concorso a cui puoi accedere con i tuoi esami e quali crediti ti mancano per aggiungerne altre, sulle Tabelle A/B del D.P.R. 19/2016.',
  },
  {
    q: 'Mi serve un modulo specifico ma non riesco a trovarlo.',
    a: 'Nella sezione Modulistica ci sono oltre 1.000 modelli già pronti, organizzati per situazione. L’Archivista AI, nella stessa pagina, ti dice quale usare e ti aiuta a compilare i campi.',
  },
  {
    q: 'Ho un dubbio su una norma o un problema sul lavoro: con chi ne parlo?',
    a: 'Sta arrivando l’Assistente Sindacalista Virtuale: addestrato su normative e situazioni lavorative scolastiche, risponderà ai dubbi di GPS, mobilità, supplenze e contratti. È riservato agli abbonati PRO: dall’area PRO chiedi l’accesso in anteprima.',
  },
  {
    q: 'Posso pagare con la Carta del Docente?',
    a: 'Stiamo completando l’integrazione con la Carta del Docente per il piano PRO annuale: sarà uno dei modi per attivarlo, con il valore del buono che copre l’intero anno. Nel frattempo la prova inclusa parte comunque lo stesso giorno dell’iscrizione.',
  },
  {
    q: 'Cosa succede quando finisce la prova inclusa?',
    a: 'Nulla di automatico: la prova è di 30 giorni di PRO, non un abbonamento nascosto. Se non rinnovi, l’account prosegue con il piano Base — monitoraggio di una provincia e riepilogo giornaliero — e i servizi a consumo restano acquistabili singolarmente.',
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
              Come funziona il Radar, come attivarlo nella tua scuola, cosa è incluso nel piano: le
              risposte operative. Se non trovi quello che cerchi, scrivici tramite il{' '}
              <Link to="/contatti" className="font-semibold text-primary-600 underline hover:text-primary-800">
                modulo contatti
              </Link>
              .
            </p>

            <div className="mt-8 space-y-3">
              {FAQ_ITEMS.map((f) => (
                <details
                  id={f.id}
                  key={f.q}
                  className="group scroll-mt-24 rounded-2xl border border-primary-100 bg-white p-5 shadow-card"
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
