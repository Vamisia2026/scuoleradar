import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  EMAIL_TEMPLATES,
  getEmailScheda,
  primoNome,
} from '../_shared/emailTemplates.ts';
import {
  applicaOverrideScheda,
  automazioneDaTipo,
  introParagrafoHtml,
  introTesto,
  leggiStatiAutomazioni,
  oggettoFinale,
  type AutomazioneEdge,
  type StatoAutomazione,
} from '../_shared/automazioniEmail.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'ScuoleRadar (Notifiche Automatiche) <notifiche@scuoleradar.it>';
const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const SEND_SECRET = Deno.env.get('SEND_NOTIFICATION_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// ============================================================
// FEATURE FLAGS DIPARTIMENTI — stessa semantica di `src/config/features.ts`
// (Deno non può importare da `src/`: la logica di gate è qui, minimale).
//   FEATURE_RADAR=on|test|off   stato del dipartimento che invia le notifiche
//   FEATURE_TEST_REDIRECT=0     disattiva il dirottamento verso l'account admin
//   FEATURE_ADMIN_EMAIL         recapito email dell'account di test
//   ADMIN_TELEGRAM_ID           chat_id Telegram dell'account di test
// In `test` le notifiche automatiche partono SOLO verso l'account admin (mai a
// utenti o beta tester); in `off` non partono affatto.
// ============================================================
const STATO_RADAR = (Deno.env.get('FEATURE_RADAR') ?? 'on').trim().toLowerCase();
const EMAIL_ADMIN_TEST = (
  Deno.env.get('FEATURE_ADMIN_EMAIL') ?? 'bartoloansaldi@gmail.com'
).trim().toLowerCase();
const ADMIN_TELEGRAM_ID = (Deno.env.get('ADMIN_TELEGRAM_ID') ?? '').trim();
const DIROTTA_IN_TEST = (Deno.env.get('FEATURE_TEST_REDIRECT') ?? '1').trim() !== '0';

/**
 * Recapito AMMESSO dal gate delle feature flags, oppure `null` se il canale è
 * bloccato (modulo `off`, o `test` senza recapito admin configurato).
 */
function recapitoAmmesso(canale: 'email' | 'telegram', recapito: string): string | null {
  if (STATO_RADAR === 'on') return recapito;
  if (STATO_RADAR === 'off') return null;
  const admin = canale === 'email' ? EMAIL_ADMIN_TEST : ADMIN_TELEGRAM_ID;
  const eAdmin = canale === 'email' ? recapito.toLowerCase() === EMAIL_ADMIN_TEST : recapito === ADMIN_TELEGRAM_ID;
  if (eAdmin) return recapito;
  return DIROTTA_IN_TEST ? admin || null : null;
}

const PREZZI_URL = 'https://scuoleradar.it/prezzi';
const FIRMA = 'I tuoi colleghi di <b>Scuole Radar</b>';
const BLOG_URL = 'https://www.scuoleradar.it/notizie';

/**
 * BRAND COMPATTO (icona piccola + nome ufficiale CLIICCABILE, stessa riga): apre
 * OGNI messaggio Telegram. Sostituisce i vecchi loghi/immagini "giganti" che
 * generavano l'anteprima e nascondevano il contenuto.
 */
const BRAND_TELEGRAM = '📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>';

/** Testo della testata di opportunità (copy di brand completo). */
const TESTO_OPPORTUNITA = '🎯 <b>Abbiamo trovato una nuova opportunità per te</b>';

/** Intestazione brand COMPATTA delle email (logo 32 px + nome ufficiale). */
const BRAND_EMAIL =
  '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">' +
  '<tr><td style="vertical-align:middle;padding-right:8px;">' +
  '<img src="https://www.scuoleradar.it/logo.png" alt="Scuole Radar" width="32" height="32" ' +
  'style="display:block;width:32px;height:32px;border:0;" /></td>' +
  '<td style="vertical-align:middle;font-size:15px;font-weight:700;color:#14354e;">Scuole Radar.it</td>' +
  '</tr></table>';

/** Etichetta UNICA del link alla fonte ufficiale dell'avviso. */
const ETICHETTA_AVVISO = "👉 Apri l'avviso ufficiale";

/**
 * Tipi il cui messaggio È un'opportunità: soggetti al GATE DI QUALITÀ STRICT
 * (link diretto all'avviso + recapito di candidatura obbligatori). Gli altri
 * tipi sono comunicazioni di ciclo di vita e non citano l'avviso.
 */
const TIPI_CON_OPPORTUNITA = new Set([
  'step2',
  'step3',
  'step4',
  'notifica_pro',
  'prova1',
  'prova2',
  'prova3',
  'extra',
]);

/** Percorsi di RICERCA/ELENCO/ARCHIVIO: mai un avviso specifico. */
const RE_URL_ARCHIVIO =
  /(?:^|\/)(?:tag|tags|category|categorie|search|ricerca|cerca|elenco|elenchi|lista|liste|indice|archivio|archive|pagin(?:a|e)|page|feed)(?:\/|$)/i;

/** True se l'email è un recapito plausibile (un solo `@`, dominio con punto). */
function emailValida(email?: string | null): boolean {
  return /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test((email ?? '').trim().toLowerCase());
}

/**
 * True se l'URL è un avviso SPECIFICO e DIRETTO: mai la home dell'ente, mai una
 * pagina di ricerca/elenco/archivio regionale (es. `/interpelli-lombardia/`,
 * `/tag/interpelli-scuola-piemonte/`). Il link "👉 Apri l'avviso ufficiale" deve
 * portare all'URL esatto dell'avviso, non a un archivio di ricerca.
 */
function eUrlAvvisoDiretto(link?: string | null): boolean {
  const u = (link ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  let percorso = '';
  let query = '';
  try {
    const p = new URL(u);
    const host = p.host.toLowerCase();
    // La piattaforma stessa non è mai una fonte ufficiale.
    if (/(^|\.)scuoleradar\.(it|com)$|(^|\.)purefocus\.one$|localhost|127\.0\.0\.1/i.test(host)) {
      return false;
    }
    percorso = p.pathname.replace(/\/+$/, '').toLowerCase();
    query = p.search;
  } catch {
    return false;
  }
  if (!percorso) return false; // home dell'ente
  if (RE_URL_ARCHIVIO.test(percorso)) return false;
  const segmenti = percorso.split('/').filter(Boolean);
  if (
    segmenti.length === 1 &&
    /^(?:interpelli|avvisi|bandi|supplenze|opportunita)/.test(segmenti[0])
  ) {
    return false;
  }
  if (/[?&](?:s|q|search|query|ricerca|filtro)=/i.test(query)) return false;
  return true;
}

/** Motivo per cui un'opportunità NON è inviabile (`null` = pronta all'invio). */
function motivoAvvisoNonInviabile(
  link?: string | null,
  email?: string | null,
): string | null {
  if (!eUrlAvvisoDiretto(link)) return 'fonte ufficiale non diretta';
  if (!emailValida(email)) return 'recapito di candidatura mancante';
  return null;
}

/**
 * OGGETTO delle email di opportunità: TESTO UNICO E STANDARD
 * (`Nuove opportunità per te!`), identico a `subjectOpportunita`/`subjectDigest`
 * del notifier. Il contesto (classe/provincia) resta nel corpo del messaggio.
 */
function oggettoOpportunita(o?: Opportunita): string {
  // Il contesto (classe/provincia) resta nel corpo del messaggio: oggetto unico.
  void o;
  return 'Nuove opportunità per te!';
}

/** CTA Notizie in TESTO PIANO (Telegram): due righe con URL visibile. */
const CTA_NOTIZIE_TESTO =
  `📌 ${BLOG_URL}\nQuando vuoi sapere cosa succede di importante nella scuola, vieni qui`;

/** URL breve mostrato nella CTA Notizie delle EMAIL. */
const NOTIZIE_VISIBILE = 'scuoleradar.it/notizie';

/**
 * CTA Notizie in HTML (EMAIL) — ESATTAMENTE due righe, tipografia crisp:
 *   scuoleradar.it/notizie
 *   Quando vuoi sapere cosa succede di importante nella scuola vieni qui!
 */
const CTA_NOTIZIE_HTML =
  `<p style="margin:6px 0 0;font-size:14px;line-height:1.5;font-weight:600;">` +
  `<a href="${BLOG_URL}" style="color:#2B6F9E;text-decoration:underline;">${NOTIZIE_VISIBILE}</a></p>` +
  `<p style="margin:2px 0 0;font-size:14px;line-height:1.5;color:#14354e;">` +
  `Quando vuoi sapere cosa succede di importante nella scuola vieni qui!</p>`;

/**
 * URL della pagina di SETUP DEL RADAR (onboarding province + classi): è la
 * destinazione di ogni CTA di conversione. Normalizza l'eventuale override
 * d'ambiente per garantire SEMPRE il percorso `/dashboard/radar`.
 */
function radarSetupUrl(): string {
  const base =
    Deno.env.get('SCUOLERADAR_BASE_URL') ??
    Deno.env.get('RESEND_DASHBOARD_URL') ??
    'https://scuoleradar.it';
  try {
    return new URL('dashboard/radar', new URL('/', base).toString()).toString();
  } catch {
    return 'https://scuoleradar.it/dashboard/radar';
  }
}
const RADAR_URL = radarSetupUrl();

/**
 * Riga "modifica il Radar": VISIBILE e cliccabile (URL in chiaro), non nascosta
 * in una nota grigia. Presente nel footer di ogni email.
 */
const RADAR_LINE_EMAIL =
  `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#14354e;">` +
  `Se questi risultati non corrispondono più ai tuoi interessi, modifica il tuo radar su ` +
  `<a href="${RADAR_URL}" style="color:#2B6F9E;font-weight:700;text-decoration:underline;">${RADAR_URL}</a></p>`;

/**
 * Avviso di casella non monitorata: SEMPRE l'ULTIMA riga dell'email, con
 * tipografia leggibile (mai testo sbiadito che sembri una trappola).
 */
const DISCLAIMER_EMAIL =
  `<p style="margin:16px 0 0;padding-top:12px;border-top:1px solid #d6eaf4;font-size:13px;color:#475569;line-height:1.6;">` +
  `Ti preghiamo di non rispondere a questo messaggio perché questa casella serve solo per inviare le segnalazioni e non è monitorata.</p>`;

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
  /** Email/PEC di candidatura della scuola (resa CLICCABILE negli avvisi). */
  email?: string;
  piano?: string;
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** True se la scadenza è una data reale e NON già passata (mai scadenze nel passato). */
function scadenzaValida(valore: string): boolean {
  const d = new Date(valore);
  if (Number.isNaN(d.getTime())) return false;
  const giorno = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const oggi = new Date();
  return giorno >= Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
}

/**
 * Blocco opportunità standard: titolo + dettagli + fonte ufficiale verificata.
 * Il link di fonte usa l'etichetta UNICA ("👉 Apri l'avviso ufficiale") e punta
 * SEMPRE all'URL ricevuto (nessuna pagina di ricerca di un'altra provincia).
 */
function conOpportunita(o: Opportunita, testo: string): string {
  let t = testo;
  if (o.titolo) t += `<br/><b>${escapeHtml(o.titolo)}</b>`;
  const dettagli: string[] = [];
  if (o.scuola) dettagli.push(`🏫 ${escapeHtml(o.scuola)}`);
  if (o.classe) dettagli.push(`📚 ${escapeHtml(o.classe)}`);
  if (o.provincia) dettagli.push(`📍 ${escapeHtml(o.provincia)}`);
  if (o.scadenza && scadenzaValida(o.scadenza)) {
    dettagli.push(`⏳ Scadenza: ${escapeHtml(o.scadenza)}`);
  }
  if (o.email) dettagli.push(`📧 Candidature: <a href="mailto:${escapeHtml(o.email)}">${escapeHtml(o.email)}</a>`);
  if (dettagli.length) t += `<br/>${dettagli.join(' · ')}`;
  if (o.link) t += `<br/><a href="${escapeHtml(o.link)}">${escapeHtml(ETICHETTA_AVVISO)}</a>`;
  return t;
}
function conOpportunitaTg(o: Opportunita, testo: string): string {
  let t = testo;
  if (o.titolo) t += `\n📌 <b>${escapeHtml(o.titolo)}</b>`;
  if (o.scuola) t += `\n🏫 ${escapeHtml(o.scuola)}`;
  if (o.classe) t += `\n📚 ${escapeHtml(o.classe)}`;
  if (o.provincia) t += `\n📍 ${escapeHtml(o.provincia)}`;
  if (o.scadenza && scadenzaValida(o.scadenza)) {
    t += `\n⏳ Scadenza: ${escapeHtml(o.scadenza)}`;
  }
  if (o.email) t += `\n📧 Candidature: <a href="mailto:${escapeHtml(o.email)}">${escapeHtml(o.email)}</a>`;
  if (o.link) {
    t += `\n<a href="${escapeHtml(o.link)}"><b>${escapeHtml(ETICHETTA_AVVISO)}</b></a>`;
  }
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
    soggetto: string | ((genere?: string, opp?: Opportunita) => string);
    email: (o: Opportunita, genere?: string) => string;
    telegram: (o: Opportunita, genere?: string) => string;
  }
> = {
  step1: {
    soggetto: (genere) => `${benvenuto(genere)} in Scuole Radar`,
    email: (_o, genere) =>
      `${benvenuto(genere)} in Scuole Radar.<br/><br/>
Questo è un sito per chi lavora o cerca lavoro nella scuola. Ti aiutiamo a trovare informazioni e opportunità, senza perdere tempo.<br/><br/>
Con il tuo account hai accesso gratuito a:<br/>
• Modulistica scolastica<br/>
• Crea CV<br/>
• Calcolatore CFU<br/>
• Radar Scuole con <b>notifiche illimitate</b> per i primi 30 giorni<br/><br/>
Radar Scuole è il servizio di cui siamo più orgogliosi.<br/>
Cerchiamo per te opportunità di lavoro nelle scuole, che spesso sono difficili da trovare, perché nascoste nei siti istituzionali. Quando ce n'è una, il tempo è fondamentale.<br/><br/>
Per sfruttare Radar Scuole al meglio, scarica Telegram e attiva le notifiche: è lì che ti arriveranno le nostre segnalazioni.<br/><br/>
Per i primi 30 giorni hai il <b>piano PRO gratuito</b>: nessun limite di segnalazioni. Dopo potrai decidere se continuare con PRO o tornare al piano gratuito.<br/><br/>
Non ti mandiamo comunicazioni inutili. Se ti scriviamo, apri il messaggio.<br/><br/>
Hai appena cominciato a conoscere Scuole Radar. Gli strumenti PRO sono molti di più, ma lasciamo che sia tu a scoprirli, un po' alla volta.<br/><br/>
E niente newsletter quotidiane.<br/><br/>
${benvenuto(genere)}. Speriamo che Scuole Radar contribuisca a migliorare la tua vita professionale, facendoti risparmiare tempo.`,
    telegram: (_o, genere) =>
      `${benvenuto(genere)} in Scuole Radar! 🎉\nCerchiamo per te opportunità di lavoro nelle scuole, spesso nascoste nei siti istituzionali. Hai 1 mese di PRO gratuito con notifiche illimitate: attiva le notifiche su Telegram.`,
  },
  step2: {
    soggetto: (_genere, o) => oggettoOpportunita(o),
    // Il copy di brand COMPLETO apre il messaggio Telegram.
    email: (o) => conOpportunita(o, ''),
    telegram: (o) => conOpportunitaTg(o, TESTO_OPPORTUNITA),
  },
  step3: {
    soggetto: (_genere, o) => oggettoOpportunita(o),
    email: (o) => conOpportunita(o, ''),
    telegram: (o) => conOpportunitaTg(o, TESTO_OPPORTUNITA),
  },
  step4: {
    soggetto: 'Notifiche del piano gratuito in pausa: attiva PRO',
    email: (o) =>
      conOpportunita(o, 'Con il piano gratuito ricevi un numero limitato di segnalazioni.<br/>Con <b>PRO</b> ricevi ogni opportunità in tempo reale, senza limiti.'),
    telegram: (o) =>
      conOpportunitaTg(o, 'Con il piano gratuito ricevi un numero limitato di segnalazioni.\nCon <b>PRO</b> ricevi ogni opportunità in tempo reale, senza limiti.'),  },
  step5: {
    soggetto: 'Ultimo avviso automatico del piano gratuito',
    email: () =>
      'Da adesso non riceverai più notifiche automatiche. I tuoi dati e la Modulistica restano attivi.<br/><b>PRO</b> riattiva gli avvisi illimitati in tempo reale:<br/><a href="' +
      PREZZI_URL +
      '">Attiva PRO</a>',
    telegram: () =>
      'Da adesso non riceverai più notifiche automatiche. I tuoi dati e la Modulistica restano attivi.\n👉 ' +
      PREZZI_URL,
  },
  notifica_pro: {
    soggetto: (_genere, o) => oggettoOpportunita(o),
    email: (o) => conOpportunita(o, ''),
    telegram: (o) => conOpportunitaTg(o, TESTO_OPPORTUNITA),
  },
  welcome_pro: {
    soggetto: 'Benvenuto nel piano PRO di ScuoleRadar',
    email: (o, genere) =>
      `${caro(genere)}, benvenuto ${stato(genere)} nel piano <b>PRO</b> di ScuoleRadar!<br/>Da ora hai notifiche illimitate, strumenti docenti completi e moduli sempre aggiornati a norma di legge.<br/><br/>Inizia subito da <a href="${RADAR_URL}">il tuo Radar</a>.`,
    telegram: (o, genere) =>
      `${caro(genere)}, benvenuto ${stato(genere)} nel piano PRO di ScuoleRadar! 👑\nConfigura il tuo Radar: ${RADAR_URL}`,
  },
  // BENVENUTO POST-REGISTRAZIONE (tipo `step1` dal trigger DB · `conferma_base`):
  // conferma l'attivazione IMMEDIATA del mese di PRO in omaggio ed elenca i
  // vantaggi già attivi. NESSUN riferimento al vecchio modello (account Base,
  // quota di 3 segnalazioni, ritorno al piano gratuito) e nessun contatore.
  conferma_base: {
    soggetto: 'Benvenuto in ScuoleRadar: il tuo mese di PRO è già attivo',
    email: (_o, genere) =>
      `${benvenuto(genere)} in ScuoleRadar!<br/><br/>` +
      'Il tuo <b>mese di PRO in omaggio</b> è già attivo: da questo momento hai tutto disponibile, senza restrizioni.<br/><br/>' +
      'Ecco cosa puoi usare subito:<br/>' +
      '• <b>Radar Scuole</b>: cerca per te gli interpelli pubblicati dalle scuole, con notifiche illimitate<br/>' +
      "• <b>Modulistica scolastica</b>: i modelli pronti all'uso per ogni adempimento<br/>" +
      '• <b>Crea CV</b>: il tuo curriculum in un formato chiaro e completo<br/>' +
      '• <b>Calcolatore CFU</b>: verifica i requisiti delle classi di concorso<br/><br/>' +
      'Il modo migliore per iniziare? Indica provincia e classi di concorso nel tuo Radar: da lì in poi cerchiamo noi per te, ogni giorno.<br/><br/>' +
      "Non ti mandiamo comunicazioni inutili: se ti scriviamo, apri il messaggio — significa che c'è qualcosa che fa per te.",
    telegram: (_o, genere) =>
      `${benvenuto(genere)} in ScuoleRadar! 🎉 Il tuo <b>mese di PRO in omaggio</b> è già attivo: Radar Scuole con notifiche illimitate, Modulistica, Crea CV e Calcolatore CFU, senza restrizioni.\nIndica provincia e classi di concorso: da lì cerchiamo noi le opportunità per te.`,
  },
  conferma_attivazione: {
    soggetto: '🎯 Scuole Radar: il tuo Radar è attivo e operativo!',
    // NB: il saluto "Caro/Cara {{nome}}" viene PREPOSTO dal corpo email
    // (riga `corpoEmail = saluto + testo.email`): qui NON va ripetuto un
    // secondo "Ciao/Caro", altrimenti si crea un saluto duplicato.
    email: () =>
      'Ti confermiamo che abbiamo attivato il tuo Radar con le impostazioni che hai scelto. Puoi cambiarle quando vuoi, andando sul tuo profilo su scuoleradar.it → <a href="' + RADAR_URL + '">Modifica il tuo Radar</a>.<br/><br/>' +
      'Ora controlleremo noi per te sui canali ufficiali, quando ci saranno delle opportunità interessanti per te.<br/>' +
      'Non inviamo spam, solo segnalazioni rilevanti, perciò, quando ricevi una nostra segnalazione, è importante aprirla ed eventualmente applicare al più presto.',
    telegram: () =>
      "🎯 Radar attivato con successo!\n\nOra puoi rilassarti: il tuo Radar è attivo e sta già lavorando per te.\n\nNon ti invieremo comunicazioni inutili e spam: quando arriva un messaggio qui su Telegram, aprilo subito — significa che c'è un'opportunità compatibile con il tuo profilo.",
  },
  free_forever_preavviso: {
    soggetto: 'Piano PRO Free Forever: il rinnovo gratuito è automatico',
    email: (o, genere) =>
      `${caro(genere)}, il tuo piano <b>PRO Free Forever</b> scade il <b>${o.scadenza ?? 'prossimo rinnovo annuale'}</b>.<br/><br/>Tranquillo: nessun pagamento e nessuna azione richiesta. Alla scadenza il rinnovo parte automaticamente a <b>0€</b>, per sempre.<br/>Non riceverai mai solleciti di pagamento né avvisi di mancato rinnovo.<br/><br/>Ti aspettiamo su <a href="${RADAR_URL}">il tuo Radar</a>.`,
    telegram: (o, genere) =>
      `${caro(genere)}, il tuo piano PRO Free Forever scade il ${o.scadenza ?? 'prossimo rinnovo annuale'}. 🎁 Rinnovo automatico a 0€, per sempre: nessun pagamento, nessuna azione.\nRadar: ${RADAR_URL}`,
  },
  free_forever_scadenza: {
    soggetto: 'Scadenza abbonamento Scuole Radar',
    // NB: il saluto "Caro/Cara {{nome}}" viene PREPOSTO dal corpo email della
    // pipeline: qui NON si ripete il saluto (evita duplicati).
    email: () =>
      `Il tuo abbonamento annuale a Scuole Radar sta per scadere.<br/><br/>Ma tu sei stato tra i primi a darci fiducia.<br/>Per questo, tu <b>non pagherai mai</b>.<br/>Il tuo abbonamento sarà rinnovato automaticamente e resterà <b>PRO per sempre</b>, gratis.<br/><br/>Speriamo che Scuole Radar stia contribuendo a cambiarti la vita in meglio.`,
    telegram: (o, genere) =>
      `${caro(genere)}, il tuo abbonamento annuale sta per scadere, ma tu non pagherai mai: verrà rinnovato automaticamente e resterai PRO per sempre, gratis! 🎁\nRadar: ${RADAR_URL}`,
  },
  beta_rinnovo_preavviso: {
    soggetto: 'Sei tra i primi a sostenerci: il tuo account PRO verrà rinnovato GRATIS A VITA 🎁',
    email: (o, genere) =>
      `${caro(genere)}, sei tra i primi a sostenerci, e per noi questo conta molto.<br/>Come ringraziamento, il tuo account <b>PRO</b> verrà rinnovato <b>GRATIS A VITA</b>.<br/><br/>Alla scadenza il rinnovo avverrà automaticamente: non dovrai fare nulla. Ti aspettiamo su <a href="${RADAR_URL}">il tuo Radar</a>.`,
    telegram: (o, genere) =>
      `${caro(genere)}, sei tra i primi a sostenerci: il tuo account PRO verrà rinnovato GRATIS A VITA. 🎁\nRadar: ${RADAR_URL}`,
  },
  beta_rinnovo_conferma: {
    soggetto: 'Congratulazioni, il tuo account PRO è stato rinnovato con successo! 🎉',
    email: (o, genere) =>
      `Congratulazioni! 🎉<br/>${caro(genere)}, il tuo account <b>PRO</b> è ${stato(genere)} rinnovato con successo: da oggi non ha più una data di scadenza — accesso <b>PRO a vita</b>, in omaggio.<br/><br/>Continua a usare ScuoleRadar su <a href="${RADAR_URL}">il tuo Radar</a>.`,
    telegram: (o, genere) =>
      `Congratulazioni! 🎉 ${caro(genere)}, il tuo account PRO è ${stato(genere)} rinnovato con successo: ora sei PRO per sempre, senza scadenza.\nRadar: ${RADAR_URL}`,
  },
};

// EMAIL 1 — BENVENUTO POST-REGISTRAZIONE (mese di PRO in omaggio): il trigger DB
// `trg_auth_users_step1_welcome` (migrazione 20260922130000) invia tipo 'step1'
// anche per Google One Tap → il copy di `conferma_base` viene consegnato su
// entrambi i tipi, senza duplicare i testi in due punti.
TESTI.step1 = { ...TESTI.conferma_base };

// Alias retro-compatibili → template centralizzati (EMAIL_TEMPLATES).
// Il cron DB `scadenza-avvisi-multistep` (public.invia_avvisi_scadenza_abbonamento)
// invia i tipi storici `scadenza_preavviso_*` / `scadenza_finale`, che non erano
// mappati su nessun template: la Edge rispondeva 400 e gli avvisi NON partivano.
// Qui vengono agganciati al FLUSSO 3 già esistente (email + Telegram).
const TIPO_ALIAS: Record<string, keyof typeof EMAIL_TEMPLATES> = {
  scadenza_preavviso_5d: 'email_3_1_scadenza_5',
  scadenza_preavviso_7d: 'email_3_1_scadenza_5',
  scadenza_preavviso_3d: 'email_3_2_scadenza_3',
  scadenza_preavviso_1d: 'email_3_3_scadenza_1',
  scadenza_finale: 'email_3_4_scadenza_0',
};

async function inviaTelegram(chatId: string, testo: string): Promise<string | null> {
  if (!TELEGRAM_TOKEN) return 'TELEGRAM_BOT_TOKEN non configurato';
  // GATE FEATURE FLAGS: in `test` solo account admin, in `off` nessun invio.
  const destinatario = recapitoAmmesso('telegram', chatId.trim());
  if (!destinatario) return 'gate dipartimenti: invio Telegram non consentito (modulo in test/off)';
  // Ogni messaggio Telegram parte dal BRAND COMPATTO (una riga) e chiude con la
  // CTA Notizie a due righe: struttura uniforme con lo scraper/notifier.
  const corpo = `${BRAND_TELEGRAM}\n\n${testo}\n\n${CTA_NOTIZIE_TESTO}`;
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: destinatario,
        text: corpo,
        parse_mode: 'HTML',
        // Niente riquadri di anteprima "giganti" che coprono l'avviso.
        link_preview_options: { is_disabled: true },
        disable_web_page_preview: true,
      }),
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
  // GATE FEATURE FLAGS: in `test` solo account admin, in `off` nessun invio.
  const destinatario = recapitoAmmesso('email', email.trim().toLowerCase());
  if (!destinatario) return 'gate dipartimenti: invio email non consentito (modulo in test/off)';
  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: RESEND_FROM, to: [destinatario], subject: soggetto, html }),
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

