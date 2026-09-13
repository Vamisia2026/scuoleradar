/**
 * Verifica la mappatura CLASSE DI CONCORSO → MATERIA ufficiale
 * (`src/data/classiConcorso.ts`: `classeByCodice`, `materiaClasse`,
 * `etichettaClasseMateria`). Copre anche la normalizzazione dei formati
 * (catalogo `A-26` ↔ fonti `A-026`).
 *
 * Uso: npm run test:materia
 */
import {
  classeByCodice,
  etichettaClasseMateria,
  materiaClasse,
} from '../src/data/classiConcorso.ts';
import { variantiClasseCodice } from '../src/lib/matchingEngine.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = atteso === ottenuto;
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— Materia dal dizionario —');
check('A-022 → lingue', 'Lingua inglese, Lingua francese, Lingua spagnola, Lingua tedesca', materiaClasse('A-022'));
check('A-26 → matematica', 'Matematica', materiaClasse('A-26'));
check('A-12 → lettere', 'Italiano, Storia, Geografia, Latino', materiaClasse('A-12'));
check('ADEE → sostegno', 'Sostegno', materiaClasse('ADEE'));
check('AAAA → denominazione', "Scuola dell'infanzia", materiaClasse('AAAA'));
check('codice ignoto → null', null, materiaClasse('Z-999'));

console.log('\n— La materia esplicita dell\'avviso vince sul dizionario —');
check('A-26 + "Fisica"', 'Fisica', materiaClasse('A-26', 'Fisica'));

console.log('\n— Etichetta leggibile: CODICE - Nome materia/classe —');
check('A-41', 'A-41 - Scienze e tecnologie informatiche', etichettaClasseMateria('A-41'));
check('A-026', 'A-026 - Matematica', etichettaClasseMateria('A-026'));
check('A-12', 'A-12 - Discipline letterarie negli istituti di istruzione secondaria di I grado e di II grado', etichettaClasseMateria('A-12'));
check('ADEE', 'ADEE - Sostegno nella scuola primaria', etichettaClasseMateria('ADEE'));
check('AA (ATA)', 'AA - Assistente amministrativo', etichettaClasseMateria('AA'));
check('A-41 + materia avviso', 'A-41 - Scienze e tecnologie informatiche (Informatica)', etichettaClasseMateria('A-41', 'Informatica'));

console.log('\n— Normalizzazione codice (catalogo ↔ fonti) —');
check('classeByCodice(A-026).codice', 'A-26', classeByCodice('A-026')?.codice);
check('classeByCodice(A042).codice', 'A-42', classeByCodice('A042')?.codice);

console.log('\n— Varianti per la query DB (feed non vuoto) —');
check('varianti A-26 ⊇ A-026', true, variantiClasseCodice('A-26').includes('A-026'));
check('varianti A-026 ⊇ A-26', true, variantiClasseCodice('A-026').includes('A-26'));
check('varianti ADEE', 'ADEE', variantiClasseCodice('ADEE').join(','));

console.log(errori === 0 ? '\n✅ MATERIA CLASSE: nessun problema' : `\n❌ MATERIA CLASSE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
