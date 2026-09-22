/**
 * ScuoleRadar.it — AUTOMAZIONI EMAIL: stato, chiavi e anteprima (logica pura).
 *
 * I dati (anagrafica, trigger, copy del codice) stanno in
 * `./automazioniEmailCatalogo.ts` e sono RIESPORTATI da qui: i consumatori
 * (pannello Admin, notifier, Edge, test) importano sempre da questo modulo.
 *
 * DOVE VIVE LO STATO (ordine di autorità):
 *   1. `public.app_settings` (KV, accesso `service_role`): chiave
 *      `email_automazione_<id>` → JSON `{ abilitata, oggetto, intro, corpo, … }`.
 *      È l'unico stato che i processi server (Edge, scraper, cron) leggono.
 *   2. copia locale del browser (`localStorage: sr_automazioni_email`) usata SOLO
 *      dal pannello Admin quando manca la sessione Supabase (modalità demo).
 *
 * Il CORPO dei messaggi strutturati (digest, promemoria, alert: HTML generato da
 * `src/lib/resend.ts` / `src/lib/telegram.ts`) non è modificabile: per quelli si
 * personalizza l'oggetto. Le automazioni con `chiaveTemplate` (template in
 * `supabase/functions/_shared/emailTemplates.ts`) accettano anche un CORPO
 * personalizzato, interpolato e convertito in HTML dalla Edge all'invio.
 */

export * from './automazioniTipi.ts';
export * from './automazioniEmailCatalogo.ts';

import { AUTOMAZIONI_EMAIL, PREFISSO_CHIAVE_AUTOMAZIONE } from './automazioniEmailCatalogo.ts';
import type { AutomazioneEmail, IdAutomazione } from './automazioniTipi.ts';

/** Stato di un'automazione (formato salvato in `app_settings` come JSON). */
export interface StatoAutomazione {
  /** false = l'automazione NON parte (invio saltato, mai un errore). */
  abilitata: boolean;
  /** Oggetto personalizzato (assente = oggetto del codice). */
  oggetto?: string;
  /** Paragrafo introduttivo aggiunto in testa al messaggio. */
  intro?: string;
  /** Corpo personalizzato (solo automazioni con `chiaveTemplate`). */
  corpo?: string;
  /** ISO dell'ultima modifica (audit). */
  aggiornatoIl?: string;
  /** Origine dell'ultima modifica (es. `pannello-admin`). */
  aggiornatoDa?: string;
}

/** Stato predefinito: automazione ATTIVA, testi dal codice. */
export function statoPredefinitoAutomazione(): StatoAutomazione {
  return { abilitata: true };
}

/** Chiave `app_settings` di un'automazione. */
export function chiaveAutomazione(id: IdAutomazione): string {
  return `${PREFISSO_CHIAVE_AUTOMAZIONE}${id}`;
}

/** Id a partire da una chiave `app_settings` (`null` se non è un'automazione). */
export function idDaChiaveAutomazione(chiave: string): IdAutomazione | null {
  if (!chiave.startsWith(PREFISSO_CHIAVE_AUTOMAZIONE)) return null;
  const id = chiave.slice(PREFISSO_CHIAVE_AUTOMAZIONE.length);
  return trovaAutomazione(id as IdAutomazione) ? (id as IdAutomazione) : null;
}

/** Scheda di un'automazione (o `undefined` se l'id non è gestito). */
export function trovaAutomazione(id: IdAutomazione): AutomazioneEmail | undefined {
  return AUTOMAZIONI_EMAIL.find((a) => a.id === id);
}

/**
 * Normalizza un valore letto da `app_settings`/JSON in uno stato valido.
 * Qualsiasi valore non interpretabile → stato PREDEFINITO (automazione attiva):
 * un dato corrotto non deve mai fermare una comunicazione di servizio.
 */
export function normalizzaStatoAutomazione(valore: unknown): StatoAutomazione {
  let grezzo: unknown = valore;
  if (typeof grezzo === 'string') {
    try {
      grezzo = JSON.parse(grezzo);
    } catch {
      return statoPredefinitoAutomazione();
    }
  }
  if (!grezzo || typeof grezzo !== 'object') return statoPredefinitoAutomazione();
  const o = grezzo as Record<string, unknown>;
  const testo = (v: unknown): string | undefined => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s ? s : undefined;
  };
  return {
    abilitata: o.abilitata === false ? false : true,
    oggetto: testo(o.oggetto),
    intro: testo(o.intro),
    corpo: testo(o.corpo),
    aggiornatoIl: testo(o.aggiornatoIl),
    aggiornatoDa: testo(o.aggiornatoDa),
  };
}

