/**
 * ScuoleRadar.it — MODALITÀ 2 «Classi di concorso», modulo PURO.
 *
 * La classe della propria lista non è l'unico modo di essere «giusti»: la modale
 * misura QUANTO la classe dell'avviso è vicina a quelle dell'utente.
 *
 *   · classe SELEZIONATA (fino a 4 per PRO)     → 100%
 *   · classe AFFINE (condividono una materia
 *     del catalogo: A-22 ↔ A-24)                → 95%
 *   · avviso senza codice, ma con la materia
 *     coperta dalle PROPRIE classi              → 90%  (match probabile)
 *   · STESSA AREA disciplinare                  → 85%  (−15)
 *   · AREA AFFINE (ponte curato)                → 75%  (−25)
 *   · area contaminata (es. Letteratura ↔ Teatro)→ 65%  (−35)
 *   · classe ESTRANEA alle proprie discipline   → 55%  (−45)
 *
 * «Penalità crescente in base alla distanza disciplinare»: i quattro gradini
 * finali sono le distanze misurate dalla matrice di `areeDisciplinari.ts`, mai un
 * giudizio a caso. `null` = modale non applicabile (nessuna classe nel profilo):
 * non entra nella media.
 *
 * LIVELLO PRIMARIO (§26.63). Questa è l'unica modale di CLASSE e non legge le
 * competenze del profilo (`profiles.materie_id`/`materie_custom`): quelle sono il
 * livello SECONDARIO, sfumano il punteggio di al massimo `CAP_COMPETENZE` punti
 * (`punteggioCompetenze.ts`) e non possono da sole promuovere una classe «estranea»
 * o aprire la bacheca.
 */
import { classeByCodice } from '../data/classiConcorso';
import { areeDi, areeInComune, ponteTraAree } from './areeDisciplinari';
import { materiaCompatibileConClassi, normalizzaClassi } from './matchingEngine';

/** Classe di concorso dell'utente presente nell'avviso. */
export const PUNTEGGIO_CLASSE_ESATTA = 100;
/** Ponte esplicito fra classi (una materia del catalogo in comune). */
export const PUNTEGGIO_CLASSE_AFFINE = 95;
/** Avviso senza codice classe, ma con la materia coperta dalle proprie classi. */
export const PUNTEGGIO_CLASSE_PROBABILE = 90;
/** Penalità (punti %) delle due classi nella STESSA area disciplinare. */
export const PENALITA_CLASSE_STESSA_AREA = 15;
/** Penalità (punti %) di aree che si toccano («Digitale ↔ IA»). */
export const PENALITA_CLASSE_PONTE_AFFINE = 25;
/** Penalità (punti %) di aree contaminate («Letteratura ↔ Teatro»). */
export const PENALITA_CLASSE_PONTE_CONTAMINATA = 35;
/** Penalità (punti %) di una classe senza alcun rapporto disciplinare. */
export const PENALITA_CLASSE_ESTRANEA = 45;

/**
 * Profilo minimo per la modale PRIMARIA: SOLO le classi di concorso dell'utente.
 * Le competenze dichiarate (`profiles.materie_id`/`materie_custom`) vivono nel livello
 * secondario (`punteggioCompetenze.ts`) e non possono alterare questo voto (§26.63):
 * non sono qui apposta, così ogni uso improprio è un errore di compilazione.
 */
export interface ProfiloClasse {
  classi?: readonly string[] | null;
}

/** Avviso minimo per la modale (struttura compatibile con `AvvisoCompatibilita`). */
export interface AvvisoClasse {
  classi?: readonly string[] | null;
  materia?: string | null;
  titolo?: string | null;
}

/** Esito della modale: punteggio + motivo leggibile per il tooltip della card. */
export interface EsitoClasse {
  punteggio: number;
  motivo: string;
}

/** `A-22 · Lingue e civiltà straniere` (codice + denominazione ufficiale). */
export function etichettaClasse(codice?: string | null): string {
  const c = (codice ?? '').trim();
  if (!c) return 'classe non indicata';
  const classe = classeByCodice(c);
  return classe ? `${c} · ${classe.denominazione}` : c;
}

/** Materie (id del catalogo) coperte da una classe di concorso. */
function materieDi(codice: string): string[] {
  return classeByCodice(codice)?.materie ?? [];
}

