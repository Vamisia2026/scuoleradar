/**
 * Contesto App · checkout Stripe del piano.
 *
 * Estratto da `AppContext.tsx`: salvataggio del "piano intenzionale" prima del
 * login (ripresa automatica post-auth) e avvio della sessione di pagamento con
 * lock anti-concorrenza (una sola scheda Stripe per azione utente).
 *
 * Dipendenza esterna: `openAuthModal` (quando il checkout richiede un utente
 * autenticato). Lo stato di piano/abbonamento non viene toccato: lo aggiorna il
 * webhook Stripe + il refresh del profilo.
 */
import { useCallback, useRef } from 'react';
import { STORAGE_KEY_INTENDED_PLAN, STORAGE_KEY_INTENDED_PLAN_DATA, type PianoId } from '@/lib/pricing';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

/** Dipendenze esterne del checkout. */
export interface OpzioniCheckout {
  /** Apre la modale di Auth quando serve un utente autenticato. */
  openAuthModal: (mode?: 'login' | 'registrazione', ctx?: 'default' | 'pro') => void;
}

/** Azioni di checkout esposte dal contesto. */
export interface Checkout {
  /** Salva il piano scelto prima del login (ripresa automatica post-auth). */
  salvaIntendedPlan: (piano: PianoId, promo?: string, quantita?: number) => void;
  /** Avvia il checkout Stripe per il piano richiesto (nuova scheda). */
  avviaCheckout: (
    plan: PianoId,
    promo?: string,
    quantita?: number,
  ) => Promise<{ ok: boolean; errore?: string }>;
}

