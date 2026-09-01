import { Link } from 'react-router-dom';
import { Mail, MessageSquareText, CheckCircle2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { ContactForm } from '@/components/ContactForm';
import { Footer } from './LandingPage';

/**
 * Pagina /contatti — form di contatto a pagina intera (stesso ContactForm della
 * modal). Le richieste vengono inoltrate al sistema interno tramite l'Edge
 * Function `contatto` (nessuna email pubblica da cercare).
 */
export function ContattiPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-soft">
            <Mail className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-primary-800">Contattaci</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-primary-500">
            Assistenza, proposte o segnalazioni: scegli il dipartimento giusto e il
            messaggio arriva direttamente al nostro team. Di solito rispondiamo entro
            1-2 giorni lavorativi.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-primary-100 bg-white p-6 shadow-card sm:p-8">
          <ContactForm />
        </div>

        <div className="mt-6 grid gap-3 text-sm text-primary-500 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-xl border border-primary-100 bg-white p-4 shadow-sm">
            <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" />
            <p>
              <strong className="text-primary-700">Niente email pubbliche:</strong> usa il form qui sopra,
              le richieste arrivano al nostro sistema interno.
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-primary-100 bg-white p-4 shadow-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p>
              <strong className="text-primary-700">Risposta garantita</strong> entro 1-2 giorni lavorativi,
              come indicato nelle nostre comunicazioni.
            </p>
          </div>
        </div>

        <p className="mt-6 text-left text-xs text-primary-400">
          Oppure torna alla{' '}
          <Link to="/" className="text-primary-600 underline hover:text-primary-800">
            home
          </Link>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}