/** Codice meccanografico (es. ASTF01000X) e PEO ufficiale (convenzione MIM). */
const RE_CODICE_MECCANOGRAFICO = /\b([A-Z]{2}[A-Z]{2}\d{5}[A-Z0-9])\b/i;

/** Codice meccanografico valido (maiuscolo) da un testo, altrimenti `null`. */
function codiceDaTesto(testo?: string | null): string | null {
  const m = (testo ?? '').toUpperCase().match(RE_CODICE_MECCANOGRAFICO);
  return m ? m[1] : null;
}

/**
 * PEO ufficiale dal codice meccanografico — STESSA convenzione del modulo
 * `src/lib/emailScuola.ts`: codice@istruzione.it. Nessuna email inventata fuori
 * da questa regola; `null` quando il codice non è disponibile.
 */
function emailDaCodice(codice?: string | null): string | null {
  const c = (codice ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{2}[A-Z]{2}\d{5}[A-Z0-9]$/.test(c)) return null;
  return `${c.toLowerCase()}@istruzione.it`;
}

/**
 * Email/PEC di CANDIDATURA dell'avviso: dal payload se presente, altrimenti
 * ricercata in `interpelli` (per `hash_id` o `source_url`) e, come ultima ratio,
 * ricostruita dal codice meccanografico (convenzione MIM). Serve a garantire che
 * OGNI notifica di opportunità contenga il recapito della scuola — anche quando
 * l'unico link è una pagina di riepilogo/"Stampa" senza descrizione: un avviso
 * senza email è un servizio incompleto.
 */
