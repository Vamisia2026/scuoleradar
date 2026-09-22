/**
 * ScuoleRadar.it — TIPI delle automazioni email (contratto condiviso).
 *
 * Estratti da `./automazioniEmailCatalogo.ts` per rispettare il limite
 * dimensionale dei file: i consumatori importano tutto da `./automazioniEmail.ts`,
 * che li riesporta.
 */

/** Identificativi delle automazioni gestite dal pannello. */
export type IdAutomazione =
  | 'benvenuto'
  | 'attivazione_pro'
  | 'radar_spento'
  | 'drip_base'
  | 'digest_giornaliero'
  | 'alert_pro_tempo_reale'
  | 'promemoria_scadenza'
  | 'preavvisi_rinnovo'
  | 'scadenza_abbonamento'
  | 'free_forever_rinnovo'
  | 'beta_ritenzione';

/** Natura del trigger: un fatto puntuale o una finestra temporale (cron). */
export type TipoTriggerAutomazione = 'evento' | 'temporale';

/** Gruppo funzionale (ordine di presentazione nel pannello). */
export type GruppoAutomazione = 'Onboarding' | 'Radar' | 'Abbonamento' | 'Beta';

/** Canali previsti da un'automazione. */
export type CanaleAutomazione = 'email' | 'email + Telegram' | 'Telegram + email';

/** Scheda descrittiva di un'automazione. */
export interface AutomazioneEmail {
  id: IdAutomazione;
  nome: string;
  emoji: string;
  gruppo: GruppoAutomazione;
  trigger: TipoTriggerAutomazione;
  /** Descrizione leggibile del trigger (colonna «Trigger» del pannello). */
  quando: string;
  /** Cron/workflow/trigger che la scatena. */
  motore: string;
  canale: CanaleAutomazione;
  /** Tipi accettati dalla Edge `send-notification` (payload `tipo`). */
  tipiEdge: readonly string[];
  /**
   * Chiave del template centralizzato in `_shared/emailTemplates.ts` (se presente,
   * il corpo del messaggio è modificabile dal pannello).
   */
  chiaveTemplate?: string;
  /** true = l'automazione è orchestrata dal notifier Node (scraper/GitHub Actions). */
  notifier?: boolean;
  /**
   * true = l'oggetto è VINCOLATO dalla checklist di comunicazione (es. «Nuove
   * opportunità per te!»): il pannello lo mostra ma non ne consente la modifica.
   */
  oggettoBloccato?: boolean;
  /** Oggetto predefinito (dal codice, non modificato). */
  oggetto: string;
  /** Anteprima del copy ESISTENTE (prime righe del corpo, placeholder inclusi). */
  anteprima: string;
  /** Nota di servizio mostrata nel pannello (limiti, dipendenze). */
  nota?: string;
}
