import { X } from 'lucide-react';

interface PillProps {
  label: string;
  onRemove?: () => void;
  color?: 'primary' | 'secondary' | 'accent';
}

export function Pill({ label, onRemove, color = 'primary' }: PillProps) {
  const colors = {
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
    secondary: 'bg-secondary-50 text-secondary-700 border-secondary-200',
    accent: 'bg-accent-50 text-accent-700 border-accent-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium ${colors[color]}`}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Rimuovi ${label}`}
          className="rounded-full p-0.5 transition hover:bg-white/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}
