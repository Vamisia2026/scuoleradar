/**
 * TEST — COMPATIBILITÀ GRADUATA: invarianti e cablaggio dei DUE LIVELLI di punteggio.
 * -----------------------------------------------------------------------------------
 *   1. INVARIANTI — sostegno extra 60 (anche con una competenza trovata), esclusione
 *      oltre il raggio (0, salvo whitelist o match PIENO al 60, §26.64), CONSEGNA STRICT
 *      (notifier/digest non passano `provinceLimitrofe`, opzione della sola bacheca);
 *   2. LIVELLO SECONDARIO (§26.63 + JOLLY §26.64) — una competenza trovata NON assegna il
 *      voto: SFUMA di max 25 punti un avviso già agganciato; col match PIENO il jolly
 *      pavimenta a 90 ed entra d’ufficio oltre il raggio (60), il PARZIALE sfuma di 15;
 *   3. GRADUAZIONE — punteggio = MEDIA PONDERATA delle modali primarie applicabili
 *      (pesi: classe 2, resto 1 — `mediaModali.ts`) + sfumatura, con penalità dichiarata
 *      rispetto al motore;
 *   4. CABLAGGIO — feed → bacheca pura → card/modale; la guardia è nella catena.
 *
 * I punteggi delle singole modali vivono in `npm run test:modali`; la geografia in
 * `npm run test:prossimita`; whitelist/blacklist in `npm run test:filtri-scuole`;
 * il jolly semantico, nel dettaglio, in `npm run test:jolly`.
 * Esecuzione: npm run test:compatibilita:graduata (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { valutaCompatibilita } from '../src/lib/compatibilitaGraduata.ts';
import { PUNTEGGIO_EXTRA_SOSTEGNO, punteggioCompatibilita } from '../src/lib/matchingEngine.ts';
import { BONUS_JOLLY_PARZIALE, PUNTEGGIO_JOLLY_OLTRE_RAGGIO } from '../src/lib/jollySemantico.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Profilo di riferimento della guardia: preferenze PRIMARIE configurate (ordine, classe, provincia), nessuna competenza/parola chiave secondaria (§26.63). */
const profilo = { ordini: ['secondaria2'], classi: ['A-22'], province: ['AT'], materieCustom: [] } as const;

/* --------------------------- 1) INVARIANTI -------------------------------- */

console.log('— Invarianti: sostegno a 60, esclusione geografica, consegna strict —');
const sostegno = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'] },
  { province: 'AL', classi: ['ADEE'], ordine: 'primaria', titolo: 'Interpello sostegno scuola primaria' },
  { provinceLimitrofe: true },
);
check('SUGGERIMENTO EXTRA (sostegno) resta a 60: il pavimento non si sconta', PUNTEGGIO_EXTRA_SOSTEGNO, sostegno.punteggio);
check('e non porta penalità inventate', 0, sostegno.penalita);

const fuori = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'] },
  { province: 'MN', classi: ['A-022'], ordine: 'secondaria2', materia: 'Inglese' },
  { provinceLimitrofe: true },
);
check('oltre il raggio → escluso dalla bacheca', true, fuori.escluso);
check('e il punteggio è 0', 0, fuori.punteggio);
check('il motivo dichiara il raggio', true, /oltre il raggio di 60 km/.test(fuori.motivi.join(' ')));

const forzata = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'] },
  { province: 'MN', classi: ['A-022'], ordine: 'secondaria2', materia: 'Inglese' },
  { provinceLimitrofe: true, forzata: true },
);
check('whitelist: la scuola preferita non è esclusa', false, forzata.escluso);
check('ed è marcata come inclusione d’ufficio', true, forzata.forzata);

/** Motore STRICT su una provincia vicina: la bacheca passa l'opzione, la consegna no. */
const motoreStrict = (provinceLimitrofe?: boolean) =>
  punteggioCompatibilita(
    { province: ['AT'], classi: ['A-22'] },
    { province: 'AL', classi: ['A-022'] },
    { provinceLimitrofe },
  );
check('CONSEGNA strict: provincia vicina senza opzione → 0 (nessuna regressione)', 0, motoreStrict());
check('con l’opzione della bacheca la stessa opportunità è compatibile', 100, motoreStrict(true));

console.log('\n— Graduazione: media PONDERATA delle modali, penalità dichiarata —');
const vicina = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'] },
  { province: 'AL', classi: ['A-022'], ordine: 'secondaria2', materia: 'Inglese' },
  { provinceLimitrofe: true },
);
// (100 × 1) ordine + (100 × 2) classe + (60 × 1) provincia = 360 : pesi 4 → 90.
check('ordine 100 · classe 100 (peso 2) · provincia vicina 60 → media ponderata 90', 90, vicina.punteggio);
check('la modale geografica è dichiarata nel dettaglio', 60, vicina.modali.provincia);
check('il denominatore è la somma dei pesi applicabili', 4, vicina.modali.pesoTotale);
check('la penalità rispetto al motore è misurata', 10, vicina.penalita);
check('il motivo racconta la provincia vicina', true, /provincia vicina/.test(vicina.motivi.join(' ')));
check('il tooltip dichiara la media ponderata', true, /media ponderata di 3 modali/.test(vicina.motivi.join(' ')));

