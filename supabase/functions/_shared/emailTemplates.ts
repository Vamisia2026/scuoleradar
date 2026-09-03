/**
 * TEMPLATE CENTRALIZZATI — email lifecycle & modali (ScuoleRadar)
 *
 * Unico file con TUTTI i testi (oggetto, corpo email e copy dei modali) per:
 *   FLUSSO 1 — Onboarding / Benvenuto (email 1.1 + modali 1.A/1.B)
 *   FLUSSO 2 — Radar non configurato (email 2.1)
 *   FLUSSO 3 — Conversione / Drip di scadenza PRO (email 3.1 → 3.4)
 *
 * Uso:
 *  · Edge send-notification (Deno): import { getEmailScheda, ... } from '../_shared/emailTemplates.ts'
 *  · Frontend (modali):           import { LINKS, MODALE_TEMPLATES } from '../../supabase/functions/_shared/emailTemplates.ts'
 *
 * Variabili supportate (interpolazione {{chiave}}):
 *   {{nome}}            nome utente (display)
 *   {{link_radar}}      https://scuoleradar.it/dashboard?action=open-radar
 *   {{link_checkout}}   https://scuoleradar.it/checkout/pro-annuale?coupon=RADAR50
 *   {{link_purefocus}}  https://purefocus.one
 */

// ----------------------------------------------------------------
// Link canonici (unico punto di modifica)
// ----------------------------------------------------------------
export const LINK_RADAR = 'https://scuoleradar.it/dashboard?action=open-radar';
export const LINK_CHECKOUT_RADAR50 = 'https://scuoleradar.it/checkout/pro-annuale?coupon=RADAR50';
export const LINK_PUREFOCUS = 'https://purefocus.one';

export const LINKS = {
  link_radar: LINK_RADAR,
  link_checkout: LINK_CHECKOUT_RADAR50,
  link_purefocus: LINK_PUREFOCUS,
};

// ----------------------------------------------------------------
// Variabili + interpolazione
// ----------------------------------------------------------------
export interface VarsTemplate {
  nome?: string;
  link_radar?: string;
  link_checkout?: string;
  link_purefocus?: string;
  [chiave: string]: string | undefined;
}

export function interpola(testo: string, vars: VarsTemplate = {}): string {
  const mappa: VarsTemplate = { ...LINKS, ...vars };
  return testo.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, chiave: string) => {
    const val = mappa[chiave];
    return typeof val === 'string' ? val : `{{${chiave}}}`;
  });
}

/** Riempie i placeholder della chiave `{{nome}}` con il primo nome dell'utente. */
export function primoNome(nomeCompleto?: string | null): string {
  const n = String(nomeCompleto ?? '').trim();
  return n.split(/\s+/)[0] ?? '';
}

// ----------------------------------------------------------------
// Convertitore testo-semplice → HTML email
//  · righe "[ LABEL ] -> url"   → pulsante CTA
//  · paragrafi separati da riga vuota → <p>…
//  · URL "spogli" dentro i paragrafi → <a href>
// ----------------------------------------------------------------
export function testoAEmailHtml(testo: string): string {
  const righe = testo.replace(/\r/g, '').split('\n');
  const blocchi: string[] = [];
  let paragrafo: string[] = [];

  const flush = (): void => {
    if (paragrafo.length === 0) return;
    const html = paragrafo
      .map((r) =>
        r.replace(
          /(https?:\/\/[^\s<]+)/g,
          (u) => `<a href="${u}" style="color:#2B6F9E;text-decoration:underline;">${u}</a>`,
        ),
      )
      .join('<br/>');
    blocchi.push(`<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#0f172a;">${html}</p>`);
    paragrafo = [];
  };

  for (const raw of righe) {
    const riga = raw.trim();
    if (!riga) {
      flush();
      continue;
    }
    // CTA: [ ETICHETTA ] -> URL
    const m = riga.match(/^\[\s*(.+?)\s*\]\s*(?:->\s*)?(\S+)$/);
    if (m) {
      flush();
      blocchi.push(
        `<p style="margin:18px 0;text-align:center;">` +
          `<a href="${m[2]}" style="display:inline-block;background:#2B6F9E;color:#ffffff;padding:12px 22px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;">${m[1]}</a>` +
          `</p>`,
      );
      continue;
    }
    paragrafo.push(riga);
  }
  flush();
  return blocchi.join('');
}

