/**
 * TEST — IL PUNTEGGIO HA DUE LIVELLI (§26.63): le preferenze fanno il voto, le competenze lo sfumano.
 *   PRIMARIO (100%)   ordine · classi di concorso · provincia → media PONDERATA (`mediaModali.ts`):
 *                     è l'unico livello che decide il voto e che apre la bacheca (§26.56–26.60);
 *   SECONDARIO (25%)  competenze/parole chiave del profilo → SFUMATURA di max `CAP_COMPETENZE`
 *                     punti su un match già agganciato: da sola non assegna il voto né passa 60;
 *                     col match PIENO parla il JOLLY SEMANTICO (§26.64): pavimento 90, e oltre il
 *                     raggio entro il tetto d’inclusione 60.
 * Verifica: 1) modulo `punteggioCompetenze` (25/20/10 + 3 per corrispondenza, dentro il tetto);
 *           2) aggregatore `valutaCompatibilita` (sfumatura DOPO la media ponderata, tetto = verdetto
 *              del motore quando mancano le classi, EXTRA sostegno non promosso, geografia sovrana
 *              col jolly semantico §26.64: il match PIENO entra d’ufficio al pavimento 60);
 *           3) API ritirata (nessun simbolo dell'override Modale 3 in `src/**` e `scripts/**`);
 *           4) cablaggio tipo → bacheca → card/modale → catena di `npm test` (il jolly semantico ha
 *              la sua guardia dedicata: `npm run test:jolly`).
 * Esecuzione: npm run test:scoring (i punteggi delle modali primarie stanno in `test:modali`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAP_COMPETENZE,
  INCREMENTO_JOLLY,
  PUNTEGGIO_COMPETENZA_ESATTA,
  PUNTEGGIO_COMPETENZA_RICONDUCIBILE,
  PUNTEGGIO_COMPETENZA_VICINA,
  punteggioCompetenze,
} from '../src/lib/punteggioCompetenze.ts';
import { valutaCompatibilita } from '../src/lib/compatibilitaGraduata.ts';
import { PUNTEGGIO_EXTRA_SOSTEGNO, PUNTEGGIO_MATCH_SECONDARIO } from '../src/lib/matchingEngine.ts';
import { PUNTEGGIO_JOLLY_OLTRE_RAGGIO, PUNTEGGIO_JOLLY_PIENO } from '../src/lib/jollySemantico.ts';
import { SOGLIA_COMPATIBILITA_ROSSO } from '../src/lib/compatibilita.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Tutti i sorgenti `.ts`/`.tsx` sotto una cartella (ricorsivo). */
function sorgenti(cartella: string): string[] {
  return readdirSync(cartella, { withFileTypes: true }).flatMap((voce) => {
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) return sorgenti(percorso);
    return /\.tsx?$/.test(voce.name) ? [percorso] : [];
  });
}

/** Profilo con una competenza del profilo (livello SECONDARIO, §26.63). */
const chiave = {
  ordini: ['secondaria2'] as const,
  classi: ['A-22'],
  province: ['AT'],
  materieCustom: ['Intelligenza Artificiale'],
};

/* ------------------- 1) MODULO DEL LIVELLO SECONDARIO --------------------- */

console.log('— Livello secondario: 25 piena · 20 vicina · 10 riconducibile (tetto 25) —');
const piena = punteggioCompetenze(
  { materieCustom: ['Intelligenza Artificiale'] },
  { titolo: 'Corso di Intelligenza Artificiale per docenti' },
);
check('competenza piena = 25 (tetto del livello secondario)', PUNTEGGIO_COMPETENZA_ESATTA, piena.punteggio);
check('il tetto è un solo numero, dichiarato dal modulo', CAP_COMPETENZE, piena.punteggio);
check('la competenza riconosciuta è dichiarata', 'Intelligenza Artificiale', piena.competenza);
check('il grado del match è dichiarato', 'esatta', piena.grado);
check('nessuna corrispondenza aggiuntiva: nessun incremento', 0, piena.incrementi);
check('il motivo dichiara la competenza', true, /competenza: Intelligenza Artificiale/.test(piena.motivi.join(' ')));
check('il motivo dichiara il tetto', true, /tetto 25%/.test(piena.motivi.join(' ')));

const vicina = punteggioCompetenze({ materieCustom: ['Didattica Multimediale'] }, { titolo: 'Corso multimediale' });
check('match semantico vicino = 20', PUNTEGGIO_COMPETENZA_VICINA, vicina.punteggio);
check('grado «vicina» (match parziale) dichiarato', 'vicina', vicina.grado);
check('la sfumatura vicina resta sotto il tetto', true, vicina.punteggio < CAP_COMPETENZE);

const riconducibile = punteggioCompetenze(
  { materieCustom: ['Intelligenza Artificiale'] },
  { titolo: 'Didattica multimediale in classe' },
);
check('stessa area / ponte curato («Digitale ↔ Intelligenza artificiale») = 10', PUNTEGGIO_COMPETENZA_RICONDUCIBILE, riconducibile.punteggio);
check('grado «riconducibile» dichiarato', 'riconducibile', riconducibile.grado);

