/**
 * Wizard Radar — PASSO 4 «Canali di notifica» (Telegram + email di backup).
 *
 * Presentazione pura: il collegamento Telegram e lo stato del piano arrivano
 * dal contenitore. Nessuna chiamata di rete, nessuna scrittura di preferenze.
 *
 * Il canale Telegram è messo in EVIDENZA perché è quello ISTANTANEO: l'email
 * consegna solo i riepiloghi, quindi senza Telegram si perdono le notifiche in
 * tempo reale. Per i Guest lo stesso passo offre la registrazione rapida con
 * Google OAuth (nessun form da compilare).
 */
import { AlertTriangle, Check, Loader2, Mail, Send, Zap } from 'lucide-react';
import { IconaGoogle } from '@/components/auth/IconaGoogle';

interface PassoNotificaProps {
  notifica: {
    /** true se il profilo ha già un chat_id Telegram collegato. */
    telegramCollegato: boolean;
    /** Deep link al bot Telegram per il collegamento. */
    telegramDeepLink: string;
    telegramUsername: string;
    setTelegramUsername: (valore: string) => void;
    emailNotifica: string;
    setEmailNotifica: (valore: string) => void;
  };
  piano: {
    /** true con PRO attivo (incluso Free Forever). */
    isProAttivo: boolean;
    /** true con la prova PRO di 30 giorni in corso. */
    isTrialAttivo: boolean;
  };
  /** Registrazione rapida con Google: mostrata solo ai Guest (fine del wizard). */
  rapida?: {
    ospite: boolean;
    googleInCorso: boolean;
    onGoogle: () => void;
  };
}

export function PassoNotifica({ notifica, piano, rapida }: PassoNotificaProps) {
  const {
    telegramCollegato,
    telegramDeepLink,
    telegramUsername,
    setTelegramUsername,
    emailNotifica,
    setEmailNotifica,
  } = notifica;
  const { isProAttivo, isTrialAttivo } = piano;
  const ospite = rapida?.ospite === true;

  return (
            <div className="animate-fade-in">
              <h2 className="text-base font-bold text-primary-800">Canali di notifica</h2>
              <p className="mt-0.5 text-xs text-primary-600">
                Ricevi gli avvisi direttamente su Telegram e via email.
              </p>

              {/* ENFASI TELEGRAM: è il canale ISTANTANEO; l'email dà i riepiloghi. */}
              <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-800">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                <p className="leading-relaxed">
                  <strong>Telegram = avvisi ISTANTANEI.</strong> Via email ricevi{' '}
                  <strong>solo i riepiloghi</strong>: se preferisci ricevere le opportunità appena
                  vengono pubblicate, collega Telegram. Bastano 10 secondi e puoi scollegarlo quando
                  vuoi.
                </p>
              </div>

              <div className="mt-3 space-y-3">
                {/* Collegamento Telegram via deeplink ?start=<user_id> */}
                <div className="rounded-xl border-2 border-primary-300 bg-primary-50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
                    <Zap className="h-4 w-4 text-primary-600" />
                    Collega Telegram (consigliato)
                  </p>
                  <p className="mt-0.5 text-xs text-primary-600">
                    Premi <strong>Start</strong> nel bot per collegarti: da quel momento gli avvisi
                    arrivano su Telegram.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={telegramDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3.5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                    >
                      <Send className="h-4 w-4" />
                      Collega Telegram
                    </a>
                    {telegramCollegato && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
                        <Check className="h-3.5 w-3.5" /> Telegram collegato
                      </span>
                    )}
                    {!telegramCollegato && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-semibold text-warning-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> non ancora collegato
                      </span>
                    )}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-primary-700">
                    <Send className="h-4 w-4 text-primary-500" />
                    Username Telegram (fortemente consigliato)
                  </span>
                  <input
                    type="text"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    placeholder="Il tuo username Telegram, senza @"
                    className="input"
                  />
                  <span className="mt-1 block text-xs leading-relaxed text-primary-500">
                    Indica il tuo username Telegram senza @ (lo trovi su Telegram in: Impostazioni
                    &gt; Modifica profilo &gt; Username. Se non ne hai uno, puoi crearlo lì al
                    momento).
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-primary-700">
                    <Mail className="h-4 w-4 text-primary-500" />
                    Email (riepiloghi, non avvisi immediati)
                  </span>
                  <input
                    type="email"
                    value={emailNotifica}
                    onChange={(e) => setEmailNotifica(e.target.value)}
                    className="input"
                  />
                  <span className="mt-1 block text-xs leading-relaxed text-primary-500">
                    L&apos;email resta utile come backup e per i riepiloghi giornalieri: gli avvisi
                    in tempo reale arrivano su Telegram.
                  </span>
                </label>

                {/* Registrazione rapida: ultimo passo del funnel per i Guest. */}
                {ospite && rapida && (
                  <div className="rounded-xl border border-primary-200 bg-white p-3">
                    <p className="text-sm font-bold text-primary-800">Salva il tuo Radar in 1 click</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-primary-500">
                      Con Google crei l&apos;account senza compilare nulla: nome, genere, età e
                      provincia che hai già indicato vengono salvati nel tuo profilo e il mese di
                      PRO si attiva automaticamente.
                    </p>
                    <button
                      type="button"
                      onClick={rapida.onGoogle}
                      disabled={rapida.googleInCorso}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary-500 bg-primary-50 px-4 py-2.5 text-sm font-bold text-primary-800 shadow-soft transition hover:bg-primary-100 disabled:cursor-wait disabled:opacity-70"
                    >
                      {rapida.googleInCorso ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                      ) : (
                        <IconaGoogle className="h-4 w-4" />
                      )}
                      Registrati con Google
                    </button>
                  </div>
                )}

                <div className="rounded-xl bg-accent-50 px-3 py-2 text-xs text-accent-700">
                  {isProAttivo ? (
                    <p>
                      Il tuo account PRO è attivo: attiva il Radar e cerchiamo noi le opportunità
                      per te.
                    </p>
                  ) : isTrialAttivo ? (
                    <p>
                      Il tuo account è attivo con <b>1 mese di PRO</b> offerto da{' '}
                      <a
                        href="https://purefocus.one"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent-800 underline decoration-accent-300 underline-offset-2 hover:text-accent-900"
                      >
                        PureFocus.one
                      </a>
                      : attiva il Radar e cerchiamo noi le opportunità per te.
                    </p>
                  ) : (
                    <p className="text-primary-600">
                      Il tuo account Base è attivo: attiva il Radar e inizia a ricevere le
                      opportunità su misura per te.
                    </p>
                  )}
                </div>
              </div>
            </div>
  );
}
