/**
 * Pannello Admin · «Email & Automazioni» — stato e azioni del tab.
 *
 * Concentra qui tutta la logica con stato del pannello:
 *  · caricamento degli stati salvati (Edge `admin` → KV `app_settings`);
 *  · interruttore di abilitazione per singola automazione;
 *  · bozza dei testi (oggetto/intro/corpo) con salvataggio e ripristino;
 *  · copia negli appunti dei testi d'anteprima.
 *
 * Senza sessione Supabase si lavora sulla copia locale del browser e la UI lo
 * dichiara (`demo: true`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import {
  AUTOMAZIONI_EMAIL,
  statoEffettivoAutomazione,
  testoAnteprima,
  type AutomazioneEmail,
  type IdAutomazione,
  type StatoAutomazione,
} from '@/config/automazioniEmail';
import {
  caricaAutomazioniEmail,
  salvaAutomazioneEmail,
  type StatiAutomazioni,
} from '../services/automazioniService';
import { bozzaDaStato, personalizzata, type BozzaTesti } from '../components/automazioniSupporto';

/** API pubblica dell'hook (consumata dal tab «Email & Automazioni»). */
export interface ApiAutomazioniEmail {
  caricato: boolean;
  inCaricamento: boolean;
  demo: boolean;
  errore: string | null;
  stati: StatiAutomazioni;
  inSalvataggio: IdAutomazione | null;
  /** Automazione con l'editor aperto (una per volta). */
  aperta: IdAutomazione | null;
  bozza: BozzaTesti | null;
  copiato: IdAutomazione | null;
  statoDi: (id: IdAutomazione) => StatoAutomazione;
  riepilogo: { attive: number; spente: number; testi: number };
  carica: () => Promise<void>;
  cambiaAbilitazione: (a: AutomazioneEmail) => void;
  apriEditor: (a: AutomazioneEmail) => void;
  chiudiEditor: () => void;
  aggiornaBozza: (patch: Partial<BozzaTesti>) => void;
  salvaTesti: (a: AutomazioneEmail) => void;
  ripristinaTesti: (a: AutomazioneEmail) => void;
  copiaAnteprima: (a: AutomazioneEmail) => void;
}

export function useAutomazioniEmail(): ApiAutomazioniEmail {
  const { mostraToast } = useToast();
  const [stati, setStati] = useState<StatiAutomazioni>({});
  const [caricato, setCaricato] = useState(false);
  const [inCaricamento, setInCaricamento] = useState(false);
  const [demo, setDemo] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inSalvataggio, setInSalvataggio] = useState<IdAutomazione | null>(null);
  const [aperta, setAperta] = useState<IdAutomazione | null>(null);
  const [bozza, setBozza] = useState<BozzaTesti | null>(null);
  const [copiato, setCopiato] = useState<IdAutomazione | null>(null);

  const carica = useCallback(async () => {
    setInCaricamento(true);
    setErrore(null);
    try {
      const esito = await caricaAutomazioniEmail();
      setStati(esito.stati);
      setDemo(esito.demo);
      if (esito.errore) setErrore(esito.errore);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : String(err));
    } finally {
      setInCaricamento(false);
      setCaricato(true);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const statoDi = useCallback((id: IdAutomazione) => statoEffettivoAutomazione(id, stati), [stati]);

  /** Salva lo stato completo di UNA automazione (interruttore o testi). */
  const salva = useCallback(
    async (a: AutomazioneEmail, prossimo: StatoAutomazione, messaggio: string) => {
      setInSalvataggio(a.id);
      try {
        const esito = await salvaAutomazioneEmail(a.id, prossimo);
        setStati((prev) => ({ ...prev, [a.id]: prossimo }));
        if (esito.demo) setDemo(true);
        mostraToast(
          'successo',
          esito.demo ? `${messaggio} Solo in locale: manca la sessione Supabase.` : messaggio,
        );
      } catch (err) {
        const testo = err instanceof Error ? err.message : String(err);
        mostraToast('errore', `Salvataggio non riuscito: ${testo}`);
      } finally {
        setInSalvataggio(null);
      }
    },
    [mostraToast],
  );

  const chiudiEditor = useCallback(() => {
    setAperta(null);
    setBozza(null);
  }, []);

  const cambiaAbilitazione = useCallback(
    (a: AutomazioneEmail): void => {
      const stato = statoEffettivoAutomazione(a.id, stati);
      const prossima = !stato.abilitata;
      void salva(
        a,
        { ...stato, abilitata: prossima },
        prossima
          ? `«${a.nome}» riattivata: gli invii riprenderanno dal prossimo trigger.`
          : `«${a.nome}» disattivata: nessun invio finché non la riattivi.`,
      );
    },
    [stati, salva],
  );

  const apriEditor = useCallback(
    (a: AutomazioneEmail): void => {
      setAperta(a.id);
      setBozza(bozzaDaStato(statoEffettivoAutomazione(a.id, stati)));
    },
    [stati],
  );

  const aggiornaBozza = useCallback((patch: Partial<BozzaTesti>): void => {
    setBozza((precedente) => (precedente ? { ...precedente, ...patch } : precedente));
  }, []);

  const salvaTesti = useCallback(
    (a: AutomazioneEmail): void => {
      if (!bozza) return;
      void salva(
        a,
        {
          abilitata: statoEffettivoAutomazione(a.id, stati).abilitata,
          oggetto: bozza.oggetto,
          intro: bozza.intro,
          corpo: bozza.corpo,
        },
        `Testi di «${a.nome}» aggiornati.`,
      ).then(() => chiudiEditor());
    },
    [bozza, stati, salva, chiudiEditor],
  );

  const ripristinaTesti = useCallback(
    (a: AutomazioneEmail): void => {
      void salva(
        a,
        { abilitata: statoEffettivoAutomazione(a.id, stati).abilitata },
        `«${a.nome}» riportata al copy del codice.`,
      ).then(() => chiudiEditor());
    },
    [stati, salva, chiudiEditor],
  );

  const copiaAnteprima = useCallback(
    (a: AutomazioneEmail): void => {
      const testi = testoAnteprima(a, statoEffettivoAutomazione(a.id, stati));
      const contenuto = `Oggetto: ${testi.oggetto}\n\n${testi.intro ? testi.intro + '\n\n' : ''}${testi.corpo}`;
      void navigator.clipboard
        ?.writeText(contenuto)
        .then(() => {
          setCopiato(a.id);
          window.setTimeout(
            () => setCopiato((precedente) => (precedente === a.id ? null : precedente)),
            2000,
          );
        })
        .catch(() => mostraToast('errore', 'Copia non riuscita: seleziona il testo manualmente.'));
    },
    [stati, mostraToast],
  );

  const riepilogo = useMemo(() => {
    let attive = 0;
    let spente = 0;
    let testi = 0;
    for (const a of AUTOMAZIONI_EMAIL) {
      const stato = statoEffettivoAutomazione(a.id, stati);
      if (stato.abilitata) attive += 1;
      else spente += 1;
      if (personalizzata(stato)) testi += 1;
    }
    return { attive, spente, testi };
  }, [stati]);

  return {
    caricato,
    inCaricamento,
    demo,
    errore,
    stati,
    inSalvataggio,
    aperta,
    bozza,
    copiato,
    statoDi,
    riepilogo,
    carica,
    cambiaAbilitazione,
    apriEditor,
    chiudiEditor,
    aggiornaBozza,
    salvaTesti,
    ripristinaTesti,
    copiaAnteprima,
  };
}
