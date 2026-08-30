import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'ScuoleRadar (Notifiche Automatiche) <notifiche@scuoleradar.it>';
const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const SEND_SECRET = Deno.env.get('SEND_NOTIFICATION_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const PREZZI_URL = 'https://scuoleradar.it/prezzi';
const FIRMA = 'I tuoi colleghi di <b>Scuole Radar</b>';
const BLOG_URL = 'https://scuoleradar.it/notizie';
/** Disclaimer legale/UX per tutte le email automatiche: la casella non è monitorata. */
const DISCLAIMER_EMAIL = `<p style="margin:16px 0 0; font-size:12px; color:#94a3b8; line-height:1.5;">⚠️ Questa è un'email automatica generata dal sistema. Ti preghiamo di non rispondere a questo messaggio perché la casella non viene letta. Se hai bisogno di aiuto o vuoi segnalarci qualcosa, usa il nostro <a href="https://scuoleradar.it/contatti" style="color:#94a3b8;">Form di Contatto</a> (https://scuoleradar.it/contatti).</p>`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-send-secret',
};

interface Opportunita {
  titolo?: string;
  scuola?: string;
  provincia?: string;
  classe?: string;
  scadenza?: string;
  link?: string;
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Blocco opportunità standard: titolo + dettagli + fonte ufficiale verificata. */
function conOpportunita(o: Opportunita, testo: string): string {
  let t = testo;
  if (o.titolo) t += `<br/><b>${escapeHtml(o.titolo)}</b>`;
  const dettagli: string[] = [];
  if (o.scuola) dettagli.push(`🏫 ${escapeHtml(o.scuola)}`);
  if (o.classe) dettagli.push(`📚 ${escapeHtml(o.classe)}`);
  if (o.provincia) dettagli.push(`📍 ${escapeHtml(o.provincia)}`);
  if (o.scadenza) dettagli.push(`⏳ Scadenza: ${escapeHtml(o.scadenza)}`);
  if (dettagli.length) t += `<br/>${dettagli.join(' · ')}`;
  if (o.link) t += `<br/><a href="${escapeHtml(o.link)}">🔗 Fonte ufficiale verificata — apri e candidati</a>`;
  return t;
}
function conOpportunitaTg(o: Opportunita, testo: string): string {
  let t = testo;
  if (o.titolo) t += `\n📌 <b>${escapeHtml(o.titolo)}</b>`;
  if (o.scuola) t += `\n🏫 ${escapeHtml(o.scuola)}`;
  if (o.classe) t += `\n📚 ${escapeHtml(o.classe)}`;
  if (o.provincia) t += `\n📍 ${escapeHtml(o.provincia)}`;
  if (o.scadenza) t += `\n⏳ Scadenza: ${escapeHtml(o.scadenza)}`;
  if (o.link) t += `\n🔗 <a href="${escapeHtml(o.link)}">Fonte ufficiale verificata — apri e candidati</a>`;
  return t;
}

/** Testi esatti del ciclo a 5 step (Step 1-5) + notifica PRO. */
const TESTI: Record<string, { soggetto: string; email: (o: Opportunita) => string; telegram: (o: Opportunita) => string }> = {
  step1: {
    soggetto: 'Grazie per esserti iscritto, ora ci pensiamo noi',
    email: () =>
      'Grazie per esserti iscritto, ora ci pensiamo noi.<br/>Il tuo profilo è <b>attivo</b>: interpelli, supplenze, PON, PNRR e bandi per esperti ora hanno qualcuno che li monitora per te.',
    telegram: () =>
      'Grazie per esserti iscritto, ora ci pensiamo noi.\nIl tuo profilo è <b>attivo</b>: interpelli, supplenze, PON, PNRR e bandi per esperti ora hanno qualcuno che li monitora per te.',
  },
  step2: {
    soggetto: 'Questa è la prima opportunità che abbiamo trovato per te. Te ne restano 2',
    email: (o) =>
      conOpportunita(o, 'Questa è la <b>prima opportunità</b> che abbiamo trovato per te. Te ne <b>restano 2</b>.'),
    telegram: (o) =>
      conOpportunitaTg(o, 'Questa è la <b>prima opportunità</b> che abbiamo trovato per te. Te ne <b>restano 2</b>.'),
  },
  step3: {
    soggetto: 'Questa è la seconda opportunità che abbiamo trovato per te. Te ne resta 1',
    email: (o) =>
      conOpportunita(o, 'Questa è la <b>seconda opportunità</b> che abbiamo trovato per te. Te ne <b>resta 1</b>.'),
    telegram: (o) =>
      conOpportunitaTg(o, 'Questa è la <b>seconda opportunità</b> che abbiamo trovato per te. Te ne <b>resta 1</b>.'),
  },
  step4: {
    soggetto: 'Questa non dovevamo mandartela, ma era troppo bella. Ora il tuo periodo di prova è finito',
    email: (o) =>
      conOpportunita(o, 'Questa non dovevamo mandartela, ma era troppo bella. <b>Ora il tuo periodo di prova è finito.</b>'),
    telegram: (o) =>
      conOpportunitaTg(o, 'Questa non dovevamo mandartela, ma era troppo bella. <b>Ora il tuo periodo di prova è finito.</b>'),
  },
  step5: {
    soggetto: 'Le tue notifiche di prova sono finite',
    email: () =>
      'Le tue notifiche di prova sono finite. <b>Passa al piano PRO</b> per continuare a ricevere notifiche illimitate in tempo reale, oppure resta con l\u2019Account Base.<br/><a href="' +
      PREZZI_URL +
      '">Passa a PRO</a>',
    telegram: () =>
      'Le tue notifiche di prova sono finite. <b>Passa al piano PRO</b> per continuare a ricevere notifiche illimitate in tempo reale, oppure resta con l\u2019Account Base.\n👉 ' +
      PREZZI_URL,
  },
  notifica_pro: {
    soggetto: 'Nuova opportunità trovata per te!',
    email: (o) => conOpportunita(o, 'Abbiamo trovato una <b>nuova opportunità</b> per te.'),
    telegram: (o) => conOpportunitaTg(o, 'Abbiamo trovato una <b>nuova opportunità</b> per te.'),
  },
};

async function inviaTelegram(chatId: string, testo: string): Promise<string | null> {
  if (!TELEGRAM_TOKEN) return 'TELEGRAM_BOT_TOKEN non configurato';
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: testo, parse_mode: 'HTML' }),
    });
  } catch (err) {
    return `eccezione: ${(err as Error).message}`;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return `HTTP ${res.status}: ${JSON.stringify(body)}`;
  }
  return null;
}

