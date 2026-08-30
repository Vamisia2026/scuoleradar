import { FileText } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { CvTool } from '@/components/CvTool';

export function CvPage() {
  const { user } = useApp();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary-600" />
        <h2 className="text-3xl font-bold text-primary-800">Crea CV</h2>
      </div>
      {!user && (
        <div className="rounded-2xl border border-warning-500/30 bg-warning-50 p-5 shadow-card">
          <p className="text-lg font-bold text-primary-800">In arrivo ad Ottobre!</p>
          <p className="mt-1 leading-relaxed text-primary-700">
            Stiamo completando uno strumento pensato per formattare il tuo Curriculum Vitae in modo
            perfetto per le candidature scolastiche. La funzionalità sarà attiva a partire da
            Ottobre per tutti gli utenti.
          </p>
        </div>
      )}
      <CvTool />
    </div>
  );
}
