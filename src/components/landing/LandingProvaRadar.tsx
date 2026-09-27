/**
 * Landing — sezione «Guarda il Radar in azione».
 *
 * Ospita il simulatore pubblico del dominio Radar (`SimulatorRadar`). Fino a ieri
 * il box «Prova il Radar» viveva dentro l'hero: occupava metà del primo schermo e
 * toglieva il palco al Radar Live. Ora è una fascia dedicata dopo «I nostri
 * strumenti»: la prova resta a un click, ma non è più la prima cosa che si vede.
 */
import { SimulatorRadar } from '@/departments/radar';

export function LandingProvaRadar() {
  return (
    <section className="bg-primary-50 py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold text-primary-900">Guarda il Radar in azione</h2>
          <p className="mt-3 text-primary-600">
            Nessuna registrazione: scegli provincia e classe di concorso e vedi cosa il Radar trova
            in questo momento per il tuo profilo.
          </p>
        </div>
        <SimulatorRadar />
      </div>
    </section>
  );
}