export function useCheckout({ openAuthModal }: OpzioniCheckout): Checkout {
  /** Salva il piano scelto da un utente non autenticato (ripresa checkout dopo il login). */
  const salvaIntendedPlan = useCallback((piano: PianoId, promo?: string, quantita?: number) => {
    try {
      localStorage.setItem(STORAGE_KEY_INTENDED_PLAN, piano);
      if (promo || quantita !== undefined) {
        localStorage.setItem(
          STORAGE_KEY_INTENDED_PLAN_DATA,
          JSON.stringify({ promo: promo ?? '', quantita: quantita ?? 1 }),
        );
      } else {
        localStorage.removeItem(STORAGE_KEY_INTENDED_PLAN_DATA);
      }
    } catch {
      // localStorage non disponibile: si ripiega sul flusso standard (modal di Auth)
    }
  }, []);

  /** Lock anti-concorrenza per avviaCheckout: evita doppie sessioni / doppie schede Stripe. */
  const checkoutInCorsoRef = useRef(false);

  /** FASE 6 — avvia il checkout Stripe per il piano richiesto e redirige l'utente. */
  const avviaCheckout = useCallback(
    async (plan: PianoId, promo?: string, quantita?: number): Promise<{ ok: boolean; errore?: string }> => {
      // Guardia ANTI-DOPPIO-OPEN: se un checkout è già in volo (doppio click rapido,
      // doppio trigger, oppure ripresa post-login sovrapposta a un click manuale),
      // ignora la seconda chiamata → UNA sola scheda Stripe per azione utente.
      if (checkoutInCorsoRef.current) {
        console.warn('avviaCheckout — chiamata ignorata: checkout già in corso.');
        return { ok: false, errore: 'Un pagamento è già in corso. Controlla le schede aperte.' };
      }
      checkoutInCorsoRef.current = true;
      try {
      // Analytics: inizializzazione checkout (click "Diventa PRO" / ripresa piano).
      track('checkout_started', { plan, promo: promo || '', quantita: quantita ?? 1 });
      if (!supabase) {
        return {
          ok: false,
          errore:
            'Pagamenti non disponibili: mancano VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nel file .env. Riavvia il dev server dopo averle aggiunte.',
        };
      }
      // Il checkout richiede un utente autenticato su Supabase Auth (JWT nella richiesta).
      const { data: sessione } = await supabase.auth.getSession();
      if (!sessione.session) {
        // Utente non autenticato: salva il piano come "intended plan" così al termine del
        // login/registrazione il checkout ripartirà da solo (niente loop sul modal di Auth).
        salvaIntendedPlan(plan, promo, quantita);
        openAuthModal('login');
        return { ok: false, errore: 'Accedi al tuo account per procedere al pagamento.' };
      }
      // Normalizza il codice promo (es. BETA1ANNO) prima di inviarlo alla Edge Function:
      // la mappatura al Coupon ID è server-side (STRIPE_COUPON_BETA1ANNO).
      const promoNorm = promo ? promo.toUpperCase().replace(/[^A-Z0-9]/g, '') : undefined;
      const { data, error } = await supabase.functions.invoke('checkout', {
        body: {
          plan,
          promo: promoNorm,
          quantita,
          // URL di ritorno dinamici: la Edge Function usa questa origin
          // (mai un fallback rigido su localhost).
          origin: window.location.origin,
        },
      });
      if (error) {
        // Log COMPLETO: errore SDK e payload ricevuto dalla Edge Function
        console.error('Checkout SDK error (oggetto intero):', error);
        console.error('Checkout — data ricevuti dalla Edge Function:', JSON.stringify(data));
        // Estrai il messaggio esatto restituito dalla Edge Function/Stripe (per il toast).
        let msgServer: string | undefined;
        const corpo = data as { error?: string | { message?: string } } | null;
        if (typeof corpo?.error === 'string') {
          msgServer = corpo.error;
        } else if (corpo?.error && typeof corpo.error === 'object') {
          msgServer = (corpo.error as { message?: string }).message;
        }
        // Se `data` è null, prova a leggere il body della Response HTTP esposta dall'SDK.
        if (!msgServer) {
          const ctx = (error as { context?: Response }).context;
          if (ctx) {
            try {
              const parsed = (await ctx.clone().json()) as {
                error?: string | { message?: string };
              } | null;
              msgServer =
                typeof parsed?.error === 'string' ? parsed.error : parsed?.error?.message;
            } catch {
              // corpo non JSON: ignorato
            }
          }
        }
        return {
          ok: false,
          errore:
            msgServer ??
            `Impossibile avviare il pagamento (${(error as Error).message}). Controlla la connessione e riprova.`,
        };
      }
      const payload = data as { success?: boolean; url?: string; error?: string } | null;
      if (!payload?.url || payload.success === false) {
        console.error(
          'Checkout senza URL — payload ricevuto dalla Edge Function:',
          JSON.stringify(data),
        );
        return {
          ok: false,
          errore: payload?.error ?? 'La sessione di pagamento non è stata creata. Riprova.',
        };
      }
      // STRICT redirect: il checkout Stripe si apre SEMPRE in una NUOVA scheda (_blank),
      // mantenendo l'app ScuoleRadar aperta e attiva nel tab principale.
      // `window.location.href` NON è mai un fallback "diretto": scatta solo nel caso
      // specifico di popup bloccato dal browser (window.open → null) oppure dentro un
      // vero catch block (ambienti restrittivi che lanciano un'eccezione su window.open).
      // NB: NON passare 'noopener,noreferrer' come features string: il token `noopener`
      // fa restituire null a window.open ANCHE a scheda aperta correttamente (il fallback
      // scatterebbe sempre). Apriamo senza features e azzeriamo opener a mano.
      // Questo blocco è il funnel UNICO di tutti i trigger checkout: "Passa a PRO Annuale"
      // (PrezziPage), VetrinaModal, ServiziPaywall/AbbonamentoModal e ripresa post-login.
      try {
        const stripeTab = window.open(payload.url, '_blank');
        if (stripeTab) {
          // Security best practice: la nuova scheda non ha handle sulla finestra chiamante.
          stripeTab.opener = null;
        } else {
          // Popup bloccato dal browser: SOLO in questo caso specifico naviga il tab corrente.
          window.location.href = payload.url;
        }
      } catch {
        // Vero catch block: mai lasciare l'utente a metà, apriamo nel tab corrente.
        window.location.href = payload.url;
      }
      return { ok: true };
      } catch (err) {
        // Mai lasciare una Promise rifiutata: errori di rete/CORS/SDK vengono gestiti e
        // mostrati al chiamante (toast in PrezziPage) invece di restare silenziosi.
        console.error('avviaCheckout — errore non gestito:', err);
        return {
          ok: false,
          errore: (err as Error)?.message ?? 'Errore imprevisto durante il checkout. Riprova.',
        };
      } finally {
        // Rilascia il lock: la scheda Stripe è già stata aperta (window.open è sincrono)
        // oppure l'operazione è terminata — un nuovo click può ripartire in modo pulito.
        checkoutInCorsoRef.current = false;
      }
    },
    [openAuthModal, salvaIntendedPlan],
  );

  return { salvaIntendedPlan, avviaCheckout };
}
