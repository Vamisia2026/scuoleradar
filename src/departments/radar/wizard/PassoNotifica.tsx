/**
 * Wizard Radar — PASSO 4 «Canali di notifica e ultimi dati».
 *
 * Tono AUTOREVOLE e operativo. Telegram è il canale con la massima potenza di
 * fuoco: l'avviso parte nell'istante in cui l'opportunità viene pubblicata.
 * L'email consegna un solo riepilogo al giorno. Niente formule deboli (nessun
 * «consigliato» enfatico) e nessuna notazione algebrica al posto delle parole;
 * nessun suggerimento su cosa scrivere nei campi: il campo si spiega con il
 * proprio nome.
 *
 * Il passo CHIUDE il percorso: in fondo raccoglie i dati anagrafici facoltativi
 * (nome, cognome, genere, età) che prima aprivano il wizard — non si chiede nulla
 * di personale prima che l'utente abbia visto il valore del Radar. I dati
 * viaggiano nella bozza di registrazione: al form finale non si riscrivono.
 *
 * Presentazione pura: valori e handler arrivano dal contenitore.
 */
import { AlertTriangle, Check, Loader2, Mail, Send, Zap } from 'lucide-react';
import { BloccoAnagrafica, type DatiAnagrafica } from '@/components/BloccoAnagrafica';
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
  /** Anagrafica facoltativa: si chiede a FINE percorso, non all'apertura. */
  anagrafica: {
    dati: DatiAnagrafica;
    onChange: (patch: Partial<DatiAnagrafica>) => void;
  };
  /** Registrazione rapida con Google: mostrata solo ai Guest (fine del wizard). */
  rapida?: {
    ospite: boolean;
    googleInCorso: boolean;
    onGoogle: () => void;
  };
}

export function PassoNotifica({ notifica, piano, anagrafica, rapida }: PassoNotificaProps) {
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
        Telegram consegna l&apos;avviso appena viene pubblicato; l&apos;email un riepilogo al giorno.
      </p>

      {/* TELEGRAM: canale immediato, il più potente che abbiamo. */}
      <div className="mt-2.5 rounded-xl border-2 border-primary-300 bg-primary-50 p-3">
        <p className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
          <Zap className="h-4 w-4 text-primary-600" />
          Telegram — avvisi istantanei
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-primary-600">
          Premi <strong>Start</strong> nel bot: da quel momento ogni opportunità per il tuo profilo
          ti arriva in chat, nell&apos;istante in cui viene pubblicata. È il canale con la massima
          potenza di fuoco e si collega in pochi secondi; puoi scollegarlo quando vuoi.
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
          {telegramCollegato ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
              <Check className="h-3.5 w-3.5" /> Telegram collegato
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-semibold text-warning-700">
              <AlertTriangle className="h-3.5 w-3.5" /> non ancora collegato
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-primary-700">
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
          <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-primary-700">
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
            Un solo messaggio al giorno: nell&apos;email non arrivano gli avvisi in tempo reale, che
            viaggiano su Telegram.
          </span>
        </label>

        {/* Registrazione rapida: ultimo passo del funnel per i Guest. */}
        {ospite && rapida && (
          <div className="rounded-xl border border-primary-200 bg-white p-3">
            <p className="text-sm font-bold text-primary-800">Salva il tuo Radar in 1 click</p>
            <p className="mt-0.5 text-xs leading-relaxed text-primary-500">
              Con Google crei l&apos;account senza compilare nulla: nome, genere, età e provincia qui
              sotto finiscono nel tuo profilo e il periodo PRO si attiva da solo.
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
              Il tuo account PRO è attivo: attiva il Radar e cerchiamo noi le opportunità per te.
            </p>
          ) : isTrialAttivo ? (
            <p>
              Il tuo account è PRO per i primi 30 giorni, con{' '}
              <a
                href="https://purefocus.one"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent-800 underline decoration-accent-300 underline-offset-2 hover:text-accent-900"
              >
                PureFocus incluso
              </a>
              : attiva il Radar e cerchiamo noi le opportunità per te.
            </p>
          ) : (
            <p className="text-primary-600">
              Il tuo account è attivo: attiva il Radar e inizia a ricevere le opportunità su misura
              per te.
            </p>
          )}
        </div>

        {/* Dati anagrafici: ultimo blocco del percorso (genere ed età servono alle
            statistiche di settore). */}
        <BloccoAnagrafica
          dati={anagrafica.dati}
          onChange={anagrafica.onChange}
          nota="Genere ed età ci servono per le statistiche sul mondo della scuola."
          compatto
        />
      </div>
    </div>
  );
}