// ----------------------------------------------------------------
// Modali (1.A primo accesso, 1.B exit-intent / inattività)
// ----------------------------------------------------------------
export interface ModaleTemplate {
  chiave: string;
  titolo: string;
  testo: string;
}

export const MODALE_TEMPLATES: Record<string, ModaleTemplate> = {
  modale_1a_primo_accesso: {
    chiave: 'modale_1a_primo_accesso',
    titolo: '🎁 Hai appena ricevuto 1 mese PRO gratis',
    testo: `Benvenuto in Scuole Radar!

Per il tuo primo mese hai accesso gratuito a tutti i servizi PRO.

Attiva il tuo Radar:
Provincia [ Seleziona ]
Classe di concorso [ Seleziona ]

[ ATTIVA IL MIO RADAR ] -> {{link_radar}}

Da quel momento, cercheremo noi le opportunità per te.
Non perdere il tuo mese PRO senza utilizzarlo.`,
  },
  modale_1b_exit_intent: {
    chiave: 'modale_1b_exit_intent',
    titolo: 'Il tuo Radar è ancora spento.',
    testo: `Ciao {{nome}},

Solo per essere chiari… Hai 1 mese PRO gratis, ma per ora non lo stai utilizzando.

Indica provincia e classe di concorso e lascia che sia Scuole Radar a cercare gli interpelli per te.

[ ATTIVA IL RADAR ] -> {{link_radar}}

Puoi farlo in meno di un minuto.

Un saluto,
I tuoi colleghi di Scuole Radar`,
  },
};