const dueCompetenze = punteggioCompetenze(
  { materieCustom: ['Intelligenza Artificiale', 'Didattica Multimediale'] },
  { titolo: 'Corso di Intelligenza Artificiale e Didattica Multimediale' },
);
check('due competenze: la seconda sfuma di 3 punti', 1, dueCompetenze.incrementi);
check('ma la somma resta DENTRO il tetto (25, non 28)', CAP_COMPETENZE, dueCompetenze.punteggio);
check('il conteggio è dichiarato nel motivo', true, /2 competenze riconosciute/.test(dueCompetenze.motivi.join(' ')));
check('incremento dichiarato dal modulo', 3, INCREMENTO_JOLLY);

check(
  'nessuna competenza nel testo → il livello secondario tace',
  { punteggio: 0, competenza: null, grado: null, incrementi: 0, motivi: [] },
  punteggioCompetenze({ materieCustom: ['Pedagogia Steineriana'] }, { titolo: 'Interpello di matematica' }),
);
check(
  'nessuna competenza nel profilo → stesso silenzio',
  true,
  punteggioCompetenze({ materieCustom: [] }, { titolo: 'Corso di inglese' }).punteggio === 0,
);

/* --------------- 2) AGGREGATORE: PRIMARIO DECIDE, SECONDARIO SFUMA -------- */

console.log('\n— Aggregatore: la media ponderata primaria fa il voto, la competenza lo sfuma —');
const senzaCompetenza = valutaCompatibilita(
  { ...chiave, materieCustom: [] },
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di inglese' },
  { provinceLimitrofe: true },
);
check('il voto primario resta quello delle preferenze: 98', 98, senzaCompetenza.punteggio);
check('ordine 100 · classe affine 95 (peso 2) · provincia 100 → denominatore 4', 4, senzaCompetenza.modali.pesoTotale);
check('senza competenza non c’è nulla da sfumare', null, senzaCompetenza.competenzaSecondaria);
check('e la modale delle competenze resta fuori dalla media', null, senzaCompetenza.modali.competenze);

const conCompetenza = valutaCompatibilita(
  chiave,
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di Intelligenza Artificiale per docenti' },
  { provinceLimitrofe: true },
);
check('la competenza NON assegna il voto: sfuma i 98 primari di 25 punti → 100', 100, conCompetenza.punteggio);
check('lo scarto è dichiarato: la stessa coppia senza competenza valeva 98', 98, senzaCompetenza.punteggio);
check('col match PIENO il badge del secondo livello è del JOLLY (§26.64)', null, conCompetenza.competenzaSecondaria);
check('e la competenza riconosciuta è dichiarata dal jolly', 'Intelligenza Artificiale', conCompetenza.jollySemantico);
check('il pavimento d’eccellenza accompagna i 98 primari', true, conCompetenza.punteggio >= PUNTEGGIO_JOLLY_PIENO);
check('il dettaglio porta la sfumatura del livello secondario', 25, conCompetenza.modali.competenze);
check('le competenze NON entrano nella media: il denominatore resta 4', 4, conCompetenza.modali.pesoTotale);
check(
  'il tooltip racconta i due livelli: media ponderata + sfumatura',
  true,
  /media ponderata di 3 modali/.test(conCompetenza.motivi.join(' ')) &&
    /livello secondario: \+25 punti/.test(conCompetenza.motivi.join(' ')),
);

const soloCompetenze = valutaCompatibilita(
  { ordini: ['secondaria2'], classi: [], province: ['AT'], materieCustom: ['Intelligenza Artificiale'] },
  { province: 'AT', classi: [], materia: 'Intelligenza Artificiale' },
  { provinceLimitrofe: true },
);
check('profilo senza classi: il motore sentenzia il livello secondario', PUNTEGGIO_MATCH_SECONDARIO, soloCompetenze.punteggioMotore);
check('e quel verdetto È il tetto del punteggio mostrato', PUNTEGGIO_MATCH_SECONDARIO, soloCompetenze.punteggio);
check('il tetto delle competenze è lo stesso numero del motore', CAP_COMPETENZE, PUNTEGGIO_MATCH_SECONDARIO);
check('la sfumatura è comunque dichiarata', 25, soloCompetenze.competenzaSecondaria?.punteggio);
check('una competenza da sola non raggiunge mai la soglia rossa', true, soloCompetenze.punteggio < SOGLIA_COMPATIBILITA_ROSSO);
check('nessun peso primario da mediare oltre la provincia', 1, soloCompetenze.modali.pesoTotale);

