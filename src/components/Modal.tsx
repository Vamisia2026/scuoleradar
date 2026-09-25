import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Classe z-index del contenitore (default z-50; es. z-[9999] per stare sopra gli overlay di sviluppo). */
  zClass?: string;
  /** Classi extra della card (es. sfondo allineato alla palette: `bg-slate-50`). Sostituisce il default `bg-white`. */
  cardClassName?: string;
  /**
   * Layout COMPATTO: header/gutter ridotti e card più alta (`max-h-[92vh]`), così
   * un contenuto denso (es. wizard Radar a 4 passi) rientra nello schermo senza
   * barra di scorrimento interna. Default `false`: nessun cambio per gli altri modal.
   */
  dense?: boolean;
}

export function Modal({ open, onClose, title, children, size = 'md', zClass = 'z-50', cardClassName = 'bg-white', dense = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : size === 'xl' ? 'max-w-5xl' : 'max-w-xl';

  // PORTAL su `document.body`: il modal DEVE essere relativo al viewport.
  // Renderizzato inline, un antenato con `transform` (es. `animate-fade-in`,
  // che mantiene `translateY(0)` con fill `both`) diventa containing block di
  // `position: fixed` → l'overlay comparirebbe in fondo alla pagina ("card persa").
  return createPortal(
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center ${dense ? 'p-1.5 sm:p-2' : 'p-4'}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-primary-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxW} ${dense ? 'max-h-[96vh]' : 'max-h-[90vh]'} overflow-y-auto rounded-2xl ${cardClassName} shadow-card animate-pop`}
      >
        <div
          className={`flex items-center justify-between border-b border-primary-100 ${dense ? 'px-4 py-2' : 'px-5 py-4'}`}
        >
          <h3 className={`font-bold text-primary-800 ${dense ? 'text-base' : 'text-lg'}`}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="rounded-full p-1.5 text-primary-500 transition hover:bg-primary-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={dense ? 'p-3' : 'p-5'}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
