/**
 * Test — ANAGRAFICA NAZIONALE DELLE SCUOLE (`lib/anagraficaScuole.ts`).
 *
 * Guardia del modulo che risolve nome/codice/PEO/PEC dell'istituto dai file
 * SCUANAGRAFE del Ministero (statali, paritarie, autonomie). Verifica:
 *   1. PARSER CSV (RFC4180): campi quotati, `""` dentro il campo, a capo nei valori;
 *   2. INDICE: ricerca per prefisso dei file, voce ignorata se estranea, `Non
 *      Disponibile` → `null`, provincia risolta in codice, sede e istituto di
 *      riferimento indicizzati entrambi;
 *   3. LOOKUP: per codice (sede o istituto) e per NOME — mai un'ipotesi su un nome
 *      ambiguo (senza provincia), risolto solo se resta UNA scuola;
 *   4. ARRICCHIMENTO: riempe codice/nome/PEO/PEC **solo se mancanti**, risolve il
 *      codice dal titolo, e lascia la riga intatta se la scuola non è in anagrafica;
 *   5. SMOKE sui file reali (quando presenti): conteggi e un codice noto.
 *
 * Uso: npm run test:anagrafica (incluso in `npm test`)
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import {
  arricchisciDaAnagrafica,
  caricaAnagrafica,
  fileAnagrafici,
  nomeDaAnagrafica,
  normalizzaNomeScuola,
  parseCsv,
  scuolaDaCodice,
  scuolaDaNome,
} from '../src/lib/anagraficaScuole.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Costruisce una riga CSV valida (virgolette solo dove servono). */
function rigaCsv(campi: Array<string | null>): string {
  return campi
    .map((campo) => {
      const valore = campo ?? '';
      return /[",\n]/.test(valore) ? `"${valore.replace(/"/g, '""')}"` : valore;
    })
    .join(',');
}

const INTESTAZIONE_STAT = [
  'ANNOSCOLASTICO', 'AREAGEOGRAFICA', 'REGIONE', 'PROVINCIA',
  'CODICEISTITUTORIFERIMENTO', 'DENOMINAZIONEISTITUTORIFERIMENTO', 'CODICESCUOLA',
  'DENOMINAZIONESCUOLA', 'INDIRIZZOSCUOLA', 'CAPSCUOLA', 'CODICECOMUNESCUOLA',
  'DESCRIZIONECOMUNE', 'DESCRIZIONECARATTERISTICASCUOLA',
  'DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA', 'INDICAZIONESEDEDIRETTIVO',
  'INDICAZIONESEDEOMNICOMPRENSIVO', 'INDIRIZZOEMAILSCUOLA', 'INDIRIZZOPECSCUOLA',
  'SITOWEBSCUOLA', 'SEDESCOLASTICA',
].join(',');

const INTESTAZIONE_PAR = [
  'ANNOSCOLASTICO', 'AREAGEOGRAFICA', 'REGIONE', 'PROVINCIA', 'CODICESCUOLA',
  'DENOMINAZIONESCUOLA', 'INDIRIZZOSCUOLA', 'CAPSCUOLA', 'CODICECOMUNESCUOLA',
  'DESCRIZIONECOMUNE', 'DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA',
  'INDIRIZZOEMAILSCUOLA', 'INDIRIZZOPECSCUOLA', 'SITOWEBSCUOLA',
].join(',');

const RIGHE_STAT = [
  // Istituto con plesso: il nome da mostrare è la denominazione dell'ISTITUTO.
  ['202627', 'NORD OVEST', 'LOMBARDIA', 'MONZA E BRIANZA', 'MBIC80500A', 'I.C. "S. ANDREA"', 'MBAA80501B', 'M.MONTESSORI', 'VIA ROMA 1', '20000', 'A123', 'MONZA', 'NORMALE', 'SCUOLA INFANZIA', 'NO', 'Non Disponibile', 'MBIC80500A@istruzione.it', 'MBIC80500A@pec.istruzione.it', 'www.ic.it', 'SI'],
  // PEC assente → null.
  ['202627', 'NORD OVEST', 'PIEMONTE', 'TORINO', 'TOIC84700B', 'I.C. Ferruccio Ulivi', 'TOEE84702C', 'PRIMARIA ULIVI', 'VIA TASSONI 5', '10100', 'B234', 'TORINO', 'NORMALE', 'SCUOLA PRIMARIA', 'NO', 'Non Disponibile', 'TOIC84700B@istruzione.it', 'Non Disponibile', 'www.ulivi.it', 'SI'],
  // Comune con virgola (test del parser) e nome con virgolette.
  ['202627', 'SUD', 'SICILIA', 'ENNA', 'ENIC80600C', 'I.C. "E. PANTANO"', 'ENAA80601D', 'M.MONTESSORI', 'VIA P. TOGLIATTI, 198', '94010', 'A478', 'ASSORO', 'NORMALE', 'SCUOLA INFANZIA', 'NO', 'Non Disponibile', 'ENIC80600C@istruzione.it', 'Non Disponibile', 'www.assoro.edu.it', 'SI'],
  // NOME AMBIGUO: due istituti omonimi in province diverse (Milano / Cuneo).
  ['202627', 'NORD OVEST', 'LOMBARDIA', 'MILANO', 'MIIC11100D', 'I.C. Manzoni', 'MIAA11101E', 'MANZONI INFANZIA', 'VIA MANZONI 1', '20100', 'F205', 'MILANO', 'NORMALE', 'SCUOLA INFANZIA', 'NO', 'Non Disponibile', 'MIIC11100D@istruzione.it', 'Non Disponibile', 'Non Disponibile', 'SI'],
  ['202627', 'NORD OVEST', 'PIEMONTE', 'CUNEO', 'CNIC22200F', 'I.C. Manzoni', 'CNAA22201G', 'MANZONI INFANZIA', 'VIA MANZONI 2', '12100', 'H727', 'CUNEO', 'NORMALE', 'SCUOLA INFANZIA', 'NO', 'Non Disponibile', 'CNIC22200F@istruzione.it', 'Non Disponibile', 'Non Disponibile', 'SI'],
  // Denominazione SENZA sigla: l'avviso scrive «I.C. Daniele Manin», l'anagrafica «Daniele Manin».
  ['202627', 'NORD OVEST', 'LIGURIA', 'GENOVA', 'GEIC85000H', 'Daniele Manin', 'GEAA85001L', 'MANIN INFANZIA', 'VIA MANIN 3', '16100', 'D969', 'GENOVA', 'NORMALE', 'SCUOLA INFANZIA', 'NO', 'Non Disponibile', 'GEIC85000H@istruzione.it', 'GEIC85000H@pec.istruzione.it', 'Non Disponibile', 'SI'],
].map(rigaCsv);

const RIGHE_PAR = [
  ['202627', 'NORD EST', 'FRIULI-VENEZIA G.', 'UDINE', 'UD1A036009', 'SCUOLA INFANZIA PARITARIA IMMACOLATA', 'VIA L. SCROSOPPI 17', '33100', 'L483', 'UDINE', 'SCUOLA INFANZIA NON STATALE', 'sc.infanziaimmacolata.ud@gmail.com', 'MATERNA@PEC.NET', 'www.rosamisticaonlus.com'],
].map(rigaCsv);

const cartella = mkdtempSync(join(tmpdir(), 'sr-anagrafica-'));
writeFileSync(join(cartella, 'SCUANAGRAFESTAT20262720260901.csv'), [INTESTAZIONE_STAT, ...RIGHE_STAT].join('\n'), 'utf8');
writeFileSync(join(cartella, 'SCUANAGRAFEPAR20262720260901.csv'), [INTESTAZIONE_PAR, ...RIGHE_PAR].join('\n'), 'utf8');
writeFileSync(join(cartella, 'ALTROFILE2026.csv'), 'a,b\n1,2\n', 'utf8');
writeFileSync(join(cartella, 'SCUANAGRAFESTAT.txt'), 'non un csv\n', 'utf8');

console.log('— 1. Parser CSV (RFC4180) —');
check('campi quotati: virgola e virgolette doppie', [['a', 'b'], ['x,y', 'z"w']], parseCsv('a,b\n"x,y","z""w"\n'));
check('a capo dentro un campo quotato', [['a'], ['riga1\nriga2']], parseCsv('a\n"riga1\nriga2"\n'));
check('righe vuote scartate', [['a', 'b']], parseCsv('\na,b\n\n'));
check('CRLF accettato', [['a', 'b'], ['c', 'd']], parseCsv('a,b\r\nc,d\r\n'));
check('normalizzazione del nome (accenti/punteggiatura)', 'ICFERRUCCIOULIVI', normalizzaNomeScuola('I.C. Ferruccio Ulivi'));

console.log('\n— 2. Indice: file per prefisso, conteggi, provincia, PEC assente —');
const indice = caricaAnagrafica({ cartella, refresh: true });
check('solo file anagrafici .csv (prefisso SCUANAGRAFE)', 2, fileAnagrafici(cartella).length);
check('anagrafica disponibile', true, indice.disponibile);
check('codici indicizzati (6 statali + 1 paritaria)', 7, indice.totale);
check(
  'file letti con i loro conteggi',
  [['SCUANAGRAFEPAR20262720260901.csv', 1], ['SCUANAGRAFESTAT20262720260901.csv', 6]],
  indice.fileLetti.map((f) => [f.file, f.righe]),
);
check('PEC «Non Disponibile» → null', null, scuolaDaCodice(indice, 'TOIC84700B')?.pec ?? null);
check('PEO letta dal file', 'mbic80500a@istruzione.it', scuolaDaCodice(indice, 'MBIC80500A')?.email);
check('provincia risolta in codice', 'MB', scuolaDaCodice(indice, 'MBIC80500A')?.provinciaCodice);
check('paritaria riconosciuta dal nome del file', true, scuolaDaCodice(indice, 'UD1A036009')?.paritaria);
check(
  'codice PARITARIA (non statale) indicizzato e cercabile in minuscolo',
  'SCUOLA INFANZIA PARITARIA IMMACOLATA',
  scuolaDaCodice(indice, 'ud1a036009')?.nome,
);
check('colonne allineate nonostante una virgola dentro le virgolette', ['ASSORO', 'SCUOLA INFANZIA'], [
  scuolaDaCodice(indice, 'ENIC80600C')?.comune,
  scuolaDaCodice(indice, 'ENIC80600C')?.tipo,
]);

console.log('\n— 3. Lookup: sede, istituto di riferimento, nome —');
check('codice di ISTITUTO → sede rappresentativa', 'MBAA80501B', scuolaDaCodice(indice, 'MBIC80500A')?.codice);
check('codice di plesso → la sua riga', 'M.MONTESSORI', scuolaDaCodice(indice, 'MBAA80501B')?.nome);
check('nome univoco → scuola (codice della sede)', 'TOEE84702C', scuolaDaNome(indice, 'I.C. Ferruccio Ulivi')?.codice);
check('nome ambiguo SENZA provincia → null (mai indovinare)', null, scuolaDaNome(indice, 'I.C. Manzoni'));
check('nome ambiguo CON provincia → la scuola giusta', 'MIAA11101E', scuolaDaNome(indice, 'I.C. Manzoni', 'MI')?.codice);
check('nome troppo corto → null', null, scuolaDaNome(indice, 'IC'));
check(
  'sigla davanti al nome → l’anagrafica registra la sola denominazione',
  'GEAA85001L',
  scuolaDaNome(indice, 'I.C. Daniele Manin', 'GE')?.codice,
);
check('nome da mostrare = denominazione dell’ISTITUTO', 'I.C. Ferruccio Ulivi', nomeDaAnagrafica(scuolaDaCodice(indice, 'TOIC84700B')!));
check('plesso con nome non presentabile → si usa l’istituto', 'I.C. "S. ANDREA"', nomeDaAnagrafica(scuolaDaCodice(indice, 'MBAA80501B')!));

console.log('\n— 4. Arricchimento: solo campi mancanti, mai sovrascritture —');
const daTitolo = arricchisciDaAnagrafica(indice, { title: 'Interpello supplenza — codice MBIC80500A', province: 'MB' });
check('via: codice estratto dal TITOLO', 'codice', daTitolo.via);
check(
  'patch completa (nome, codice, PEO, PEC)',
  ['I.C. "S. ANDREA"', 'MBIC80500A', 'mbic80500a@istruzione.it', 'mbic80500a@pec.istruzione.it'],
  [daTitolo.patch.school_name, daTitolo.patch.school_code, daTitolo.patch.contact_email, daTitolo.patch.school_pec],
);
const daNome = arricchisciDaAnagrafica(indice, { school_name: 'I.C. Ferruccio Ulivi', province: 'TO' });
check(
  'via: NOME univoco → recupera codice e recapito',
  ['nome', 'TOEE84702C', 'toic84700b@istruzione.it'],
  [daNome.via, daNome.patch.school_code, daNome.patch.contact_email],
);
check('PEC assente in anagrafica → nessuna PEC scritta', undefined, daNome.patch.school_pec);
const datiPieni = arricchisciDaAnagrafica(indice, {
  school_code: 'MBIC80500A',
  school_name: 'I.C. "S. ANDREA"',
  contact_email: 'segreteria@scuola.it',
  school_pec: 'pec@scuola.it',
  province: 'MB',
});
check('dati già presenti: NESSUNA sovrascrittura', {}, datiPieni.patch);
const ambiguo = arricchisciDaAnagrafica(indice, { school_name: 'I.C. Manzoni', province: null });
check('nome ambiguo → nessun arricchimento', ['nessuna', {}], [ambiguo.via, ambiguo.patch]);
const sconosciuto = arricchisciDaAnagrafica(indice, { school_code: 'ZZIC99999Z', province: 'ZZ' });
check('codice sconosciuto → nessun arricchimento', ['nessuna', {}], [sconosciuto.via, sconosciuto.patch]);
check(
  'anagrafica non disponibile → patch vuota (nessun crash)',
  {},
  arricchisciDaAnagrafica(
    { perCodice: new Map(), perIstituto: new Map(), perNome: new Map(), totale: 0, fileLetti: [], disponibile: false },
    { school_code: 'MBIC80500A' },
  ).patch,
);

console.log('\n— 5. Smoke sui file REALI (se presenti) —');
const reale = caricaAnagrafica();
if (reale.disponibile) {
  console.log(`  · file: ${reale.fileLetti.map((f) => `${f.file}=${f.righe}`).join(', ')}`);
  console.log(`  · codici meccanografici indicizzati: ${reale.totale}`);
  check('anagrafica reale: ci sono codici indicizzati', true, reale.totale >= 100);
  const esempio = scuolaDaCodice(reale, 'BSIS02900X');
  console.log(
    `  · esempio BSIS02900X → ${esempio ? `${esempio.nome} (${esempio.provinciaNome ?? 'n/d'})` : 'non presente in questa edizione'}`,
  );
} else {
  console.log('  ℹ file SCUANAGRAFE non trovati: smoke saltato (imposta SCUOLERADAR_ANAGRAFICA_DIR).');
}

rmSync(cartella, { recursive: true, force: true });
console.log(errori === 0 ? '\n✅ ANAGRAFICA SCUOLE: nessun problema' : `\n❌ ANAGRAFICA SCUOLE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