async function inviaEmail(email: string, soggetto: string, html: string): Promise<string | null> {
  if (!RESEND_API_KEY) return 'RESEND_API_KEY non configurato';
  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: RESEND_FROM, to: [email], subject: soggetto, html }),
    });
  } catch (err) {
    return `eccezione: ${(err as Error).message}`;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return `HTTP ${res.status}: ${JSON.stringify(body)}`;
  }
  return null;
}

async function caricaProfilo(userId: string) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=email,email_notifica,telegram_chat_id,nome&id=eq.${encodeURIComponent(userId)}`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  ).catch(() => null);
  if (!res || !res.ok) return null;
  const rows = (await res.json().catch(() => [])) as Array<{
    email?: string;
    email_notifica?: string;
    telegram_chat_id?: string;
    nome?: string;
  }>;
  return rows[0] ?? null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo non consentito' }), { status: 405, headers: CORS });
  }

  const secret = req.headers.get('x-send-secret');
  if (SEND_SECRET && secret !== SEND_SECRET) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400, headers: CORS });
  }

  if (body.ping === true) {
    return new Response(
      JSON.stringify({ ok: true, resend: Boolean(RESEND_API_KEY), telegram: Boolean(TELEGRAM_TOKEN) }),
      { status: 200, headers: CORS },
    );
  }

  const tipo = String(body.tipo ?? '');
  const userId = String(body.userId ?? '');
  let email = String(body.email ?? '').trim();
  let chatId = String(body.chatId ?? '').trim();
  const nome = String(body.nome ?? '').trim();

  if (userId) {
    const profilo = await caricaProfilo(userId);
    if (profilo) {
      if (!email) email = (profilo.email_notifica || profilo.email || '').trim();
      if (!chatId) chatId = (profilo.telegram_chat_id ?? '').trim();
    }
  }

  const testo = TESTI[tipo];
  if (!testo) {
    return new Response(JSON.stringify({ error: `tipo non valido: ${tipo}` }), { status: 400, headers: CORS });
  }

  const opp: Opportunita = {
    titolo: body.titolo ? String(body.titolo) : undefined,
    scuola: body.scuola ? String(body.scuola) : undefined,
    provincia: body.provincia ? String(body.provincia) : undefined,
    classe: body.classe ? String(body.classe) : undefined,
    scadenza: body.scadenza ? String(body.scadenza) : undefined,
    link: body.link ? String(body.link) : undefined,
  };

  const saluto = nome ? `Ciao ${escapeHtml(nome)},<br/>` : '';
  const corpoEmail = saluto + testo.email(opp) + '<br/><br/>' + FIRMA + '<br/>P.S. Approfondimenti e novità sul blog: <a href="' + BLOG_URL + '">scuoleradar.it/notizie</a>' + DISCLAIMER_EMAIL;
  const corpoTelegram = testo.telegram(opp) + '\n\n' + FIRMA;
  const errEmail = email ? await inviaEmail(email, testo.soggetto, corpoEmail) : 'nessun indirizzo email';
  const errTelegram = chatId ? await inviaTelegram(chatId, corpoTelegram) : null;

  if (errEmail) console.error(`[send-notification] ${tipo} → email ${email}: ${errEmail}`);
  if (errTelegram) console.error(`[send-notification] ${tipo} → telegram ${chatId}: ${errTelegram}`);

  return new Response(
    JSON.stringify({ ok: !errEmail && !errTelegram, tipo, email: errEmail ?? 'ok', telegram: errTelegram ?? 'ok' }),
    { status: 200, headers: CORS },
  );
});