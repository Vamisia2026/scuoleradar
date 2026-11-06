/**
 * TEST — GRADI AFFINI E CASCATA GENEROSA (§26.141 · §26.144).
 *
 * «Trovare è più importante che scartare»: ogni generosità è un rischio di falso positivo.
 *   · il GRADO AFFINE è proporzionale (82 · 76 · 72 · 70) e vale solo con un ponte VERO:
 *     materia coperta, area affine/contaminata, oppure avviso senza classe in un ordine vicino;
 *   · il SERBATOIO (ATA 52 · sostegno d'altro ordine 58) è il CANALE RISERVA della cascata e
 *     entra D'UFFICIO in bacheca (§26.144 · §26.145). §26.148: le emergenze non scelte pagano
 *     −40%, e l'infanzia per chi cerca le superiori è SBARRATA (non un match basso);
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
  bachecaScarsa,
  eAvvisoAta,
  gradoAffine,
} from '../src/lib/gradiAffini.ts';
import { bachecaInterpelli } from '../src/lib/bachecaInterpelli.ts';
import {
  PUNTEGGIO_RISERVA_ATA,
  PUNTEGGIO_RISERVA_SOSTEGNO,
  PUNTEGGIO_RISERVA_SOSTEGNO_VICINO,
  PUNTEGGIO_MERITO_SOSTEGNO,
  PUNTEGGIO_MERITO_SOSTEGNO_VICINO,
  voceCascata,
} from '../src/lib/cascataGenerosa.ts';
import {
  PENALITA_CLASSE_STESSA_AREA,
  PUNTEGGIO_CLASSE_ESATTA,
  punteggioClasse,
} from '../src/lib/punteggioClasse.ts';
import { scalaParacadute } from '../src/lib/scalaParacadute.ts';
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
const stessaArea = PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_STESSA_AREA;
check('ed è la classe a dirlo (85, la soglia di §26.120)', stessaArea, punteggioClasse(PROFILO, datiAvviso(primariaInglese))?.punteggio);

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

/* -------------- 3) LA CASCATA: SOSTEGNO · ATA ENTRANO D'UFFICIO ------------- */

console.log('\n— 3. Cascata: sostegno/ATA d’ufficio, poi la DISTANZA DAL PROFILO (§26.145) —');
const ata = avviso({ id: 'ata', titolo: 'Avviso di selezione per collaboratore scolastico', classeCodice: '', classiCodes: [], materia: null, ordine: 'ata' });
const sostegnoInfanzia = avviso({ id: 'sost-inf', titolo: 'Interpello sostegno scuola dell’infanzia', classeCodice: 'ADAA', classiCodes: ['ADAA'], materia: 'Sostegno', ordine: 'infanzia' });
const sostegnoAltroOrdine = avviso({ id: 'sost-med', titolo: 'Interpello sostegno secondaria di I grado', classeCodice: 'ADSS', classiCodes: ['ADSS'], materia: 'Sostegno', ordine: 'secondaria1' });
const sostegnoProprioOrdine = avviso({ id: 'sost-2', titolo: 'Interpello sostegno secondaria di II grado', classeCodice: 'ADSS', classiCodes: ['ADSS'], materia: 'Sostegno', ordine: 'secondaria2' });
const cascata = (i: Interpello, provincia: 'propria' | 'vicina' | 'fuori' = 'propria') => voceCascata(PROFILO, datiAvviso(i), provincia);

