/**
 * Guardia di PERSISTENZA delle preferenze Radar (classi, province, competenze,
 * scuole): una preferenza cambia SOLO per un'azione esplicita dell'utente (o
 * dell'admin), mai per un caricamento, un refresh o un default.
 *
 * Il test esegue le funzioni VERE di `src/lib/preferenzeGuardia.ts` sui casi che
 * in produzione facevano sparire i dati (`[]`/`null` scritti sopra le preferenze):
 *  1. LETTURA — `idrataDaProfilo`: un profilo vuoto non azzera la scelta locale;
 *  2. SCRITTURA — `modificheDaSalvare`: gli altri campi del pannello (mai toccati)
 *     non entrano nel payload, quindi un autosave non può scrivere un default
 *     vuoto sopra una scelta salvata;
 *  3. cablaggio — la schermata registra i campi toccati (`segnaToccato`),
 *     idrata solo quelli NON toccati e non tronca nulla per i tetti del piano.
 *
 * Uso: npm run test:persistenza:preferenze
 */
import { readFileSync } from 'node:fs';
import {
  haContenuto,
  idrataDaProfilo,
  modificheDaSalvare,
} from '../src/lib/preferenzeGuardia.ts';

/** Sottoinsieme delle preferenze gestito dal pannello (campi confrontabili). */
interface PrefFinta {
  ordini: string[];
  classiCodici: string[];
  materieId: string[];
  materieCustom: string[];
  provinceCodici: string[];
  telegramUsername: string;
  telegramChatId: string;
  emailNotifica: string;
  favoriteSchools: string[];
  ignoredSchools: string[];
}

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (percorso: string): string => readFileSync(percorso, 'utf8');

/** Preferenze già salvate (localStorage + riga `profiles`). */
const salvate: PrefFinta = {
  ordini: ['secondaria-2'],
  classiCodici: ['A-18', 'A-22'],
  materieId: ['ai-didattica'],
  materieCustom: ['robotica educativa'],
  provinceCodici: ['TO', 'MI'],
  telegramUsername: 'docente',
  telegramChatId: '123456',
  emailNotifica: 'docente@scuola.it',
  favoriteSchools: ['IIS Volta'],
  ignoredSchools: [],
};

console.log("— 1. Refresh / primo avvio: nessun campo toccato ⇒ nessuna scrittura —");
// Pagina appena aperta: i campi locali sono ai default, il profilo deve ancora
// arrivare. Confrontare questi valori con quelli salvati NON deve salvare nulla.
const localiVuoti: PrefFinta = {
  ...salvate,
  ordini: [],
  classiCodici: [],
  materieId: [],
  materieCustom: [],
  provinceCodici: [],
  favoriteSchools: [],
};
check('toccati vuoti ⇒ payload vuoto', [], Object.keys(modificheDaSalvare<PrefFinta>(new Set(), localiVuoti, salvate)));
check('i dati salvati restano intatti', ['TO', 'MI'], salvate.provinceCodici);
check(
  'i campi mai toccati restano fuori anche se il locale è vuoto',
  [],
  Object.keys(modificheDaSalvare<PrefFinta>(new Set(), localiVuoti, salvate)),
);

console.log("\n— 2. Azione esplicita: si salva (solo) il campo toccato —");
const conClasseInPiu: PrefFinta = { ...salvate, classiCodici: ['A-18', 'A-22', 'B-10'] };
const soloClassi = modificheDaSalvare<PrefFinta>(new Set(['classiCodici']), conClasseInPiu, salvate);
check('un solo campo nel payload', ['classiCodici'], Object.keys(soloClassi));
check('con il valore nuovo', ['A-18', 'A-22', 'B-10'], soloClassi.classiCodici);
check(
  'gli altri campi restano fuori dal payload',
  undefined,
  (soloClassi as Partial<PrefFinta>).provinceCodici,
);
check(
  'una provincia aggiunta a mano si salva',
  ['TO', 'MI', 'GE'],
  modificheDaSalvare<PrefFinta>(new Set(['provinceCodici']), { ...salvate, provinceCodici: ['TO', 'MI', 'GE'] }, salvate)
    .provinceCodici,
);

console.log("\n— 3. Campo toccato ma identico ⇒ nessun salvataggio (niente ciclo) —");
// Dopo un salvataggio il contesto coincide con i campi locali: l'autosave che
// segue non deve ripartire (era il ciclo che riscriveva le preferenze).
const dopoSave: PrefFinta = { ...conClasseInPiu };
check('nessuna differenza ⇒ payload vuoto', [], Object.keys(modificheDaSalvare<PrefFinta>(new Set(['classiCodici']), dopoSave, dopoSave)));
check('stringhe identiche ⇒ payload vuoto', [], Object.keys(modificheDaSalvare<PrefFinta>(new Set(['emailNotifica']), salvate, { ...salvate })));

console.log("\n— 4. Azzeramento VOLUTO: l'utente svuota, e si salva —");
check(
  'province svuotate a mano ⇒ si salva il vuoto',
  ['provinceCodici'],
  Object.keys(modificheDaSalvare<PrefFinta>(new Set(['provinceCodici']), { ...salvate, provinceCodici: [] }, salvate)),
);
check(
  'tag svuotati a mano ⇒ si salva il vuoto',
  ['materieCustom'],
  Object.keys(modificheDaSalvare<PrefFinta>(new Set(['materieCustom']), { ...salvate, materieCustom: [] }, salvate)),
);

