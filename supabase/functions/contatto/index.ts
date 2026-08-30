// ============================================================
// Edge Function Supabase — Modulo Contatti ("Contattaci / Get in Touch")
//
// Riceve il form di contatto dal frontend e lo inoltra via Resend
// alla mail di supporto del progetto.
//
// Body atteso:
//   {
//     "email": "mittente@example.com",
//     "dipartimento": "commerciale | stampa | assistenza | tecnico",
//     "oggetto": "oggetto opzionale",
//     "messaggio": "testo della richiesta",
//     "website": "<honeypot — deve restare vuoto>",
//     "utenteLoggato": true | false,
//     "allegato": { "name": "file.png", "type": "image/png", "data": "<base64>" } | null
//   }
//
// Anti-spam & lingua:
//   · honeypot compilato → richiesta scartata (risposta ok, nessuna email)
//   · alfabeti non latini (cirillico, greco, arabo, ebraico, CJK…) → scarto
//   · impronte spam note (farmaci, casino, crypto, "make money"…) → scarto
//   · troppi link nel messaggio (>= 4) → scarto
//
// Email di notifica (a CONTACT_SUPPORT_EMAIL, default supporto@scuoleradar.it):
//   Subject: [ScuoleRadar] [<Dipartimento>] - <Oggetto utente>
//   Reply-To: email del mittente
//   Corpo: Sito, Dipartimento, stato di login, Da, Oggetto, Allegato, Messaggio.
//
// Secrets richiesti (supabase secrets set --env-file ./supabase/.env.production):
//   RESEND_API_KEY            (obbligatoria) — chiave API Resend
//   CONTACT_SUPPORT_EMAIL     (opzionale)    — mail di supporto, default supporto@scuoleradar.it
//   RESEND_FROM_EMAIL         (opzionale)    — mittente (default ScuoleRadar (Notifiche Automatiche) <notifiche@scuoleradar.it>)
//
// Deploy:
//   supabase functions deploy contatto --project-ref gwdmsgsshvdnfrplbjiv --no-verify-jwt
//   (--no-verify-jwt: il form contatti è pubblico, funziona anche per utenti non loggati)
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPPORT_EMAIL = Deno.env.get('CONTACT_SUPPORT_EMAIL') ?? 'supporto@scuoleradar.it';
const FROM_EMAIL =
  Deno.env.get('RESEND_FROM_EMAIL') ?? 'ScuoleRadar (Notifiche Automatiche) <notifiche@scuoleradar.it>';

/** Dipartimenti strategici (value → nome visualizzato nell'email). */
const DIPARTIMENTI: Record<string, string> = {
  commerciale: 'Commerciale & Partnerships',
  stampa: 'Ufficio Stampa & Media',
  assistenza: 'Assistenza Utenti & Account',
  tecnico: 'Segnalazioni Tecniche & Bug',
};

/** Header CORS per richieste dal browser (incluso lo sviluppo locale). */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // Necessario per le richieste dev da localhost verso la funzione locale
  // (Private Network Access di Chrome) e per il preflight in generale.
  'Access-Control-Allow-Private-Network': 'true',
};