check('collaboratore scolastico → è ATA', true, eAvvisoAta(datiAvviso(ata)));
// §26.145 — `lib/distanzaProfilo` cambia i voti che si leggono in pagina: +18 di provincia
// principale (solo sotto 70), poi la scala dell'ordine, il posto e le emergenze (§26.148),
// tutti MOLTIPLICATIVI.
check('i voti di partenza sono quelli dichiarati: 52 · 58 · 90 · 86 · 56', [52, 58, 90, 86, 56], [PUNTEGGIO_RISERVA_ATA, PUNTEGGIO_RISERVA_SOSTEGNO, PUNTEGGIO_MERITO_SOSTEGNO, PUNTEGGIO_MERITO_SOSTEGNO_VICINO, PUNTEGGIO_RISERVA_SOSTEGNO_VICINO]);
check('ATA → 52 +18 di prossimità, −40% di emergenza = 42 (in fondo, com’è giusto)', 42, cascata(ata).punteggio);
check('…e la fascia è `riserva`, non un match', 'riserva', cascata(ata).fascia);
check('sostegno alle MEDIE → 58 +18, −40% posto, −25% ordine = 34 (ripiego dichiarato)', 34, cascata(sostegnoAltroOrdine).punteggio);
check('…e sopra la soglia del fondo: la riga resta, non si spaccia per match', false, cascata(sostegnoAltroOrdine).fondo);
check('sostegno all’INFANZIA → SBARRATO: non c’è nessun voto da leggere', { escluso: true, punteggio: 0 }, { escluso: cascata(sostegnoInfanzia).escluso, punteggio: cascata(sostegnoInfanzia).punteggio });
check('sostegno nel PROPRIO ordine → 90 −40% del posto = 54 (merito, ma non la propria cattedra)', 54, cascata(sostegnoProprioOrdine).punteggio);
check('…e la fascia è `merito`', 'merito', cascata(sostegnoProprioOrdine).fascia);
check('sostegno nel proprio ordine, provincia vicina → 86 −40% = 52', 52, cascata(sostegnoProprioOrdine, 'vicina').punteggio);
check('sostegno alle medie, provincia vicina → 56 +18, poi le due penalità = 33', 33, cascata(sostegnoAltroOrdine, 'vicina').punteggio);
check('la classe ESATTA vince sul canale sostegno', PUNTEGGIO_CLASSE_ESATTA, cascata(avviso({})).punteggio);
check('profilo senza classi → decide il motore (`motore`)', 'motore', voceCascata({ province: ['AT'], classi: [] }, datiAvviso(senzaClasse), 'propria').fascia);
const voci = [cascata(ata), cascata(sostegnoAltroOrdine), cascata(sostegnoProprioOrdine)];
check('nessuna voce esce dalla forbice dichiarata (1-100)', true, voci.every((v) => v.punteggio >= 1 && v.punteggio <= 100));
check('sotto 20 solo con una penalità dichiarata (`penalita > 0`)', true, voci.every((v) => v.punteggio >= 20 || v.penalita > 0));
check('la scala del perimetro resta quella della geografia', true, scalaParacadute(PROFILO, datiAvviso(ata)).ammessa);

/* ------------------- 4) LA BACHECA VERA: D'UFFICIO, NON IN SCORTA ---------- */

console.log('\n— 4. Bacheca: la riserva entra, il merito resta, l’estranea resta fuori —');
const soloAta = bachecaInterpelli([ata], PROFILO);
check('solo ATA in provincia → entra in bacheca (d’ufficio)', ['ata'], soloAta.lista.map((r) => r.id));
check('col voto della riserva più il bonus, meno l’emergenza (52 +18 −40% = 42)', 42, soloAta.lista[0]?.compatibilita);
check('e non è più un ripiego: la scorta non esiste', undefined, soloAta.lista[0]?.ripiego);
check('la voce è contata fra le riserve', 1, soloAta.riserveInBacheca);

