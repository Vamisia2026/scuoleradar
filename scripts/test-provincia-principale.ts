/**
 * Verifica PROVINCIA PRINCIPALE (gerarchia) e sopravvivenza al downgrade.
 *
 * La PRIMA provincia scelta nel wizard è la provincia principale: badge dedicato,
 * ordine persistito (= priorità) e — regola decisiva — sopravvive SEMPRE al
 * troncamento quando il piano torna Base (1 provincia). Nessun downgrade può
 * lasciare attiva una provincia «di contorno».
 *
 * Uso: npm run test:province
 */
import { readFileSync } from 'node:fs';
import {
  eProvinciaPrincipale,
  limitaProvinceMantenendoPrincipale,
  provinciaPrincipale,
  promuoviProvinciaPrincipale,
  provinceDiContorno,
} from '../src/lib/provinceRadar.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (percorso: string): string => readFileSync(percorso, 'utf8');

console.log('— Provincia principale = la prima selezionata —');
check('prima provincia selezionata', 'TO', provinciaPrincipale(['TO', 'MI', 'GE']));
check('selezione vuota: nessuna principale', null, provinciaPrincipale([]));
check('lista assente: nessun crash', null, provinciaPrincipale(undefined));
check('riconoscimento della principale', true, eProvinciaPrincipale(['TO', 'MI'], 'TO'));
check('le altre NON sono principali', false, eProvinciaPrincipale(['TO', 'MI'], 'MI'));
check('province di contorno = tutte tranne la principale', ['MI', 'GE'], provinceDiContorno(['TO', 'MI', 'GE']));

console.log('\n— Promozione a principale —');
check('la provincia scelta va in testa', ['MI', 'TO', 'GE'], promuoviProvinciaPrincipale(['TO', 'MI', 'GE'], 'MI'));
check('idempotente sulla principale', ['TO', 'MI'], promuoviProvinciaPrincipale(['TO', 'MI'], 'TO'));
check('provincia assente: nessun effetto', ['TO', 'MI'], promuoviProvinciaPrincipale(['TO', 'MI'], 'GE'));
check('lista vuota: nessun effetto', [], promuoviProvinciaPrincipale([], 'TO'));

console.log('\n— DOWNGRADE a Base: sopravvive la principale —');
check('tetto 1: resta SOLO la principale', ['TO'], limitaProvinceMantenendoPrincipale(['TO', 'MI', 'GE'], 1));
check(
  'tetto 2: principale + prima di contorno',
  ['TO', 'MI'],
  limitaProvinceMantenendoPrincipale(['TO', 'MI', 'GE'], 2),
);
check('entro il tetto: nessun troncamento', ['TO', 'MI'], limitaProvinceMantenendoPrincipale(['TO', 'MI'], 4));
check('tetto zero: nessuna provincia attiva', [], limitaProvinceMantenendoPrincipale(['TO', 'MI'], 0));
check('lista assente: nessun crash', [], limitaProvinceMantenendoPrincipale(undefined, 2));
check(
  'dopo un riordino la principale resta la promossa',
  ['MI'],
  limitaProvinceMantenendoPrincipale(promuoviProvinciaPrincipale(['TO', 'MI', 'GE'], 'MI'), 1),
);

console.log('\n— Cablaggio: badge, promozione e persistenza —');
const wizard = leggi('src/departments/radar/wizard/PassoProvince.tsx');
const pannello = leggi('src/departments/radar/preferenze/PannelloProvince.tsx');
const pill = leggi('src/departments/radar/components/ProvinciaPill.tsx');
const wizardModal = leggi('src/departments/radar/RadarWizardModal.tsx');
const preferenze = leggi('src/departments/radar/PreferenzeRadar.tsx');
const preferenzeUtente = leggi('src/contexts/app/usePreferenzeUtente.ts');

check('pill: badge «principale» dedicato', true, pill.includes('principale') && pill.includes('Star'));
check('wizard: pill con ruolo principale', true, wizard.includes('principale=') && wizard.includes('onPromuoviPrincipale'));
check('preferenze: pill con ruolo principale', true, pannello.includes('principale=') && pannello.includes('onPromuoviPrincipale'));
check(
  'wizard: il riordino è persistito subito',
  true,
  /const promuoviPrincipale[\s\S]{0,400}persistiSelezione\(\{ provinceCodici: prossime \}\)/.test(wizardModal),
);
check('preferenze: il riordino passa dall’autosave', true, /promuoviProvinciaPrincipale\(prev, codice\)/.test(preferenze));
check(
  'wizard e preferenze NON troncano più la selezione salvata',
  true,
  !wizardModal.includes('limitaProvinceMantenendoPrincipale') &&
    !preferenze.includes('limitaProvinceMantenendoPrincipale'),
);
check(
  'i tetti del piano limitano SOLO l’uso (feed), non cancellano i dati',
  true,
  /limitaSelezione\(preferenze\.provinceCodici, tetti\?\.province/.test(
    leggi('src/contexts/app/useInterpelliFeed.ts'),
  ),
);
check(
  'downgrade: nessun riallineamento distruttivo delle preferenze',
  true,
  !/provinceCodici: province, classiCodici: classi/.test(preferenzeUtente) &&
    /dati conservati/.test(preferenzeUtente),
);
check(
  'province oltre il tetto: visibili e marcate «PRO» (in attesa)',
  true,
  pannello.includes('inAttesa={indice >= maxProvince}') &&
    leggi('src/departments/radar/components/ProvinciaPill.tsx').includes('inAttesa?: boolean'),
);

console.log(errori === 0 ? '\n✅ PROVINCIA PRINCIPALE: nessun problema' : `\n❌ PROVINCIA PRINCIPALE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
