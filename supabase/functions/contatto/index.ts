// ============================================================
// Edge Function Supabase — Modulo Contatti ("Contattaci / Get in Touch")
//
// Riceve il form di contatto dal frontend e lo inoltra via Resend
// alla mail di supporto del progetto.
//
// Body atteso:
//   {
//     "email": "mittente@example.com",
//     "dipartimento": "Assistenza & Supporto Tecnico",
//     "oggetto": "oggetto opzionale",
//     "messaggio": "testo della richiesta",
//     "allegato": { "name": "file.png", "type": "image/png", "data": "<base64>" } | null
//   }
//
// Secrets richiesti (supabase secrets set --env-file ./supabase/.env.production):
//   RESEND_API_KEY            (obbligatoria) — chiave API Resend
//   CONTACT_SUPPORT_EMAIL     (opzionale)    — mail di supporto, default supporto@scuoleradar.it
//   RESEND_FROM_EMAIL         (opzionale)    — mittente (default ScuoleRadar <onboarding@resend.dev>)
//
// Deploy:
//   supabase functions deploy contatto --project-ref gwdmsgsshvdnfrplbjiv --no-verify-jwt
//   (--no-verify-jwt: il form contatti è pubblico, funziona anche per utenti non loggati)
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPPORT_EMAIL = Deno.env.get('CONTACT_SUPPORT_EMAIL') ?? 'supporto@scuoleradar.it';
const FROM_EMAIL =
  Deno.env.get('RESEND_FROM_EMAIL') ?? 'ScuoleRadar <onboarding@resend.dev>';

const DIPARTIMENTI = [
  'Assistenza & Supporto Tecnico',
  'Proposte & Suggerimenti',
  'Business & Partnership',
  'Stampa & Media',
];

/** Header CORS per richieste dal browser. */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const allegato = (body?.allegato as { name?: string; type?: string; data?: string } | null) ?? null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return risposta({ error: 'Indirizzo email non valido' }, 400);
    }
    if (!DIPARTIMENTI.includes(dipartimento)) {
      return risposta({ error: 'Dipartimento non valido' }, 400);
    }
    if (messaggio.length < 10) {
      return risposta({ error: 'Il messaggio deve avere almeno 10 caratteri' }, 400);
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

    const subject = `[${dipartimento}] ${oggetto || 'Richiesta di contatto da ScuoleRadar'}`;

    const html = `
<!DOCTYPE html>
<html lang="it">
  <body style="margin:0; padding:24px; background:#f1f5f9; font-family:Arial, Helvetica, sans-serif;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #d6eaf4; border-radius:12px; padding:24px;">
      <h2 style="margin:0 0 16px; color:#14354e;">Richiesta di contatto — ScuoleRadar</h2>
      <p style="margin:0 0 8px; font-size:14px; color:#334155;"><strong>Da:</strong> ${escapeHtml(email)}</p>
      <p style="margin:0 0 8px; font-size:14px; color:#334155;"><strong>Dipartimento:</strong> ${escapeHtml(dipartimento)}</p>
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
