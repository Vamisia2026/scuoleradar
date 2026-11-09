/**
 * GUARDIA — IL BANNER DELLA SCANSIONE (§26.146 · §26.149 · §26.150 · §26.151).
 * -----------------------------------------------------------------------------------
 * Il banner dice che cosa sta facendo il radar che l'utente sta guardando: quante bacheche
 * scolastiche ha controllato nelle 24 ore, quanto rumore ha scartato, quante posizioni ha in
 * archivio. Dal §26.151 non dice più «fonti elaborate» (un contatore di pipeline) e non
 * scambia un orario di lavoro per un guasto: il ciclo gira **lun–ven 08:00–17:00 (ora
 * italiana)** e fuori da lì il badge è `STANDBY`, con l'ora della ripresa.
 *
 * Il rischio di un contenuto così è tutto in una parola: INVENTARE. Un «0 avvisi scartati»
 * quando la Edge non ha risposto, un «adesso» quando la data manca, un «IN DIRETTA» su un
 * ciclo vecchio, un «1.200+» su un numero non letto, un «standby» sopra un radar che lavora
 * (cioè: costanti del banner diverse dal cron del worker).
 *
 * Le regole verificate qui sotto:
 *
 *   1. SILENZIO — telemetria assente = nessun banner;
 *   2. OROLOGHI — che ora è in Italia, senza chiedere il fuso al browser;
 *   3. RIPRESA — «domattina alle 08:00» ≠ «lunedì mattina»: il venerdì sera conta;
 *   4. STANDBY — finestra chiusa = orario, non guasto (badge, titolo, ripresa);
 *   5. IN DIRETTA — badge, posizioni, bacheche, scarti e cifre in evidenza;
 *   6. OPERATIVO — giro recente a finestra aperta, con le province coperte;
 *   7. SOGLIE — live < 1,5 h · attivo ≤ 24 h · in-ritardo oltre · guasta senza ciclo;
 *   8. MAI IN GIORNI — l'età resta in minuti o in ore, anche oltre le 48;
 *   9. NIENTE REFERTO — quarantena, errori per fonte e «fonti elaborate» fuori dal testo.
 *
 * Le altre quattro regole hanno ciascuna la sua guardia, per stare sotto il tetto di 300
 * righe per file: `test-telemetria-contenuto` (avvio, misure, frasi, moduli puri) e
 * `test-telemetria-cablaggio` (banner montato in bacheca, cron e gate del worker).
 *
 * Uso: npm run test:telemetria-scansione  (incluso in `npm test`)
 */
import {
  FUSO_ITALIA,
  GIORNI_APERTURA,
  ORA_APERTURA,
  ORA_CHIUSURA,
  TITOLO_STANDBY,
  finestraAperta,
  fraseRipresa,
  fraseStandby,
  giornoLocale,
  oraEsatta,
  oraItaliana,
  quandoEsatto,
} from '../src/lib/finestraScansione.ts';
import {
  ORE_CADENZA,
  ORE_LIVE,
  ORE_PRIMA_DEL_RITARDO,
  bannerScansione,
  durataLeggibile,
  durataTrascorsa,
  oreDa,
} from '../src/lib/telemetriaScansione.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
/** Il fatto, non il periodo: per i dettagli lunghi si verifica la sottostringa. */
const contiene = (nome: string, atteso: boolean, testo: string | undefined, ago: RegExp): void =>
  check(nome, atteso, ago.test(testo ?? ''));

/** Venerdì 6 novembre 2026, 13:00 a Roma: la finestra è APERTA (8 ≤ 13 < 17). */
const ADESSO = new Date('2026-11-06T12:00:00.000Z');
/** Lo stesso venerdì alle 17:30 italiane: il radar ha chiuso, e riapre lunedì. */
const CHIUSO = new Date('2026-11-06T16:30:00.000Z');
/** `ore` prima di `adesso`, in ISO. */
const fa = (ore: number, adesso: Date = ADESSO): string =>
  new Date(adesso.getTime() - ore * 3_600_000).toISOString();

console.log('— 1. Silenzio: senza telemetria non si dice niente —');
check('assente → nessun banner', null, bannerScansione(null, ADESSO));
check('undefined → nessun banner', null, bannerScansione(undefined, ADESSO));

