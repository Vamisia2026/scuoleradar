/**
 * Preferenze Radar — pannello «Canali di Notifica e Telegram».
 *
 * Responsabilità unica: mostrare/compilare i canali con cui l'utente riceve gli
 * avvisi (Telegram + email di backup) e spiegare il programma notifiche del piano.
 * Presentazione pura: stato e persistenza vivono nel contenitore `PreferenzeRadar`.
 */
import { Check, Mail, Send } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import type { Preferenze } from '@/contexts/AppContext';

interface PannelloCanaliProps {
  /** Mappa di apertura degli accordion (chiave → stato). */
  accordionAperti: Record<string, boolean>;
  /** Apre/chiude un accordion per chiave. */
  toggleAccordion: (chiave: string) => void;
  /** Preferenze correnti del profilo (chat id Telegram collegato, ecc.). */
  preferenze: Preferenze;
  /** Deep link al bot per il collegamento della chat. */
  telegramDeepLink: string;
  telegramUsername: string;
  setTelegramUsername: (valore: string) => void;
  telegramChatIdInput: string;
  setTelegramChatIdInput: (valore: string) => void;
  emailNotifica: string;
  setEmailNotifica: (valore: string) => void;
}

export function PannelloCanali({
  accordionAperti,
  toggleAccordion,
  preferenze,
  telegramDeepLink,
  telegramUsername,
  setTelegramUsername,
  telegramChatIdInput,
  setTelegramChatIdInput,
  emailNotifica,
  setEmailNotifica,
}: PannelloCanaliProps) {
  return (
      <Accordion
        icona="🔔"
        titolo="Canali di Notifica e Telegram"
        badge={
          [telegramUsername, telegramChatIdInput, emailNotifica].some(Boolean)
            ? 'configurati'
            : undefined
        }
        aperto={!!accordionAperti.canali}
        onToggle={() => toggleAccordion('canali')}
      >
        <p className="text-sm text-primary-500">
          Configura i canali su cui ricevere gli avvisi dei nuovi interpelli in tempo reale.
        </p>
        <p className="mt-2 rounded-xl bg-primary-50 px-3 py-2 text-xs text-primary-600">
          Piano PRO (mese di prova): notifiche e segnalazioni illimitate.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-primary-700">
              <Send className="h-4 w-4 text-primary-500" />
              Username Telegram (fortemente consigliato)
            </span>
            <input
              type="text"
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              placeholder="es. mario_rossi (senza @)"
              className="input"
            />
            <span className="mt-1.5 block text-xs leading-relaxed text-primary-500">
              Indica il tuo username Telegram senza @ (lo trovi su Telegram in: Impostazioni &gt;
              Modifica profilo &gt; Username. Se non ne hai uno, puoi crearlo lì al momento).
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-primary-700">
              <Mail className="h-4 w-4 text-primary-500" />
              Email (backup)
            </span>
            <input
              type="email"
              value={emailNotifica}
              onChange={(e) => setEmailNotifica(e.target.value)}
              className="input"
            />
          </label>
        </div>

        <div className="mt-5 rounded-xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-700">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-500">
            Collega Telegram
          </p>
          {preferenze.telegramChatId ? (
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
              <Check className="h-3.5 w-3.5" /> Telegram collegato
            </p>
          ) : null}
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              Premi <strong>Collega Telegram</strong>: si aprirà il bot{' '}
              <a
                href="https://t.me/ScuoleRadar_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary-700 underline"
              >
                @ScuoleRadar_bot
              </a>{' '}
              con il tuo account già riconosciuto.
            </li>
            <li>
              Nel bot premi <strong>Start</strong> (o invia il comando <code>/start</code>): il
              collegamento avviene automaticamente.
            </li>
            <li>
              Riceverai il messaggio di conferma e, da quel momento, le notifiche dei nuovi
              interpelli.
            </li>
          </ol>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={telegramChatIdInput}
              onChange={(e) => setTelegramChatIdInput(e.target.value)}
              placeholder="Chat ID (solo se preferisci il collegamento manuale)"
              className="input"
            />
            <a
              href={telegramDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
            >
              <Send className="h-4 w-4" />
              Collega Telegram
            </a>
          </div>
        </div>
        <p className="mt-3 text-xs text-primary-400">
          Con il pulsante "Collega Telegram" il tuo Chat ID viene salvato automaticamente nel profilo
          e usato per inviarti le notifiche Telegram.
        </p>
      </Accordion>
  );
}
