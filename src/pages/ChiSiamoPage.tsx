import { BellRing, ShieldCheck, Heart, Radar } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';

const valori = [
  {
    icon: <BellRing className="h-6 w-6" />,
    titolo: 'Solo ciò che conta',
    testo:
      'Nessun contatore aggressivo, nessun risultato sfocato. Se oggi non c\u2019è nulla di rilevante per te, te lo diciamo.',
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    titolo: 'Trasparenza prima di tutto',
    testo:
      'Niente sorprese in fattura, niente rinnovi automatici nascosti. Il prezzo è chiaro e lo resta.',
  },
  {
    icon: <Heart className="h-6 w-6" />,
    titolo: 'Rispetto per il tuo tempo',
    testo:
      'Pensiamo noi alla ricerca. Tu pensa a insegnare. È questo il rispetto che meriti.',
  },
];

export function ChiSiamoPage() {
  const { openAuthModal } = useApp();

  return (
    <div className="min-h-screen">
      <Header />

      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
          <h1 className="text-3xl font-bold text-primary-900 sm:text-4xl">
            Facciamo risparmiare tempo ai docenti
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-primary-700">
            ScuoleRadar.it nasce da una frustrazione semplice: ogni giorno centinaia di interpelli,
            bandi per esperti, progetti CPIA e PON vengono pubblicati in luoghi diversi, in orari
            diversi, senza un filo logico. Chi insegna — o vorrebbe insegnare — è costretto a
            spulciare siti e circolari per ore, spesso perdendosi la notizia che conta.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-primary-700">
            Noi raccogliamo queste opportunità, le puliamo, le classifichiamo e le confrontiamo con
            il profilo di ogni iscritto. Alla fine ricevi solo ciò che ti riguarda davvero: su
            Telegram o via email, quando serve.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-primary-700">
            Siamo un progetto indipendente, piccolo e artigianale. Crediamo che il tempo di un
            docente valga più di 29€ all\u2019anno, e ci comportiamo di conseguenza.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold text-primary-900">I nostri valori</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {valori.map((v) => (
              <div key={v.titolo}>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  {v.icon}
                </span>
                <h3 className="mt-4 text-lg font-bold text-primary-800">{v.titolo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary-600">{v.testo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-primary-900 sm:text-3xl">
                Un prototipo costruito in trasparenza
              </h2>
              <p className="mt-4 leading-relaxed text-primary-700">
                Quello che vedi è un prototipo dimostrativo: i dati di esempio restano sul tuo
                dispositivo e i pagamenti sono simulati. È il nostro modo di mostrarti il prodotto
                prima di chiederti un centesimo. Se ti piace, lo portiamo avanti insieme.
              </p>
              <button
                onClick={() => openAuthModal('registrazione')}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600"
              >
                <Radar className="h-5 w-5" />
                Prova il Radar gratis
              </button>
            </div>
            <div className="rounded-2xl border border-primary-100 bg-white p-6 shadow-card">
              <h3 className="text-sm font-bold text-primary-800">Dove siamo oggi</h3>
              <ul className="mt-4 space-y-3 text-sm text-primary-700">
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent-500" />
                  Radar Interpelli: in produzione (prototipo)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent-500" />
                  Il mio CV: in produzione (prototipo)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-secondary-500" />
                  Check CFU e Assistente AI: in sperimentazione su invito
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-secondary-500" />
                  Pagamenti reali: in arrivo
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
