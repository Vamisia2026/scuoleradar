/**
 * ScuoleRadar.it — IL PONTE DISCIPLINARE (modulo PURO, §26.144).
 *
 * Estratto da `lib/cascataGenerosa` il 05/11/2026: la cascata era al tetto delle 250 righe
 * della sua guardia e questo blocco — «di che cosa parlano queste classi?» — è autonomo,
 * verificabile da solo e non conosce né la geografia né la distanza dal profilo.
 *
 * Due risposte, entrambe dichiarate:
 *   · `ponteTolleranza` — la stessa scala del grado affine (82 area comune · 76 ponte
 *     affine · 72 contaminata) applicata anche quando l'avviso non dichiara un ordine
 *     vicino: la semantica non si riscrive, si toglie un requisito che non è merito;
 *   · `incompatibilitaSemantica` — l'unica ragione di scarto di MERITO: serve un tema
 *     riconosciuto da entrambe le parti (due temi noti che non si toccano, «Musica vs
 *     Spagnolo»). Se il catalogo non sa dire di che cosa parlano le classi, non si giudica.
 *
 * Modulo PURO: nessuna rete, nessun `node:*`, nessun orologio.
 */
import { classeByCodice } from '../data/classiConcorso';
import { areeDi, areeInComune, ponteTraAree } from './areeDisciplinari';
import {
  PUNTEGGIO_GRADO_AFFINE_AREA,
  PUNTEGGIO_GRADO_AFFINE_MATERIA,
  PUNTEGGIO_GRADO_AFFINE_PONTE,
} from './gradiAffini';
import {
  normalizzaClassi,
  type AvvisoCompatibilita,
  type ProfiloCompatibilita,
} from './matchingEngine';

/** Denominazione + materie di una classe del catalogo (`[]` = codice sconosciuto). */
export function materieDi(codice: string): string[] {
  const classe = classeByCodice(codice);
  return classe ? [classe.denominazione, ...classe.materie] : [];
}

/** Testo su cui si cercano i temi: titolo, materia e classi dell'avviso. */
export function testoAvviso(avviso: AvvisoCompatibilita): string {
  const classi = (avviso.classi ?? []).flatMap((c) => {
    const proprie = materieDi(c);
    return proprie.length > 0 ? proprie : [c];
  });
  return [avviso.titolo, avviso.materia, ...classi].filter(Boolean).join(' ');
}

/** Testo delle PROPRIE classi (denominazioni + materie del catalogo). */
export const testoClassi = (classi: readonly string[]): string => classi.flatMap(materieDi).join(' ');

/**
 * PONTE DISCIPLINARE senza il vincolo dell'ordine di scuola (`null` = nessun ponte): la stessa
 * scala del grado affine (82 area comune · 76 ponte affine · 72 contaminata) applicata anche
 * quando l'avviso non dichiara un ordine vicino. La semantica non si riscrive: si toglie un
 * requisito che non è merito.
 */
export function ponteTolleranza(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): { punteggio: number; etichetta: string } | null {
  const areeProfilo = areeDi(testoClassi(normalizzaClassi(profilo.classi)));
  const areeAvviso = areeDi(testoAvviso(avviso));
  const comuni = areeInComune(areeProfilo, areeAvviso);
  if (comuni.length > 0) {
    return {
      punteggio: PUNTEGGIO_GRADO_AFFINE_MATERIA,
      etichetta: `tolleranza ampia: stessa area disciplinare (${comuni.join(', ')})`,
    };
  }
  const ponte = ponteTraAree(areeProfilo, areeAvviso);
  if (!ponte) return null;
  return {
    punteggio: ponte.livello === 'affine' ? PUNTEGGIO_GRADO_AFFINE_PONTE : PUNTEGGIO_GRADO_AFFINE_AREA,
    etichetta: `tolleranza ampia: area ${ponte.livello} (${ponte.etichetta})`,
  };
}

/**
 * INCOMPATIBILITÀ SEMANTICA EVIDENTE — l'unica ragione di scarto di merito. Serve un tema
 * riconosciuto da ENTRAMBE le parti: se il catalogo non sa dire di che cosa parlano le classi
 * dell'avviso (o le proprie), non si giudica e la riga resta (buttadentro). Con due temi noti,
 * nessuna area in comune e nessun ponte, l'avviso parla d'altro: è il caso «Musica vs Spagnolo».
 */
export function incompatibilitaSemantica(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): boolean {
  const areeProfilo = areeDi(testoClassi(normalizzaClassi(profilo.classi)));
  const areeAvviso = areeDi(testoAvviso(avviso));
  if (areeProfilo.size === 0 || areeAvviso.size === 0) return false;
  return areeInComune(areeProfilo, areeAvviso).length === 0 && ponteTraAree(areeProfilo, areeAvviso) === null;
}