/** Materie in comune fra due classi (id, ordinati): prova dell'affinità. */
export function materieInComune(a?: string | null, b?: string | null): string[] {
  const ma = new Set(materieDi((a ?? '').trim()));
  return [...new Set(materieDi((b ?? '').trim()))].filter((m) => ma.has(m)).sort();
}

/** Testo descrittivo di un insieme di classi (denominazione + materie). */
function testoClassi(classi: readonly string[]): string {
  return classi
    .flatMap((codice) => {
      const classe = classeByCodice(codice);
      return classe ? [classe.denominazione, ...classe.materie] : [];
    })
    .join(' | ');
}

/**
 * Punteggio della modale PRIMARIA «Classi di concorso» (Modalità 2) o `null` se il
 * profilo non ha classi. Ordine dei giudizi, tutti derivati dalle CLASSI dell'utente:
 * esatta → affine → materia coperta → distanza disciplinare (stessa area → ponte → estranea).
 */
export function punteggioClasse(
  profilo: ProfiloClasse,
  avviso: AvvisoClasse,
): EsitoClasse | null {
  const classiProfilo = normalizzaClassi(profilo.classi);
  if (classiProfilo.length === 0) return null;

  const classiAvviso = normalizzaClassi(avviso.classi);
  const uguale = classiAvviso.find((c) => classiProfilo.includes(c));
  if (uguale) {
    return {
      punteggio: PUNTEGGIO_CLASSE_ESATTA,
      motivo: `classe di concorso: ${etichettaClasse(uguale)}`,
    };
  }

  for (const ca of classiAvviso) {
    for (const cp of classiProfilo) {
      const comuni = materieInComune(cp, ca);
      if (comuni.length > 0) {
        return {
          punteggio: PUNTEGGIO_CLASSE_AFFINE,
          motivo:
            `classe affine: ${etichettaClasse(cp)} ↔ ${etichettaClasse(ca)}` +
            ` (${comuni.join(', ')})`,
        };
      }
    }
  }

  const testoAvviso = `${avviso.materia ?? ''} ${avviso.titolo ?? ''} ${testoClassi(classiAvviso)}`;
  if (classiAvviso.length === 0 && materiaCompatibileConClassi(avviso.materia, classiProfilo)) {
    return {
      punteggio: PUNTEGGIO_CLASSE_PROBABILE,
      motivo: `materia coperta dalle tue classi: ${(avviso.materia ?? '').trim()}`,
    };
  }

  const areeProfilo = areeDi(testoClassi(classiProfilo));
  const areeAvviso = areeDi(testoAvviso);
  const comuni = areeInComune(areeProfilo, areeAvviso);
  if (comuni.length > 0) {
    return {
      punteggio: PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_STESSA_AREA,
      motivo: `stessa area disciplinare: ${comuni.join(', ')}`,
    };
  }
  const ponte = ponteTraAree(areeProfilo, areeAvviso);
  if (ponte) {
    const penalita =
      ponte.livello === 'affine'
        ? PENALITA_CLASSE_PONTE_AFFINE
        : PENALITA_CLASSE_PONTE_CONTAMINATA;
    return {
      punteggio: PUNTEGGIO_CLASSE_ESATTA - penalita,
      motivo: `area ${ponte.livello === 'affine' ? 'affine' : 'contaminata'}: ${ponte.etichetta}`,
    };
  }

  const indicata = classiAvviso[0] ?? (avviso.materia ?? '').trim();
  return {
    punteggio: PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_ESTRANEA,
    motivo: `classe estranea alle tue discipline${indicata ? ` (${indicata})` : ''}`,
  };
}

/**
 * True se la classe dell'avviso è ALMENO «stessa area» (85 o meglio): è la soglia
 * con cui la bacheca decide di far entrare un'opportunità che il motore non
 * aggancia per classe esatta. Un ponte tematico, da solo, non crea l'opportunità.
 */
export function classeVicina(profilo: ProfiloClasse, avviso: AvvisoClasse): boolean {
  const esito = punteggioClasse(profilo, avviso);
  return (
    esito !== null && esito.punteggio >= PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_STESSA_AREA
  );
}
