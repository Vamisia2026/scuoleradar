/**
 * TEST — OGGETTI EMAIL + DIGEST GIORNALIERO + PROMEMORIA 24h.
 * -----------------------------------------------------------------
 * 1) OGGETTI: niente più copy "da supermercato". Gli oggetti delle opportunità
 *    sono branded e DESCRITTIVI con il contesto del match:
 *    `Scuole Radar — Nuova opportunità per A-22 (Torino)`.
 * 2) DIGEST: una sola email al giorno per utente (guardia `chiaveDigestGiorno`).
 * 3) PROMEMORIA 24h: parte solo dopo 24h, solo per scadenze vicine, UNA email per
 *    utente e UN SOLO promemoria per interpello (guardia strict anti-duplicato).
 *
 * Tutto in DRY-RUN / con client STUB: nessuna rete, nessun invio reale.
 *
 * Esecuzione: npm run test:promemoria
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CANALE_PROMEMORIA,
  GIORNI_URGENZA_PROMEMORIA,
  ORE_PROMEMORIA,
  chiavePromemoria,
  ePromemoriaDovuto,
  eVoceUrgente,
  motivoPromemoria,
  oreTrascorse,
} from '../src/lib/promemoria.ts';
import { chiaveDigestGiorno, dataLocaleItalia } from '../src/lib/digest.ts';
import { chiaveLedger, ledgerLocaleRegistra, ledgerLocaleSalva } from '../src/lib/ledgerLocale.ts';
import {
  BRAND_OGGETTO,
  contestoOggetto,
  inviaPromemoriaEmail,
  renderPromemoriaEmailHtml,
  subjectDigest,
  subjectNotifica,
  subjectOpportunita,
  subjectPerNotifica,
  subjectPromemoria,
  type DettagliNotifica,
  type DestinatarioNotifica,
} from '../src/lib/resend.ts';
import { inviaDigestGiornaliero, inviaPromemoria24h } from '../src/lib/notifier.ts';

declare const process: { exitCode?: number; env: Record<string, string | undefined>; pid: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

// LEDGER ISOLATO: il test non tocca il ledger reale del workspace.
const percorsoLedger = join(tmpdir(), `scuoleradar-promemoria-test-${process.pid}.json`);
process.env.SCUOLERADAR_LEDGER_PATH = percorsoLedger;
writeFileSync(percorsoLedger, JSON.stringify({ aggiornato: new Date().toISOString(), chiavi: [] }), 'utf8');

// Istante di riferimento FISSO: la logica 24h è deterministica nei test.
const ADESSO = new Date('2026-09-17T15:00:00Z');
const oreFa = (ore: number): string => new Date(ADESSO.getTime() - ore * 3_600_000).toISOString();
const fraGiorni = (giorni: number): string =>
  new Date(ADESSO.getTime() + giorni * 86_400_000).toISOString().slice(0, 10);

/* ===================== 1) OGGETTI EMAIL (branded + contesto) ===================== */

