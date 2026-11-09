/**
 * ScuoleRadar.it — IL PERIMETRO DELLA RICERCA, DETTO UNA VOLTA (§26.150).
 *
 * L'AUDIT DEL 06/11/2026. Bartolo toglie tre province dal profilo (da Torino · Cuneo ·
 * Alessandria · Asti resta **Asti**) e la bacheca passa da 48 a 33 opportunità: non azzera le
 * altre, non «filtra netto». La causa non era un errore di calcolo ma un perimetro SILENZIOSO,
 * misurato sulle coordinate vere dei capoluoghi:
 *
 *   · `['TO','CN','AL','AT']` → perimetro **TO, CN, AL, AT** (principale Torino; Asti, che è
 *     secondaria, sta a 46 km e non porta raggio: la regola §26.139 vale solo per la prima);
 *   · `['AT']`                → perimetro **AT, AL (32 km), TO (46 km), VC (51 km)**.
 *
 * Quindi deselezionare non restringe: **cambia il centro**. Con Asti come principale il raggio
 * dei 60 km riammette Alessandria e Torino — le due province appena tolte — e aggiunge Vercelli,
 * mai scelta. Il conteggio resta alto perché il perimetro è ancora di quattro province: è
 * corretto per la regola (§26.139) e insensato per chi guarda, perché **nessuna superficie lo
 * diceva**.
 *
 * LA REGOLA (non cambia, si dichiara). Il perimetro è: province scelte + province entro
 * `RAGGIO_PROVINCIA_KM` (60) dalla **principale** (la prima dell'elenco, `lib/provinceRadar`).
 * `provinceDiRicerca` resta la funzione che la query del feed usa: qui non si riscrive la
 * regola, si aggiunge la sua DESCRIZIONE — nomi e chilometri — così il numero mostrato in
 * bacheca e le pillole delle preferenze possono dire «Asti + 60 km: Alessandria 32 km, Torino
 * 46 km, Vercelli 51 km» invece di lasciare l'utente a contare le proprie province.
 *
 * PERCHÉ CONTANO I CHILOMETRI. «Entro 60 km» da solo non spiega perché Torino rientra dopo
 * essere stata deselezionata; «Torino, 46 km da Asti» sì. Un perimetro che si può leggere è un
 * filtro che si può verificare: l'utente sa perché una riga è in pagina.
 *
 * Modulo PURO (nessuna rete, nessun `node:*`). Guardia: `npm run test:ambito-bacheca`.
 */
import { province } from '../data/province';
import {
  RAGGIO_PROVINCIA_KM,
  distanzaKm,
  normalizzaProvincia,
  provinceDiRicerca,
} from './prossimitaGeografica';
import { provinciaPrincipale } from './provinceRadar';

/** Una provincia che entra per il raggio, con la distanza dal capoluogo principale. */
export interface ProvinciaNelRaggio {
  codice: string;
  nome: string;
  /** Chilometri dal capoluogo principale (`null` = coordinate assenti, nessuna cifra finta). */
  km: number | null;
}

/** Il perimetro di ricerca, già leggibile: chi cerca, da dove, e fin dove arriva il raggio. */
export interface PerimetroRicerca {
  /** Codice della provincia principale (la prima scelta), o `null` senza selezione. */
  principale: string | null;
  /** Nome esteso della principale (`''` senza selezione). */
  principaleNome: string;
  /** Province scelte, nell'ordine del profilo (la prima è la principale). */
  proprie: readonly string[];
  /** Province entrate per il raggio, dalla più vicina: è l'espansione da DICHIARARE. */
  entroRaggio: readonly ProvinciaNelRaggio[];
  /** Ciò che la query chiede davvero: `proprie` + `entroRaggio`. */
  perimetro: string[];
  /** Raggio applicato (km). */
  raggioKm: number;
}

/** Nome esteso di un codice (il codice stesso se sconosciuto: nessun nome inventato). */
function nomeProvincia(codice: string): string {
  return province.find((p) => p.codice === codice)?.nome ?? codice;
}

