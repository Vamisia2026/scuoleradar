/**
 * ScuoleRadar.it — MODELLO DELLA PALETTE: quali token colore esistono davvero (§26.88).
 * -----------------------------------------------------------------------------------
 * Estratto da `scripts/test-token-palette.ts` per rispettare il limite di 250 righe del
 * gate strutturale (`W-DIM`), stessa forma di `scripts/lib/sanificaInterpelli.ts`: qui
 * sta la REGOLA, nel test stanno le asserzioni e l'output.
 *
 * Il problema che il modello serve a intercettare: Tailwind scarta IN SILENZIO le classi
 * il cui token non esiste — nessun errore di build, di typecheck o di lint. La classe
 * resta nel JSX, sembra corretta, e non produce CSS (spariscono bordi, anelli, outline,
 * sfumature). Fra §26.85 e §26.87 ha lasciato 33 classi inerti e una barra sfumata nel
 * trasparente (`to-primary-950`).
 *
 * LE DUE REGOLE, che sono diverse e vanno tenute distinte.
 *   · SCALA CUSTOM (`primary`, `secondary`, `accent`, `success`, `warning`, `error`): è un
 *     nome che Tailwind NON conosce, quindi i gradini dichiarati sono ESAUSTIVI —
 *     `success-200`, mai definito, non esiste in nessun posto del foglio generato.
 *   · SCALA CHE ESTENDE LA PALETTE (`sky`, `slate`): `theme.extend.colors` FONDE l'oggetto
 *     con i default di Tailwind, quindi `slate-700` esiste anche se la config dichiara
 *     solo `slate.50`. Qui è orfano solo un numero di gradino che Tailwind non prevede
 *     (es. `sky-750`), non un gradino che la config non ripete.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** I gradini che Tailwind genera per ogni palette della sua scala base. */
