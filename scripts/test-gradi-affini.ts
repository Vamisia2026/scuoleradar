/**
 * TEST — GRADI AFFINI E SERBATOIO DI DEFAULT (§26.141).
 *
 * «Trovare è più importante che scartare»: ogni generosità è un rischio di falso positivo.
 *   · il GRADO AFFINE è proporzionale (82 · 76 · 72 · 70) e vale solo con un ponte
 *     VERO: materia coperta, area affine/contaminata, oppure avviso senza classe in
 *     un ordine vicino. Un'altra materia nello stesso ordine resta fuori;
 *   · il SERBATOIO (ATA 52 · sostegno d'altro ordine 58) esiste solo nelle proprie
 *     province, non sostituisce un match e va nella sola SCORTA (in vetrina arriva col paracadute, `ripiego`);
 *   · la bacheca conta ciò che fa e la vetrina scarsa (< 3 match pieni) lo dichiara.
 * Il lessico dell'ingestione (keywords e target) ha la sua guardia: `test-lessico-ingestione.ts`.
 * Uso: npm run test:gradi-affini  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  CONSIGLIO_BACHECA_SCARSA,
  MINIMO_MATCH_PIENI,
  PUNTEGGIO_GRADO_AFFINE_AREA,
  PUNTEGGIO_GRADO_AFFINE_MATERIA,
  PUNTEGGIO_GRADO_AFFINE_ORDINE,
  PUNTEGGIO_GRADO_AFFINE_PONTE,
  PUNTEGGIO_SERBATOIO_ATA,
  PUNTEGGIO_SERBATOIO_SOSTEGNO,
  bachecaScarsa,
  eAvvisoAta,
  gradoAffine,
  voceSerbatoio,
} from '../src/lib/gradiAffini.ts';
import { bachecaInterpelli } from '../src/lib/bachecaInterpelli.ts';
import { esitoRiga } from '../src/lib/bachecaRipiego.ts';
import {
  PENALITA_CLASSE_STESSA_AREA,
  PUNTEGGIO_CLASSE_ESATTA,
  punteggioClasse,
} from '../src/lib/punteggioClasse.ts';
import type { Interpello } from '../src/data/interpelli.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
/** Data di riferimento dei giudizi sulla scadenza (guardia deterministica). */
const OGGI = new Date().toISOString().slice(0, 10);
/** Data fra N giorni in ISO: la finestra delle opportunità è di 15 giorni (§26.71). */
const fra = (giorni: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
};

/** Interpello di prova: identità completa, sovrascrivibile campo per campo. */
const avviso = (overrides: Partial<Interpello> = {}): Interpello => ({
  id: 'a1',
  titolo: 'Interpello supplenza A-24 lingua inglese',
  istituto: 'I.I.S. A. CASTIGLIANO',
  provinciaCodice: 'AT',
  provinciaNome: 'Asti',
  classeCodice: 'A-24',
  classiCodes: ['A-24'],
  materia: null,
  ordine: 'secondaria2',
  dataScadenza: fra(5),
  descrizione: 'Fixture di guardia',
  linkFonte: 'https://www.iiscastigliano.edu.it/avvisi/interpello-a24',
  compatibilita: 100,
  ...overrides,
});

/** Il profilo della direttiva: una classe di lingue della secondaria II, in AT. */
const PROFILO = { ordini: ['secondaria2'] as const, classi: ['A-24'], province: ['AT'] };

/** La riga nella forma che i giudizi puri si aspettano. */
const datiAvviso = (i: Interpello) => ({
  province: i.provinciaCodice,
  classi: i.classiCodes,
  materia: i.materia,
  titolo: i.titolo,
  ordine: i.ordine,
});


/* --------------------- 1) IL GRADO AFFINE, IN PROPORZIONE ------------------ */