const soloSostegno = bachecaInterpelli([sostegnoAltroOrdine], PROFILO);
check('sostegno alle medie → 34 in bacheca: riserva dichiarata, non un match', 34, soloSostegno.lista[0]?.compatibilita);
check('e non è un «senza affinità»: non si butta', 0, soloSostegno.senzaAffinitaClasse);
check('il motivo dichiara l’ingresso d’ufficio', true, /d'ufficio/.test(soloSostegno.lista[0]?.motivoCompatibilita ?? ''));

const sbarraInfanzia = bachecaInterpelli([sostegnoInfanzia], PROFILO);
check('sostegno all’infanzia → NON entra: la riga non si mostra affatto', 0, sbarraInfanzia.lista.length);
check('…e lo scarto è contato, non silenzioso', 1, sbarraInfanzia.esclusiOrdineEstremo);

const estranea = bachecaInterpelli([matematica], PROFILO);
check('classe estranea (matematica per un profilo di lingue) → bacheca vuota', 0, estranea.lista.length);
check('e lo scarto è contato (incompatibilità semantica)', 1, estranea.senzaAffinitaClasse);

const conGrado = bachecaInterpelli([senzaClasse], PROFILO);
check('avviso senza classe in ordine vicino → entra', ['noclass'], conGrado.lista.map((r) => r.id));
check('con il pavimento del grado (almeno 70)', true, (conGrado.lista[0]?.compatibilita ?? 0) >= PUNTEGGIO_GRADO_AFFINE_ORDINE);
check('il conto della tolleranza è dichiarato', 1, conGrado.tolleranzaInBacheca);
check('e il motivo lo dice, mai «match»', true, /grado affine/.test(conGrado.lista[0]?.motivoCompatibilita ?? ''));

const fuoriProvincia = bachecaInterpelli([{ ...ata, provinciaCodice: 'MI', provinciaNome: 'Milano' }], PROFILO);
check('ATA fuori dal perimetro → niente bacheca', 0, fuoriProvincia.lista.length);
check('e lo scarto è contato come fuori perimetro', 1, fuoriProvincia.fuoriPerimetro);

/* ------------------- 5) LA VETRINA SCARSA LO DICE ------------------------- */

console.log('\n— 5. Sotto i 3 match pieni la vetrina lo dichiara —');
const riga = (compatibilita: number, ripiego = false) => ({ compatibilita, ripiego });
check('lista vuota → non è «scarsa» (ha il suo stato)', false, bachecaScarsa([]));
check('due match pieni → scarsa', true, bachecaScarsa([riga(100), riga(85)]));
check('tre match pieni → non è scarsa', false, bachecaScarsa([riga(100), riga(85), riga(70)]));
check('i ripieghi non contano come match pieni', true, bachecaScarsa([riga(100), riga(52, true), riga(58, true)]));
check('sotto soglia non conta', true, bachecaScarsa([riga(100), riga(65), riga(69)]));
check('la soglia è tre, dichiarata', 3, MINIMO_MATCH_PIENI);
check('il consiglio è il copy esatto della direttiva 03/11/2026', 'Le opportunità che abbiamo trovato per te oggi. Allarga la ricerca per intercettare più opportunità.', CONSIGLIO_BACHECA_SCARSA);

/* --------------------- 6) CABLAGGIO: UN SOLO METRO ------------------------ */

console.log('\n— 6. Cablaggio: un solo metro (bacheca → cascata) —');
const bacheca = leggi('src/lib/bachecaInterpelli.ts'), ripiego = leggi('src/lib/bachecaRipiego.ts');
const cascataSrc = leggi('src/lib/cascataGenerosa.ts');
const esito = `${bacheca}\n${ripiego}`;
check('la bacheca usa la cascata', true, /voceCascata\(profilo, avviso, scala\.provincia\)/.test(bacheca));
check('e il perimetro geografico come unico sbarramento', true, /scalaParacadute\(profilo, avviso\)/.test(bacheca) && /!scala\.ammessa/.test(bacheca));
check('il grado affine vive nella cascata', true, /gradoAffine\(profilo, avviso\)/.test(cascataSrc));
check('la decisione non passa più da `esitoRiga`', false, /esitoRiga\(/.test(esito));
check('nessun cap e nessun paracadute: la cascata non lascia vuoti', false, /paracaduteCinque\(|limitaRiempitivi\(/.test(bacheca));
check('i conti della cascata sono dichiarati nell’esito', true, ['merito', 'tolleranza', 'riserve'].every((k) => new RegExp(`${k}InBacheca: number`).test(ripiego)));

const vetrina = leggi('src/pages/dashboard/components/ElencoOpportunita.tsx');
check('la vetrina usa il giudizio condiviso', true, /bachecaScarsa\(lista\)/.test(vetrina));
check('e mostra la frase, mai un copy locale', true, /CONSIGLIO_BACHECA_SCARSA/.test(vetrina) && !/Ecco le opportunità disponibili oggi/.test(vetrina));

const pkg = leggi('package.json');
check('guardia dedicata in package.json', true, /"test:gradi-affini": "tsx scripts\/test-gradi-affini.ts"/.test(pkg));
check('guardia nella catena di `npm test`', true, /scripts\/test-gradi-affini\.ts/.test(pkg));

/* ------------------------- 7) PUREZZA DEL MODULO ------------------------- */

console.log('\n— 7. Modulo puro, verificabile senza browser —');
const sorgente = leggi('src/lib/gradiAffini.ts');
const codice = sorgente.split('\n').filter((linea) => !/^\s*(\/\/|\*)/.test(linea)).join('\n');
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
