/**
 * SOFT ONBOARDING — modal non bloccante post-login.
 *
 * All'appena entrato (SIGNED_IN / sessione già attiva) verifica sul DB
 * (`profiles`) che l'utente abbia:
 *   · canale email valido (email_notifica oppure email auth reale, niente
 *     indirizzi Telegram segnaposto tg_*@telegram.scuoleradar.it);
 *   · Telegram collegato (telegram_chat_id);
 *   · almeno una preferenza Radar completa (province + classe di concorso).
 * Se manca qualcosa mostra una guida "soft" (fade-in, chiudibile, mai bloccante)
 * con passi dinamici in base al tipo di utente:
 *   · Google/email senza Telegram  → CTA "Attiva notifiche istantanee su Telegram";
 *   · utenti Telegram senza email  → campo email primaria;
 *   · preferenze mancanti          → selettori Provincia + Classe per attivare
 *     subito la prima regola Radar.
 * Include il claim sponsorizzato PureFocus: "…30 giorni di PRO offerti da PureFocus.one".
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, Gift, Loader2, Mail, MapPin, Radar, Send, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/components/Toast';
import { province } from '@/data/province';
import { classiConcorso } from '@/data/classiConcorso';

/** Evita di riproporre il modal nella stessa sessione dopo "Non ora". */
const STORAGE_KEY_SOFT_ONBOARD_DISMISSED = 'sr_soft_onboarding_dismissed';

function emailValida(email?: string | null): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim());
}

/** True se l'email auth è un segnaposto Telegram (tg_*@telegram.scuoleradar.it). */
function emailSegnapostoTelegram(email?: string | null): boolean {
  return /@telegram\.scuoleradar\.it$/i.test(String(email ?? '').trim());
}

interface StatoProfilo {
  email: string | null;
  email_notifica: string | null;
  telegram_chat_id: string | null;
  province_interesse: string[] | null;
  province_attive: string[] | null;
  classi_concorso: string[] | null;
  provider?: string | null;
  providers?: string[] | null;
}

