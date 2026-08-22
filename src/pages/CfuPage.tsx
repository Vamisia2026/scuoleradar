import { Calculator } from 'lucide-react';
import { CfuTool } from '@/components/CfuTool';

export function CfuPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-bold text-primary-800">Check CFU</h2>
      </div>
      <CfuTool />
    </div>
  );
}