console.log('\n— 1. Grado affine: 82 · 76 · 72 · 70, mai un match —');
const primariaInglese = avviso({
  id: 'eeee',
  titolo: 'Interpello posto comune scuola primaria lingua inglese',
  classeCodice: 'EEEE',
  classiCodes: ['EEEE'],
  materia: 'Lingua inglese',
  ordine: 'primaria',
});
// La «stessa area» (85) è già la porta d'ingresso di sempre: il grado non la declassa.
check('EEEE con lingua inglese → già «stessa area»: il grado non la declassa', null, gradoAffine(PROFILO, datiAvviso(primariaInglese)));
check(
  'ed è la classe a dirlo (85, la soglia di §26.120)',
  PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_STESSA_AREA,
  punteggioClasse(PROFILO, datiAvviso(primariaInglese))?.punteggio,
);

const senzaClasse = avviso({
  id: 'noclass',
  titolo: 'Avviso per il conferimento di supplenza',
  classeCodice: '',
  classiCodes: [],
  materia: null,
  ordine: 'secondaria2',
});
check('avviso senza classe, stesso ordine → 70 (il grado è l’unico segnale)', PUNTEGGIO_GRADO_AFFINE_ORDINE, gradoAffine(PROFILO, datiAvviso(senzaClasse))?.punteggio);
check('con la secondaria I (ordine adiacente) vale uguale', PUNTEGGIO_GRADO_AFFINE_ORDINE, gradoAffine(PROFILO, { ...datiAvviso(senzaClasse), ordine: 'secondaria1' })?.punteggio);
check('l’etichetta del grado lo dichiara, senza spacciarlo per match', true, /grado affine/.test(gradoAffine(PROFILO, datiAvviso(senzaClasse))?.etichetta ?? ''));

const scalaValori = [PUNTEGGIO_GRADO_AFFINE_MATERIA, PUNTEGGIO_GRADO_AFFINE_PONTE, PUNTEGGIO_GRADO_AFFINE_AREA, PUNTEGGIO_GRADO_AFFINE_ORDINE];
check('la scala è decrescente, dentro la forbice 85 → 70 e mai sotto soglia', true, scalaValori.every((v, i) => v <= 85 && v >= 70 && (i === 0 || v < scalaValori[i - 1])));

/* ------------------- 2) IL GRADO NON È UNA SCORCIATOIA -------------------- */

console.log('\n— 2. Senza ponte il grado non esiste (la classe estranea resta fuori) —');
const matematica = avviso({
  id: 'a26',
  titolo: 'Interpello supplenza A-26 matematica',
  classeCodice: 'A-26',
  classiCodes: ['A-26'],
  materia: 'Matematica',
});
check('altra materia, stesso ordine → nessun grado', null, gradoAffine(PROFILO, datiAvviso(matematica)));
check('ordine non adiacente (infanzia) → nessun grado', null, gradoAffine(PROFILO, { ...datiAvviso(senzaClasse), ordine: 'infanzia' }));
check('profilo senza ordini dichiarati → nessun grado', null, gradoAffine({ classi: ['A-24'], province: ['AT'] }, datiAvviso(senzaClasse)));
check('la stessa classe di concorso non passa dal grado (è già un match)', null, gradoAffine(PROFILO, datiAvviso(avviso({}))));

/* --------------------- 3) IL SERBATOIO: SOLO LE TUE PROVINCE -------------- */

