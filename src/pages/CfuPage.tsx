import { Calculator } from 'lucide-react';
import { CfuTool } from '@/components/CfuTool';

export function CfuPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-primary-600" />
        <h2 className="text-3xl font-bold text-primary-800">Calcolatore CFU</h2>
      </div>
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