/** «A, B e C» — l'elenco si legge come una frase, non come un log. */
function elenco(voci: readonly string[]): string {
  if (voci.length <= 1) return voci[0] ?? '';
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`;
}

/**
 * Il perimetro della ricerca per un profilo. Legge SOLO la regola di `prossimitaGeografica`
 * (la stessa del feed e della bacheca): qui si aggiungono i nomi e i chilometri, mai una
 * seconda verità.
 */
export function perimetroRicerca(
  provinceCodici: readonly string[] | null | undefined,
  opts: { raggioKm?: number } = {},
): PerimetroRicerca {
  const raggioKm = opts.raggioKm ?? RAGGIO_PROVINCIA_KM;
  const proprie = [...new Set((provinceCodici ?? []).map(normalizzaProvincia).filter(Boolean))];
  const principale = provinciaPrincipale(proprie);
  // UNA sola chiamata alla regola: il perimetro è esattamente ciò che il feed chiederà, e le
  // «vicine» sono i codici che stanno nel perimetro senza essere stati scelti.
  const perimetro = provinceDiRicerca(proprie, raggioKm);
  const entroRaggio: ProvinciaNelRaggio[] = principale
    ? perimetro
        .filter((codice) => !proprie.includes(codice))
        .map((codice) => ({
          codice,
          nome: nomeProvincia(codice),
          km: distanzaKm(principale, codice),
        }))
    : [];
  return {
    principale,
    principaleNome: principale ? nomeProvincia(principale) : '',
    proprie,
    entroRaggio,
    perimetro,
    raggioKm,
  };
}

/**
 * LA FRASE DEL PERIMETRO (estesa): si legge sotto le pillole delle preferenze, dove l'utente
 * aggiunge e toglie province. È il posto in cui la deselezione deve smettere di sorprendere.
 */
export function frasePerimetro(p: PerimetroRicerca): string {
  if (p.proprie.length === 0) {
    return 'Nessuna provincia scelta: senza un perimetro il Radar non cerca nulla.';
  }
  const base =
    p.proprie.length === 1
      ? `Cerchi in ${p.principaleNome || nomeProvincia(p.proprie[0])}`
      : `Cerchi in ${elenco(p.proprie.map(nomeProvincia))}`;
  if (p.entroRaggio.length === 0) {
    return `${base}. Nessun'altra provincia è entro ${p.raggioKm} km.`;
  }
  const vicine = elenco(
    p.entroRaggio.map((v) => (v.km === null ? v.nome : `${v.nome} (${v.km} km)`)),
  );
  return `${base} e, entro ${p.raggioKm} km da ${p.principaleNome}, in ${vicine}.`;
}

/**
 * IL RIASSUNTO (breve): sta accanto al conteggio delle opportunità, dove il numero 33 deve
 * poter essere spiegato in una riga — «Asti + 60 km: Alessandria 32 km · Torino 46 km ·
 * Vercelli 51 km».
 */
export function riassuntoPerimetro(p: PerimetroRicerca): string {
  if (p.proprie.length === 0) return 'Nessuna provincia scelta';
  const base = p.proprie.length === 1 ? p.principaleNome : `${p.proprie.length} province scelte`;
  if (p.entroRaggio.length === 0) return `${base} · nessuna provincia entro ${p.raggioKm} km`;
  const vicine = p.entroRaggio
    .map((v) => (v.km === null ? v.nome : `${v.nome} ${v.km} km`))
    .join(' · ');
  return `${base} + ${p.raggioKm} km: ${vicine}`;
}

/**
 * Dove cade un codice nel perimetro: la stessa risposta di `scalaParacadute`
 * (`propria` · `vicina` · `fuori` · `non-applicabile`), in forma di etichetta leggibile.
 * Serve alle guardie e a chi deve dichiarare una riga senza rifare il conto.
 */
export function provinciaNelPerimetro(
  p: PerimetroRicerca,
  codice?: string | null,
): 'propria' | 'raggio' | 'fuori' | 'non-applicabile' {
  if (p.proprie.length === 0) return 'non-applicabile';
  const c = normalizzaProvincia(codice);
  if (!c) return 'fuori';
  if (p.proprie.includes(c)) return 'propria';
  return p.entroRaggio.some((v) => v.codice === c) ? 'raggio' : 'fuori';
}

