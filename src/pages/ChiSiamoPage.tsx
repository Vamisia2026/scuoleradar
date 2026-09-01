import { Radar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';

export function ChiSiamoPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <Header />

      {/* Chi siamo */}
      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl font-bold leading-tight text-primary-900 sm:text-4xl">
            ScuoleRadar nasce dalla collaborazione di persone che lavorano nella scuola e che sono{' '}
            <span className="text-secondary-500">stufe di essere trattate come vacche da mungere</span>.
          </h1>

          <p className="mt-8 text-lg leading-relaxed text-primary-700">
            Abbiamo speso <strong>soldi, energia e tempo</strong>, sacrificando la nostra vita per
            qualificarci e poi scoprire che <strong>le regole erano cambiate</strong> e che un titolo
            non valeva più quello che valeva ieri.
          </p>

          <p className="mt-6 text-lg leading-relaxed text-primary-700">
            Cerchiamo di sopravvivere professionalmente in{' '}
            <strong>un Sistema che sembra costruito per farci affogare</strong> (e se hai mai cercato
            di usare la Carta del Docente, sai di cosa parliamo).
          </p>

          <p className="mt-6 text-lg leading-relaxed text-primary-700">
            Per questo motivo stiamo costruendo{' '}
            <strong>sistemi che facciano ordine nella confusione</strong>. Potremmo tenerli per noi e
            avere un vantaggio personale, ma vogliamo metterli a disposizione di tutti,{' '}
            <strong>a un prezzo accessibile</strong>, affinché le persone smettano di sacrificare la propria
            vita.
          </p>

          {/* Finale in evidenza */}
          <div className="mt-10 rounded-2xl border-l-4 border-secondary-500 bg-white p-6 shadow-card sm:p-8">
            <p className="text-xl font-semibold leading-relaxed text-primary-800">
              Perché insegnanti, personale ATA e tutti quelli che lavorano nella scuola meritano di
              meglio:
            </p>
            <p className="mt-2 text-xl font-bold leading-relaxed text-primary-900 sm:text-2xl">
              meno tempo sprecato a combattere contro il Sistema,{' '}
              <span className="text-secondary-500">più tempo per vivere</span>.
            </p>
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={() => navigate('/prezzi')}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-8 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600"
            >
              <Radar className="h-5 w-5" />
              Unisciti a noi
            </button>
            <p className="mt-3 text-sm text-primary-500">
              3 notifiche di prova in assoluto, senza carta di credito.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

