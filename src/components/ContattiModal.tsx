import { Modal } from '@/components/Modal';
import { ContactForm } from '@/components/ContactForm';

/**
 * Modal "Contattaci / Get in Touch" — wrapper del form riutilizzabile ContactForm.
 * L'invio avviene tramite l'Edge Function Supabase `contatto`, che inoltra via
 * Resend al sistema interno del progetto (CONTACT_SUPPORT_EMAIL).
 */
export function ContattiModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Contattaci" size="lg">
      <p className="mb-3 text-sm leading-relaxed text-primary-500">
        Scrivici per assistenza, proposte o segnalazioni. Di solito rispondiamo entro 1-2 giorni lavorativi.
      </p>
      {open && <ContactForm onInviato={onClose} />}
    </Modal>
  );
}