console.log('\n— 3. Serbatoio di default: ATA 52 · sostegno 58, nella tua provincia —');
const ata = avviso({
  id: 'ata',
  titolo: 'Avviso di selezione per collaboratore scolastico',
  classeCodice: '',
  classiCodes: [],
  materia: null,
  ordine: 'ata',
});
check('collaboratore scolastico → è ATA', true, eAvvisoAta(datiAvviso(ata)));
check('ed entra nel serbatoio a 52', PUNTEGGIO_SERBATOIO_ATA, voceSerbatoio(PROFILO, datiAvviso(ata))?.punteggio);
const sostegnoAltroOrdine = avviso({
  id: 'sost-inf',
  titolo: 'Interpello sostegno scuola dell’infanzia',
  classeCodice: 'ADAA',
  classiCodes: ['ADAA'],
  materia: 'Sostegno',
  ordine: 'infanzia',
});
check('sostegno di un altro ordine → 58 (paracadute, non suggerimento)', PUNTEGGIO_SERBATOIO_SOSTEGNO, voceSerbatoio(PROFILO, datiAvviso(sostegnoAltroOrdine))?.punteggio);
check('sostegno nel PROPRIO ordine resta al motore (extra 60), non al serbatoio', null, voceSerbatoio(PROFILO, { ...datiAvviso(sostegnoAltroOrdine), ordine: 'secondaria2', classi: ['ADSS'] }));
check('un’altra provincia non è un paracadute', null, voceSerbatoio(PROFILO, { ...datiAvviso(ata), province: 'MI' }));
check('una classe in comune è un match, non un serbatoio', null, voceSerbatoio(PROFILO, datiAvviso(avviso({}))));
check('un profilo senza classi non ha serbatoio (decide il motore)', null, voceSerbatoio({ province: ['AT'], classi: [] }, datiAvviso(ata)));


/* ------------------- 4) LA BACHECA VERA: RISERVA, NON MERITO -------------- */

console.log('\n— 4. Bacheca: il serbatoio va in scorta, il grado in vetrina —');
const soloAta = bachecaInterpelli([ata], PROFILO);
check('solo ATA in provincia → la vetrina si riempie col paracadute', ['ata'], soloAta.lista.map((r) => r.id));
check('ed è dichiarata ripiego, non match', true, soloAta.lista[0]?.ripiego === true);
check('col punteggio del serbatoio (52)', PUNTEGGIO_SERBATOIO_ATA, soloAta.lista[0]?.compatibilita);
check('la voce è contata a parte', 1, soloAta.serbatoioInScorta);

const soloSostegno = bachecaInterpelli([sostegnoAltroOrdine], PROFILO);
check('sostegno di un altro ordine → paracadute a 58', PUNTEGGIO_SERBATOIO_SOSTEGNO, soloSostegno.lista[0]?.compatibilita);
check('e non è un «senza affinità»: non si butta', 0, soloSostegno.senzaAffinitaClasse);

const estranea = bachecaInterpelli([matematica], PROFILO);
check('classe estranea → bacheca vuota (la regola di §26.120 resta)', 0, estranea.lista.length);
check('e lo scarto è contato', 1, estranea.senzaAffinitaClasse);

const conGrado = bachecaInterpelli([senzaClasse], PROFILO);
check('avviso senza classe in ordine vicino → entra', ['noclass'], conGrado.lista.map((r) => r.id));
check('con il pavimento del grado (almeno 70)', true, (conGrado.lista[0]?.compatibilita ?? 0) >= PUNTEGGIO_GRADO_AFFINE_ORDINE);
check('il conto degli affini è dichiarato', 1, conGrado.affiniInBacheca);
check('e il motivo lo dice, mai «match»', true, /grado affine/.test(conGrado.lista[0]?.motivoCompatibilita ?? ''));
// §26.141 — `affine` = «la riga è qui DOVE IL GRADO È STATO DECISIVO»: il grado esiste solo
// quando la classe non fa match, quindi senza di lui la riga non avrebbe la porta d'ingresso
// (misurato su AT il 04/11/2026: due righe senza classe a 78 in vetrina grazie al solo grado).
const esitoPieno = esitoRiga(senzaClasse, { punteggio: 88, motivi: ['classe esatta'], escluso: false } as unknown as Parameters<typeof esitoRiga>[1], { punteggioGrado: PUNTEGGIO_GRADO_AFFINE_ORDINE, gradoEtichetta: 'grado affine: nessuna classe, ordine vicino', serbatoio: null, pertinente: true, forzata: false, livelloScala: 'affini' });
check('con il grado la riga è affine anche se il voto del motore era già alto', true, esitoPieno.esito === 'bacheca' ? esitoPieno.affine : null);