// La CLASSE pesa il doppio (requisito abilitante): una classe estranea (55) trascina il
// voto più di una provincia solo vicina (60), a parità di ordine.
const classeEstranea = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'] },
  { province: 'AT', classi: ['A-01'], ordine: 'secondaria2', materia: 'Arte e immagine' },
  { provinceLimitrofe: true },
);
check('classe estranea: ordine 100 · classe 55 · provincia 100 → 78', 78, classeEstranea.punteggio);
check('e pesa più della provincia vicina (78 < 90)', true, classeEstranea.punteggio < vicina.punteggio);


/* ---------- 2) LIVELLO SECONDARIO: LA COMPETENZA SFUMA IL VOTO PRIMARIO ------ */

console.log('\n— Livello secondario: la competenza sfuma, il voto resta delle preferenze —');
/** Profilo con una competenza del profilo: livello SECONDARIO che sfuma il voto (§26.63). */
const chiave = { ...profilo, ordini: ['secondaria2'] as const, materieCustom: ['Intelligenza Artificiale'] };
const senzaChiave = valutaCompatibilita(
  { ...chiave, materieCustom: [] },
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('SENZA competenza il voto è quello primario: 100 · 95 (peso 2) · 100 → 98', 98, senzaChiave.punteggio);
check('e non c’è nulla da sfumare', null, senzaChiave.competenzaSecondaria);

const conChiave = valutaCompatibilita(
  chiave,
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('la competenza NON assegna il voto: sfuma i 98 primari di 25 punti → 100', 100, conChiave.punteggio);
check('col match PIENO parla il JOLLY (§26.64): il badge del secondo livello tace', null, conChiave.competenzaSecondaria);
check('e la competenza riconosciuta è dichiarata dal jolly', 'Intelligenza Artificiale', conChiave.jollySemantico);
check('le competenze NON entrano nella media: il denominatore resta 4', 4, conChiave.modali.pesoTotale);
check(
  'il tooltip racconta i due livelli',
  true,
  /media ponderata di 3 modali/.test(conChiave.motivi.join(' ')) &&
    /livello secondario: \+25 punti \(tetto 25%\)/.test(conChiave.motivi.join(' ')),
);

const chiaveVicina = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'], materieCustom: ['Didattica Multimediale'] },
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso multimediale' },
  { provinceLimitrofe: true },
);
check('match «vicino» (20) su basi primarie 98 → 100, non un voto d’ufficio', 100, chiaveVicina.punteggio);
check('col jolly parziale il grado vicino stringe i 20 misurati a 15 applicati (§26.64)',
  { etichetta: 'Didattica Multimediale', punteggio: BONUS_JOLLY_PARZIALE },
  chiaveVicina.competenzaSecondaria);

// Oltre il raggio decidono le preferenze: esclusione secca, salvo il match PIENO (§26.64).
const chiaveFuori = valutaCompatibilita(
  chiave,
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('il match PIENO non è escluso: entra d’ufficio al pavimento d’inclusione', PUNTEGGIO_JOLLY_OLTRE_RAGGIO, chiaveFuori.punteggio);
check('e la riga del jolly dichiara la competenza riconosciuta', 'Intelligenza Artificiale', chiaveFuori.jollySemantico);
const fuoriVicino = valutaCompatibilita({ ...profilo, ordini: ['secondaria2'], materieCustom: ['Didattica Multimediale'] },
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso multimediale' }, { provinceLimitrofe: true });
check('mentre un match PARZIALE oltre il raggio resta ESCLUSO', true, fuoriVicino.escluso);

const chiaveForzata = valutaCompatibilita(
  chiave,
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true, forzata: true },
);
check('whitelist + competenza: entra d’ufficio e sfuma i 97 primari → 100', 100, chiaveForzata.punteggio);
check('ed è marcata come inclusione d’ufficio', true, chiaveForzata.forzata);
check('le competenze non toccano la condizione geografica', null, chiaveForzata.modali.provincia);
check('whitelist: il jolly è SOSPESO, il badge resta la sfumatura §26.63', 25, chiaveForzata.competenzaSecondaria?.punteggio);

// INVARIANTE §26.45: il pavimento del sostegno non si sconta e la competenza non lo promuove.
const sostegnoChiave = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'], materieCustom: ['Intelligenza Artificiale'] },
  {
    province: 'AL',
    classi: ['ADEE'],
    ordine: 'primaria',
    titolo: 'Interpello sostegno scuola primaria: intelligenza artificiale',
  },
  { provinceLimitrofe: true },
);
check('suggerimento EXTRA (sostegno) anche con la competenza: resta 60', PUNTEGGIO_EXTRA_SOSTEGNO, sostegnoChiave.punteggio);
check('e la competenza non lo promuove', null, sostegnoChiave.competenzaSecondaria);
check('e il jolly tace: nessun pavimento d’ufficio sul suggerimento extra (§26.64)', null, sostegnoChiave.jollySemantico);

/* ---------------------------- 3) CABLAGGIO -------------------------------- */

console.log('\n— Cablaggio: feed → bacheca pura → card/modale —');
const feed = leggi('src/contexts/app/useInterpelliFeed.ts');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
const graduata = leggi('src/lib/compatibilitaGraduata.ts');
const card = leggi('src/components/InterpelloCard.tsx');
const modale = leggi('src/components/InterpelloDettaglioModal.tsx');
check('feed: delega alla bacheca pura', true, /bachecaInterpelli\(/.test(feed));
check('feed: cerca anche le province entro il raggio', true, /provinceDiRicerca\(/.test(feed));
check('bacheca: applica le modali con l’opzione della bacheca', true, /valutaCompatibilita\(/.test(bacheca) && /provinceLimitrofe: true/.test(bacheca));
check('bacheca: cap dinamico dei riempitivi', true, /limitaRiempitivi\(/.test(bacheca));
check('graduata: il motore resta la base del punteggio', true, /punteggioCompatibilita\(/.test(graduata));
check('graduata: una sola media PONDERATA delle modali', true, /mediaPonderata\(/.test(graduata));
const bandaRe = /bandaCompatibilita\(interpello\.compatibilita, interpello\.motivoCompatibilita\)/;
check('card e modale: banda + motivo dichiarato', true, bandaRe.test(card) && bandaRe.test(modale));
const consegna = ['src/lib/notifier.ts', 'src/lib/digest.ts', 'scripts/invia-digest.ts'];
check('CONSEGNA: nessun file di notifica passa `provinceLimitrofe`', true, consegna.every((f) => !/provinceLimitrofe/.test(leggi(f))));
const moduli = [
  'src/lib/punteggioOrdine.ts',
  'src/lib/punteggioClasse.ts',
  'src/lib/punteggioCompetenze.ts',
  'src/lib/prossimitaGeografica.ts',
  'src/lib/filtriScuole.ts',
  'src/lib/areeDisciplinari.ts',
  'src/lib/mediaModali.ts',
];
check('una modale, un modulo (puro e testabile)', true, moduli.every((f) => leggi(f).length > 0));
// LIVELLO SECONDARIO — dal modulo puro al tipo, alla bacheca, alla card: un solo filo.
const datiInterpello = leggi('src/data/interpelli.ts');
check('tipo: il campo della competenza che ha sfumato il voto', true, /competenzaSecondaria\?: string \| null/.test(datiInterpello));
check(
  'bacheca: la sfumatura della valutazione diventa `competenzaSecondaria`',
  true,
  /competenzaSecondaria: valutazione\.competenzaSecondaria\?\.etichetta \?\? null/.test(bacheca),
);
check(
  'bacheca: la pertinenza resta quella PRIMARIA del motore (le competenze non aprono la bacheca)',
  true,
  /const pertinenzaMotore =/.test(bacheca) && /avvisoCompatibileConProfilo\(profilo, avviso/.test(bacheca),
);
check(
  'card e modale: etichetta dedicata + tooltip della sfumatura',
  true,
  /ETICHETTA_COMPETENZA_SECONDARIA/.test(card) &&
    /ETICHETTA_COMPETENZA_SECONDARIA/.test(modale) &&
    /descrizioneCompetenzaSecondaria\(competenzaSecondaria, banda\.punteggio\)/.test(card) &&
    /descrizioneCompetenzaSecondaria\(competenzaSecondaria, banda\.punteggio\)/.test(modale),
);
check(
  'graduata: la competenza è l’unico tier SECONDARIO (dopo la media ponderata)',
  true,
  graduata.indexOf('const base = mediaPonderata(contributi)') > 0 &&
    graduata.indexOf('const base = mediaPonderata(contributi)') <
      graduata.indexOf('base + competenze.punteggio'),
);
check(
  'graduata: il tetto del livello secondario è il verdetto del motore senza classi',
  true,
  /const tetto = punteggioMotore === PUNTEGGIO_MATCH_SECONDARIO \? PUNTEGGIO_MATCH_SECONDARIO : 100/.test(graduata),
);

/* ------------------------ 4) LA GUARDIA È NELLA CATENA -------------------- */

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:compatibilita:graduata' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-compatibilita-graduata.ts'));

console.log(
  errori === 0
    ? '\n✅ COMPATIBILITÀ GRADUATA: due livelli (media ponderata primaria + sfumatura competenze), sostegno a 60, consegna strict.'
    : `\n❌ COMPATIBILITÀ GRADUATA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