const sostegno = valutaCompatibilita(
  chiave,
  { province: 'AT', classi: ['ADEE'], ordine: 'primaria', titolo: 'Interpello sostegno primaria: intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('SUGGERIMENTO EXTRA (sostegno) resta a 60 anche con la competenza trovata', PUNTEGGIO_EXTRA_SOSTEGNO, sostegno.punteggio);
check('e non porta alcuna sfumatura', null, sostegno.competenzaSecondaria);
check('né motivi inventati', [], sostegno.motivi);
check('le competenze non promuovono il suggerimento extra', 0, sostegno.modali.pesoTotale);

console.log('\n— Geografia: il match PIENO entra d’ufficio a 60, la whitelist resta nel tetto —');
const fuoriRaggio = valutaCompatibilita(
  chiave,
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('oltre i 60 km il match PIENO entra D’UFFICIO (§26.64)', false, fuoriRaggio.escluso);
check('al pavimento d’inclusione (60), non a un 100% finto', PUNTEGGIO_JOLLY_OLTRE_RAGGIO, fuoriRaggio.punteggio);
check('e la competenza riconosciuta resta dichiarata', 'Intelligenza Artificiale', fuoriRaggio.jollySemantico);

const forzata = valutaCompatibilita(
  chiave,
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true, forzata: true },
);
check('whitelist: entra d’ufficio (media primaria 97) e sfuma fino a 100', 100, forzata.punteggio);
check('ed è marcata come inclusione d’ufficio', true, forzata.forzata);
check('le competenze non toccano la condizione geografica', null, forzata.modali.provincia);
check('il cap protegge le soglie: 25 < 60 (soglia rossa)', true, CAP_COMPETENZE < SOGLIA_COMPATIBILITA_ROSSO);

/* ---------------------------- 3) API RITIRATA ---------------------------- */

console.log('\n— API ritirata: l’override della Modalità 3 non esiste più —');
// Nomi ritirati dalla §26.63. La guardia non conta SE STESSA (li cita qui per spiegarli).
const RITIRATI = ['PUNTEGGIO_MATCH_POSSIBILE', 'PUNTEGGIO_KEYWORD', 'JOLLY_MASSIMO', 'incrementiJolly',
  'parolaChiaveVoto', 'ETICHETTA_PAROLA_CHIAVE', 'descrizioneParolaChiave'];
const infetti = (file: readonly string[]): string[] => file.filter((f) => RITIRATI.some((nome) => leggi(f).includes(nome)));
check('src/**: nessun simbolo ritirato', [], infetti(sorgenti('src')));
const guardie = sorgenti('scripts').filter((f) => !/test-scoring-due-livelli\.ts$/.test(f));
check('scripts/**: nessun simbolo ritirato', [], infetti(guardie));
check(
  'scripts/**: nessun `EsitoCompetenze.override` (il livello secondario non assegna voti)',
  [],
  guardie.filter((f) => /\.override\b/.test(leggi(f))),
);
check('la guardia dell’override è stata RIMOSSA', false, guardie.some((f) => /test-override-modale3\.ts$/.test(f)));

/* ----------------- 4) CABLAGGIO: tipo → bacheca → viste → catena --------- */

console.log('\n— Cablaggio: tipo, bacheca, card/modale —');
const dati = leggi('src/data/interpelli.ts');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
const graduata = leggi('src/lib/compatibilitaGraduata.ts');
const card = leggi('src/components/InterpelloCard.tsx');
const modale = leggi('src/components/InterpelloDettaglioModal.tsx');
check('tipo: il campo del livello secondario è `competenzaSecondaria`', true, /competenzaSecondaria\?: string \| null/.test(dati));
check(
  'bacheca: porta la competenza riconosciuta sulla riga',
  true,
  /competenzaSecondaria: valutazione\.competenzaSecondaria\?\.etichetta \?\? null/.test(bacheca),
);
check('bacheca: la porta d’ingresso NON usa le competenze (non creano l’opportunità)', true, !/punteggioCompetenze\(/.test(bacheca));
check(
  'bacheca: la pertinenza resta quella primaria del motore',
  true,
  /const pertinenzaMotore =/.test(bacheca) && /avvisoCompatibileConProfilo\(profilo, avviso/.test(bacheca),
);
check('graduata: il motore resta la base del punteggio', true, /punteggioCompatibilita\(/.test(graduata));
check(
  'graduata: la sfumatura arriva DOPO la media ponderata primaria',
  true,
  graduata.indexOf('const base = mediaPonderata(contributi)') > 0 &&
    graduata.indexOf('const base = mediaPonderata(contributi)') < graduata.indexOf('base + competenze.punteggio'),
);
check(
  'graduata: il tetto del livello secondario è il verdetto del motore',
  true,
  /const tetto = punteggioMotore === PUNTEGGIO_MATCH_SECONDARIO \? PUNTEGGIO_MATCH_SECONDARIO : 100/.test(graduata),
);
check(
  'card e modale: etichetta dedicata + tooltip della sfumatura',
  true,
  /ETICHETTA_COMPETENZA_SECONDARIA/.test(card) &&
    /ETICHETTA_COMPETENZA_SECONDARIA/.test(modale) &&
    /descrizioneCompetenzaSecondaria\(competenzaSecondaria, banda\.punteggio\)/.test(card) &&
    /descrizioneCompetenzaSecondaria\(competenzaSecondaria, banda\.punteggio\)/.test(modale),
);

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:scoring' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-scoring-due-livelli.ts'));
check('la guardia ritirata non è più uno script', false, 'test:override' in catena.scripts);

console.log(
  errori === 0
    ? '\n✅ SCORING: le preferenze primarie fanno il voto, le competenze lo sfumano (max 25).'
    : `\n❌ SCORING: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