console.log('\n— 2. L’orologio del Radar: che ora è in Italia —');
const venerdi = oraItaliana(ADESSO);
check('venerdì 6 novembre 2026', [5, 2026, 11, 6], [venerdi.giorno, venerdi.anno, venerdi.mese, venerdi.data]);
check('13:00 a Roma (il browser può stare altrove)', '13:00', venerdi.testo);
check('il fuso è dichiarato, non dedotto', 'Europe/Rome', FUSO_ITALIA);
check('la finestra è lun–ven 08:00–17:00', '1-5 · 8-17', `${GIORNI_APERTURA[0]}-${GIORNI_APERTURA[4]} · ${ORA_APERTURA}-${ORA_CHIUSURA}`);
check('venerdì alle 13: la finestra è aperta', true, finestraAperta(ADESSO));
check('le 08:00 sono già aperte', true, finestraAperta(new Date('2026-11-09T07:00:00.000Z')));
check('le 07:59 sono ancora chiuse', false, finestraAperta(new Date('2026-11-09T06:59:00.000Z')));
check('le 17:00 sono già chiuse', false, finestraAperta(new Date('2026-11-06T16:00:00.000Z')));
check('sabato è chiuso', false, finestraAperta(new Date('2026-11-07T10:00:00.000Z')));
check('domenica è chiusa', false, finestraAperta(new Date('2026-11-08T10:00:00.000Z')));

console.log('\n— 3. Quando riparte: il venerdì sera non è «domattina» —');
check('finestra aperta: niente da annunciare', null, fraseStandby(ADESSO));
check('venerdì sera → lunedì mattina', 'lunedì mattina alle 08:00', fraseRipresa(new Date('2026-11-06T19:00:00.000Z')));
check('sabato → lunedì mattina', 'lunedì mattina alle 08:00', fraseRipresa(new Date('2026-11-07T10:00:00.000Z')));
check('domenica → lunedì mattina', 'lunedì mattina alle 08:00', fraseRipresa(new Date('2026-11-08T10:00:00.000Z')));
check('giovedì notte → domattina', 'domattina alle 08:00', fraseRipresa(new Date('2026-11-05T22:00:00.000Z')));
check('lunedì prima delle 8 → stamattina', 'stamattina alle 08:00', fraseRipresa(new Date('2026-11-09T06:30:00.000Z')));

console.log('\n— 4. Standby: la finestra chiusa è un orario, non un guasto —');
const notturno = bannerScansione({ ultimo_ciclo: fa(5.5, CHIUSO), scansionate_24h: 412, scarti: 478 }, CHIUSO);
check('tono', 'standby', notturno?.tono);
check('badge', 'STANDBY', notturno?.badge);
check('titolo: il radar riposa', TITOLO_STANDBY, notturno?.titolo);
check(
  'dettaglio: quando riparte, che ora era, quanto si è letto',
  'Prossima scansione automatica lunedì mattina alle 08:00. Ultimo controllo: oggi alle 12:00. 412 bacheche scolastiche controllate nelle ultime 24 ore.',
  notturno?.dettaglio,
);
check(
  'senza telemetria lo standby non inventa un controllo',
  'Prossima scansione automatica lunedì mattina alle 08:00. Nessun controllo registrato finora.',
  bannerScansione({}, CHIUSO)?.dettaglio,
);
check(
  'di notte un ciclo vecchissimo non è un guasto',
  'standby',
  bannerScansione({ ultimo_ciclo: fa(70, CHIUSO) }, CHIUSO)?.tono,
);
check('lo standby senza numeri non mostra misure', 0, bannerScansione({}, CHIUSO)?.misure.length);


console.log('\n— 5. Un ciclo in diretta: badge, prova di lavoro e cifre in evidenza —');
const live = bannerScansione(
  {
    ultimo_ciclo: fa(0.25),
    province_coperte: 87,
    interpelli_attivi: 1284,
    scansionate_24h: 412,
    scarti: 478,
    pagine_in_coda: 0,
    in_errore: 0,
    fonti_isolate: [],
    fonti_in_guasto: 0,
  },
  ADESSO,
);
check('tono', 'live', live?.tono);
check('badge', 'IN DIRETTA', live?.badge);
check(
  'titolo: la cifra «prova di lavoro» arrotondata PER DIFETTO',
  'Il radar ha appena finito un giro · 1.200+ posizioni attive',
  live?.titolo,
);
check(
  'dettaglio: orologio, bacheche, scarti — nient’altro',
  'Ultimo controllo: 15 minuti fa. 412 bacheche scolastiche controllate nelle ultime 24 ore · 478 avvisi scartati perché fuori tema.',
  live?.dettaglio,
);
check(
  'misure in evidenza, nell’ordine in cui si leggono',
  [
    { etichetta: 'Bacheche controllate', valore: '412' },
    { etichetta: 'Avvisi scartati', valore: '478' },
    { etichetta: 'Posizioni selezionate', valore: '1.200+' },
  ],
  live?.misure,
);
check(
  'senza posizioni misurate il titolo non inventa una cifra',
  'Il radar ha appena finito un giro',
  bannerScansione({ ultimo_ciclo: fa(0.5) }, ADESSO)?.titolo,
);

console.log('\n— 6. Giro recente a finestra aperta: il radar è operativo —');
const attivo = bannerScansione({ ultimo_ciclo: fa(2), province_coperte: 87 }, ADESSO);
check('2 ore → attivo', 'attivo', attivo?.tono);
check('badge', 'OPERATIVO', attivo?.badge);
check('titolo con le province', 'Il radar sta controllando le bacheche di 87 province', attivo?.titolo);
check(
  'copertura non letta: nessun numero inventato',
  'Il radar sta controllando le bacheche',
  bannerScansione({ ultimo_ciclo: fa(2) }, ADESSO)?.titolo,
);

