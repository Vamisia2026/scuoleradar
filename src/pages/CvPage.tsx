import { FileText } from 'lucide-react';
import { CvTool } from '@/components/CvTool';

export function CvPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-bold text-primary-800">Il mio CV</h2>
      </div>
      <CvTool />
    </div>
  );
}
