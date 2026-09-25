/**
 * Test — FEATURE FLAGS dei dipartimenti (stati OFF | TEST | ON).
 *
 * Verifica:
 *  1. anagrafica e default dei 6 dipartimenti (incluso `cv_builder` = off) e la
 *     SUPERFICIE PUBBLICA di produzione: accesi solo radar + purefocus, tutti i
 *     dipartimenti chiusi invisibili a un utente non admin (nessuna tab/link morta);
 *  2. store condiviso: override locale, persistenza, reset, notifica agli ascoltatori;
 *  3. matrice di VISIBILITÀ (off/test/on × guest/admin/DEV forzato);
 *  4. override da variabile d'ambiente (`FEATURE_RADAR=…`) e sua priorità;
 *  5. GATE notifiche: on (invariato) · test (solo admin / dirottamento) · off (bloccato);
 *  6. cablaggio reale dei CHOKE POINT di invio (resend/telegram/Edge) e della UI:
 *     le superfici di navigazione e i pannelli Admin/DEV sono verificati da
 *     `scripts/test-flags-cablaggio.ts` (stessa catena `npm run test:flags`).
 *
 * Uso: npm run test:flags
 */
import {
  DIPARTIMENTI,
  STATI_DIPARTIMENTO,
  azzeraStatiDipartimento,
  eStatoDipartimento,
  impostaStatoDipartimento,
  overrideDipartimenti,
  sottoscriviDipartimenti,
  type StatoDipartimento,
} from '../src/config/features.ts';
import {
  dipartimentoVisibile,
  origineStatoDipartimento,
  statoDaAmbiente,
  statoDipartimento,
} from '../src/config/statoDipartimenti.ts';
import { gateEmail, gateTelegram, valutaInvioNotifica } from '../src/config/gateNotifiche.ts';
import { ADMIN_EMAILS, EMAIL_ADMIN_TEST, eEmailAdmin } from '../src/lib/utentiAdmin.ts';
import { inviaNotificaEmail } from '../src/lib/resend.ts';
import { inviaMessaggioTelegram } from '../src/lib/telegram.ts';

/**
 * Stub di `localStorage`: il test gira in Node (nessun browser) e serve a verificare
 * che il cambio di stato (click sui toggle di DEV Toolbar / Admin) scriva DAVVERO
 * nella chiave `sr_flag_dipartimenti`. Va installato PRIMA della prima lettura dello
 * store, che poi tiene il valore in cache.
 */
const CHIAVE_FLAG = 'sr_flag_dipartimenti';
const fintoStorage = {
  dati: new Map<string, string>(),
  getItem(chiave: string): string | null {
    return this.dati.get(chiave) ?? null;
  },
  setItem(chiave: string, valore: string): void {
    this.dati.set(chiave, valore);
  },
  removeItem(chiave: string): void {
    this.dati.delete(chiave);
  },
};
(globalThis as unknown as { localStorage: typeof fintoStorage }).localStorage = fintoStorage;

/** Interfaccia minima per l'ambiente (come gli altri script di test). */
declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
};

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. Anagrafica e default —');
// Default del codice = superficie PUBBLICA di produzione: si parte sempre da qui.
azzeraStatiDipartimento();
check('6 dipartimenti', 6, DIPARTIMENTI.length);
check('id univoci', DIPARTIMENTI.length, new Set(DIPARTIMENTI.map((d) => d.id)).size);
check('default Radar Scuole = on', 'on', DIPARTIMENTI.find((d) => d.id === 'radar')?.statoBase);
check('default Pure Focus = on', 'on', DIPARTIMENTI.find((d) => d.id === 'purefocus')?.statoBase);
check('default Calcolatore CFU = off', 'off', DIPARTIMENTI.find((d) => d.id === 'cfu')?.statoBase);
check('default Modulistica = off', 'off', DIPARTIMENTI.find((d) => d.id === 'modulistica')?.statoBase);
check(
  'default Invita un Collega = off',
  'off',
  DIPARTIMENTI.find((d) => d.id === 'referral')?.statoBase,
);
check('default Crea CV = off', 'off', DIPARTIMENTI.find((d) => d.id === 'cv_builder')?.statoBase);
// CHIUSURA IN PRODUZIONE: senza override (build di produzione, utente non admin)
// la navbar/tab pubblica può mostrare SOLO i dipartimenti maturi. Qualunque
// dipartimento chiuso che ricomparisse qui sarebbe una tab/link «morta».
check(
  'superficie pubblica = solo radar + purefocus',
  ['radar', 'purefocus'],
  DIPARTIMENTI.filter((d) => dipartimentoVisibile(d.id)).map((d) => d.id),
);
check(
  'nessun dipartimento chiuso visibile senza admin/DEV',
  ['radar', 'purefocus'],
  DIPARTIMENTI.filter((d) => dipartimentoVisibile(d.id, { eAdmin: false, forzaDev: false })).map((d) => d.id),
);
check('3 stati ammessi', ['off', 'test', 'on'], STATI_DIPARTIMENTO);
check('stato valido riconosciuto', true, eStatoDipartimento('test'));
check('stato non valido scartato', false, eStatoDipartimento('beta'));
check('notifiche automatiche solo su radar', ['radar'], DIPARTIMENTI.filter((d) => d.notificheAutomatiche).map((d) => d.id));