async function caricaEmailAvviso(body: Record<string, unknown>): Promise<string> {
  const dalPayload = String(body.email ?? body.contactEmail ?? '').trim();
  if (dalPayload) return dalPayload;

  // Fallback IMMEDIATO sul payload: codice meccanografico dichiarato o ricavato
  // dal titolo → PEO ufficiale. Evita una query quando la scuola è già nota.
  const codicePayload =
    codiceDaTesto(String(body.schoolCode ?? body.school_code ?? '')) ??
    codiceDaTesto(String(body.title ?? body.titolo ?? ''));
  const daCodicePayload = emailDaCodice(codicePayload);
  if (daCodicePayload) return daCodicePayload;

  if (!SUPABASE_URL || !SERVICE_ROLE) return '';
  const hash = String(body.hash ?? body.hash_id ?? '').trim();
  const link = String(body.link ?? body.source_url ?? '').trim();
  const filtro = hash
    ? `hash_id=eq.${encodeURIComponent(hash)}`
    : link
      ? `source_url=eq.${encodeURIComponent(link)}`
      : '';
  if (!filtro) return '';
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/interpelli?${filtro}&select=contact_email,school_code,title&limit=1`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    if (!res.ok) return '';
    const rows = (await res.json()) as Array<{
      contact_email?: string | null;
      school_code?: string | null;
      title?: string | null;
    }>;
    const riga = rows?.[0] ?? null;
    const diretta = String(riga?.contact_email ?? '').trim();
    if (diretta) return diretta;
    // Riga (anche storica) senza email: PEO ufficiale dal codice meccanografico.
    return emailDaCodice(riga?.school_code ?? codiceDaTesto(riga?.title)) ?? '';
  } catch {
    return '';
  }
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
      if (!nome) nome = primoNome(profilo.nome);
    }
  }

  // ------------------------------------------------------------
  // AUTOMAZIONI EMAIL (pannello Admin → KV `public.app_settings`):
  //   chiave `email_automazione_<id>` → { abilitata, oggetto, intro, corpo }.
  //   · `abilitata: false` → invio SALTATO (nessuna email, nessun Telegram);
  //   · `oggetto` → sostituisce l'oggetto (mai per gli oggetti vincolati dalla
  //     checklist: «Nuove opportunità per te!»);
  //   · `intro`   → paragrafo introduttivo in testa al messaggio;
  //   · `corpo`   → sostituisce il corpo (solo automazioni con template).
  // Errori di lettura o KV non configurata → automazione ATTIVA: la KV non deve
  // mai fermare le comunicazioni di servizio.
  // ------------------------------------------------------------
  const varsAutomazione = {
    nome,
    giorni: body.giorni ? String(body.giorni) : '',
    scadenza: body.scadenza ? String(body.scadenza) : '',
  };
  const automazioneEdge: AutomazioneEdge | undefined = automazioneDaTipo(tipo);
  const statoAutomazione: StatoAutomazione | null = automazioneEdge
    ? ((await leggiStatiAutomazioni(SUPABASE_URL, SERVICE_ROLE)).get(automazioneEdge.id) ?? {
        abilitata: true,
      })
    : null;
  if (automazioneEdge && statoAutomazione && statoAutomazione.abilitata === false) {
    console.log(
      `[send-notification] ${tipo} saltato: automazione "${automazioneEdge.id}" disattivata dal pannello Admin.`,
    );
    return new Response(
      JSON.stringify({ ok: false, skipped: `automazione disattivata: ${automazioneEdge.id}`, tipo }),
      { status: 200, headers: CORS },
    );
  }
  /** Intro personalizzata (testo semplice) dai template del pannello. */
  const introAut = introTesto(statoAutomazione, varsAutomazione);

  // ------------------------------------------------------------
  // TEMPLATE CENTRALIZZATI (email lifecycle — file _shared/emailTemplates.ts):
  // FLUSSO 1 onboarding, FLUSSO 2 radar spento, FLUSSO 3 drip scadenza PRO.
  // Oggetto/corpo/CTA provengono da un unico file con interpolazione {{nome}}
  // e link canonici {{link_radar}} / {{link_checkout}} / {{link_purefocus}}.
  // Promemoria di rinnovo (trial/PRO, finestra 3–5 gg): {{giorni}} + {{scadenza}}.
  // ------------------------------------------------------------
  const chiaveTemplate = (TIPO_ALIAS[tipo] ?? tipo) as keyof typeof EMAIL_TEMPLATES;
  const scheda = EMAIL_TEMPLATES[chiaveTemplate]
    ? getEmailScheda(chiaveTemplate, {
        nome,
        giorni: body.giorni ? String(body.giorni) : '',
        scadenza: body.scadenza ? String(body.scadenza) : '',
      })
    : null;
  if (scheda) {
    // Personalizzazioni del pannello Admin (oggetto/intro/corpo) applicate QUI:
    // il template del codice resta la base, il pannello vince quando compilato.
    const schedaFinale = applicaOverrideScheda(scheda, statoAutomazione, varsAutomazione);
    // Email: intestazione brand COMPATTA (logo piccolo + nome) e CTA Notizie a
    // due righe, come in ogni altra email transazionale.
    const corpoHtml =
      BRAND_EMAIL +
      `<div style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">` +
      schedaFinale.html +
      CTA_NOTIZIE_HTML +
      RADAR_LINE_EMAIL +
      DISCLAIMER_EMAIL +
      `</div>`;
    const errEmail = email
      ? await inviaEmail(email, schedaFinale.soggetto, corpoHtml)
      : 'nessun indirizzo email';
    const errTelegram = chatId ? await inviaTelegram(chatId, schedaFinale.testo) : null;
    if (errEmail) console.error(`[send-notification] ${tipo} → email ${email}: ${errEmail}`);
    if (errTelegram) console.error(`[send-notification] ${tipo} → telegram ${chatId}: ${errTelegram}`);
    return new Response(
      JSON.stringify({ ok: !errEmail && !errTelegram, tipo, email: errEmail ?? 'ok', telegram: errTelegram ?? 'ok' }),
      { status: 200, headers: CORS },
    );
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
    email: (await caricaEmailAvviso(body)) || undefined,
    piano: body.piano ? String(body.piano) : undefined,
  };

  // GATE DI QUALITÀ STRICT: le comunicazioni di opportunità partono SOLO se
  // contengono un link DIRETTO all'avviso ufficiale e un recapito di
  // candidatura valido. Meglio saltare l'invio che spedire un alert incompleto.
  const motivoGate = TIPI_CON_OPPORTUNITA.has(tipo)
    ? motivoAvvisoNonInviabile(opp.link, opp.email)
    : null;
  if (motivoGate) {
    console.warn(`[send-notification] ${tipo} escluso (${motivoGate}).`);
    return new Response(
      JSON.stringify({ ok: false, skipped: motivoGate, tipo }),
      { status: 200, headers: CORS },
    );
  }

  const saluto = nome ? `${caro(genere)} ${escapeHtml(nome)},<br/>` : '';
  // STRUTTURA UNIFORME: brand compatto in testa, contenuto, firma, CTA Notizie a
  // due righe (identica a Telegram), disclaimer legale.
  const corpoEmail =
    BRAND_EMAIL +
    `<div style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">` +
    saluto +
    introParagrafoHtml(introAut) +
    testo.email(opp, genere) +
    '<br/><br/>' +
    FIRMA +
    CTA_NOTIZIE_HTML +
    RADAR_LINE_EMAIL +
    DISCLAIMER_EMAIL +
    `</div>`;
  // Il brand e la CTA Notizie vengono aggiunti centralmente da `inviaTelegram`.
  // L'intro del pannello precede il copy di ciclo di vita anche su Telegram.
  const corpoTelegram = (introAut ? introAut + '\n\n' : '') + testo.telegram(opp, genere) + '\n\n' + FIRMA;
  // Oggetto del pannello Admin solo se il tipo non ha un oggetto VINCOLATO
  // (le opportunità usano sempre «Nuove opportunità per te!»).
  const soggetto = oggettoFinale(
    typeof testo.soggetto === 'function' ? testo.soggetto(genere, opp) : testo.soggetto,
    statoAutomazione,
    automazioneEdge,
    varsAutomazione,
  );
  const errEmail = email ? await inviaEmail(email, soggetto, corpoEmail) : 'nessun indirizzo email';
  const errTelegram = chatId ? await inviaTelegram(chatId, corpoTelegram) : null;

  if (errEmail) console.error(`[send-notification] ${tipo} → email ${email}: ${errEmail}`);
  if (errTelegram) console.error(`[send-notification] ${tipo} → telegram ${chatId}: ${errTelegram}`);

  return new Response(
    JSON.stringify({ ok: !errEmail && !errTelegram, tipo, email: errEmail ?? 'ok', telegram: errTelegram ?? 'ok' }),
    { status: 200, headers: CORS },
  );
});