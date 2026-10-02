/**
 * ScuoleRadar.it — Dipartimento Radar · blocco di trasparenza del Passo 4
 * («Cosa fa il tuo Radar, in chiaro»).
 *
 * Il passo finale non deve limitarsi a chiedere i canali: deve dichiarare, con i
 * dati REALI del profilo, che cosa cerca il Radar (province, classi di concorso,
 * competenze e parole chiave) e che cosa arriverà — avviso su Telegram
 * nell'istante in cui la scuola pubblica, UNA sola email al giorno, al massimo
 * `MAX_INVII_OPPORTUNITA` invii per la stessa opportunità, sempre con il link
 * all'annuncio ufficiale. È il rovescio del copy competitivo: nessuna urgenza e
 * nessun vantaggio sui colleghi.
 *
 * I controlli sono di RENDER (`react-dom/server`): il blocco viene costruito con
 * selezioni VERE prese dai cataloghi e i testi si leggono dal markup mostrato —
 * nomi delle province, etichette canoniche delle classi, plurale/singolare,
 * «e N altre» sulle liste lunghe, stato di profilo incompleto e numero di invii
 * ancorato al motore (`src/lib/frequenzaNotifiche`). Una regressione di copy o di
 * etichette salta fuori senza browser. L'ultima sezione verifica il CABLAGGIO
 * (il Passo 4 deve passargli i dati vivi, non un esempio).
 *
 * Uso: npm run test:trasparenza  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import ReactDOMServer from 'react-dom/server';
import { classiConcorso, etichettaClasseMateria } from '@/data/classiConcorso';
import { materie } from '@/data/ordiniMaterie';
import { province } from '@/data/province';
import { MAX_INVII_OPPORTUNITA } from '@/lib/frequenzaNotifiche';
import { SezioneTrasparenza } from '../components/SezioneTrasparenza';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Selezione del profilo così come la passa il contenitore del wizard. */
interface Selezione {
  provinceCodici: string[];
  classiCodici: string[];
  materieId: string[];
  materieCustom: string[];
}

/** Profilo appena aperto: nessuna scelta ancora fatta. */
const vuota: Selezione = { provinceCodici: [], classiCodici: [], materieId: [], materieCustom: [] };

/** Markup REALE del blocco per la selezione indicata. */
function rendi(selezione: Selezione): string {
  return ReactDOMServer.renderToStaticMarkup(createElement(SezioneTrasparenza, { selezione }));
}

/**
 * Testo come lo legge l'utente: il markup statico di React escapa apostrofi e
 * «&», mentre le etichette dei cataloghi («A-01 - Disegno e storia dell'arte…»)
 * arrivano in chiaro. Si confrontano quindi i testi già decodificati.
 */
function testo(markup: string): string {
  return markup
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/** Prima classe di concorso disciplinare del catalogo: codice ed etichetta veri. */
const classeProva =
  classiConcorso.find((c) => /^A-\d\d$/.test(c.codice))?.codice ?? classiConcorso[0].codice;
/** Competenza/laboratorio extra del catalogo (tag, non parola libera). */
const materiaProva = materie.find((m) => m.id === 'clil') ?? materie[0];

console.log('— 1. Riepilogo con i dati REALI del profilo —');
const dueProvince = province.slice(0, 2);
const pieno = testo(
  rendi({
    provinceCodici: dueProvince.map((p) => p.codice),
    classiCodici: [classeProva],
    materieId: [materiaProva.id],
    materieCustom: ['contrasto alla dispersione'],
  }),
);
check('titolo del blocco', true, pieno.includes('Cosa fa il tuo Radar, in chiaro'));
check(
  '2 province, con i nomi dal catalogo (non codici)',
  true,
  pieno.includes('2 province') && dueProvince.every((p) => pieno.includes(p.nome)),
);
check(
  '1 classe di concorso con etichetta canonica',
  true,
  pieno.includes('1 classe di concorso') && pieno.includes(etichettaClasseMateria(classeProva)),
);
check(
  'competenze dai tag + parole chiave libere',
  true,
  pieno.includes(materiaProva.nome) && pieno.includes('contrasto alla dispersione'),
);
check(
  'regole di consegna dichiarate (email giornaliera e link ufficiale)',
  true,
  /sola consegna al giorno/.test(pieno) &&
    pieno.includes('solo se ci sono opportunità nuove') &&
    pieno.includes('annuncio ufficiale della scuola'),
);
check(
  `invii per opportunità ancorati al motore (${MAX_INVII_OPPORTUNITA})`,
  true,
  pieno.includes(`al massimo ${MAX_INVII_OPPORTUNITA} volte`),
);

console.log('\n— 2. Plurale, singolare e riepilogo delle liste lunghe —');
const una = testo(rendi({ ...vuota, provinceCodici: [province[0].codice], classiCodici: [classeProva] }));
check('singolare: «1 provincia»', true, /1 provincia\b/.test(una));
check('singolare: «1 classe di concorso»', true, una.includes('1 classe di concorso'));
const cinque = testo(rendi({ ...vuota, provinceCodici: province.slice(0, 5).map((p) => p.codice) }));
check(
  '5 province: solo 4 nomi + «e 1 altra»',
  true,
  cinque.includes('5 province') && cinque.includes('e 1 altra') && !cinque.includes(province[4].nome),
);
const sei = testo(rendi({ ...vuota, provinceCodici: province.slice(0, 6).map((p) => p.codice) }));
check('6 province: «e 2 altre»', true, sei.includes('6 province') && sei.includes('e 2 altre'));

console.log('\n— 3. Profilo incompleto: il blocco lo dice, non sparisce —');
const incompleto = testo(rendi(vuota));
check(
  'spiega quali dati mancano per accendere la ricerca',
  true,
  incompleto.includes('mancano i due dati che accendono la ricerca'),
);
check(
  'le regole di consegna restano visibili',
  true,
  incompleto.includes(`al massimo ${MAX_INVII_OPPORTUNITA} volte`),
);
check('nessuna riga di competenze vuota', false, incompleto.includes('Competenze e parole chiave'));

console.log('\n— 4. Cablaggio: i dati arrivano VIVI dal contenitore —');
/** Sorgenti letti rispetto a questo file: il test vale anche se cambia la cwd. */
const sorgente = (percorso: string) =>
  readFileSync(fileURLToPath(new URL(percorso, import.meta.url)), 'utf8');
const passo = sorgente('../PassoNotifica.tsx');
const wizard = sorgente('../../RadarWizardModal.tsx');
const blocco = sorgente('../components/SezioneTrasparenza.tsx');
check(
  'il Passo 4 monta il blocco nel punto giusto',
  true,
  passo.includes('<SezioneTrasparenza selezione={trasparenza} />'),
);
check(
  'il contenitore passa province, classi, competenze e parole chiave',
  true,
  wizard.includes('trasparenza={{ provinceCodici, classiCodici, materieId, materieCustom }}'),
);
check(
  'etichette dai cataloghi condivisi (province, classi canoniche, materie)',
  true,
  /from '@\/data\/province'/.test(blocco) &&
    blocco.includes('etichettaClasseMateria') &&
    /from '@\/data\/ordiniMaterie'/.test(blocco),
);
check(
  'nessun dato di esempio nel sorgente (città, codici o nomi fissi)',
  false,
  /Torino|Milano|A-22|A-12/.test(blocco),
);

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ TRASPARENZA PASSO 4: dati reali e regole di consegna dichiarate.'
    : `\n❌ ${errori} controllo/i fallito/i.`,
);
