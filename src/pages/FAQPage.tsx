/**
 * Domande frequenti del servizio (pagina pubblica `/faq`).
 *
 * L'ELENCO delle voci — quali domande, con quale ancora HTML, in quale ordine — sta in
 * `src/data/faqPubbliche.ts`: lo STESSO elenco alimenta la sezione FAQ di `/prezzi`, così
 * le due superfici non possono divergere. I TESTI stanno nel registro
 * `src/data/editableTexts.ts` (chiavi `faq.<slug>.domanda` / `faq.<slug>.risposta`) e la
 * pagina li rende PER CHIAVE con `useTestiEditabili()` — una sola fonte di verità, zero
 * doppioni. L'«Editor Testi Rapido» della DEV Toolbar li modifica al volo in sviluppo.
 *
 * Copy di POSIZIONAMENTO: ogni risposta è un punto di forza commerciale o una
 * istruzione operativa (inserire ScuoleRadar tra le app attendibili della scuola,
 * «Invita un Collega» con il buono Amazon, PureFocus incluso nel PRO con l'account
 * Gmail, Carta del Docente, piano più conveniente). Nessun tono difensivo: nessuna
 * domanda su disdette o sicurezza dei pagamenti e nessun annuncio di funzioni non
 * ancora attive (l'elenco e le ragioni della selezione stanno in `data/faqPubbliche.ts`).
 *
 * L'ancora `#animatore-digitale` è pubblica e referenziata da
 * `AuthModal`/`NotaAccessoScolastico`: NON va rinominata (vive nell'elenco condiviso).
 */
import { HelpCircle, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FAQ_PUBBLICHE } from '@/data/faqPubbliche';
import { useTestiEditabili } from '@/hooks/useTestiEditabili';

/**
 * Elenco delle voci (ancora HTML + chiavi del registro testi) in `@/data/faqPubbliche`:
 * lo stesso elenco alimenta la sezione FAQ di `/prezzi`, quindi le due superfici non
 * possono divergere. Niente copy nel markup: si cambia nel registro
 * (`src/data/editableTexts.ts`) o dall'«Editor Testi Rapido» della DEV Toolbar.
 */

/** Pagina Domande Frequenti (FAQ) — pubblica, raggiungibile da /faq. */
export function FAQPage() {
  // Testi dal registro (default del codice + eventuale override DEV): zero copy nel markup.
  const { testo } = useTestiEditabili();
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
              {FAQ_PUBBLICHE.map((f) => (
                <details
                  id={f.id}
                  key={f.q}
                  className="group scroll-mt-24 rounded-2xl border border-primary-100 bg-white p-5 shadow-card"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-base font-semibold text-primary-800">
                    {testo(f.q)}
                    <span className="text-primary-400 transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-primary-600">{testo(f.a)}</p>
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
