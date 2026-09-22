/**
 * Interpello · stato «avviso non disponibile» (`/interpello/:id`).
 *
 * Mai un rimbalzo silenzioso sulla Home: l'utente legge cosa è successo e ha
 * due vie d'uscita (Radar Scuole o home). Il rimando al Radar compare solo se il
 * dipartimento è visibile (feature flags): nessun link a un modulo spento.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

export function AvvisoAssente() {
  const { visibile } = useFeatureFlags();
  return (
    <div className="rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
      <h1 className="text-xl font-bold text-primary-800">Avviso non più disponibile</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-primary-600">
        Questo avviso non è presente nell&apos;archivio (potrebbe essere stato rimosso dalla fonte
        ufficiale o essere scaduto). Nessun problema: il tuo Radar continua a controllare per te le
        opportunità nella tua provincia e per le tue classi di concorso.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {visibile('radar') && (
          <Link
            to="/dashboard/radar"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            Vai al Radar Scuole
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alla home
        </Link>
      </div>
    </div>
  );
}
