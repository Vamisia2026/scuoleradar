/**
 * Onboarding · PASSO 4 — canali di notifica (Telegram + email).
 *
 * Collegamento del bot via deeplink, username Telegram e email di backup.
 * Presentazione pura: valori e handler arrivano dalla pagina.
 */
import { Check, Mail, Send } from 'lucide-react';

interface PassoCanaliProps {
  /** true se il profilo ha già un chat_id Telegram collegato. */
  telegramCollegato: boolean;
  /** Deeplink al bot con l'account già riconosciuto. */
  telegramDeepLink: string;
  telegramUsername: string;
  setTelegramUsername: (valore: string) => void;
  /** Email di backup per le notifiche. */
  emailNotifica: string;
  setEmailNotifica: (valore: string) => void;
}

export function PassoCanali({
  telegramCollegato,
  telegramDeepLink,
  telegramUsername,
  setTelegramUsername,
  emailNotifica,
  setEmailNotifica,
}: PassoCanaliProps) {
  return (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-primary-800">Canali di notifica</h2>
              <p className="mt-1 text-sm text-primary-600">
                Ricevi gli avvisi direttamente su Telegram e via email.
              </p>

              <div className="mt-6 space-y-5">
                {/* Collegamento Telegram via deeplink ?start=<user_id> */}
                <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
                  <p className="text-sm font-semibold text-primary-800">Collega Telegram</p>
                  <p className="mt-1 text-xs leading-relaxed text-primary-600">
                    Premi il pulsante qui sotto: si aprirà il bot{' '}
                    <strong>@ScuoleRadar_bot</strong> con il tuo account già riconosciuto.
                    Nel bot premi <strong>Start</strong>: il collegamento avviene automaticamente
                    e riceverai le notifiche in tempo reale.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={telegramDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                    >
                      <Send className="h-4 w-4" />
                      Collega Telegram
                    </a>
                    {telegramCollegato && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
                        <Check className="h-3.5 w-3.5" /> Telegram collegato
                      </span>
                    )}
                  </div>
                  {!telegramCollegato && (
                    <p className="mt-2 text-xs text-primary-400">
                      Puoi completare il collegamento anche più tardi dalla pagina Profilo.
                    </p>
                  )}
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-primary-700">
                    <Send className="h-4 w-4 text-primary-500" />
                    Username Telegram (opzionale)
                  </span>
                  <input
                    type="text"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    placeholder="@iltuousername"
                    className="input"
                  />
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
            </div>
  );
}
