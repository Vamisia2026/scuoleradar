import { Calculator } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { CfuTool } from '@/components/CfuTool';

export function CfuPage() {
  const { user } = useApp();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-primary-600" />
        <h2 className="text-3xl font-bold text-primary-800">Calcolatore CFU</h2>
      </div>
      {!user && (
        <div className="rounded-2xl border border-warning-500/30 bg-warning-50 p-5 shadow-card">
          <p className="text-lg font-bold text-primary-800">Disponibile da Ottobre!</p>
          <p className="mt-1 leading-relaxed text-primary-700">
            Il tool di verifica e calcolo dei CFU per le classi di concorso è attualmente in fase di
            aggiornamento normativo. Sarà accessibile direttamente dal tuo account a partire da
            Ottobre.
          </p>
        </div>
      )}
      <p className="rounded-2xl border border-primary-100 bg-white p-5 text-lg leading-relaxed text-primary-600 shadow-card">
        Inserisci i tuoi titoli di studio e gli esami che hai sostenuto, segui la nostra guida e scopri
        a quali classi di concorso puoi accedere o cosa ti manca. Il servizio è incluso nell&apos;
        abbonamento ScuoleRadar. Puoi anche acquistarlo singolarmente a €5, ma con €9 hai un mese di
        abbonamento tutto incluso. Vedi tu.
      </p>
      <CfuTool />
    </div>
  );
}