/** Stato effettivo di un'automazione dato l'insieme degli stati salvati. */
export function statoEffettivoAutomazione(
  id: IdAutomazione,
  stati: Partial<Record<IdAutomazione, StatoAutomazione>> = {},
): StatoAutomazione {
  const salvato = stati[id];
  return salvato ? normalizzaStatoAutomazione(salvato) : statoPredefinitoAutomazione();
}

/** true se lo stato è identico al default (nessun override da conservare). */
export function eStatoPredefinito(stato: StatoAutomazione): boolean {
  return stato.abilitata === true && !stato.oggetto && !stato.intro && !stato.corpo;
}

/** Etichetta breve dell'interruttore (pannello Admin/DEV). */
export function etichettaAbilitazione(abilitata: boolean): string {
  return abilitata ? 'Attiva' : 'Disattivata';
}

/** Automazione che gestisce un `tipo` della Edge `send-notification`. */
export function automazioneDaTipoEdge(tipo: string): AutomazioneEmail | undefined {
  const t = (tipo ?? '').trim();
  if (!t) return undefined;
  return AUTOMAZIONI_EMAIL.find((a) => a.tipiEdge.includes(t));
}

/** Automazione di un template centralizzato (`email_3_5_rinnovo_prova`, …). */
export function automazioneDaTemplate(chiave: string): AutomazioneEmail | undefined {
  const k = (chiave ?? '').trim();
  if (!k) return undefined;
  return AUTOMAZIONI_EMAIL.find((a) => a.chiaveTemplate === k);
}

/** true se il corpo del messaggio è modificabile dal pannello (template in codice). */
export function corpoModificabile(a: AutomazioneEmail): boolean {
  return typeof a.chiaveTemplate === 'string' && a.chiaveTemplate.length > 0;
}

/** true se l'oggetto è modificabile dal pannello (non vincolato dalla checklist). */
export function oggettoModificabile(a: AutomazioneEmail): boolean {
  return a.oggettoBloccato !== true;
}

/** Variabili di esempio usate dall'anteprima del pannello. */
export const VARIABILI_ANTEPRIMA: Record<string, string> = {
  nome: 'Maria',
  giorni: '3',
  scadenza: '15/10/2026',
  scuola: 'Liceo Scientifico Galilei',
  classe: 'A-22',
  provincia: 'Torino',
  email: 'istituto@istruzione.it',
  link_radar: 'https://scuoleradar.it/dashboard?action=open-radar',
  link_checkout: 'https://scuoleradar.it/checkout/pro-annuale?coupon=RADAR50',
  link_purefocus: 'https://purefocus.one',
  link_prezzi: 'https://scuoleradar.it/prezzi',
};

/**
 * Interpolazione SEMPLICE per l'anteprima del pannello (`{{chiave}}`).
 * La sostituzione vera degli invii resta `interpola` in `_shared/emailTemplates.ts`:
 * qui serve solo a mostrare all'admin il testo finale che riceverà l'utente.
 */
export function interpolaAnteprima(
  testo: string,
  variabili: Record<string, string> = VARIABILI_ANTEPRIMA,
): string {
  return String(testo ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (intero, chiave: string) => {
    const valore = variabili[chiave];
    return typeof valore === 'string' ? valore : intero;
  });
}

/** Testi mostrati nell'anteprima: `corpo` personalizzato, `intro` + copy del codice. */
export function testoAnteprima(
  automazione: AutomazioneEmail,
  stato: StatoAutomazione = statoPredefinitoAutomazione(),
  variabili: Record<string, string> = VARIABILI_ANTEPRIMA,
): { oggetto: string; intro: string; corpo: string; corpoPersonalizzato: boolean } {
  const corpoPersonalizzato = Boolean(stato.corpo) && corpoModificabile(automazione);
  return {
    oggetto: interpolaAnteprima(stato.oggetto || automazione.oggetto, variabili),
    intro: interpolaAnteprima(stato.intro ?? '', variabili),
    corpo: interpolaAnteprima(corpoPersonalizzato ? (stato.corpo as string) : automazione.anteprima, variabili),
    corpoPersonalizzato,
  };
}
