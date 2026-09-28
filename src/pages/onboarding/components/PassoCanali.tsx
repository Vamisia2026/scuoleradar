/**
 * Onboarding · PASSO 4 — canali di notifica (Telegram + email) e ultimi dati.
 *
 * Tono AUTOREVOLE: Telegram è il canale PRIMARIO — l'avviso parte nell'istante in
 * cui l'opportunità viene pubblicata ed è la massima potenza di fuoco del Radar.
 * L'email è un riepilogo, una volta al giorno. Al termine del percorso arrivano
 * genere ed età (statistiche di settore): nessuna domanda personale all'apertura e
 * nessuna etichetta «facoltativo».
 *
 * Presentazione pura: valori e handler arrivano dalla pagina.
 */
import { Check, Mail, Send, Zap } from 'lucide-react';

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
  /** Anagrafica facoltativa raccolta a FINE percorso (genere + età). */
  anagrafica: {
    genere: 'M' | 'F' | null;
    setGenere: (valore: 'M' | 'F' | null) => void;
    eta: string;
    setEta: (valore: string) => void;
  };
}

export function PassoCanali({
  telegramCollegato,
  telegramDeepLink,
  telegramUsername,
  setTelegramUsername,
  emailNotifica,
  setEmailNotifica,
  anagrafica,
}: PassoCanaliProps) {
  const { genere, setGenere, eta, setEta } = anagrafica;
  return (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-primary-800">Canali di notifica</h2>
              <p className="mt-1 text-sm text-primary-600">
                Telegram consegna l&apos;avviso nell&apos;istante in cui l&apos;opportunità viene
                pubblicata; l&apos;email è un riepilogo, una volta al giorno.
              </p>

              <div className="mt-6 space-y-5">
                {/* TELEGRAM — canale primario: avvisi istantanei, la massima potenza
                    di fuoco del Radar (deeplink ?start=<user_id>). */}
                <div className="rounded-xl border-2 border-primary-300 bg-primary-50 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
                    <Zap className="h-4 w-4 text-primary-600" />
                    Telegram — avvisi istantanei
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-primary-600">
                    Premi il pulsante qui sotto: si aprirà il bot{' '}
                    <strong>@ScuoleRadar_bot</strong> con il tuo account già riconosciuto. Nel bot
                    premi <strong>Start</strong>: da quel momento ogni opportunità per il tuo profilo
                    arriva in chat, nell&apos;istante in cui viene pubblicata. È il canale con la
                    massima potenza di fuoco e si collega in pochi secondi.
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
                    Username Telegram
                  </span>
                  <input
                    type="text"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    placeholder="Il tuo username Telegram, senza @"
                    className="input"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-primary-700">
                    <Mail className="h-4 w-4 text-primary-500" />
                    Email — riepilogo giornaliero
                  </span>
                  <input
                    type="email"
                    value={emailNotifica}
                    onChange={(e) => setEmailNotifica(e.target.value)}
                    className="input"
                  />
                  <span className="mt-1 block text-xs leading-relaxed text-primary-500">
                    Un solo messaggio al giorno: nell&apos;email non arrivano gli avvisi in tempo
                    reale, che viaggiano su Telegram.
                  </span>
                </label>

                {/* Ultimo blocco del percorso: genere ed età servono alle statistiche di
                    settore. Nessuna domanda personale all'apertura, nessuna etichetta
                    «facoltativo». */}
                <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4">
                  <p className="text-sm font-bold text-primary-800">Il tuo profilo</p>
                  <p className="mt-0.5 text-xs text-primary-500">
                    Genere ed età ci servono per le statistiche sul mondo della scuola.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <span className="mb-1.5 block text-xs font-semibold text-primary-700">Genere</span>
                      <div className="grid grid-cols-2 gap-2">
                        {(['F', 'M'] as const).map((valore) => (
                          <button
                            key={valore}
                            type="button"
                            onClick={() => setGenere(genere === valore ? null : valore)}
                            aria-pressed={genere === valore}
                            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                              genere === valore
                                ? 'border-accent-400 bg-accent-50 text-accent-700'
                                : 'border-primary-200 bg-white text-primary-600 hover:bg-primary-50'
                            }`}
                          >
                            {valore === 'F' ? 'Donna' : 'Uomo'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs font-semibold text-primary-700">Età (anni)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={14}
                        max={100}
                        value={eta}
                        onChange={(e) => setEta(e.target.value)}
                        className="input"
                        placeholder="Età"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
  );
}
