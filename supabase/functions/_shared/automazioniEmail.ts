/**
 * ScuoleRadar.it — AUTOMAZIONI EMAIL lato Edge Function (Deno).
 *
 * Gemello Deno di `src/config/automazioniEmail.ts` (unico punto di verità del
 * catalogo: nome, trigger, copy, anteprima). Qui vive SOLO ciò che serve alla
 * Edge Function, che non può importare da `src/`:
 *   · la mappa `tipo` (payload `send-notification`) → id automazione;
 *   · la lettura dello stato da `public.app_settings` (KV `service_role`);
 *   · l'applicazione degli override di OGGETTO/INTRO/CORPO sul messaggio.
 *
 * La coerenza con il catalogo è verificata da `npm run test:automazioni`
 * (id, tipi e prefisso delle chiavi devono combaciare).
 *
 * In caso di errore di lettura si assume l'automazione ATTIVA: una KV non
 * raggiungibile non deve mai fermare le comunicazioni di servizio.
 */
import { interpola, testoAEmailHtml, type VarsTemplate } from './emailTemplates.ts';

/** Prefisso delle chiavi in `public.app_settings` (identico al frontend). */
export const PREFISSO_CHIAVE_AUTOMAZIONE = 'email_automazione_';

/** Tipi della Edge `send-notification` che appartengono a un'automazione. */
export interface AutomazioneEdge {
  id: string;
  /** Valori del campo `tipo` che questa automazione governa. */
  tipi: readonly string[];
  /**
   * true = l'oggetto è VINCOLATO (es. «Nuove opportunità per te!» delle
   * opportunità): le checklist di comunicazione lo impongono, quindi l'override
   * dal pannello NON viene applicato.
   */
  oggettoBloccato: boolean;
}

/** Mappa tipo → automazione (ordine irrilevante). */
export const AUTOMAZIONI_EDGE: readonly AutomazioneEdge[] = [
  { id: 'benvenuto', tipi: ['step1', 'conferma_base', 'email_1_1_onboarding'], oggettoBloccato: false },
  { id: 'attivazione_pro', tipi: ['welcome_pro', 'conferma_attivazione'], oggettoBloccato: false },
  { id: 'radar_spento', tipi: ['email_2_1_radar_spento', 'radar_spento'], oggettoBloccato: false },
  { id: 'drip_base', tipi: ['step2', 'step3', 'step4', 'step5'], oggettoBloccato: true },
  {
    id: 'preavvisi_rinnovo',
    tipi: ['rinnovo_preavviso_prova', 'rinnovo_preavviso_pro'],
    oggettoBloccato: false,
  },
  {
    id: 'scadenza_abbonamento',
    tipi: [
      'scadenza_preavviso_5d',
      'scadenza_preavviso_7d',
      'scadenza_preavviso_3d',
      'scadenza_preavviso_1d',
      'scadenza_finale',
    ],
    oggettoBloccato: false,
  },
  {
    id: 'free_forever_rinnovo',
    tipi: ['free_forever_preavviso', 'free_forever_scadenza'],
    oggettoBloccato: false,
  },
  {
    id: 'beta_ritenzione',
    tipi: ['beta_rinnovo', 'beta_rinnovo_preavviso', 'beta_rinnovo_conferma'],
    oggettoBloccato: false,
  },
];

/** Automazione che governa un `tipo` della Edge (o `undefined`). */
export function automazioneDaTipo(tipo: string): AutomazioneEdge | undefined {
  const t = (tipo ?? '').trim();
  if (!t) return undefined;
  return AUTOMAZIONI_EDGE.find((a) => a.tipi.includes(t));
}

/** Stato di un'automazione (JSON nella KV `app_settings`). */
export interface StatoAutomazione {
  abilitata: boolean;
  oggetto?: string;
  intro?: string;
  corpo?: string;
  aggiornatoIl?: string;
  aggiornatoDa?: string;
}

/** Mappa id → stato (letta dalla KV). */
export type StatiAutomazioni = Map<string, StatoAutomazione>;

