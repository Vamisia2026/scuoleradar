/**
 * Landing — primitive di presentazione riutilizzabili dalle sezioni.
 *
 * Quattro componenti "senza stato", ognuno con props esplicite e solo markup:
 *  - `StepCard`    → i passi «Come funziona»
 *  - `ValueCard`   → le card dei valori
 *  - `VetrinaCard` → card servizio/CTA
 *  - `Stat`        → numero + etichetta (social proof)
 *
 * Estratte da `pages/LandingPage.tsx` per ridurne la dimensione: il markup e le
 * classi Tailwind sono identici all'originale.
 */
import { Calendar, MapPin } from 'lucide-react';
export function StepCard({
  icon,
  step,
  title,
  text,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className="relative rounded-2xl border border-primary-100 bg-white p-6 shadow-card transition hover:shadow-soft">
      <span className="absolute -top-3 -left-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary-500 text-sm font-bold text-white shadow-soft">
        {step}
      </span>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-bold text-primary-800">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-primary-600">{text}</p>
    </div>
  );
}

export function ValueCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white text-primary-600 shadow-soft">
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-bold text-primary-800">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-primary-600">{text}</p>
    </div>
  );
}

export function VetrinaCard({
  tipo,
  tipoClasse,
  classe,
  titolo,
  scuola,
  provincia,
  scadenza,
}: {
  tipo: string;
  tipoClasse: string;
  classe: string;
  titolo: string;
  scuola: string;
  provincia: string;
  scadenza: string;
}) {
  return (
    <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tipoClasse}`}>{tipo}</span>
        <span className="rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
          {classe}
        </span>
      </div>
      <h3 className="mt-3 text-base font-bold text-primary-800">{titolo}</h3>
      <p className="mt-1 truncate text-sm text-primary-500">{scuola}</p>
      <div className="mt-3 flex items-center gap-3 text-xs text-primary-500">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {provincia}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          Scade il {scadenza}
        </span>
      </div>
    </div>
  );
}

export function Stat({ numero, label }: { numero: string; label: string }) {
  return (
    <div>
      <p className="text-4xl font-bold text-white">{numero}</p>
      <p className="mx-auto mt-2 max-w-[220px] text-sm text-primary-200">{label}</p>
    </div>
  );
}

