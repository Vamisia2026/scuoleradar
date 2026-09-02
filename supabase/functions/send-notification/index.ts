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
  piano?: string;
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

/**
 * Termini declinati per genere (colonna profiles.genere):
 *   {{Caro_a}}  → 'Cara' se 'F', altrimenti 'Caro'
 *   {{stato_a}} → 'stata' se 'F', altrimenti 'stato'
 */
function caro(genere?: string): string {
  return genere === 'F' ? 'Cara' : 'Caro';
}
function stato(genere?: string): string {
  return genere === 'F' ? 'stata' : 'stato';
}
/** Concordanza di genere della email di benvenuto (Benvenuto/Benvenuta). */
function benvenuto(genere?: string): string {
  return genere === 'F' ? 'Benvenuta' : 'Benvenuto';
}

/** Testi esatti del ciclo a 5 step (Step 1-5) + notifica PRO + attivazione/rinnovo PRO (declinati per genere). */
const TESTI: Record<
  string,
  {
    soggetto: string | ((genere?: string) => string);
    email: (o: Opportunita, genere?: string) => string;
    telegram: (o: Opportunita, genere?: string) => string;
  }
> = {
  step1: {
    soggetto: (genere) => `${benvenuto(genere)} in Scuole Radar`,
    email: (_o, genere) =>
      `${benvenuto(genere)} in Scuole Radar.<br/><br/>
Questo è un sito per chi lavora o cerca lavoro nella scuola. Ti aiutiamo a trovare informazioni e opportunità, senza perdere tempo.<br/><br/>
Con il tuo account <b>Base</b> hai accesso gratuito a:<br/>
• Modulistica scolastica<br/>
• Crea CV<br/>
• Calcolatore CFU<br/>
• Radar Scuole, con <b>3 segnalazioni</b> di opportunità di lavoro<br/><br/>
Radar Scuole è il servizio di cui siamo più orgogliosi.<br/>
Cerchiamo per te opportunità di lavoro nelle scuole, che spesso sono difficili da trovare, perché nascoste nei siti istituzionali. Quando ce n'è una, il tempo è fondamentale.<br/><br/>
Per sfruttare Radar Scuole al meglio, scarica Telegram e attiva le notifiche: è lì che ti arriveranno le nostre segnalazioni.<br/><br/>
Hai <b>3 segnalazioni gratuite</b>. Dopo potrai decidere se passare a PRO e lasciarci continuare la ricerca per te, oppure usare solo l'account Base.<br/><br/>
Non ti mandiamo comunicazioni inutili. Se ti scriviamo, apri il messaggio.<br/><br/>
Hai appena cominciato a conoscere Scuole Radar. Gli strumenti PRO sono molti di più, ma lasciamo che sia tu a scoprirli, un po' alla volta.<br/><br/>
E niente newsletter quotidiane.<br/><br/>
Quando vuoi sapere cosa succede di importante nella scuola, vai su <a href="${BLOG_URL}">ScuoleRadar.it → Notizie</a>.<br/><br/>
${benvenuto(genere)}. Speriamo che Scuole Radar contribuisca a migliorare la tua vita professionale, facendoti risparmiare tempo.`,
    telegram: (_o, genere) =>
      `${benvenuto(genere)} in Scuole Radar! 🎉\nCerchiamo per te opportunità di lavoro nelle scuole, spesso nascoste nei siti istituzionali. Hai 3 segnalazioni gratuite: attiva le notifiche su Telegram. Quando vuoi, tutto su https://www.scuoleradar.it/notizie`,
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
    soggetto: 'Il tuo periodo di prova è terminato: passa a PRO per continuare a ricevere le opportunità',
    email: (o) =>
      conOpportunita(o, 'Le tue <b>3 notifiche di prova sono terminate</b>.<br/>Per continuare a ricevere le opportunità su misura per te in tempo reale, passa al piano PRO.'),
    telegram: (o) =>
      conOpportunitaTg(o, 'Le tue <b>3 notifiche di prova sono terminate</b>.\nPer continuare a ricevere le opportunità su misura per te, passa al piano PRO.'),
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
  welcome_pro: {
    soggetto: 'Benvenuto nel piano PRO di ScuoleRadar',
    email: (o, genere) =>
      `${caro(genere)}, benvenuto ${stato(genere)} nel piano <b>PRO</b> di ScuoleRadar!<br/>Da ora hai notifiche illimitate, strumenti docenti completi e moduli sempre aggiornati a norma di legge.<br/><br/>Inizia subito su <a href="https://www.scuoleradar.it/">www.scuoleradar.it</a> e resta aggiornato con <a href="https://www.scuoleradar.it/notizie">www.scuoleradar.it/notizie</a>.`,
    telegram: (o, genere) =>
      `${caro(genere)}, benvenuto ${stato(genere)} nel piano PRO di ScuoleRadar! 👑\nhttps://www.scuoleradar.it/ · https://www.scuoleradar.it/notizie`,
  },
  conferma_base: {
    soggetto: 'Conferma attivazione: il tuo account Base è attivo',
    email: (_o, genere) =>
      `${benvenuto(genere)} in ScuoleRadar!<br/><br/>Il tuo account <b>Base</b> è attivo e puoi iniziare subito.<br/>Hai già accesso gratuito a Modulistica scolastica, Crea CV, Calcolatore CFU e Radar Scuole con <b>3 segnalazioni</b> di opportunità.<br/><br/>Quando vuoi sapere cosa succede di importante nella scuola, vai su <a href="${BLOG_URL}">ScuoleRadar.it → Notizie</a>.<br/><br/>Non ti mandiamo comunicazioni inutili: quando ti scriviamo, apri il messaggio.`,
    telegram: (_o, genere) =>
      `${benvenuto(genere)} in ScuoleRadar! 🎉 Il tuo account Base è attivo: hai accesso gratuito a Modulistica, Crea CV, Calcolatore CFU e Radar con 3 segnalazioni. Novità su https://www.scuoleradar.it/notizie`,
  },
  conferma_attivazione: {
    soggetto: 'Conferma attivazione: il tuo piano PRO è attivo',
    email: (o, genere) =>
      `${caro(genere)}, la tua attivazione è confermata: il piano <b>PRO</b> di ScuoleRadar è attivo.${o.piano === 'free_forever' ? ' Sei nel piano <b>Free Forever</b>: il rinnovo annuale avviene automaticamente a <b>0€</b> per sempre — non riceverai mai solleciti di pagamento.' : ' Da ora hai notifiche illimitate, strumenti docenti completi e moduli sempre aggiornati a norma di legge.'}<br/><br/>Inizia subito su <a href="https://www.scuoleradar.it/">www.scuoleradar.it</a> e resta aggiornato con <a href="${BLOG_URL}">www.scuoleradar.it/notizie</a>.`,
    telegram: (o, genere) =>
      `${caro(genere)}, la tua attivazione è confermata: il piano PRO di ScuoleRadar è attivo!${o.piano === 'free_forever' ? ' Free Forever: rinnovo annuale automatico a 0€, per sempre.' : ' Notifiche illimitate e strumenti docenti completi.'}\nhttps://www.scuoleradar.it/ · https://www.scuoleradar.it/notizie`,
  },
  free_forever_preavviso: {
    soggetto: 'Piano PRO Free Forever: il rinnovo gratuito è automatico',
    email: (o, genere) =>
      `${caro(genere)}, il tuo piano <b>PRO Free Forever</b> scade il <b>${o.scadenza ?? 'prossimo rinnovo annuale'}</b>.<br/><br/>Tranquillo: nessun pagamento e nessuna azione richiesta. Alla scadenza il rinnovo parte automaticamente a <b>0€</b>, per sempre.<br/>Non riceverai mai solleciti di pagamento né avvisi di mancato rinnovo.<br/><br/>Ti aspettiamo su <a href="https://www.scuoleradar.it/">www.scuoleradar.it</a> e sulle novità del nostro <a href="${BLOG_URL}">notiziario</a>.`,
    telegram: (o, genere) =>
      `${caro(genere)}, il tuo piano PRO Free Forever scade il ${o.scadenza ?? 'prossimo rinnovo annuale'}. 🎁 Rinnovo automatico a 0€, per sempre: nessun pagamento, nessuna azione. https://www.scuoleradar.it/ · https://www.scuoleradar.it/notizie`,
  },
  beta_rinnovo_preavviso: {
    soggetto: 'Sei tra i primi a sostenerci: il tuo account PRO verrà rinnovato GRATIS A VITA 🎁',
    email: (o, genere) =>
      `${caro(genere)}, sei tra i primi a sostenerci, e per noi questo conta molto.<br/>Come ringraziamento, il tuo account <b>PRO</b> verrà rinnovato <b>GRATIS A VITA</b>.<br/><br/>Alla scadenza il rinnovo avverrà automaticamente: non dovrai fare nulla. Ti aspettiamo su <a href="https://www.scuoleradar.it/">www.scuoleradar.it</a> e sulle novità del nostro <a href="https://www.scuoleradar.it/notizie">notiziario</a>.`,
    telegram: (o, genere) =>
      `${caro(genere)}, sei tra i primi a sostenerci: il tuo account PRO verrà rinnovato GRATIS A VITA. 🎁\nhttps://www.scuoleradar.it/ · https://www.scuoleradar.it/notizie`,
  },
  beta_rinnovo_conferma: {
    soggetto: 'Congratulazioni, il tuo account PRO è stato rinnovato con successo! 🎉',
    email: (o, genere) =>
      `Congratulazioni! 🎉<br/>${caro(genere)}, il tuo account <b>PRO</b> è ${stato(genere)} rinnovato con successo: da oggi non ha più una data di scadenza — accesso <b>PRO a vita</b>, in omaggio.<br/><br/>Continua a usare ScuoleRadar su <a href="https://www.scuoleradar.it/">www.scuoleradar.it</a> e resta aggiornato con <a href="https://www.scuoleradar.it/notizie">www.scuoleradar.it/notizie</a>.`,
    telegram: (o, genere) =>
      `Congratulazioni! 🎉 ${caro(genere)}, il tuo account PRO è ${stato(genere)} rinnovato con successo: ora sei PRO per sempre, senza scadenza.\nhttps://www.scuoleradar.it/ · https://www.scuoleradar.it/notizie`,
  },
};

// EMAIL 3 — "Conferma attivazione Base" per i nuovi account Base (inclusi
// Google One Tap): il trigger DB legacy `trg_auth_users_step1_welcome` invia
// ancora tipo 'step1' → consegniamo il testo di conferma aggiornato anche su
// quel tipo, finché il trigger non viene migrato a 'conferma_base'.
TESTI.step1 = { ...TESTI.conferma_base };

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
    `${SUPABASE_URL}/rest/v1/profiles?select=email,email_notifica,telegram_chat_id,nome,genere&id=eq.${encodeURIComponent(userId)}`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  ).catch(() => null);
  if (!res || !res.ok) return null;
  const rows = (await res.json().catch(() => [])) as Array<{
    email?: string;
    email_notifica?: string;
    telegram_chat_id?: string;
    nome?: string;
    genere?: string;
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
  let genere = String(body.genere ?? '').trim();

  if (userId) {
    const profilo = await caricaProfilo(userId);
    if (profilo) {
      if (!email) email = (profilo.email_notifica || profilo.email || '').trim();
      if (!chatId) chatId = (profilo.telegram_chat_id ?? '').trim();
      if (!genere) genere = (profilo.genere ?? '').trim();
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
    piano: body.piano ? String(body.piano) : undefined,
  };

  const saluto = nome ? `${caro(genere)} ${escapeHtml(nome)},<br/>` : '';
  const corpoEmail = saluto + testo.email(opp, genere) + '<br/><br/>' + FIRMA + '<br/>P.S. Approfondimenti e novità sul blog: <a href="' + BLOG_URL + '">scuoleradar.it/notizie</a>' + DISCLAIMER_EMAIL;
  const corpoTelegram = testo.telegram(opp, genere) + '\n\n' + FIRMA;
  const soggetto = typeof testo.soggetto === 'function' ? testo.soggetto(genere) : testo.soggetto;
  const errEmail = email ? await inviaEmail(email, soggetto, corpoEmail) : 'nessun indirizzo email';
  const errTelegram = chatId ? await inviaTelegram(chatId, corpoTelegram) : null;

  if (errEmail) console.error(`[send-notification] ${tipo} → email ${email}: ${errEmail}`);
  if (errTelegram) console.error(`[send-notification] ${tipo} → telegram ${chatId}: ${errTelegram}`);

  return new Response(
    JSON.stringify({ ok: !errEmail && !errTelegram, tipo, email: errEmail ?? 'ok', telegram: errTelegram ?? 'ok' }),
    { status: 200, headers: CORS },
  );
});