console.log('\n— 2. Store condiviso (override locale) —');
let notifiche = 0;
const rimuoviAscoltatore = sottoscriviDipartimenti(() => {
  notifiche += 1;
});
impostaStatoDipartimento('radar', 'test');
check('override applicato', 'test', statoDipartimento('radar'));
check('origine = locale', 'locale', origineStatoDipartimento('radar'));
check('ascoltatore avvisato', true, notifiche > 0);
check('override leggibile dallo snapshot', 'test', overrideDipartimenti().radar);
// Il click sui toggle (DEV Toolbar / Admin) passa da qui: la chiave DEVE cambiare.
check('click → chiave scritta in localStorage', '{"radar":"test"}', fintoStorage.dati.get(CHIAVE_FLAG) ?? null);
azzeraStatiDipartimento();
check('reset → default', 'on', statoDipartimento('radar'));
check('reset → chiave rimossa', null, fintoStorage.dati.get(CHIAVE_FLAG) ?? null);
check('origine torna default', 'default', origineStatoDipartimento('radar'));
rimuoviAscoltatore();
const notifichePrima = notifiche;
impostaStatoDipartimento('purefocus', 'off');
check('nessuna notifica dopo unsubscribe', notifichePrima, notifiche);
azzeraStatiDipartimento();


console.log('\n— 3. Matrice di visibilità —');
for (const stato of ['on', 'test', 'off'] as StatoDipartimento[]) {
  impostaStatoDipartimento('modulistica', stato);
  const guest = dipartimentoVisibile('modulistica');
  const admin = dipartimentoVisibile('modulistica', { eAdmin: true });
  const dev = dipartimentoVisibile('modulistica', { forzaDev: true });
  const attesi: Record<StatoDipartimento, [boolean, boolean, boolean]> = {
    on: [true, true, true],
    test: [false, true, true],
    off: [false, false, false],
  };
  check(`visibilità ${stato} (guest/admin/dev)`, attesi[stato], [guest, admin, dev]);
}
azzeraStatiDipartimento();
// SNAPSHOT degli override passato esplicitamente (useFeatureFlags): è il percorso
// che rende lo «sblocco» immediato — navbar, tab e `primaRottaVisibile` devono
// ricalcolarsi nello stesso render in cui cambia lo stato.
check('override esplicito: modulo chiuso → visibile', true, dipartimentoVisibile('modulistica', { override: { modulistica: 'on' } }));
check('override esplicito: modulo acceso → chiuso', false, dipartimentoVisibile('radar', { override: { radar: 'off' } }));
check('override esplicito: stato effettivo coerente', 'off', statoDipartimento('radar', { radar: 'off' }));
check('override esplicito: guest vede modulo in TEST? no', false, dipartimentoVisibile('cfu', { override: { cfu: 'test' } }));

console.log('\n— 4. Override da variabile d’ambiente —');
impostaStatoDipartimento('radar', 'test');
process.env.FEATURE_RADAR = 'off';
check('env vince sull’override locale', 'off', statoDipartimento('radar'));
check('env riconosciuto', 'off', statoDaAmbiente('radar'));
check('origine = ambiente', 'ambiente', origineStatoDipartimento('radar'));
check('non visibile nemmeno all’admin', false, dipartimentoVisibile('radar', { eAdmin: true }));
process.env.FEATURE_RADAR = 'non-valido';
check('env non valido ignorato', 'test', statoDipartimento('radar'));
delete process.env.FEATURE_RADAR;
azzeraStatiDipartimento();

