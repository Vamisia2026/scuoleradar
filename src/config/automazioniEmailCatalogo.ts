/**
 * ScuoleRadar.it — CATALOGO delle automazioni email (dati + tipi).
 *
 * Anagrafica di ogni comunicazione automatica (transazionale o di richiamo):
 * id, nome, gruppo, trigger, motore che la esegue, canale, oggetto e anteprima
 * del copy ESISTENTE. È il gemello "dati" di `./automazioniEmail.ts`, che
 * riesporta tutto e aggiunge le funzioni pure (stato salvato, anteprima,
 * normalizzazione).
 *
 * Modulo PURO e isomorfo (nessun import): importabile da frontend, script Node,
 * test. La controparte Deno è `supabase/functions/_shared/automazioniEmail.ts`
 * (guardia di coerenza: `npm run test:automazioni`).
 */

import type { AutomazioneEmail } from './automazioniTipi.ts';

/** Prefisso delle chiavi in `public.app_settings`. */
export const PREFISSO_CHIAVE_AUTOMAZIONE = 'email_automazione_';

/** Chiave localStorage della cache/mirror usata in modalità demo. */
export const STORAGE_KEY_AUTOMAZIONI = 'sr_automazioni_email';

/** Elenco canonico: ordine = ordine di presentazione nel pannello Admin. */
export const AUTOMAZIONI_EMAIL: readonly AutomazioneEmail[] = [
  {
    id: 'benvenuto',
    nome: 'Benvenuto / onboarding',
    emoji: '👋',
    gruppo: 'Onboarding',
    trigger: 'evento',
    quando: 'Subito dopo la registrazione (trigger DB su auth.users → Edge send-notification).',
    motore: 'Edge send-notification · tipi step1 / conferma_base · template email_1_1_onboarding',
    canale: 'email + Telegram',
    tipiEdge: ['step1', 'conferma_base', 'email_1_1_onboarding'],
    chiaveTemplate: 'email_1_1_onboarding',
    oggetto: 'Benvenuto in Scuole Radar: il tuo mese di PRO è già attivo',
    anteprima:
      'Caro {{nome}},\n\nBenvenuto in Scuole Radar.\n\nIl tuo mese di PRO in omaggio è già attivo: Radar Scuole con notifiche illimitate, Modulistica scolastica, Crea CV e Calcolatore CFU, senza restrizioni.\n\n[ ATTIVA IL TUO RADAR ] -> {{link_radar}}',
    nota: 'Il benvenuto post-registrazione (tipo `step1`) e la conferma di attivazione (tipo `conferma_base`) condividono questo template: nessun riferimento al vecchio piano Base né a quote di segnalazioni.',
  },
  {
    id: 'attivazione_pro',
    nome: 'Attivazione PRO (benvenuto PRO)',
    emoji: '👑',
    gruppo: 'Abbonamento',
    trigger: 'evento',
    quando: 'Al pagamento riuscito / attivazione PRO (webhook Stripe → Edge).',
    motore: 'Edge send-notification · tipi welcome_pro / conferma_attivazione',
    canale: 'email + Telegram',
    tipiEdge: ['welcome_pro', 'conferma_attivazione'],
    oggetto: 'Benvenuto nel piano PRO di ScuoleRadar',
    anteprima:
      'Caro {{nome}}, benvenuto nel piano PRO di ScuoleRadar!\nDa ora hai notifiche illimitate, strumenti docenti completi e moduli sempre aggiornati a norma di legge.',
    nota: 'Il copy di questa automazione è un messaggio strutturato: si modifica l’oggetto.',
  },
  {
    id: 'radar_spento',
    nome: 'Radar ancora spento (richiamo 24h)',
    emoji: '📡',
    gruppo: 'Onboarding',
    trigger: 'temporale',
    quando:
      '24-48h dopo la registrazione, se l’utente non ha indicato province/classi (Radar mai attivato).',
    motore: 'Edge send-notification · template email_2_1_radar_spento',
    canale: 'email',
    tipiEdge: ['email_2_1_radar_spento', 'radar_spento'],
    chiaveTemplate: 'email_2_1_radar_spento',
    oggetto: 'Il tuo Radar è ancora spento',
    anteprima:
      'Ciao {{nome}},\n\nIl tuo Radar è ancora spento.\n\nQuesto significa che in questo momento Scuole Radar non sta cercando opportunità per te, anche se le scuole ne pubblicano ogni giorno.\n\n[ ATTIVA IL TUO RADAR ] -> {{link_radar}}',
    nota:
      'Template pronto e inviabile: l’invio va schedulato con una chiamata alla Edge con tipo `email_2_1_radar_spento` (nessun cron attivo su questo richiamo).',
  },
  {
    id: 'drip_base',
    nome: 'Drip piano Base (step 2 → 5)',
    emoji: '🪜',
    gruppo: 'Radar',
    trigger: 'temporale',
    quando:
      'Dopo ogni opportunità consegnata al piano Base: quota, pausa notifiche e ultimo avviso automatico.',
    motore:
      'Edge send-notification · tipi step2 / step3 / step4 / step5 · cron DB `step5-notifiche` (ogni minuto)',
    canale: 'email + Telegram',
    tipiEdge: ['step2', 'step3', 'step4', 'step5'],
    oggettoBloccato: true,
    oggetto: 'Nuove opportunità per te!',
    anteprima:
      'Step 2-3: nuova opportunità (oggetto standard `Nuove opportunità per te!`).\nStep 4: “Con il piano gratuito ricevi un numero limitato di segnalazioni…”\nStep 5: “Da adesso non riceverai più notifiche automatiche…”',
    nota: 'Il messaggio è composto in codice (HTML + opportunità): si modifica l’oggetto.',
  },
  {
    id: 'digest_giornaliero',
    nome: 'Riepilogo giornaliero (digest)',
    emoji: '📬',
    gruppo: 'Radar',
    trigger: 'temporale',
    quando:
      'Ogni giorno feriale alle 17:00 (Europe/Rome): UNA email + UN messaggio Telegram per utente, solo se ci sono opportunità.',
    motore: 'Notifier `inviaDigestGiornaliero` · workflow `digest.yml` · `src/lib/resend.ts`',
    canale: 'email + Telegram',
    tipiEdge: [],
    notifier: true,
    oggettoBloccato: true,
    oggetto: 'Nuove opportunità per te!',
    anteprima:
      'Ciao {{nome}},\n\nEcco le opportunità di oggi per il tuo profilo:\n• {{scuola}} · {{classe}} · {{provincia}} — scadenza {{scadenza}}\n\n[ Apri il tuo Radar Scuole ]',
    nota:
      'Oggetto STANDARD imposto dalla checklist («Nuove opportunità per te!»): il corpo è strutturato in `src/lib/resend.ts`.',
  },
  {
    id: 'alert_pro_tempo_reale',
    nome: 'Alert PRO in tempo reale',
    emoji: '⚡',
    gruppo: 'Radar',
    trigger: 'evento',
    quando:
      'Alla comparsa di un nuovo avviso compatibile, per i piani PRO / Free Forever (nessun batching).',
    motore: 'Notifier `inviaAlertTelegramTempoReale` · scraper · `src/lib/telegram.ts`',
    canale: 'Telegram + email',
    tipiEdge: [],
    notifier: true,
    oggettoBloccato: true,
    oggetto: 'Nuove opportunità per te!',
    anteprima:
      '🎯 Abbiamo trovato una nuova opportunità per te\n🏫 {{scuola}} · 📚 {{classe}} · 📍 {{provincia}}\n⏳ Scadenza: {{scadenza}}\n📧 Candidature: {{email}}\n👉 Apri l’avviso ufficiale',
    nota: 'Messaggio strutturato (Telegram + email): si modifica l’oggetto.',
  },
  {
    id: 'promemoria_scadenza',
    nome: 'Promemoria scadenza (24h)',
    emoji: '⏳',
    gruppo: 'Radar',
    trigger: 'temporale',
    quando:
      'Opportunità consegnata da almeno 24h e scadenza entro 3 giorni: UNA email con tutte le voci in scadenza.',
    motore: 'Notifier `inviaPromemoria24h` · `src/lib/promemoria.ts` · `npm run notifiche:promemoria`',
    canale: 'email',
    tipiEdge: [],
    notifier: true,
    oggetto: 'Scuole Radar — Scadenza vicina: {{classe}} ({{provincia}})',
    anteprima:
      'Ciao {{nome}},\n\n⏳ Scadenza vicina: un’opportunità che ti abbiamo segnalato chiude entro {{giorni}} giorni.\n\nUn solo promemoria per avviso: non ti riscriveremo su queste opportunità.',
    nota: 'Il corpo del promemoria è strutturato in `src/lib/resend.ts`: si modifica l’oggetto.',
  },
  {
    id: 'preavvisi_rinnovo',
    nome: 'Preavviso di rinnovo (3-5 giorni)',
    emoji: '🔔',
    gruppo: 'Abbonamento',
    trigger: 'temporale',
    quando:
      'Tutti i giorni alle 09:00, nella finestra 3-5 giorni dalla scadenza (cron `rinnovo-preavvisi-3-5g`).',
    motore:
      'Edge send-notification · tipi rinnovo_preavviso_prova / rinnovo_preavviso_pro · template email_3_5 / email_3_6',
    canale: 'email + Telegram',
    tipiEdge: ['rinnovo_preavviso_prova', 'rinnovo_preavviso_pro'],
    chiaveTemplate: 'email_3_5_rinnovo_prova',
    oggetto: 'Il tuo mese PRO gratuito scade tra {{giorni}} giorni',
    anteprima:
      'Ciao {{nome}},\n\nil tuo mese di PRO gratuito su Scuole Radar sta per terminare: scade il {{scadenza}}, tra {{giorni}} giorni.\n\n[ SCOPRI IL PIANO PRO ] -> {{link_prezzi}}',
  },
  {
    id: 'scadenza_abbonamento',
    nome: 'Drip scadenza abbonamento',
    emoji: '⌛',
    gruppo: 'Abbonamento',
    trigger: 'temporale',
    quando:
      '5, 3, 1 e 0 giorni dalla scadenza (cron `scadenza-avvisi-multistep`, ogni giorno alle 09:00 e 18:00).',
    motore:
      'Edge send-notification · tipi scadenza_preavviso_7d / 3d / 1d, scadenza_finale · template email_3_1 … email_3_4',
    canale: 'email + Telegram',
    tipiEdge: [
      'scadenza_preavviso_5d',
      'scadenza_preavviso_7d',
      'scadenza_preavviso_3d',
      'scadenza_preavviso_1d',
      'scadenza_finale',
    ],
    chiaveTemplate: 'email_3_1_scadenza_5',
    oggetto: 'Il tuo mese PRO su Scuole Radar sta per terminare',
    anteprima:
      'Ciao {{nome}},\n\nTra 5 giorni termina il tuo mese PRO gratuito.\n\n[ PASSA A PRO ] -> {{link_checkout}}\n\nUsa il codice RADAR50 quando passi a PRO.',
  },
  {
    id: 'free_forever_rinnovo',
    nome: 'Rinnovo Free Forever (annuale)',
    emoji: '♾️',
    gruppo: 'Abbonamento',
    trigger: 'temporale',
    quando:
      '7 giorni prima della scadenza annuale (cron `free-forever-rinnovo-annuale`, ogni giorno alle 08:30).',
    motore: 'Edge send-notification · tipi free_forever_preavviso / free_forever_scadenza',
    canale: 'email',
    tipiEdge: ['free_forever_preavviso', 'free_forever_scadenza'],
    oggetto: 'Scuole Radar — Piano PRO Free Forever: rinnovo automatico',
    anteprima:
      'Ciao {{nome}},\n\nil tuo piano PRO Free Forever si rinnova automaticamente: non devi fare nulla e non ci sono pagamenti.',
    nota: 'Nessun sollecito di pagamento: è un rinnovo gratuito a vita.',
  },
  {
    id: 'beta_ritenzione',
    nome: 'Beta tester (omaggio a vita)',
    emoji: '🧪',
    gruppo: 'Beta',
    trigger: 'temporale',
    quando:
      'Tutti i giorni alle 09:00 per i profili contrassegnati come beta tester (cron `beta-rinnovo-omaggio-vita`).',
    motore:
      'Edge send-notification · tipi beta_rinnovo / beta_rinnovo_preavviso / beta_rinnovo_conferma',
    canale: 'email',
    tipiEdge: ['beta_rinnovo', 'beta_rinnovo_preavviso', 'beta_rinnovo_conferma'],
    oggetto: 'Rinnovo omaggio beta tester',
    anteprima:
      'Ciao {{nome}},\n\nil tuo omaggio PRO riservato ai beta tester è stato rinnovato: continua a usare Scuole Radar senza limiti.',
  },
];