const fuoriProvincia = bachecaInterpelli([{ ...ata, provinciaCodice: 'MI', provinciaNome: 'Milano' }], PROFILO);
check('ATA fuori dalle tue province → niente serbatoio', 0, fuoriProvincia.lista.length);

/* ------------------- 5) LA VETRINA SCARSA LO DICE ------------------------- */

console.log('\n— 5. Sotto i 3 match pieni la vetrina lo dichiara —');
const riga = (compatibilita: number, ripiego = false) => ({ compatibilita, ripiego });
check('lista vuota → non è «scarsa» (ha il suo stato)', false, bachecaScarsa([]));
check('due match pieni → scarsa', true, bachecaScarsa([riga(100), riga(85)]));
check('tre match pieni → non è scarsa', false, bachecaScarsa([riga(100), riga(85), riga(70)]));
check('i ripieghi non contano come match pieni', true, bachecaScarsa([riga(100), riga(52, true), riga(58, true)]));
check('sotto soglia non conta', true, bachecaScarsa([riga(100), riga(65), riga(69)]));
check('la soglia è tre, dichiarata', 3, MINIMO_MATCH_PIENI);
check('il consiglio nomina le tue province e la strada', true, /province/.test(CONSIGLIO_BACHECA_SCARSA) && /profilo/.test(CONSIGLIO_BACHECA_SCARSA));

/* --------------------- 6) CABLAGGIO: UN SOLO METRO ------------------------ */

console.log('\n— 6. Cablaggio: bacheca, vetrina e guardia —');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
const ripiego = leggi('src/lib/bachecaRipiego.ts');
const bachecaConRipiego = `${bacheca}\n${ripiego}`;
check('la bacheca usa il grado affine', true, /gradoAffine\(profilo, avviso\)/.test(bacheca));
check('e il serbatoio', true, /voceSerbatoio\(profilo, avviso\)/.test(bacheca));
check('la decisione della riga sta in un solo posto', true, /esitoRiga\(i, valutazione/.test(bacheca));
check('il serbatoio va nella SOLA scorta, col suo gradino', true, /candidatoSerbatoio\(i, valutazione, ctx\.serbatoio\)/.test(ripiego) && /'ultima-spiaggia'/.test(ripiego));
check('il grado alza il pavimento, non il merito', true, /Math\.max\(valutazione\.punteggio, ctx\.punteggioGrado/.test(ripiego));
check('i conti sono dichiarati nell’esito', true, /affiniInBacheca: number/.test(bachecaConRipiego) && /serbatoioInScorta: number/.test(bachecaConRipiego));

const vetrina = leggi('src/pages/dashboard/components/ElencoOpportunita.tsx');
check('la vetrina usa il giudizio condiviso', true, /bachecaScarsa\(lista\)/.test(vetrina));
check('e mostra la frase, mai un copy locale', true, /CONSIGLIO_BACHECA_SCARSA/.test(vetrina) && !/Ecco le opportunità disponibili oggi/.test(vetrina));

const pkg = leggi('package.json');
check('guardia dedicata in package.json', true, /"test:gradi-affini": "tsx scripts\/test-gradi-affini.ts"/.test(pkg));
check('guardia nella catena di `npm test`', true, /scripts\/test-gradi-affini\.ts/.test(pkg));

/* ------------------------- 7) PUREZZA DEL MODULO ------------------------- */

console.log('\n— 7. Modulo puro, verificabile senza browser —');
const sorgente = leggi('src/lib/gradiAffini.ts');
const codice = sorgente
  .split('\n')
  .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
  .join('\n');
check('nessuna rete', false, /\bfetch\(|axios|supabase/i.test(codice));
check('nessun node:* (importabile dal browser)', false, /from\s+'node:/i.test(codice));
check('sotto il tetto di 250 righe', true, sorgente.split('\n').length <= 250);
check('la data di riferimento è quella di oggi', true, OGGI.length === 10);

console.log(
  errori === 0
    ? '\n✅ GRADI AFFINI: si allarga la ricerca, non si abbassa il merito — e la riserva è dichiarata.'
    : `\n❌ GRADI AFFINI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