console.log('\n— 7. Le soglie e il segnale di vita —');
check('cadenza dichiarata (ore)', 1, ORE_CADENZA);
check('soglia della diretta', 1.5, ORE_LIVE);
check('soglia del fermo (a finestra aperta)', 24, ORE_PRIMA_DEL_RITARDO);
check('ultimo_ciclo vince su ultima_scansione', 'live', bannerScansione({ ultimo_ciclo: fa(0.2), ultima_scansione: fa(50) }, ADESSO)?.tono);
check('senza ultimo_ciclo si ripiega su ultima_scansione', 'in-ritardo', bannerScansione({ ultima_scansione: fa(50) }, ADESSO)?.tono);
check('1 ora → live', 'live', bannerScansione({ ultimo_ciclo: fa(1) }, ADESSO)?.tono);
check('23 ore → ancora attivo', 'attivo', bannerScansione({ ultimo_ciclo: fa(23) }, ADESSO)?.tono);
check('25 ore → in ritardo', 'in-ritardo', bannerScansione({ ultimo_ciclo: fa(25) }, ADESSO)?.tono);
const fermo = bannerScansione({ ultimo_ciclo: fa(50) }, ADESSO);
check('badge dell’attesa', 'IN ATTESA', fermo?.badge);
check('50 ore → titolo in ORE, non in giorni', 'Nessun controllo da 50 ore', fermo?.titolo);
contiene('l’attesa dichiara l’orario di lavoro', true, fermo?.dettaglio, /dal lunedì al venerdì, dalle 08:00 alle 17:00/);

console.log('\n— 8. La freschezza si dice in minuti o in ore, MAI in giorni —');
const eta = [0.5, 3, 23, 25, 30, 50, 72, 240].map((ore) => durataLeggibile(ore));
check('nessuna durata nomina giorni o «ieri»', [], eta.filter((t) => /giorn|ieri/.test(t)));
check('30 ore restano 30 ore', '30 ore fa', durataLeggibile(30));
check('52 ore restano 52 ore', '52 ore fa', durataLeggibile(52));
check('dieci giorni restano ore', '240 ore fa', durataLeggibile(240));
contiene('anche un fermo lunghissimo non dice «giorni»', false, bannerScansione({ ultimo_ciclo: fa(240) }, ADESSO)?.titolo, /giorn|ieri/);
check('durata senza «fa» (per il titolo)', '2 ore', durataTrascorsa(2));
check('pochi secondi', 'adesso', durataLeggibile(0.001));
check('un minuto (singolare)', 'un minuto fa', durataLeggibile(1 / 60));
check('mezz’ora', '30 minuti fa', durataLeggibile(0.5));
check("un'ora (singolare)", "un'ora fa", durataLeggibile(1));
check('assente', 'non registrata', durataLeggibile(null));
check('istante nel futuro → 0 ore', 0, oreDa('2027-01-01T00:00:00.000Z', ADESSO));
check('data assente → null', null, oreDa(null, ADESSO));
check('data illeggibile → null', null, oreDa('non-una-data', ADESSO));

console.log('\n— 9. L’orologio in parole: «oggi alle 11:00», «ieri alle 15:00», poi le ore —');
check('oggi alle 11:00', 'oggi alle 11:00', quandoEsatto(fa(2), ADESSO));
check('ieri alle 15:00', 'ieri alle 15:00', quandoEsatto(fa(22), ADESSO));
check('oltre ieri si torna alle ore', null, quandoEsatto(fa(45), ADESSO));
check('data illeggibile → null', null, quandoEsatto('ieri', ADESSO));
check('ora esatta italiana', '11:00', oraEsatta(fa(2)));
check('giorno italiano in forma confrontabile', '2026-11-06', giornoLocale(ADESSO));


console.log('\n— 10. Niente referto tecnico: le fonti sorde restano fuori dal banner —');
const sorde = bannerScansione(
  {
    ultimo_ciclo: fa(0.5),
    fonti_isolate: Array.from({ length: 205 }, () => ({ url: 'a' })),
    fonti_whitelist: 512,
    in_errore: 7,
  },
  ADESSO,
);
contiene('nessuna quarantena nel dettaglio', false, sorde?.dettaglio, /quarantena|isolat/i);
contiene('nessun errore per fonte nel dettaglio', false, sorde?.dettaglio, /error|risposto male/i);
check('nessuna misura «fonti»', undefined, sorde?.misure.find((m) => /fonti/i.test(m.etichetta)));
check('nessun contatore inventato dai campi tecnici', [], sorde?.misure);

console.log(`\n${errori === 0 ? '✓ guardia verde' : `✗ ${errori} verifiche fallite`}`);
if (errori > 0) process.exitCode = 1;

