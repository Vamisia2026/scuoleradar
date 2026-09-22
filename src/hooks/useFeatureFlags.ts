/**
 * ScuoleRadar.it — hook React delle FEATURE FLAGS dei dipartimenti.
 *
 * Unico modo per la UI di leggere/cambiare lo stato dei dipartimenti:
 *  · `stati` / `stato(id)`   → stato effettivo (env → override locale → default);
 *  · `visibile(id)`          → se il dipartimento va mostrato all'utente corrente
 *                              (`test` = solo admin, `off` = nessuno, `on` = tutti);
 *  · `impostaStato(id, …)`   → cambio IMMEDIATO (store condiviso + localStorage):
 *                              navbar, rotte e pannelli si aggiornano senza reload;
 *  · `forzaDev`              → interruttore della DEV Toolbar che mostra comunque
 *                              tutti i dipartimenti in ambiente di sviluppo.
 *
 * Lo stato vive in uno store esterno (`@/config/features`) sottoscritto con
 * `useSyncExternalStore`: tutti i componenti condividono la stessa verità.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useApp } from '@/contexts/AppContext';
import { eEmailAdmin } from '@/lib/utentiAdmin';
import {
  DIPARTIMENTI,
  azzeraStatiDipartimento,
  impostaStatoDipartimento,
  overrideDipartimenti,
  sottoscriviDipartimenti,
  type DipartimentoId,
  type StatoDipartimento,
} from '@/config/features';
import {
  dipartimentoVisibile,
  origineStatoDipartimento,
  statoDipartimento,
  type OrigineStato,
} from '@/config/statoDipartimenti';
import { useLocalStorage } from './useLocalStorage';

/** Chiave localStorage dell'interruttore DEV «mostra tutti i dipartimenti». */
export const STORAGE_KEY_FLAG_FORZA_DEV = 'sr_flag_forza_dev';

export interface ApiFeatureFlags {
  /** Stati effettivi, per dipartimento (aggiornati in tempo reale). */
  stati: Record<DipartimentoId, StatoDipartimento>;
  /** Stato effettivo di un dipartimento. */
  stato: (id: DipartimentoId) => StatoDipartimento;
  /** Provenienza dello stato (`ambiente` | `locale` | `default`). */
  origine: (id: DipartimentoId) => OrigineStato;
  /** true = il dipartimento va mostrato/aperto per l'utente corrente. */
  visibile: (id: DipartimentoId) => boolean;
  /**
   * Rotta del PRIMO dipartimento visibile (fallback `/dashboard/profilo`, che non
   * dipende da nessun modulo). UNICA fonte dei redirect post-login/onboarding:
   * mai mandare l'utente su un modulo `off`.
   */
  primaRottaVisibile: () => string;
  /** true = l'utente corrente è un amministratore (email in whitelist). */
  eAdmin: boolean;
  /** true = può vedere anche i dipartimenti in `off`/`test` (admin o DEV forzato). */
  puoVedereTutto: boolean;
  /** Interruttore DEV: mostra comunque tutti i dipartimenti. */
  forzaDev: boolean;
  setForzaDev: (attivo: boolean) => void;
  /** Cambia stato (persistito in locale, effettivo subito). */
  impostaStato: (id: DipartimentoId, stato: StatoDipartimento) => void;
  /** Riporta tutti i dipartimenti ai default del codice. */
  azzera: () => void;
  /** true = la DEV Toolbar è attiva in questa build (`import.meta.env.DEV`). */
  dev: boolean;
}

export function useFeatureFlags(): ApiFeatureFlags {
  const { user } = useApp();
  // Snapshot STABILE (stesso riferimento finché non cambiano gli override).
  const override = useSyncExternalStore(
    sottoscriviDipartimenti,
    overrideDipartimenti,
    overrideDipartimenti,
  );
  const [forzaDevAttivo, setForzaDevAttivo] = useLocalStorage<boolean>(STORAGE_KEY_FLAG_FORZA_DEV, false);
  const dev = import.meta.env.DEV === true;

  const eAdmin = eEmailAdmin(user?.email);
  const puoVedereTutto = eAdmin || (dev && forzaDevAttivo === true);

  const stato = useCallback(
    (id: DipartimentoId) => statoDipartimento(id, override),
    [override],
  );

  const stati = useMemo(() => {
    const out = {} as Record<DipartimentoId, StatoDipartimento>;
    for (const d of DIPARTIMENTI) out[d.id] = statoDipartimento(d.id, override);
    return out;
  }, [override]);

  const visibile = useCallback(
    (id: DipartimentoId) => dipartimentoVisibile(id, { eAdmin, forzaDev: dev && forzaDevAttivo === true }),
    [eAdmin, dev, forzaDevAttivo],
  );

  const primaRottaVisibile = useCallback((): string => {
    const primo = DIPARTIMENTI.find((d) => visibile(d.id));
    return primo ? primo.rotta : '/dashboard/profilo';
  }, [visibile]);

  const setForzaDev = useCallback(
    (attivo: boolean) => setForzaDevAttivo(attivo),
    [setForzaDevAttivo],
  );

  return {
    stati,
    stato,
    origine: origineStatoDipartimento,
    visibile,
    primaRottaVisibile,
    eAdmin,
    puoVedereTutto,
    forzaDev: forzaDevAttivo === true,
    setForzaDev,
    impostaStato: impostaStatoDipartimento,
    azzera: azzeraStatiDipartimento,
    dev,
  };
}