export const GRADINI_TAILWIND = new Set([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);

/**
 * Utility che accettano un colore. L'ordine conta: `border-t`/`ring-offset` devono essere
 * provati PRIMA di `border`/`ring`, altrimenti `border-t-error-200` non tornerebbe.
 */
const PREFISSI_COLORE = [
  'ring-offset', 'placeholder', 'decoration', 'border-x', 'border-y', 'shadow', 'outline',
  'border-t', 'border-r', 'border-b', 'border-l', 'accent', 'caret', 'border', 'divide',
  'stroke', 'ring', 'fill', 'text', 'from', 'via', 'bg', 'to',
];

/** I nomi che Tailwind già conosce: su questi la config fa una FUSIONE, non una sostituzione. */
const PALETTE_TAILWIND = new Set([
  'inherit', 'current', 'transparent', 'black', 'white',
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple',
  'fuchsia', 'pink', 'rose',
]);

export type ConfigTailwind = {
  content?: string[];
  theme?: { extend?: { colors?: Record<string, unknown> } };
};

export type Scala = {
  nome: string;
  /** true = nome sconosciuto a Tailwind → i gradini dichiarati sono l'elenco completo. */
  custom: boolean;
  gradini: Set<string>;
  /** true se la scala non ha una chiave `DEFAULT` (allora `bg-<scala>` non esiste). */
  senzaDefault: boolean;
  /** i valori letterali, per validarne il formato */
  valori: string[];
};

export type Palette = {
  scale: Scala[];
  perNome: Map<string, Scala>;
  /** Token usati nel testo che la palette non sa generare, nell'ordine in cui compaiono. */
  orfaniDi: (testo: string) => string[];
  /** Token validi trovati nel testo, per il riepilogo d'uso dei gradini. */
  gradiniValidiDi: (testo: string) => Array<{ scala: string; gradino: string }>;
};

/** Alternanza regex con le voci più lunghe per prime (e i trattini protetti). */
function alternanza(voci: string[]): string {
  return [...voci]
    .sort((a, b) => b.length - a.length)
    .map((v) => v.replace(/-/g, '\\-'))
    .join('|');
}


/**
 * Costruisce il modello della palette a partire da `theme.extend.colors`.
 * Non legge file: la config viene passata dal chiamante, così la fonte di verità resta
 * `tailwind.config.js` (importata) e qui non si duplica nulla.
 */
export function costruisciPalette(colors: Record<string, unknown> | undefined): Palette {
  const scale: Scala[] = Object.entries(colors ?? {}).map(([nome, valore]) => {
    const gradini = new Set<string>();
    const valori: string[] = [];
    if (typeof valore === 'string') {
      gradini.add('DEFAULT'); // `bg-<scala>` con un colore piatto
      valori.push(valore);
    } else if (valore && typeof valore === 'object') {
      for (const [gradino, hex] of Object.entries(valore as Record<string, unknown>)) {
        gradini.add(gradino);
        if (typeof hex === 'string') valori.push(hex);
      }
    }
    return {
      nome,
      custom: !PALETTE_TAILWIND.has(nome),
      gradini,
      senzaDefault: !gradini.has('DEFAULT'),
      valori,
    };
  });

  const perNome = new Map(scale.map((s) => [s.nome, s]));
  if (perNome.size === 0) {
    return { scale, perNome, orfaniDi: () => [], gradiniValidiDi: () => [] };
  }

  const prefissi = alternanza(PREFISSI_COLORE);
  const nomi = alternanza([...perNome.keys()]);
  /**
   * `prefisso-scala-gradino`. Il confine iniziale/finale impedisce che il match parta o
   * finisca dentro una parola più lunga (`text-errorx-200`, `text-error-2000`), mentre
   * l'opacità (`text-error-200/40`) resta valida perché `/` non è `\w`.
   */
  const RE_CLASSE = new RegExp(`(^|[^\\w-])(${prefissi})-(${nomi})-([A-Za-z][\\w]*|\\d{1,3})(?![\\w-])`, 'g');
  /** `bg-<scala>` senza gradino: valido solo se la scala ha una chiave `DEFAULT`. */
  const RE_SENZA_GRADINO = new RegExp(`(^|[^\\w-])(${prefissi})-(${nomi})(?![\\w-])`, 'g');

  /** Valido se il gradino è dichiarato o, per le scale che fondono i default, se è standard. */
  const eTokenValido = (s: Scala, gradino: string): boolean =>
    s.gradini.has(gradino) || (!s.custom && GRADINI_TAILWIND.has(Number(gradino)));

  return {
    scale,
    perNome,
    orfaniDi(testo: string): string[] {
      const orfani: string[] = [];
      for (const m of testo.matchAll(RE_CLASSE)) {
        const s = perNome.get(m[3]);
        if (s && !eTokenValido(s, m[4])) orfani.push(`${m[2]}-${m[3]}-${m[4]}`);
      }
      for (const m of testo.matchAll(RE_SENZA_GRADINO)) {
        const s = perNome.get(m[3]);
        if (s && s.senzaDefault) orfani.push(`${m[2]}-${m[3]} (senza gradino, la scala non ha DEFAULT)`);
      }
      return orfani;
    },
    gradiniValidiDi(testo: string): Array<{ scala: string; gradino: string }> {
      const validi: Array<{ scala: string; gradino: string }> = [];
      for (const m of testo.matchAll(RE_CLASSE)) {
        const s = perNome.get(m[3]);
        if (s && eTokenValido(s, m[4])) validi.push({ scala: s.nome, gradino: m[4] });
      }
      return validi;
    },
  };
}

/** Elenco ricorsivo dei file di una cartella, filtrato per estensione. */
function elenco(cartella: string, estensioni: string[], acc: string[] = []): string[] {
  for (const voce of readdirSync(cartella)) {
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) elenco(percorso, estensioni, acc);
    else if (estensioni.some((e) => voce.endsWith(e))) acc.push(percorso.replace(/\\/g, '/'));
  }
  return acc;
}

/**
 * Espande le voci di `content` di Tailwind: file letterale oppure `cartella/**` con le
 * estensioni elencate fra graffe. Le voci che non sa espandere NON vengono ignorate in
 * silenzio: finiscono in `nonGestiti`, così il test può fallire invece di restringere la
 * scansione senza dirlo.
 */
export function espandiContent(content: string[]): { file: string[]; nonGestiti: string[] } {
  const file: string[] = [];
  const nonGestiti: string[] = [];
  for (const voce of content) {
    if (voce.includes('*')) {
      const cartella = voce.slice(0, voce.indexOf('/**'));
      const estensioni = [...voce.matchAll(/\.(\w+)/g)].map((m) => `.${m[1]}`);
      file.push(...elenco(cartella, estensioni.length > 0 ? estensioni : ['.ts', '.tsx']));
      continue;
    }
    try {
      statSync(voce);
      file.push(voce.replace(/\\/g, '/'));
    } catch {
      nonGestiti.push(voce);
    }
  }
  return { file, nonGestiti };
}