console.log('\n— 5. Gate notifiche —');
const emailUtente = 'beta.tester@example.com';
const chatUtente = '111222333';
const chatAdmin = '999888777';

check('account admin riconosciuto', true, eEmailAdmin(EMAIL_ADMIN_TEST.toUpperCase()));
check('account non admin scartato', false, eEmailAdmin(emailUtente));
check('whitelist non vuota', true, ADMIN_EMAILS.length > 0);

// ON → invio invariato su entrambi i canali.
const on = valutaInvioNotifica('radar', { email: emailUtente, chatId: chatUtente }, { stato: 'on' });
check('ON: consentito', true, on.consentito);
check('ON: email invariata', emailUtente, on.email);
check('ON: chat invariata', chatUtente, on.chatId);
check('ON: nessun dirottamento', false, on.dirottato);

// OFF → tutto bloccato (anche per l'admin).
const off = valutaInvioNotifica('radar', { email: emailUtente, chatId: chatUtente }, { stato: 'off' });
check('OFF: bloccato', false, off.consentito);
check('OFF: nessun recapito', [null, null], [off.email, off.chatId]);

// TEST → destinatario admin ammesso.
const testAdmin = valutaInvioNotifica(
  'radar',
  { email: EMAIL_ADMIN_TEST, chatId: chatAdmin },
  { stato: 'test', chatIdAdmin: chatAdmin },
);
check('TEST: admin ammesso', true, testAdmin.consentito);
check('TEST: admin non dirottato', false, testAdmin.dirottato);

// TEST → destinatario non admin: dirottato sull'account di test.
const testDiretto = valutaInvioNotifica(
  'radar',
  { email: emailUtente, chatId: chatUtente },
  { stato: 'test', chatIdAdmin: chatAdmin, emailAdmin: EMAIL_ADMIN_TEST },
);
check('TEST: dirottato', true, testDiretto.dirottato);
check('TEST: email → admin', EMAIL_ADMIN_TEST, testDiretto.email);
check('TEST: telegram → admin', chatAdmin, testDiretto.chatId);

// TEST senza dirottamento → bloccato per i non admin.
const testBloccato = gateEmail('radar', emailUtente, { stato: 'test', dirottamento: false });
check('TEST senza dirottamento: bloccato', false, testBloccato.consentito);

// TEST senza recapito Telegram admin → canale Telegram bloccato.
const testSenzaAdmin = gateTelegram('radar', chatUtente, { stato: 'test', chatIdAdmin: null });
check('TEST senza chat admin: Telegram bloccato', false, testSenzaAdmin.consentito);

// Canali pubblici (chat negative) mai ammessi in test.
const canale = gateTelegram('radar', '-1001234567890', { stato: 'test', chatIdAdmin: chatAdmin });
check('TEST: canale pubblico dirottato su admin', chatAdmin, canale.recapito);

console.log('\n— 6. Integrazione nei punti di invio —');
process.env.FEATURE_RADAR = 'off';
const fintoClient = { emails: { send: async () => ({ data: null, error: null }) } };
const esitoEmail = await inviaNotificaEmail(
  fintoClient as unknown as Parameters<typeof inviaNotificaEmail>[0],
  null,
  { email: emailUtente, province: [], classi: [] },
  { tipo: 'recap' },
);
check('resend.ts: invio bloccato dal gate (OFF)', false, esitoEmail.inviata);
check('resend.ts: errore dal gate', true, String(esitoEmail.error ?? '').includes('gate'));

const esitoTelegram = await inviaMessaggioTelegram(chatUtente, 'prova gate');
check('telegram.ts: invio bloccato dal gate (OFF)', false, esitoTelegram.ok);
check('telegram.ts: errore dal gate', true, String(esitoTelegram.error ?? '').includes('gate'));
delete process.env.FEATURE_RADAR;

// Il CABLAGGIO di UI, rotte e pannelli (navbar desktop/mobile, tab della
// dashboard, menu utente, superfici pubbliche, pannelli Admin/DEV) è verificato
// da `scripts/test-flags-cablaggio.ts`: estratto qui per restare sotto il limite
// di 250 righe per file del gate strutturale. Stessa catena `npm run test:flags`.

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ Feature flags dipartimenti: tutti i controlli superati.'
    : `\n❌ ${errori} controllo/i fallito/i.`,
);

