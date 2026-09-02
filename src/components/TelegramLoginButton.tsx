/**
 * Accedi con Telegram — widget ufficiale Telegram Login.
 * Il bottone personalizzato espande il widget Telegram ufficiale; il callback
 * fornisce { id, first_name, last_name, username, auth_date, hash } che verrà
 * validato lato Edge Function (`telegram-login`) usando TELEGRAM_BOT_TOKEN.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface TelegramAuthUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const BOT_USERNAME =
  (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.replace(/^@/, '').trim() ||
  'ScuoleRadar_bot';

declare global {
  interface Window {
    srOnTelegramAuth?: (user: TelegramAuthUser) => void;
  }
}

/** Bot Telegram con il quale è stato firmato il login. */
export function telegramBotUsername(): string {
  return BOT_USERNAME;
}

export function TelegramLoginButton({
  onSuccess,
  onError,
}: {
  onSuccess: () => void;
  onError?: (messaggio: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [aperto, setAperto] = useState(false);
  const [caricamento, setCaricamento] = useState(false);

  useEffect(() => {
    window.srOnTelegramAuth = (user) => {
      void (async () => {
        setCaricamento(true);
        try {
          if (!supabase) throw new Error('Supabase non configurato.');
          const { data, error } = await supabase.functions.invoke('telegram-login', {
            body: { auth_data: user },
          });
          if (error) throw new Error((error as { message?: string }).message ?? 'Errore Telegram');
          const res = data as { ok?: boolean; email?: string; password?: string; error?: string };
          if (!res?.ok || !res.email || !res.password) {
            throw new Error(res?.error ?? 'Login Telegram non riuscito.');
          }
          const { error: signError } = await supabase.auth.signInWithPassword({
            email: res.email,
            password: res.password,
          });
          if (signError) throw signError;
          onSuccess();
        } catch (err) {
          const msg = (err as Error).message ?? 'Errore durante il login Telegram.';
          onError?.(msg);
        } finally {
          setCaricamento(false);
          setAperto(false);
        }
      })();
    };
    return () => {
      delete window.srOnTelegramAuth;
    };
  }, [onSuccess, onError]);

  // Inietta il widget ufficiale Telegram (iframe) quando l'utente espande il pannello.
  useEffect(() => {
    if (!aperto || !containerRef.current) return;
    const contenitore = containerRef.current;
    contenitore.innerHTML = '';
    const nodo = document.createElement('div');
    nodo.setAttribute('data-telegram-login', BOT_USERNAME);
    nodo.setAttribute('data-size', 'large');
    nodo.setAttribute('data-radius', '10');
    nodo.setAttribute('data-request-access', 'write');
    nodo.setAttribute('data-onauth', 'srOnTelegramAuth(user)');
    contenitore.appendChild(nodo);

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    contenitore.appendChild(script);
  }, [aperto]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        disabled={caricamento}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:cursor-wait disabled:opacity-70"
      >
        {caricamento ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
            Verifica Telegram…
          </>
        ) : (
          <>
            <Send className="h-4 w-4 text-sky-600" />
            Accedi con Telegram
          </>
        )}
      </button>
      {aperto && (
        <div className="mt-3 rounded-xl border border-primary-100 bg-slate-50 p-3">
          <p className="mb-2 text-center text-xs text-primary-500">
            Premi il pulsante ufficiale di Telegram qui sotto per autorizzare l'accesso.
          </p>
          <div ref={containerRef} className="flex justify-center [&>div]:mx-auto" />
        </div>
      )}
    </div>
  );
}