/** Normalizza un valore KV in uno stato valido (default: ATTIVA). */
export function normalizzaStatoAutomazione(valore: unknown): StatoAutomazione {
  let grezzo: unknown = valore;
  if (typeof grezzo === 'string') {
    try {
      grezzo = JSON.parse(grezzo);
    } catch {
      return { abilitata: true };
    }
  }
  if (!grezzo || typeof grezzo !== 'object') return { abilitata: true };
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

/** Stato effettivo dell'automazione di un `tipo` (default: attiva). */
export function statoDaTipo(tipo: string, stati: StatiAutomazioni): StatoAutomazione | null {
  const automazione = automazioneDaTipo(tipo);
  if (!automazione) return null;
  return stati.get(automazione.id) ?? { abilitata: true };
}

/**
 * Legge gli stati delle automazioni da `public.app_settings` (REST + service role).
 * Qualsiasi errore (rete, tabella assente, permessi) → mappa VUOTA = tutte attive.
 */
export async function leggiStatiAutomazioni(
  supabaseUrl: string,
  serviceRole: string,
): Promise<StatiAutomazioni> {
  const stati: StatiAutomazioni = new Map();
  if (!supabaseUrl || !serviceRole) return stati;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=key,value`, {
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
    });
    if (!res.ok) return stati;
    const righe = (await res.json()) as Array<{ key?: string; value?: string }>;
    for (const riga of righe ?? []) {
      const chiave = String(riga?.key ?? '');
      if (!chiave.startsWith(PREFISSO_CHIAVE_AUTOMAZIONE)) continue;
      const id = chiave.slice(PREFISSO_CHIAVE_AUTOMAZIONE.length);
      stati.set(id, normalizzaStatoAutomazione(riga?.value));
    }
  } catch {
    /* KV non raggiungibile: si prosegue con i default (automazioni attive) */
  }
  return stati;
}

/** Fuga minima per l'HTML dell'email (l'intro è testo semplice dell'admin). */
function escapeBase(testo: string): string {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Intro INTERPOLATA in testo semplice (o stringa vuota). */
export function introTesto(stato: StatoAutomazione | null, vars: VarsTemplate = {}): string {
  return interpola(stato?.intro ?? '', vars).trim();
}

/** Intro come paragrafo HTML (stile unico delle email transazionali). */
export function introParagrafoHtml(testo: string): string {
  const pulito = (testo ?? '').trim();
  if (!pulito) return '';
  return pulito
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#14354e;">${escapeBase(p).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('');
}

/** Paragrafo introduttivo personalizzato (o stringa vuota). */
export function introHtml(stato: StatoAutomazione, vars: VarsTemplate = {}): string {
  return introParagrafoHtml(introTesto(stato, vars));
}

/** Oggetto finale: override del pannello solo se consentito dal tipo di messaggio. */
export function oggettoFinale(
  soggetto: string,
  stato: StatoAutomazione | null,
  automazione: AutomazioneEdge | undefined,
  vars: VarsTemplate = {},
): string {
  if (!stato?.oggetto) return soggetto;
  if (automazione?.oggettoBloccato) return soggetto;
  return interpola(stato.oggetto, vars);
}

/** Scheda email con gli override del pannello già applicati. */
export function applicaOverrideScheda(
  scheda: { soggetto: string; testo: string; html: string },
  stato: StatoAutomazione | null,
  vars: VarsTemplate = {},
): { soggetto: string; testo: string; html: string } {
  if (!stato) return scheda;
  const corpoPersonalizzato = stato.corpo ? interpola(stato.corpo, vars) : null;
  const testo = corpoPersonalizzato ?? scheda.testo;
  const htmlBase = corpoPersonalizzato ? testoAEmailHtml(corpoPersonalizzato) : scheda.html;
  const prefisso = introHtml(stato, vars);
  return {
    soggetto: stato.oggetto ? interpola(stato.oggetto, vars) : scheda.soggetto,
    testo: prefisso ? `${interpola(stato.intro ?? '', vars)}\n\n${testo}` : testo,
    html: prefisso ? prefisso + htmlBase : htmlBase,
  };
}
