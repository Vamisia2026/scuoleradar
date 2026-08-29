import { useEffect, useRef, useState } from 'react';
import { Loader2, Mail, Building2, MessageSquare, Paperclip, Send, Trash2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

/** Dipartimenti del modulo contatti (inviato nell'oggetto dell'email di supporto). */
const DIPARTIMENTI = [
  'Assistenza & Supporto Tecnico',
  'Proposte & Suggerimenti',
  'Business & Partnership',
  'Stampa & Media',
] as const;

const MAX_ALLEGATO = 5 * 1024 * 1024; // 5 MB

interface AllegatoForm {
  name: string;
  type: string;
  data: string;
}

const inputCls =
  'w-full rounded-xl border border-primary-200 bg-white px-3.5 py-2.5 text-sm text-primary-800 placeholder:text-primary-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100';

/**
 * Modal "Contattaci / Get in Touch" (in stile PureFocus).
 * L'invio avviene tramite l'Edge Function Supabase `contatto`, che inoltra
 * la richiesta via Resend alla mail di supporto del progetto.
 */
export function ContattiModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useApp();
  const { mostraToast } = useToast();
  const [email, setEmail] = useState('');
  const [dipartimento, setDipartimento] = useState('');
  const [oggetto, setOggetto] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [allegato, setAllegato] = useState<AllegatoForm | null>(null);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // All'apertura: prefill dell'email (utente autenticato) e reset dello stato.
  useEffect(() => {
    if (!open) return;
    setErrore('');
    setInvio(false);
    setOggetto('');
    setMessaggio('');
    setAllegato(null);
    if (user?.email) setEmail(user.email);
    if (supabase) {
      void supabase.auth.getUser().then(({ data }) => {
        if (data.user?.email) setEmail(data.user.email);
      });
    }
  }, [open, user]);

  const selezionaFile = (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_ALLEGATO) {
      setErrore('Allegato troppo grande: dimensione massima 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result ?? '').split(',')[1] ?? '';
      setAllegato({ name: file.name, type: file.type, data: base64 });
      setErrore('');
    };
    reader.readAsDataURL(file);
  };

  const invia = async () => {
    setErrore('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrore('Inserisci un indirizzo email valido.');
      return;
    }
    if (!dipartimento) {
      setErrore('Scegli il dipartimento.');
      return;
    }
    if (messaggio.trim().length < 10) {
      setErrore('Scrivi un messaggio di almeno 10 caratteri.');
      return;
    }
    if (!supabase) {
      setErrore('Invio non disponibile in modalità demo (Supabase non configurato).');
      return;
    }

    setInvio(true);
    const { data, error } = await supabase.functions.invoke('contatto', {
      body: {
        email: email.trim(),
        dipartimento,
        oggetto: oggetto.trim(),
        messaggio: messaggio.trim(),
        allegato: allegato
          ? { name: allegato.name, type: allegato.type, data: allegato.data }
          : null,
      },
    });

    if (error) {
      const msg =
        (data as { error?: string } | null)?.error ??
        (error as { message?: string }).message ??
        'Errore di invio';
      setErrore(msg);
      setInvio(false);
      return;
    }

    setInvio(false);
    mostraToast('successo', 'Messaggio inviato! Ti risponderemo al più presto.');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Contattaci" size="lg">
      <p className="mb-4 text-sm leading-relaxed text-primary-500">
        Scrivici per assistenza, proposte o segnalazioni. Rispondiamo di solito entro 1-2 giorni lavorativi.
      </p>

      <div className="space-y-4">
        {/* Email */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-primary-700">
            <Mail className="h-4 w-4 text-primary-400" /> Email *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@esempio.it"
            className={inputCls}
          />
        </div>

        {/* Dipartimento */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-primary-700">
            <Building2 className="h-4 w-4 text-primary-400" /> Dipartimento *
          </label>
          <select value={dipartimento} onChange={(e) => setDipartimento(e.target.value)} className={inputCls}>
            <option value="">Seleziona un dipartimento…</option>
            {DIPARTIMENTI.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Oggetto */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-primary-700">
            <MessageSquare className="h-4 w-4 text-primary-400" /> Oggetto della richiesta
          </label>
          <input
            type="text"
            value={oggetto}
            onChange={(e) => setOggetto(e.target.value)}
            placeholder="Es. Problema con le notifiche"
            className={inputCls}
          />
        </div>

        {/* Messaggio */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-primary-700">
            <MessageSquare className="h-4 w-4 text-primary-400" /> Messaggio *
          </label>
          <textarea
            value={messaggio}
            onChange={(e) => setMessaggio(e.target.value)}
            rows={5}
            placeholder="Descrivi la tua richiesta…"
            className={inputCls}
          />
        </div>

        {/* Allegato */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-primary-700">
            <Paperclip className="h-4 w-4 text-primary-400" /> Allegato / screenshot (opzionale)
          </label>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => selezionaFile(e.target.files?.[0])}
          />
          {allegato ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary-100 bg-primary-50 px-3.5 py-2.5 text-sm text-primary-700">
              <span className="truncate">📎 {allegato.name}</span>
              <button
                onClick={() => {
                  setAllegato(null);
                  if (fileInput.current) fileInput.current.value = '';
                }}
                aria-label="Rimuovi allegato"
                className="rounded-full p-1 text-primary-500 transition hover:bg-primary-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary-300 bg-white px-3.5 py-3 text-sm font-medium text-primary-600 transition hover:bg-primary-50"
            >
              <Paperclip className="h-4 w-4" />
              Allega file o screenshot (max 5 MB)
            </button>
          )}
        </div>

        {errore && (
          <p className="rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-sm text-error-700">
            {errore}
          </p>
        )}

        <button
          onClick={() => void invia()}
          disabled={invio}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-60"
        >
          {invio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {invio ? 'Invio in corso…' : 'Invia messaggio'}
        </button>
      </div>
    </Modal>
  );
}
