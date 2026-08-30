import { useEffect, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Loader2, Mail, Building2, MessageSquare, Paperclip, Send, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

/** Dipartimenti strategici del modulo contatti (value inviato all'Edge Function). */
const DIPARTIMENTI = [
  { value: 'commerciale', label: 'Commerciale & Partnerships' },
  { value: 'stampa', label: 'Ufficio Stampa & Media' },
  { value: 'assistenza', label: 'Assistenza Utenti & Account' },
  { value: 'tecnico', label: 'Segnalazioni Tecniche & Bug' },
] as const;

const MAX_ALLEGATO = 5 * 1024 * 1024; // 5 MB

/** Progetto Supabase remoto dove è deployata la Edge Function `contatto`. */
const SUPABASE_URL_REMOTO = 'https://gwdmsgsshvdnfrplbjiv.supabase.co';

/**
 * Client dedicato all'invio del form contatti: punta SEMPRE al progetto remoto
 * (gwdmsgsshvdnfrplbjiv), mai al CLI Supabase locale.
 */
function creaClientContattoRemoto(): SupabaseClient | null {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!anonKey || anonKey.includes('xxxx') || anonKey.includes('your-')) return null;
  return createClient(SUPABASE_URL_REMOTO, anonKey);
}

interface AllegatoForm {
  name: string;
  type: string;
  data: string;
}

const inputCls =
  'w-full rounded-xl border border-primary-200 bg-white px-3.5 py-2 text-sm text-primary-800 placeholder:text-primary-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100';

/**
 * Form contatti riutilizzabile (usato nella modal "Contattaci" e nella pagina /contatti).
 * L'invio avviene tramite l'Edge Function Supabase `contatto`, che inoltra la
 * richiesta via Resend al sistema interno (CONTACT_SUPPORT_EMAIL).
 */
export function ContactForm({ onInviato }: { onInviato?: () => void }) {
  const { user } = useApp();
  const { mostraToast } = useToast();
  const [email, setEmail] = useState('');
  const [dipartimento, setDipartimento] = useState('');
  const [oggetto, setOggetto] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [allegato, setAllegato] = useState<AllegatoForm | null>(null);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');
  // Honeypot anti-spam: campo invisibile, i bot lo compilano, gli umani no.
  const [website, setWebsite] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Prefill dell'email (utente autenticato) al montaggio del form.
  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (supabase) {
      void supabase.auth.getUser().then(({ data }) => {
        if (data.user?.email) setEmail(data.user.email);
      });
    }
  }, [user]);

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

    // L'invio punta SEMPRE alla Edge Function `contatto` deployata sul progetto
    // remoto (gwdmsgsshvdnfrplbjiv): mai al CLI Supabase locale in sviluppo.
    const clientRemoto = creaClientContattoRemoto();
    if (!clientRemoto) {
      setErrore('Invio non disponibile: configura VITE_SUPABASE_ANON_KEY nel file .env.');
      return;
    }

    setInvio(true);
    try {
      const { data, error } = await clientRemoto.functions.invoke('contatto', {
        body: {
          email: email.trim(),
          dipartimento,
          oggetto: oggetto.trim(),
          messaggio: messaggio.trim(),
          // Anti-spam: il campo honeypot (invisibile) se compilato scarta la richiesta.
          website: website.trim(),
          // Contesto per l'email: stato di login dell'utente.
          utenteLoggato: Boolean(user),
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
        setInvio(false);

        // Funzione remota non raggiungibile: messaggio chiaro, mai criptico.
        if (/Failed to send a request|fetch|ECONNREFUSED|network|load failed/i.test(msg)) {
          setErrore(
            'Servizio di contatto non raggiungibile: verifica la connessione e che la funzione sia deployata.',
          );
          return;
        }

        setErrore(msg);
        return;
      }

      // Invio riuscito: reset del form e conferma.
      setInvio(false);
      setDipartimento('');
      setOggetto('');
      setMessaggio('');
      setAllegato(null);
      setWebsite('');
      mostraToast('successo', 'Messaggio inviato! Ti risponderemo al più presto.');
      onInviato?.();
    } catch (err) {
      // Errore non gestito (rete/JSON): mai mostrare messaggi criptici.
      console.error('[contatti] errore non gestito:', err);
      setInvio(false);
      setErrore('Invio non riuscito: si è verificato un errore imprevisto.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Honeypot anti-spam: invisibile agli utenti, attira i bot */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="contatti-website">Lasciare questo campo vuoto</label>
        <input
          id="contatti-website"
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
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
            <option key={d.value} value={d.value}>
              {d.label}
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
          rows={3}
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
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary-300 bg-white px-3.5 py-2.5 text-sm font-medium text-primary-600 transition hover:bg-primary-50"
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-60"
      >
        {invio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {invio ? 'Invio in corso…' : 'Invia messaggio'}
      </button>
    </div>
  );
}