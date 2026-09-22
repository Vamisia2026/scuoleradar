/**
 * Landing — sezione «Ecco cosa riceverai» (benefici/features).
 *
 * Spiega cosa arriva all'utente quando il Radar è attivo, con una card di
 * esempio (`VetrinaCard`). Nessuna prop dal contenitore: è una sezione
 * autosufficiente, ricomponibile in altre pagine vetrina.
 */
import { VetrinaCard } from './LandingCards';

export function LandingBenefici() {
  return (
      <section className="bg-primary-50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-primary-900">Cosa riceverai</h2>
            <p className="mt-3 text-primary-600">
              Esempi degli avvisi che il radar ti segnala, filtrati per il tuo profilo.
            </p>
          </div>
          <div className="animate-fade-in grid gap-5 md:grid-cols-3">
            <VetrinaCard
              tipo="Supplenza"
              tipoClasse="bg-primary-50 text-primary-600"
              classe="A-18"
              titolo="Interpello supplenza Filosofia e Scienze Umane"
              scuola="Liceo Classico A. Manzoni"
              provincia="AT"
              scadenza="30/09/2026"
            />
            <VetrinaCard
              tipo="Bando PNRR"
              tipoClasse="bg-secondary-50 text-secondary-700"
              classe="A-050"
              titolo="Esperto esterno Biologia e Chimica"
              scuola="IIS G. Carducci"
              provincia="RM"
              scadenza="12/09/2026"
            />
            <VetrinaCard
              tipo="Sostegno"
              tipoClasse="bg-accent-50 text-accent-700"
              classe="ADEE"
              titolo="Supplenza sostegno scuola primaria"
              scuola="IC Dante Alighieri"
              provincia="AL"
              scadenza="05/10/2026"
            />
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-base font-medium leading-relaxed text-primary-700">
            Inserisci il tuo profilo e vedrai solo le opportunità davvero pertinenti per te.
          </p>
        </div>
      </section>
  );
}