function risposta(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Alfabeti NON latini (cirillico, greco, arabo, ebraico, CJK…). */
const RE_SCRIPT_NON_LATINO =
  /[\u0400-\u04FF\u0500-\u052F\u0370-\u03FF\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;

/** Impronte spam note (parole/frasi tipiche dello spam in alfabeto latino). */
const RE_SPAM =
  /(viagra|cialis|tadalafil|sildenafil|canadian pharmacy|casino|betting|poker|bitcoin|btc|crypto|criptovalut|lottery|free money|earn money|make money|100% guaranteed|buy now|click here|promo code|xxx|sexy|escort|enlargement|pill)/i;

/**
 * Controlli anti-spam e di lingua sul messaggio.
 * Ritorna `null` se accettabile, altrimenti il motivo del rifiuto.
 */
function motivoRifiutoMessaggio(messaggio: string): string | null {
  if (messaggio.length < 10) return 'Messaggio troppo corto';
  if (RE_SCRIPT_NON_LATINO.test(messaggio)) {
    return 'Contenuto in alfabeto non latino (spam)';
  }
  if (RE_SPAM.test(messaggio)) {
    return 'Contenuto riconosciuto come spam';
  }
  const linkCount = (messaggio.match(/https?:\/\/\S+/g) ?? []).length;
  if (linkCount >= 4) return 'Troppi link (possibile spam)';
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return risposta({ error: 'Metodo non consentito' }, 405);
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const email = String(body?.email ?? '').trim();
    const dipartimento = String(body?.dipartimento ?? '').trim();
    const oggetto = String(body?.oggetto ?? '').trim();
    const messaggio = String(body?.messaggio ?? '').trim();
    const website = String(body?.website ?? '').trim(); // honeypot anti-spam
    const utenteLoggato = Boolean(body?.utenteLoggato);
    const allegato = (body?.allegato as { name?: string; type?: string; data?: string } | null) ?? null;

    // Health-check mode (ping): nessuna email inviata, solo stato di configurazione.
    if (body?.ping === true) {
      return risposta({
        ok: true,
        configurato: Boolean(RESEND_API_KEY),
        supportEmail: SUPPORT_EMAIL,
      });
    }

    // Honeypot: se compilato (bot) la richiesta viene scartata subito,
    // rispondendo "ok" per non rivelare al bot di essere stato intercettato.
    if (website) {
      console.warn('[contatto] Honeypot compilato: richiesta scartata.');
      return risposta({ ok: true });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return risposta({ error: 'Indirizzo email non valido' }, 400);
    }
    const nomeDipartimento = DIPARTIMENTI[dipartimento];
    if (!nomeDipartimento) {
      return risposta({ error: 'Dipartimento non valido' }, 400);
    }
    // Controlli anti-spam e di lingua (alfabeti non latini, impronte spam,
    // troppi link): il messaggio deve essere in italiano (alfabeto latino).
    const motivo = motivoRifiutoMessaggio(messaggio);
    if (motivo) {
      console.warn(`[contatto] Richiesta scartata da ${email}: ${motivo}.`);
      return risposta({ error: 'Il messaggio non supera i controlli anti-spam' }, 400);
    }
    if (!RESEND_API_KEY) {
      return risposta({ error: 'Resend non configurato sul server (RESEND_API_KEY mancante)' }, 500);
    }

    const attachments =
      allegato?.data && allegato.name
        ? [
            {
              filename: allegato.name,
              content: allegato.data,
              type: allegato.type ?? 'application/octet-stream',
            },
          ]
        : undefined;

    const subject = `[ScuoleRadar] [${nomeDipartimento}] - ${oggetto || 'Richiesta di contatto'}`;

    const html = `
<!DOCTYPE html>
<html lang="it">
  <body style="margin:0; padding:24px; background:#f1f5f9; font-family:Arial, Helvetica, sans-serif;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #d6eaf4; border-radius:12px; padding:24px;">
      <h2 style="margin:0 0 16px; color:#14354e;">Richiesta di contatto — ScuoleRadar</h2>
      <p style="margin:0 0 8px; font-size:14px; color:#334155;"><strong>Sito:</strong> ScuoleRadar (scuoleradar.it)</p>
      <p style="margin:0 0 8px; font-size:14px; color:#334155;"><strong>Dipartimento:</strong> ${escapeHtml(nomeDipartimento)}</p>
      <p style="margin:0 0 8px; font-size:14px; color:#334155;"><strong>Utente autenticato:</strong> ${utenteLoggato ? 'Sì' : 'No'}</p>
      <p style="margin:0 0 8px; font-size:14px; color:#334155;"><strong>Da:</strong> ${escapeHtml(email)}</p>
      <p style="margin:0 0 8px; font-size:14px; color:#334155;"><strong>Oggetto:</strong> ${escapeHtml(oggetto || '—')}</p>
      ${allegato?.name ? `<p style="margin:0 0 8px; font-size:14px; color:#334155;"><strong>Allegato:</strong> ${escapeHtml(allegato.name)}</p>` : ''}
      <hr style="margin:16px 0; border:none; border-top:1px solid #e2e8f0;" />
      <p style="margin:0; font-size:15px; line-height:1.6; color:#14354e; white-space:pre-wrap;">${escapeHtml(messaggio)}</p>
    </div>
  </body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [SUPPORT_EMAIL],
        reply_to: email,
        subject,
        html,
        ...(attachments ? { attachments } : {}),
      }),
    });

    const data = (await res.json().catch(() => null)) as { message?: string } | null;

    if (!res.ok) {
      console.error('[contatto] Resend:', res.status, JSON.stringify(data));
      return risposta({ error: data?.message ?? `Errore Resend (HTTP ${res.status})` }, 502);
    }

    console.log(`[contatto] Richiesta da ${email} · ${dipartimento}${allegato?.name ? ' · allegato ' + allegato.name : ''}`);
    return risposta({ ok: true });
  } catch (err) {
    console.error('[contatto] errore non gestito:', err);
    return risposta({ error: 'Errore interno nell invio del messaggio' }, 500);
  }
});