// ----------------------------------------------------------------
// Email — FLUSSO 1 / 2 / 3 (oggetto + corpo con CTA e placeholder)
// ----------------------------------------------------------------
export interface EmailTemplate {
  chiave: string;
  soggetto: string;
  corpo: string;
}

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  // ---------- FLUSSO 1 — Onboarding (Email 1.1) ----------
  email_1_1_onboarding: {
    chiave: 'email_1_1_onboarding',
    soggetto: 'Benvenuto su Scuole Radar + Il tuo mese PRO in regalo',
    corpo: `Caro {{nome}},

Benvenuto in Scuole Radar.

Per festeggiare il tuo arrivo, ti regaliamo 1 mese di account PRO, offerto dal nostro partner PureFocus, un ambiente per usare YouTube per il tuo studio e lavoro senza distrazioni (puoi scoprirlo su {{link_purefocus}}).

Il servizio di cui siamo più orgogliosi è il nostro Radar, attraverso cui cerchiamo opportunità di lavoro pubblicate dalle scuole e spesso molto difficili da trovare sui siti istituzionali.

Quando troviamo qualcosa che sembra fatta apposta per te, te lo segnaliamo.

Per attivare il tuo Radar, indica la tua Provincia e Classe di concorso. Puoi anche scegliere più province o classi di concorso.

[ ATTIVA IL TUO RADAR ] -> {{link_radar}}

Il tuo mese PRO inizia ora.

Un saluto,
I tuoi colleghi di Scuole Radar`,
  },

  // ---------- FLUSSO 2 — Radar non configurato (Email 2.1) ----------
  email_2_1_radar_spento: {
    chiave: 'email_2_1_radar_spento',
    soggetto: 'Il tuo Radar è ancora spento',
    corpo: `Ciao {{nome}},

Il tuo Radar è ancora spento.

Questo significa che in questo momento Scuole Radar non sta cercando opportunità per te, anche se le scuole ne pubblicano ogni giorno.

Cercarli manualmente è un percorso molto frustrante e lento, e il tempo per candidarsi è molto breve.

Per questo abbiamo costruito Radar Scuole: tu ci dici cosa cerchi e dove, noi controlliamo i siti delle scuole e ti segnaliamo le opportunità che troviamo.

Puoi attivarlo in meno di un minuto.

[ ATTIVA IL TUO RADAR ] -> {{link_radar}}

Hai un mese PRO gratuito, usalo!

I tuoi colleghi di Scuole Radar`,
  },

  // ---------- FLUSSO 3 — Conversione / drip scadenza ----------
  email_3_1_scadenza_5: {
    chiave: 'email_3_1_scadenza_5',
    soggetto: 'Il tuo mese PRO su Scuole Radar sta per terminare',
    corpo: `Ciao {{nome}},

Tra 5 giorni termina il tuo mese PRO gratuito.

Durante questo mese hai potuto utilizzare tutti gli strumenti di Scuole Radar senza limitazioni.

Se hai attivato il Radar, abbiamo continuato a cercare per te le opportunità che corrispondono alle tue preferenze.

Dopo il mese gratuito, il tuo account passerà al piano Base.

Se hai trovato utile il nostro servizio, abbiamo un'offerta speciale per te: 50% di sconto sul piano PRO annuale.

Usa il codice RADAR50 quando passi a PRO.

[ PASSA A PRO ] -> {{link_checkout}}

I tuoi colleghi di Scuole Radar`,
  },

  email_3_2_scadenza_3: {
    chiave: 'email_3_2_scadenza_3',
    soggetto: '3 Giorni alla scadenza del PRO di benvenuto',
    corpo: `Caro {{nome}},

Mancano 3 giorni alla fine del tuo mese PRO gratuito.

Se vuoi continuare con il piano PRO, puoi avere il 50% di sconto sul tuo abbonamento annuale a Scuole Radar.

Il codice da utilizzare è: RADAR50

Inseriscilo al momento dell'acquisto del piano PRO annuale.

[ PASSA A PRO CON IL 50% DI SCONTO ] -> {{link_checkout}}

Dopo la scadenza del mese gratuito, il tuo account tornerà al piano Base.

Intanto noi continuiamo a cercare opportunità per te.

A presto!
I tuoi colleghi di Scuole Radar`,
  },

  email_3_3_scadenza_1: {
    chiave: 'email_3_3_scadenza_1',
    soggetto: '1 Giorno alla fine dell’offerta PRO 1 Mese Gratis di Benvenuto',
    corpo: `Ciao {{nome}},

Domani termina il tuo mese PRO gratuito.

Da domani il tuo account PRO diventerà Base e alcune funzioni come il Radar personalizzato non saranno più disponibili.

Se vuoi continuare a utilizzare Scuole Radar PRO, hai ancora un po’ di tempo per approfittare del 50% di sconto sull'abbonamento annuale.

Il codice è: RADAR50

[ ATTIVA PRO CON IL 50% DI SCONTO ] -> {{link_checkout}}

Dopodomani l'offerta potrebbe non essere più disponibile.

Questa è l'ultima comunicazione che ti mandiamo prima della scadenza.

A presto!
I tuoi colleghi di Scuole Radar`,
  },

  email_3_4_scadenza_0: {
    chiave: 'email_3_4_scadenza_0',
    soggetto: 'Il tuo mese PRO gratuito è terminato',
    corpo: `Ciao {{nome}},

Il tuo mese PRO gratuito è terminato.

Da oggi il tuo account PRO è diventato Base.

Puoi continuare a utilizzare gratuitamente Scuole Radar, ma d’ora in poi non continueremo a cercare per te le opportunità di lavoro migliori.

Se vuoi provare a vedere se il tuo codice per il 50% di sconto sul piano annuale funziona ancora, è un’offerta davvero generosa, ma scade. Dopo, devi cercarti a mano tutte le opportunità di lavoro.

Codice: RADAR50

[ TORNA A PRO ] -> {{link_checkout}}

A presto!
I tuoi colleghi di Scuole Radar`,
  },
};

export type ChiaveEmail = keyof typeof EMAIL_TEMPLATES;

/** Scheda email pronta all'invio: soggetto interpolato + testo + HTML. */
export function getEmailScheda(
  chiave: ChiaveEmail,
  vars: VarsTemplate = {},
): { soggetto: string; testo: string; html: string } {
  const tpl = EMAIL_TEMPLATES[chiave];
  const testo = interpola(tpl.corpo, vars);
  return {
    soggetto: interpola(tpl.soggetto, vars),
    testo,
    html: testoAEmailHtml(testo),
  };
}