export function SoftOnboardingModal() {
  const { mostraToast } = useToast();
  const { supabaseUserId, loading, authModalOpen, radarWizardOpen } = useApp();
  const { pathname } = useLocation();

  const [aperto, setAperto] = useState(false);
  const [caricamento, setCaricamento] = useState(true);
  const [profilo, setProfilo] = useState<StatoProfilo | null>(null);

  // Input locali
  const [emailInput, setEmailInput] = useState('');
  const [provinciaSel, setProvinciaSel] = useState('');
  const [classeSel, setClasseSel] = useState('');
  const [salvando, setSalvando] = useState(false);

  const uidCorrente = supabaseUserId;

  // Calcolo "cosa manca"
  const emailCanaleReale = emailValida(profilo?.email_notifica)
    || (emailValida(profilo?.email) && !emailSegnapostoTelegram(profilo?.email));
  const telegramOk = Boolean(profilo?.telegram_chat_id);
  const provinceOk = (profilo?.province_interesse?.length ?? 0) > 0 || (profilo?.province_attive?.length ?? 0) > 0;
  const classiOk = (profilo?.classi_concorso?.length ?? 0) > 0;
  const prefsOk = provinceOk && classiOk;

  const mancaEmail = !emailCanaleReale;
  const mancaTelegram = !telegramOk;
  const mancaPrefs = !prefsOk;
  const tuttoOk = !mancaEmail && !mancaTelegram && !mancaPrefs;

  const isGoogle = (profilo?.providers ?? []).includes('google') || profilo?.provider === 'google';
  const isTelegram = telegramOk || (profilo?.providers ?? []).includes('telegram') || profilo?.provider === 'telegram';


  /** Carica la riga profilo aggiornata (canali + preferenze radar) dal DB. */
  const caricaProfilo = useCallback(async (): Promise<StatoProfilo | null> => {
    if (!supabase || !uidCorrente) return null;
    const { data: sessione } = await supabase.auth.getSession();
    const au = sessione.session?.user;
    const appMeta = (au?.app_metadata ?? {}) as Record<string, unknown>;
    const provider = String(appMeta.provider ?? '');
    const providers = Array.isArray(appMeta.providers)
      ? (appMeta.providers as unknown[]).map((p) => String(p))
      : [];

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'email, email_notifica, telegram_chat_id, province_interesse, province_attive, classi_concorso',
      )
      .eq('id', uidCorrente)
      .maybeSingle();
    if (error || !data) return null;
    return {
      ...(data as StatoProfilo),
      email: (data as StatoProfilo).email ?? au?.email ?? null,
      provider,
      providers,
    };
  }, [uidCorrente]);

  const dismissEseguitoInSessione = useCallback((): boolean => {
    try {
      return sessionStorage.getItem(STORAGE_KEY_SOFT_ONBOARD_DISMISSED) === (uidCorrente ?? '');
    } catch {
      return false;
    }
  }, [uidCorrente]);

  const segnaDismissSessione = useCallback((): void => {
    try {
      sessionStorage.setItem(STORAGE_KEY_SOFT_ONBOARD_DISMISSED, uidCorrente ?? '');
    } catch {
      // sessionStorage non disponibile: il modal potrà riapparire al reload
    }
  }, [uidCorrente]);

  /** Verifica i campi dal DB e (se mancanti) apre il modal con i passi giusti. */
  const valutaEApri = useCallback(async (): Promise<void> => {
    if (!uidCorrente || loading) return;
    if (pathname.startsWith('/onboarding') || authModalOpen || radarWizardOpen) return;
    const row = await caricaProfilo();
    setProfilo(row);
    setCaricamento(false);
    if (!row) return;

    // Prefill (una sola volta per sessione di modale)
    setProvinciaSel((prev) => prev || (row.province_interesse?.[0] ?? row.province_attive?.[0] ?? ''));
    setClasseSel((prev) => prev || (row.classi_concorso?.[0] ?? ''));
    const emailPrefill =
      emailValida(row.email_notifica)
        ? String(row.email_notifica ?? '')
        : emailValida(row.email) && !emailSegnapostoTelegram(row.email)
          ? String(row.email ?? '')
          : '';
    setEmailInput((prev) => prev || emailPrefill);

    const hasProv = (row.province_interesse?.length ?? 0) > 0 || (row.province_attive?.length ?? 0) > 0;
    const hasCl = (row.classi_concorso?.length ?? 0) > 0;
    const okEmail =
      emailValida(row.email_notifica) || (emailValida(row.email) && !emailSegnapostoTelegram(row.email));
    const okTelegram = Boolean(row.telegram_chat_id);
    const okPrefs = hasProv && hasCl;

    if (okEmail && okTelegram && okPrefs) {
      setAperto(false);
      return;
    }
    if (dismissEseguitoInSessione()) return;
    setAperto(true);
  }, [uidCorrente, loading, pathname, authModalOpen, radarWizardOpen, caricaProfilo, dismissEseguitoInSessione]);

  // All'apertura di una sessione (login) → verifica e apri in modo "soft".
  useEffect(() => {
    if (!uidCorrente) {
      setAperto(false);
      setCaricamento(true);
      setProfilo(null);
      try {
        sessionStorage.removeItem(STORAGE_KEY_SOFT_ONBOARD_DISMISSED);
      } catch {
        // ignore
      }
      return;
    }
    setCaricamento(true);
    void valutaEApri();
  }, [uidCorrente, loading, valutaEApri]);

  // Se l'utente sta collegando Telegram, al ritorno sulla scheda ricontrolla.
  useEffect(() => {
    if (!aperto || !mancaTelegram) return;
    const suFocus = (): void => {
      void valutaEApri();
    };
    window.addEventListener('focus', suFocus);
    const id = window.setInterval(suFocus, 8000);
    return () => {
      window.removeEventListener('focus', suFocus);
      window.clearInterval(id);
    };
  }, [aperto, mancaTelegram, valutaEApri]);

  const chiudiPerOra = (): void => {
    segnaDismissSessione();
    setAperto(false);
  };

  /** Salva email/preferenze e attiva il Radar; poi rivaluta lo stato. */
  const salvaImpostazioni = async (): Promise<void> => {
    if (!uidCorrente || !supabase) return;
    setSalvando(true);
    try {
      const updateEmail = emailInput.trim();
      const updateProv = provinciaSel.trim();
      const updateClasse = classeSel.trim();
      const riga: Record<string, unknown> = {};
      if (emailValida(updateEmail)) riga.email_notifica = updateEmail;
      if (updateProv) {
        riga.province_interesse = [updateProv];
        riga.province_attive = [updateProv];
      }
      if (updateClasse) riga.classi_concorso = [updateClasse];
      if (Object.keys(riga).length > 0) {
        const { error } = await supabase.from('profiles').update(riga).eq('id', uidCorrente);
        if (error) throw error;
      }
      if (updateProv || updateClasse) {
        await supabase.from('profiles').update({ radar_attivo: true }).eq('id', uidCorrente);
      }
      mostraToast('successo', updateProv || updateClasse ? 'Preferenze salvate: Radar attivo!' : 'Dati salvati.');
      await valutaEApri();
      if (tuttoOk) setAperto(false);
    } catch (err) {
      mostraToast('errore', (err as { message?: string }).message ?? 'Salvataggio non riuscito. Riprova.');
    } finally {
      setSalvando(false);
    }
  };


  if (!uidCorrente || caricamento || !aperto) return null;

  const passiMancanti = [mancaEmail, mancaTelegram, mancaPrefs].filter(Boolean).length;
  const salvaDisabilitato = salvando || (mancaEmail && !emailValida(emailInput));

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Completa il tuo Radar"
    >
      {/* Backdrop soft: chiusura non bloccante */}
      <div
        className="absolute inset-0 animate-fade-in bg-primary-900/30 backdrop-blur-[2px]"
        onClick={chiudiPerOra}
      />

      <div className="relative w-full max-w-lg animate-fade-in-lenta rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-soft">
            <Radar className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-primary-800">🎁 Hai appena ricevuto 1 mese PRO gratis</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-primary-500">
              Benvenuto in Scuole Radar! Completa il tuo Radar per sfruttare subito il mese PRO.
            </p>
          </div>
          <button
            type="button"
            onClick={chiudiPerOra}
            aria-label="Chiudi"
            className="rounded-full p-1.5 text-primary-400 transition hover:bg-primary-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Incentive: sponsorizzazione PureFocus */}
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent-50 px-3.5 py-2.5 text-xs text-accent-700">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
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
            .
          </p>
        </div>

        <div className="mt-4 space-y-3">


          {mancaTelegram && (
            <section className="rounded-xl border border-primary-100 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
                <Send className="h-4 w-4 text-primary-500" /> Notifiche istantanee su Telegram
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-primary-500">
                {isGoogle
                  ? 'Collega il tuo account al nostro bot e ricevi gli interpelli in tempo reale.'
                  : 'Ricevi gli interpelli compatibili direttamente su Telegram.'}
              </p>
              <a
                href={`https://t.me/ScuoleRadar_bot?start=${uidCorrente}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
              >
                <Send className="h-4 w-4" /> Attiva notifiche istantanee su Telegram
              </a>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-primary-400">
                <span>Nel bot premi Start: il collegamento è automatico.</span>
                <button
                  type="button"
                  onClick={() => void valutaEApri()}
                  className="shrink-0 font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-800"
                >
                  Ho collegato, aggiorna
                </button>
              </div>
            </section>
          )}

          {mancaEmail && (
            <section className="rounded-xl border border-primary-100 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
                <Mail className="h-4 w-4 text-primary-500" /> Email per le notifiche
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-primary-500">
                {isTelegram
                  ? 'Inserisci la tua email primaria: riceverai lì le conferme e le notifiche di backup.'
                  : 'Conferma la tua email per ricevere le notifiche di backup.'}
              </p>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="nome@email.it"
                className="input mt-2"
                autoComplete="email"
              />
              {!emailValida(emailInput) && emailInput.trim() !== '' && (
                <p className="mt-1 text-[11px] text-error-600">Inserisci un indirizzo email valido.</p>
              )}
            </section>
          )}

          {mancaPrefs && (
            <section className="rounded-xl border border-primary-100 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
                <MapPin className="h-4 w-4 text-primary-500" /> Attiva la tua prima regola Radar
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-primary-500">
                Scegli una provincia e una classe di concorso: il Radar parte subito.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary-500">Provincia</span>
                  <select
                    value={provinciaSel}
                    onChange={(e) => setProvinciaSel(e.target.value)}
                    className="input mt-1"
                  >
                    <option value="">— Scegli —</option>
                    {province.map((p) => (
                      <option key={p.codice} value={p.codice}>
                        {p.codice} · {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary-500">Classe di concorso</span>
                  <select
                    value={classeSel}
                    onChange={(e) => setClasseSel(e.target.value)}
                    className="input mt-1"
                  >
                    <option value="">— Scegli —</option>
                    {classiConcorso.map((c) => (
                      <option key={c.codice} value={c.codice}>
                        {c.codice}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}
        </div>

        {/* Footer: non bloccante → sempre possibile rimandare */}
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-primary-100 pt-4">
          <div className="text-[11px] text-primary-400">
            {passiMancanti > 0 ? (
              <>
                <Check className="mr-1 inline h-3 w-3 text-accent-500" />
                {3 - passiMancanti}/3 completati — puoi continuare quando vuoi.
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-accent-700">
                <Check className="h-3.5 w-3.5" /> Profilo pronto!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={chiudiPerOra}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-600 transition hover:bg-primary-50 disabled:opacity-50"
            >
              Non ora
            </button>
            <button
              type="button"
              onClick={() => void salvaImpostazioni()}
              disabled={salvaDisabilitato}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              Attiva il mio Radar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

