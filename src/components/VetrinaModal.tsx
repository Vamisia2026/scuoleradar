import type { ReactNode } from 'react';
import { MessageSquare, Calculator, FileText, FolderOpen, PenLine, Radar, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useApp } from '@/contexts/AppContext';
import { STORAGE_KEY_INTENDED_PLAN } from '@/lib/pricing';

interface DettaglioVetrina {
  icona: ReactNode;
  titolo: string;
  testo: string;
}

/** Descrizioni per sezione: valore del servizio mostrato nel modal di conversione. */
const dettagli: Record<string, DettaglioVetrina> = {
  radar: {
    icona: <Radar className="h-6 w-6" />,
    titolo: 'Radar Scuole',
    testo:
      'Interpelli, supplenze e bandi mappati per te: i primi 3 sono gratuiti. Attiva le notifiche e continua a monitorare le opportunità su misura per te.',
  },
  cv: {
    icona: <FileText className="h-6 w-6" />,
    titolo: 'Crea CV',
    testo:
      'Trasforma il tuo CV in un layout ordinato. Registrandoti gratuitamente scarichi il PDF (con logo), con il PRO senza logo.',
  },
  cfu: {
    icona: <Calculator className="h-6 w-6" />,
    titolo: 'Check CFU',
    testo:
            'Verifica le classi di concorso accessibili dal tuo percorso di studi: in arrivo a Ottobre, riservato ai membri PRO.',
  },
  moduli: {
    icona: <FolderOpen className="h-6 w-6" />,
    titolo: 'Modulistica',
    testo:
      'Modelli e documenti pronti all\u2019uso (domande, autocertificazioni, lettere di presentazione). I download sono disponibili con un account gratuito.',
  },
  assistente: {
    icona: <MessageSquare className="h-6 w-6" />,
    titolo: 'Assistente Sindacalista Virtuale',
    testo:
      'Risposte su graduatorie, mobilità e supplenze. Il servizio è incluso per i PRO: registrati e richiedi l\u2019accesso in anteprima.',
  },
  purefocus: {
    icona: <PenLine className="h-6 w-6" />,
    titolo: 'PureFocus',
    testo:
      'PureFocus è una piattaforma straordinaria che trasforma YouTube in un ambiente di studio e lavoro: elimina distrazioni, suggerimenti e contenuti irrilevanti, lasciandoti solo ciò che ti serve per ottimizzare il tuo tempo. PureFocus costa 29$ all\u2019anno ed è incluso nel tuo abbonamento a Scuole Radar.',
  },
};

/** Modal di conversione "Vetrina Freemium": scelta tra Free, PRO Mensile, PRO Annuale. */
export function VetrinaModal() {
  const { user, vetrinaAperta, vetrinaSezione, closeVetrina, openAuthModal, avviaCheckout } =
    useApp();
  const dettaglio = (vetrinaSezione && dettagli[vetrinaSezione]) || null;

  const scegliPiano = (piano: 'free' | 'pro_mensile' | 'pro_annuale') => {
    closeVetrina();

    if (piano === 'free') {
      // Account Base: solo registrazione (mai checkout).
      if (!user) openAuthModal('registrazione', 'default');
      return;
    }

    if (user) {
      // Già autenticato: checkout Stripe IMMEDIATO per il piano scelto, nessun altro click.
      void avviaCheckout(piano);
      return;
    }

    // Utente anonimo: salva il piano scelto e apri l'Auth modal con header dedicato PRO.
    // Dopo login/signup (Google o email) il checkout ripartirà automaticamente (AppContext).
    try {
      localStorage.setItem(STORAGE_KEY_INTENDED_PLAN, piano);
    } catch {
      // localStorage non disponibile
    }
    openAuthModal('registrazione', 'pro');
  };

  return (
    <Modal open={vetrinaAperta} onClose={closeVetrina} title="Attiva ScuoleRadar" size="sm">
      <div className="space-y-4">
        {dettaglio && (
          <div className="flex items-start gap-3 rounded-xl bg-primary-50 p-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white">
              {dettaglio.icona}
            </span>
            <div>
              <p className="font-bold text-primary-800">{dettaglio.titolo}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-primary-600">{dettaglio.testo}</p>
            </div>
          </div>
        )}

        <p className="text-sm text-primary-600">
          {user
            ? 'Sei già nel tuo account Base: continua gratis oppure passa al PRO per notifiche illimitate.'
            : 'Crea il tuo account gratuito e inizia subito. Scegli il piano che preferisci:'}
        </p>

        <div className="space-y-2">
          {user ? (
            <button
              onClick={() => scegliPiano('free')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary-200 px-5 py-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
            >
              <ShieldCheck className="h-4 w-4" />
              Continua con Account Base
            </button>
          ) : (
            <button
              onClick={() => scegliPiano('free')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary-200 px-5 py-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
            >
              <UserPlus className="h-4 w-4" />
              Registrati (Account Base - Gratis)
            </button>
          )}
          <button
            onClick={() => scegliPiano('pro_mensile')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-secondary-200 px-5 py-3 text-sm font-semibold text-secondary-700 transition hover:bg-secondary-50"
          >
            <Sparkles className="h-4 w-4" />
            PRO Mensile · 9€/mese
          </button>
          <button
            onClick={() => scegliPiano('pro_annuale')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
          >
            <Sparkles className="h-4 w-4" />
            PRO Annuale · 49€/anno (consigliato)
          </button>
        </div>

        <p className="text-left text-sm font-medium text-primary-500">
          L&apos;unica cosa che ti dispiacerà è non averlo fatto prima.
        </p>
      </div>
    </Modal>
  );
}