console.log('— Oggetti email: branded, descrittivi, con classe e provincia —');
check('brand negli oggetti', BRAND_OGGETTO, 'Scuole Radar');
check('contesto classe + provincia', 'A-22 (Torino)', contestoOggetto({ classe: 'A-22', provincia: 'Torino' }));
check('contesto solo classe', 'A-22', contestoOggetto({ classe: 'A-22' }));
check('contesto assente', '', contestoOggetto({}));
check(
  'oggetto opportunità con contesto (testo UNICO standard)',
  'Nuove opportunità per te!',
  subjectOpportunita({ classe: 'A-22', provincia: 'Torino' }),
);
check(
  'notifica_pro (stessa formula)',
  'Nuove opportunità per te!',
  subjectPerNotifica('notifica_pro', { classe: 'A-22', provincia: 'Torino' }),
);
check(
  'prova1 (stessa formula)',
  'Nuove opportunità per te!',
  subjectPerNotifica('prova1', { classe: 'A-026', provincia: 'Asti' }),
);
check(
  'senza contesto → stesso oggetto standard',
  'Nuove opportunità per te!',
  subjectPerNotifica('notifica_pro', {}),
);
check(
  'i messaggi transazionali restano invariati',
  true,
  subjectPerNotifica('welcome', { classe: 'A-22', provincia: 'Torino' }).startsWith('Scuole Radar — Benvenuto'),
);
check(
  'vecchio oggetto generico rimosso',
  false,
  Object.values({ v: subjectNotifica('notifica_pro') }).some((s) => /trovata per te/i.test(s)),
);
check(
  'opportunità e digest: SEMPRE l’oggetto standard',
  true,
  (['prova1', 'prova2', 'prova3', 'notifica_pro', 'digest_giornaliero'] as const).every(
    (t) => subjectNotifica(t) === 'Nuove opportunità per te!',
  ),
);
check(
  'transazionali: oggetto branded invariato',
  true,
  (['welcome', 'extra', 'recap', 'welcome_pro', 'conferma_attivazione', 'free_forever_preavviso'] as const).every((t) =>
    subjectNotifica(t).startsWith('Scuole Radar — '),
  ),
);
check('oggetto digest standard', 'Nuove opportunità per te!', subjectDigest(2));
check(
  'oggetto promemoria (1 voce con contesto)',
  'Scuole Radar — Scadenza vicina: A-22 (Torino)',
  subjectPromemoria([{ classe: 'A-22', provincia: 'Torino' }]),
);
check(
  'oggetto promemoria (più voci)',
  'Scuole Radar — Scadenza vicina: 3 opportunità per il tuo profilo',
  subjectPromemoria([{ classe: 'A-22' }, { classe: 'A-26' }, { classe: 'A-47' }]),
);
check(
  'oggetto promemoria (nessuna voce)',
  'Scuole Radar — Promemoria: opportunità in scadenza',
  subjectPromemoria([]),
);

/* ======================= 2) LOGICA PROMEMORIA (pura) ======================= */

console.log('\n— Soglie del promemoria: 24h dalla consegna, alta priorità ≤ 3 gg —');
check('ore promemoria = 24', 24, ORE_PROMEMORIA);
check('giorni di urgenza = 3', 3, GIORNI_URGENZA_PROMEMORIA);
check('ore trascorse (25h)', 25, oreTrascorse(oreFa(25), ADESSO));
check('data non valida → null', null, oreTrascorse('non-una-data', ADESSO));
check('mai inviata → null', null, oreTrascorse(null, ADESSO));
check('voce urgente (domani)', true, eVoceUrgente({ scadenza: fraGiorni(1) }, { adesso: ADESSO }));
check('voce NON urgente (10 giorni)', false, eVoceUrgente({ scadenza: fraGiorni(10) }, { adesso: ADESSO }));
check('voce senza scadenza → non urgente', false, eVoceUrgente({ scadenza: null }, { adesso: ADESSO }));
check('voce scaduta → non urgente', false, eVoceUrgente({ scadenza: fraGiorni(-1) }, { adesso: ADESSO }));
check('soglia personalizzabile (7 gg)', true, eVoceUrgente({ scadenza: fraGiorni(6) }, { adesso: ADESSO, giorniUrgenza: 7 }));

console.log('\n— Motivo del promemoria (un solo esito per voce) —');
const voce = (id: string, giorni: number) => ({ id, scadenza: fraGiorni(giorni) });
check(
  'dovuto: 25h + scadenza vicina',
  'ok',
  motivoPromemoria(voce('h1', 1), oreFa(25), { adesso: ADESSO }),
);
check(
  'NON dovuto: consegnata da 2 ore',
  'inviata-da-meno-di-24h',
  motivoPromemoria(voce('h1', 1), oreFa(2), { adesso: ADESSO }),
);
check(
  'NON dovuto: già ricordata (anti-duplicato)',
  'gia-promemoria',
  motivoPromemoria(voce('h1', 1), oreFa(25), { adesso: ADESSO, giaPromemoria: true }),
);
check(
  'NON dovuto: scadenza lontana',
  'scadenza-non-urgente',
  motivoPromemoria(voce('h1', 12), oreFa(30), { adesso: ADESSO }),
);
check(
  'NON dovuto: opportunità scaduta',
  'scaduta',
  motivoPromemoria(voce('h1', -1), oreFa(30), { adesso: ADESSO }),
);
check('NON dovuto: mai consegnata', 'mai-inviata', motivoPromemoria(voce('h1', 1), null, { adesso: ADESSO }));
check('NON dovuto: senza hash', 'senza-id', motivoPromemoria({ id: '' }, oreFa(30), { adesso: ADESSO }));
check(
  'ePromemoriaDovuto = solo motivo ok',
  [true, false],
  [
    ePromemoriaDovuto(voce('h1', 2), oreFa(24), { adesso: ADESSO }),
    ePromemoriaDovuto(voce('h1', 2), oreFa(23.9), { adesso: ADESSO }),
  ],
);