console.log('\n— 5. Robustezza del payload —');
check(
  'campo toccato ma assente nel locale ⇒ ignorato',
  [],
  Object.keys(modificheDaSalvare<PrefFinta>(new Set(['campoInesistente']), salvate, salvate)),
);
check(
  'ordine identico dei codici ⇒ nessuna differenza',
  [],
  Object.keys(modificheDaSalvare<PrefFinta>(new Set(['classiCodici']), { ...salvate, classiCodici: ['A-18', 'A-22'] }, salvate)),
);

console.log('\n— 6. LATO LETTURA: il profilo idrata, non svuota —');
check('DB vuoto ⇒ resta il valore locale', ['A-18', 'A-22'], idrataDaProfilo([], salvate.classiCodici));
check('DB null ⇒ resta il valore locale', ['TO', 'MI'], idrataDaProfilo(null, salvate.provinceCodici));
check('DB assente ⇒ resta il valore locale', ['TO'], idrataDaProfilo(undefined, ['TO']));
check('DB con valori ⇒ vince il DB', ['MI'], idrataDaProfilo(['MI'], ['TO']));
const arrayDalDb = ['MI'];
check('valore dal DB ⇒ copia, non riferimento condiviso', false, idrataDaProfilo(arrayDalDb, ['TO']) === arrayDalDb);
const arrayLocale = ['TO'];
check('DB vuoto ⇒ il valore locale resta quello già in memoria', true, idrataDaProfilo([], arrayLocale) === arrayLocale);
check('stringa di soli spazi non è contenuto', false, haContenuto('   '));
check('array vuoto non è contenuto', false, haContenuto([]));
check('stringa vera è contenuto', true, haContenuto('docente'));

console.log('\n— 7. Cablaggio di PreferenzeRadar: tocco esplicito, idratazione selettiva —');
const schermata = leggi('src/departments/radar/PreferenzeRadar.tsx');
const CAMPI = [
  'ordini',
  'classiCodici',
  'materieId',
  'materieCustom',
  'provinceCodici',
  'telegramUsername',
  'telegramChatId',
  'emailNotifica',
  'favoriteSchools',
  'ignoredSchools',
];
check(
  "autosave: le modifiche escono dalla guardia (solo campi toccati)",
  true,
  /modificheDaSalvare<Preferenze>\(toccatiRef\.current, locale, preferenze\)/.test(schermata),
);
check(
  "autosave: niente scrittura quando non c'è nulla da salvare",
  true,
  /Object\.keys\(modifiche\)\.length === 0\) return;/.test(schermata),
);
check(
  'idratazione: ogni campo è saltato se già toccato',
  true,
  CAMPI.every((campo) => schermata.includes(`!toccati.has('${campo}')`)),
);
check(
  'ogni handler registra il campo che modifica',
  true,
  CAMPI.every((campo) => schermata.includes(`segnaToccato('${campo}')`)),
);
check(
  'il resto del payload sono le preferenze reali del contesto',
  true,
  /\.\.\.preferenze,[\s\S]{0,40}\.\.\.modifiche,/.test(schermata),
);
check(
  'niente più scrittura dedotta confrontando fotografie diverse',
  false,
  /payloadSalvataggio|campiToccati|fondiCampiToccati|idratateRef|toccatoDallUtente/.test(schermata),
);
check('nessun troncamento automatico di classi/province', false, /slice\(0, max(?:Province|ClassiConcorso)\)/.test(schermata));
check(
  'i campi di testo sono confrontati dopo il trim',
  true,
  /telegramUsername: \(f\.telegramUsername \?\? ''\)\.trim\(\)/.test(schermata) &&
    /classiCodici: normalizzaClassi\(f\.classiCodici\)/.test(schermata),
);
check(
  'canali di notifica: anche le tendine passano dagli handler che marcano',
  true,
  /setTelegramUsername=\{cambiaTelegramUsername\}/.test(schermata) &&
    /setEmailNotifica=\{cambiaEmailNotifica\}/.test(schermata),
);
check(
  'apertura/chiusura degli accordion non marca alcun campo',
  true,
  !/setAccordionAperti\([\s\S]{0,200}segnaToccato/.test(schermata),
);

console.log('\n— 8. Bootstrap: la lettura del profilo non azzera nulla —');
const bootstrap = leggi('src/contexts/app/useProfileBootstrap.ts');
const COLONNE = [
  'ordini_scuola',
  'province_interesse',
  'classi_concorso',
  'materie_id',
  'materie_custom',
  'favorite_schools',
  'ignored_schools',
];
check(
  'ogni colonna del profilo passa dalla guardia (`idrataDaProfilo`)',
  true,
  COLONNE.every((colonna) => new RegExp(`idrataDaProfilo\\([\\s\\S]{0,120}${colonna}`).test(bootstrap)),
);
check(
  'nessun `length > 0` scritto a mano al posto della guardia',
  false,
  /length > 0 \?[^;\n]*: prev\./.test(bootstrap),
);

console.log(errori === 0 ? '\n✅ PERSISTENZA PREFERENZE: nessun problema' : `\n❌ PERSISTENZA PREFERENZE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
