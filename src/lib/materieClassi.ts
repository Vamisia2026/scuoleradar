/**
 * ScuoleRadar.it — MATERIE coperte dalle classi di concorso del profilo (PURO).
 *
 * Il catalogo delle classi di concorso (`src/data/classiConcorso.ts`) dichiara,
 * per ogni codice, le MATERIE che quella abilitazione copre (`materie: ['italiano',
 * 'latino', …]`, id del catalogo `src/data/ordiniMaterie.ts`). Le superfici però
 * mostravano le classi come codici nudi ("A-22 · Filosofia e scienze umane") e mai
 * le discipline che ne derivano.
 *
 * Questa derivazione — UNA sola, condivisa — risolve i codici nel NOME della
 * materia, nell'ordine delle classi scelte e senza duplicati. La usano la scheda
 * utente dell'Admin (`departments/admin/components/derivaPreferenzeUtente.ts`) e
 * il riepilogo della vista utente
 * (`departments/radar/components/RiepilogoLavoro.tsx`): così le due superfici
 * mostrano la stessa lista per lo stesso profilo.
 *
 * Il formato dei codici è tollerante come ovunque nell'app
 * (`normalizzaClasse`: `A-018` ≡ `A18` ≡ `a 18` → `A-18`). Un codice fuori
 * catalogo non inventa materie: resta codice, senza riga "Materie".
 */
import { classiConcorso } from '../data/classiConcorso';
import { materie as catalogoMaterie } from '../data/ordiniMaterie';
import { normalizzaClasse } from './matchingEngine';

/**
 * Nomi leggibili delle materie coperte dalle classi di concorso indicate.
 * Lista vuota se nessuna classe è scelta (o se nessuna è nel catalogo).
 */
export function materieDelleClassi(codici?: readonly (string | null | undefined)[] | null): string[] {
  const nomi: string[] = [];
  for (const codice of codici ?? []) {
    const canonico = normalizzaClasse(codice);
    if (!canonico) continue;
    const classe = classiConcorso.find((c) => c.codice === canonico);
    for (const id of classe?.materie ?? []) {
      const nome = catalogoMaterie.find((m) => m.id === id)?.nome ?? id;
      if (nome && !nomi.includes(nome)) nomi.push(nome);
    }
  }
  return nomi;
}
