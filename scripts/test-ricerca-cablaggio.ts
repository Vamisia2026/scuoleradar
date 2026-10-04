/**
 * Verifica CABLAGGIO della ricerca unificata (guardie STATICHE sui sorgenti).
 *
 * Un solo motore e un solo componente condivisi da wizard e Preferenze; colonna
 * di SINISTRA = classi di concorso, colonna di DESTRA = competenze e parole
 * chiave (nessun elenco fisso di materie, nessun campo di ricerca duplicato);
 * le parole chiave multiple si dividono sulla virgola. Le verifiche FUNZIONALI
 * del motore stanno in `test-ricerca-unificata.ts`.
 *
 * Uso: npm run test:ricerca
 */
import { readFileSync } from 'node:fs';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (percorso: string): string => readFileSync(percorso, 'utf8');

console.log('— Cablaggio: un solo campo per entrambe le colonne —');
const wizard = leggi('src/departments/radar/wizard/PassoClassiMaterie.tsx');
const wizardClassi = leggi('src/departments/radar/wizard/components/SezioneClassiConcorso.tsx');
const wizardCompetenze = leggi('src/departments/radar/wizard/components/SezioneCompetenzeExtra.tsx');
const pannelloMaterie = leggi('src/departments/radar/preferenze/PannelloMaterie.tsx');
const componenteRicerca = leggi('src/departments/radar/components/RicercaSelezioni.tsx');
const preferenze = leggi('src/departments/radar/PreferenzeRadar.tsx');

check('wizard: campo unico di ricerca unificata', true, wizard.includes('<RicercaSelezioni'));
check(
  'wizard: la colonna CLASSI non ha campi di ricerca propri (resta il campo unificato)',
  true,
  !/<input/.test(wizardClassi),
);
check(
  'wizard: la colonna COMPETENZE ha UN solo campo, la parola chiave libera',
  true,
  (wizardCompetenze.match(/<input/g) ?? []).length === 1 &&
    !wizardCompetenze.includes('<RicercaSelezioni') &&
    /aggiungiParolaChiave/.test(wizardCompetenze),
);
check(
  'wizard: campo parola chiave accessibile (aria-label) e svuotato dopo l’aggiunta',
  true,
  wizardCompetenze.includes('aria-label="Cerca o aggiungi una parola chiave"') &&
    /setParolaChiave\(''\)/.test(wizardCompetenze),
);
check(
  'wizard: nessuna <select> né elenco statico di materie',
  true,
  !wizardClassi.includes('<select') && !wizardCompetenze.includes('<select'),
);
check(
  'Preferenze «In cosa puoi lavorare»: NIENTE elenco fisso di materie',
  true,
  !pannelloMaterie.includes('materieCompetenzeExtra') && pannelloMaterie.includes('<RicercaSelezioni'),
);
check(
  'stesso motore + stesso componente nelle due superfici',
  true,
  componenteRicerca.includes('ricercaSelezioniRadar') &&
    wizard.includes('<RicercaSelezioni') &&
    pannelloMaterie.includes('<RicercaSelezioni'),
);
check(
  'Preferenze: la colonna di DESTRA usa la ricerca di competenze/parole chiave',
  true,
  preferenze.includes('cercaCompetenzeParole'),
);
check(
  'Preferenze: la colonna di SINISTRA filtra le CLASSI con la regola condivisa',
  true,
  preferenze.includes('classeCorrispondeAQuery'),
);
check(
  'parola chiave: aggiunta sia dal wizard sia dalle Preferenze',
  true,
  /aggiungiParolaChiave/.test(leggi('src/departments/radar/RadarWizardModal.tsx')) &&
    /aggiungiParolaChiave/.test(preferenze),
);
check(
  'parola chiave: i container dividono le voci sulla virgola',
  true,
  /separaParoleChiave/.test(leggi('src/departments/radar/RadarWizardModal.tsx')) &&
    /separaParoleChiave/.test(preferenze),
);
check(
  'la UI propone tutte le voci separate da virgola',
  true,
  /onParolaChiave\(paroleChiave\.join\(', '\)\)/.test(leggi('src/departments/radar/components/RicercaSelezioni.tsx')),
);

console.log('\n— Filtro CLASSI: una sola regola di normalizzazione in ogni superficie —');
const SUPERFICI_CLASSI = ['src/departments/radar/PreferenzeRadar.tsx', 'src/pages/onboarding/OnboardingPage.tsx'];
check('il filtro classi usa la regola condivisa `classeCorrispondeAQuery`', [], SUPERFICI_CLASSI.filter((p) => !/classeCorrispondeAQuery\(c, queryClasse\)/.test(leggi(p))));
check('nessun confronto "fai-da-te" sul codice di classe', [], SUPERFICI_CLASSI.filter((p) => /c\.codice\.toLowerCase\(\)\.includes/.test(leggi(p))));
check('la regola vive una volta sola (motore di ricerca condiviso)', true, /export function classeCorrispondeAQuery/.test(leggi('src/lib/ricercaSelezioniRadar.ts')));
check('il confronto testuale è definito UNA volta (`ricercaTesto.ts`)', true, /export function classeCorrispondeAQuery/.test(leggi('src/lib/ricercaSelezioniRadar.ts')) && /export function ordineRisponde/.test(leggi('src/lib/ricercaTesto.ts')));

console.log(errori === 0 ? '\n✅ RICERCA — CABLAGGIO: nessun problema' : `\n❌ RICERCA — CABLAGGIO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