console.log('\n— Chiave del ledger (canale dedicato `promemoria`) —');
check('canale dedicato', 'promemoria', CANALE_PROMEMORIA);
check(
  'chiave coerente con il ledger condiviso',
  chiavePromemoria('u-1', 'hash-1'),
  chiaveLedger('utente', 'u-1:hash-1', CANALE_PROMEMORIA),
);
check(
  'chiave del digest giornaliero',
  chiaveLedger('utente', 'u-1:digest', '2026-09-17'),
  chiaveDigestGiorno('u-1', '2026-09-17'),
);


/* ===================== 3) EMAIL DI PROMEMORIA (rendering) ===================== */

console.log('\n— Email di promemoria: brand, voci numerate, CTA Notizie —');
const destinatario: DestinatarioNotifica = {
  email: 'docente@example.it',
  nome: 'Mario',
  province: ['TO'],
  classi: ['A-22'],
};
const voceEmail: DettagliNotifica = {
  id: 'hash-to-urgent',
  title: 'Interpello supplenza A-022 — Liceo Monti',
  schoolName: 'Liceo Augusto Monti',
  province: 'TO',
  classi: ['A-022'],
  materia: 'Lingue straniere',
  scadenza: fraGiorni(1),
  link: 'https://www.usp-torino.gov.it/interpelli/avviso-a022',
  contactEmail: 'segreteria@liceomonti.edu.it',
};
const htmlPromemoria = renderPromemoriaEmailHtml([voceEmail], destinatario, 'https://www.scuoleradar.it/dashboard', {
  giorni: 3,
});
check('oggetto nel titolo HTML', true, htmlPromemoria.includes('Scuole Radar — Scadenza vicina: A-022 (Torino)'));
check('logo compatto (32 px)', true, htmlPromemoria.includes('width="32" height="32"'));
check('brand testuale', true, htmlPromemoria.includes('Scuole Radar.it'));
check('spiega la scadenza vicina', true, htmlPromemoria.includes('Scadenza vicina'));
check('promessa anti-spam dichiarata', true, htmlPromemoria.includes('Un solo promemoria per avviso'));
check('voce numerata', true, />1\.<\/span>\s*Interpello/.test(htmlPromemoria));
check('link ufficiale standard', true, /👉 Apri l(&#39;|')avviso ufficiale/.test(htmlPromemoria));
// CTA = link ufficiale della voce (in evidenza): nessun bottone gigante al Radar,
// le preferenze restano nel footer in piccolo.
check('nessun bottone verso il Radar', false, htmlPromemoria.includes('Apri il tuo Radar Scuole'));
check('nessun riquadro giallo di avviso', false, htmlPromemoria.includes('#fffbeb'));
check(
  'CTA Notizie a due righe (formato EMAIL esatto)',
  true,
  htmlPromemoria.includes('>scuoleradar.it/notizie</a>') &&
    htmlPromemoria.includes('Quando vuoi sapere cosa succede di importante nella scuola vieni qui!'),
);
check(
  'footer: link Radar visibile (in piccolo)',
  true,
  htmlPromemoria.includes('modifica il tuo radar su') && htmlPromemoria.includes('font-size:12.5px'),
);
check('avviso finale: non rispondere', true, htmlPromemoria.includes('Ti preghiamo di non rispondere'));
check('nessun blocco "P.S."', false, /\bP\.S\./.test(htmlPromemoria));
check('nessuna data di scadenza inventata', false, /Non indicata/.test(htmlPromemoria));

const esitoDry = await inviaPromemoriaEmail(null, [voceEmail], destinatario, { dryRun: true });
check('senza client Resend → nessun invio', false, esitoDry.inviata);
check('mai eccezioni (errore esplicito)', true, Boolean(esitoDry.error));

/* ============ 4) NOTIFIER: anti-duplicato e filtri del promemoria ============ */

const ID_PRO_TO = '11111111-1111-1111-1111-111111111111';

const PROFILI = [
  {
    id: ID_PRO_TO,
    email: 'docente-to@example.it',
    email_notifica: 'docente-to@example.it',
    nome: 'Docente Torino',
    province_interesse: ['TO'],
    province_attive: ['TO'],
    classi_concorso: ['A-22'],
    telegram_chat_id: null,
    piano: 'pro',
    radar_attivo: true,
    is_free_forever: false,
    notifiche_blocco_inviato: false,
    notifiche_recap_inviato: false,
    sostegno: false,
  },
];

function rigaInterpello(hashId: string, province: string, scadenza: string) {
  return {
    id: `row-${hashId}`,
    hash_id: hashId,
    // Il riferimento dell'avviso entra nel titolo: due righe diverse dello stub
    // NON devono collassare nella stessa identità di frequenza (in produzione
    // ogni avviso ha titolo e URL propri).
    title: `Interpello supplenza A-022 — ${province} (rif. ${hashId})`,
    province,
    class_codes: ['A-022'],
    school_name: 'Liceo Augusto Monti',
    school_code: 'ATTF01000X',
    source_url: `https://www.usp-torino.gov.it/interpelli/${hashId}`,
    expiration_date: scadenza,
    created_at: new Date().toISOString(),
    contact_email: 'atff01000x@istruzione.it',
    materia: null,
  };
}

/** Righe del ledger DB: canale `email` (consegna del digest) o `promemoria`. */
function rigaLog(hashId: string, canale: string, sentAt: string) {
  return { user_id: ID_PRO_TO, interpello_hash: hashId, canale, sent_at: sentAt };
}

const PROFILI_STUB = PROFILI;
let INTERPELLI_STUB: Array<Record<string, unknown>> = [];
let LOG_STUB: Array<Record<string, unknown>> = [];
let erroreLog: string | null = null;

/** Client Supabase STUB con filtri reali (eq/in) su liste in memoria. */
function clientStub(): unknown {
  const thenable = (tabella: string) => {
    const filtri: Array<(r: Record<string, unknown>) => boolean> = [];
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = (col: string, val: unknown) => {
      filtri.push((r) => String(r[col]) === String(val));
      return b;
    };
    b.in = (col: string, vals: unknown) => {
      const ammessi = (vals as unknown[]).map(String);
      filtri.push((r) => ammessi.includes(String(r[col])));
      return b;
    };
    b.order = () => b;
    b.or = () => b;
    b.limit = () => b;
    b.update = () => b;
    b.insert = () => b;
    b.upsert = async () => ({ error: null });
    const esito = (): { data: unknown[] | null; error: { message: string } | null } => {
      if (tabella === 'notifications_log' && erroreLog) return { data: null, error: { message: erroreLog } };
      const righe =
        tabella === 'profiles'
          ? PROFILI_STUB
          : tabella === 'interpelli'
            ? INTERPELLI_STUB
            : tabella === 'notifications_log'
              ? LOG_STUB
              : [];
      return { data: righe.filter((r) => filtri.every((f) => f(r))), error: null };
    };
    b.maybeSingle = async () => ({ data: esito().data?.[0] ?? null, error: null });
    b.then = (resolve: (v: unknown) => void) => resolve(esito());
    return b;
  };
  return {
    from: (tabella: string) => thenable(tabella),
    rpc: async () => ({ data: [{ consentito: true, notifiche_usate: 1 }], error: null }),
  };
}

// AMBIENTE DI PROVA: Resend "configurato" ma nessun invio reale (seam `inviaEmail`).
process.env.RESEND_API_KEY = 'test-key-not-real';
process.env.TELEGRAM_BOT_TOKEN = '';


/** Registra le email "inviate" dal seam (per verificare voci e anti-duplicato). */
let inviateSeam: Array<{ voci: DettagliNotifica[]; email: string }> = [];
const inviaSeam = async (voci: DettagliNotifica[], dest: DestinatarioNotifica) => {
  inviateSeam.push({ voci, email: dest.email });
  return { inviata: true };
};

async function scenariPromemoria(): Promise<void> {
  const client = clientStub() as never;

  console.log('\n— Promemoria: filtra 24h, urgenza, provincia e scaduti —');
  // h-urgent  → consegnata 25h fa, scadenza domani  → PROMEMORIA
  // h-far     → consegnata 25h fa, scadenza tra 12 gg → scartata (non urgente)
  // h-recent  → consegnata 2h fa, scadenza domani     → scartata (finestra 24h)
  // h-expired → consegnata 30h fa, scaduta ieri       → scartata (scaduta)
  // h-po      → consegnata 25h fa, scadenza domani, altra provincia → scartata
  // h-done    → consegnata 30h fa, scadenza domani, già ricordata   → scartata
  INTERPELLI_STUB = [
    rigaInterpello('h-urgent', 'TO', fraGiorni(1)),
    rigaInterpello('h-far', 'TO', fraGiorni(12)),
    rigaInterpello('h-recent', 'TO', fraGiorni(1)),
    rigaInterpello('h-expired', 'TO', fraGiorni(-1)),
    rigaInterpello('h-po', 'PO', fraGiorni(1)),
    rigaInterpello('h-done', 'TO', fraGiorni(1)),
  ];
  LOG_STUB = [
    rigaLog('h-urgent', 'email', oreFa(25)),
    rigaLog('h-far', 'email', oreFa(25)),
    rigaLog('h-recent', 'email', oreFa(2)),
    rigaLog('h-expired', 'email', oreFa(30)),
    rigaLog('h-po', 'email', oreFa(25)),
    rigaLog('h-done', 'email', oreFa(30)),
    rigaLog('h-done', CANALE_PROMEMORIA, oreFa(6)), // già ricordata (ledger DB)
  ];
  inviateSeam = [];
  const primo = await inviaPromemoria24h(client, {
    adesso: ADESSO,
    dryRun: false,
    inviaEmail: inviaSeam,
  });
  check('un solo promemoria (una email per utente)', 1, primo.inviate);
  check('una sola voce idonea', 1, primo.voci);
  check('email al profilo giusto', ['docente-to@example.it'], inviateSeam.map((i) => i.email));
  check('voce = solo l’avviso urgente di Torino', ['h-urgent'], inviateSeam[0]?.voci.map((v) => v.id));
  check('nessun avviso di altre province', false, inviateSeam[0]?.voci.some((v) => v.province === 'PO') ?? false);

  console.log('\n— ANTI-DUPLICATO: la seconda esecuzione non rimanda nulla —');
  inviateSeam = [];
  const secondo = await inviaPromemoria24h(client, { adesso: ADESSO, dryRun: false, inviaEmail: inviaSeam });
  check('nessun secondo invio per lo stesso interpello', 0, secondo.inviate);
  check('nessuna email inviata', 0, inviateSeam.length);
  check('profilo conteggiato come saltato', 1, secondo.saltati);

  console.log('\n— Ledger DB assente: nessun promemoria "a caso" —');
  erroreLog = 'relation "notifications_log" does not exist';
  inviateSeam = [];
  const senzaLedger = await inviaPromemoria24h(client, { adesso: ADESSO, dryRun: false, inviaEmail: inviaSeam });
  check('nessun invio senza timestamp affidabili', 0, senzaLedger.inviate);
  check('utente contato come "senza storico"', 1, senzaLedger.senzaStorico);
  erroreLog = null;

  console.log('\n— DIGEST: una sola email al giorno per utente —');
  INTERPELLI_STUB = [rigaInterpello('h-urgent', 'TO', fraGiorni(1)), rigaInterpello('h-nuovo', 'TO', fraGiorni(5))];
  LOG_STUB = [];
  // 1) DRY-RUN: passa e non registra nulla (nessun invio reale).
  const dry = await inviaDigestGiornaliero(client, { dryRun: true });
  check('dry-run: digest costruito', 1, dry.inviate);
  // 2) Guardia: con la chiave del giorno già registrata, il run NON invia.
  ledgerLocaleRegistra(chiaveDigestGiorno(ID_PRO_TO, dataLocaleItalia()));
  const bloccato = await inviaDigestGiornaliero(client, { dryRun: true });
  check('secondo run nello stesso giorno: nessun invio', 0, bloccato.inviate);
  check('profilo saltato (uno al giorno)', 1, bloccato.saltati);
  // 3) Lancio FORZATO (admin): la guardia viene ignorata.
  const forzato = await inviaDigestGiornaliero(client, { dryRun: true, forzato: true });
  check('lancio forzato: la guardia non blocca', 1, forzato.inviate);
}

await scenariPromemoria();
ledgerLocaleSalva();
if (existsSync(percorsoLedger)) rmSync(percorsoLedger, { force: true });

console.log(errori === 0 ? '\n✅ OGGETTI + DIGEST + PROMEMORIA: nessun problema' : `\n❌ OGGETTI + DIGEST + PROMEMORIA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

