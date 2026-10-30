/**
 * ScuoleRadar.it — GERARCHIA DEL RECAPITO DI CANDIDATURA (modulo PURO, §26.116).
 *
 * Perché esiste: una scuola ha PIÙ caselle e non sono equivalenti. Mostrare la
 * PEC quando esiste la PEO ministeriale, o una casella generica quando esiste la
 * segreteria, fa perdere la candidatura (la PEC è per gli atti formali, la
 * casella generica spesso non è presidiata). Qui vive l'UNICA scala di priorità,
 * condivisa da scraper, anagrafica, Tailoring, manutenzione dati e interfaccia.
 *
 * ORDINE (dal migliore al peggiore):
 *   1. `peo`        — PEO ministeriale ordinaria: `codice@istruzione.it`
 *                     (convenzione MIM, `lib/emailScuola.ts`); è la casella
 *                     ufficiale di candidatura di ogni istituto;
 *   2. `segreteria` — segreteria / didattica / protocollo / DSGA / personale:
 *                     la casella che il bando presidia davvero;
 *   3. `dirigenza`  — dirigente / presidenza / direzione;
 *   4. `istituto`   — casella generica dell'istituto (`info@…`, `contatti@…`);
 *   5. `pec`        — posta certificata: SOLO estrema ratio (atti formali, non
 *                     candidature); non batte mai un'altra casella reale;
 *   6. `esterno`    — dominio personale/gratuito (gmail, libero…): vietato come
 *                     recapito scolastico, resta solo se non c'è nulla di meglio.
 *
 * TRE REGOLE DI DECISIONE
 *  · `scegliContatto` — tra più candidati vince il rango migliore, con una
 *    precedenza dichiarata: un indirizzo OSSERVATO (fonte, anagrafica MIM,
 *    storico interno) batte uno RICOSTRUITO (`derivato`: convenzione MIM), e la
 *    PEC entra solo quando non esiste alcuna casella reale. A parità di rango
 *    vince l'ordine di arrivo (la fonte resta la prima della lista).
 *  · `eAggiornamentoContatto` — quando un recapito NUOVO deve sostituire quello
 *    salvato: buco da riempire, oppure PEC/dominio esterno battuti da una casella
 *    reale, oppure (solo tra osservazioni) rango strettamente migliore — così una
 *    mail generica diventa segreteria/PEO. Una ricostruzione non sale mai sopra
 *    un'osservazione e un recapito primario non viene mai abbassato.
 *  · `soloNonPrimari` — il contratto «fill-only» dell'anagrafica: si completa un
 *    recapito PEC/generico, non si tocca un recapito già buono.
 *
 * Modulo PURO e isomorfo (nessuna rete, nessun `node:*`): lo usano lo scraper
 * (Node) e le viste web (browser). Guardia: `npm run test:contatti`.
 */
import { eDominioNonIstituzionale, normalizzaCodiceMeccanografico } from './emailScuola';

/** Natura di un recapito email: la scala di priorità di prodotto. */
export type NaturaContatto = 'peo' | 'segreteria' | 'dirigenza' | 'istituto' | 'pec' | 'esterno';

/** Rango numerico (1 = migliore). Usato per ordinare, non per mostrare. */
export const RANGO_CONTATTO: Record<NaturaContatto, number> = {
  peo: 1,
  segreteria: 2,
  dirigenza: 3,
  istituto: 4,
  pec: 5,
  esterno: 6,
};

/**
 * Etichetta leggibile della natura: è ciò che l'interfaccia dichiara accanto al
 * recapito, così l'utente sa SEMPRE che cosa sta usando (PEO ministeriale,
 * segreteria, PEC di ripiego…). Mai un'etichetta tecnica o un codice.
 */
export const ETICHETTA_NATURA: Record<NaturaContatto, string> = {
  peo: 'PEO ministeriale',
  segreteria: 'Segreteria',
  dirigenza: 'Dirigenza',
  istituto: 'Istituto',
  pec: 'PEC (atti formali)',
  esterno: 'Dominio esterno',
};

/** Caselle della SEGRETERIA (è la casella che il bando presidia). */
const RE_SEGRETERIA =
  /(segreteria|segr\.?(?![a-z])|didattica|protocollo|dsga|amministrazione|personale|alunni|urp|uffici[oi])/;

/** Caselle della DIRIGENZA. */
const RE_DIRIGENZA = /(dirigente|dirigenza|presidenza|preside|dirscol|direttore|(?:^|[._-])ds(?:[._-]|$))/;

/** Domini di posta CERTIFICATA (PEC): etichetta del dominio, non un suffisso qualsiasi. */
const RE_PEC_DOMINIO = /(?:^|\.)pec\.|postacert|legalmail/;

/** Dominio del Ministero: la PEO ufficiale vive qui (`codice@istruzione.it`). */
const DOMINIO_MINISTERO = 'istruzione.it';

/** Struttura minima accettata per un indirizzo (nessun indirizzo inventato). */
const RE_DOMINIO_VALIDO = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/;
const RE_LOCAL_VALIDO = /^[a-z0-9._%+-]+$/;


/**
 * Natura di un recapito; `null` se il valore non è un indirizzo email.
 * L'ordine dei controlli è significativo: un dominio personale resta `esterno`
 * anche quando la casella si chiama «segreteria», e `codice@pec.istruzione.it`
 * resta `pec` (mai scambiata per la PEO dello stesso codice).
 */
export function naturaContatto(email?: string | null): NaturaContatto | null {
  const e = (email ?? '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1 || at === e.length - 1) return null;
  const local = e.slice(0, at);
  const dominio = e.slice(at + 1);
  if (!RE_LOCAL_VALIDO.test(local) || !RE_DOMINIO_VALIDO.test(dominio)) return null;
  if (eDominioNonIstituzionale(e)) return 'esterno';
  if (RE_PEC_DOMINIO.test(dominio)) return 'pec';
  if (dominio === DOMINIO_MINISTERO && normalizzaCodiceMeccanografico(local)) return 'peo';
  if (RE_SEGRETERIA.test(local)) return 'segreteria';
  if (RE_DIRIGENZA.test(local)) return 'dirigenza';
  return 'istituto';
}

/** Rango del recapito (1 = migliore); `0` quando non è un'indirizzo email. */
export function rangoContatto(email?: string | null): number {
  const natura = naturaContatto(email);
  return natura ? RANGO_CONTATTO[natura] : 0;
}

/**
 * True se il recapito è utilizzabile come PRIMARIO: una casella reale
 * dell'istituto (PEO, segreteria, dirigenza, generica). PEC e dominio personale
 * non lo sono mai — sono i ripieghi dichiarati.
 */
export function eContattoPrimario(email?: string | null): boolean {
  const natura = naturaContatto(email);
  return natura !== null && RANGO_CONTATTO[natura] <= RANGO_CONTATTO.istituto;
}


/** Un candidato a recapito: l'indirizzo più da dove arriva. */
export interface CandidatoContatto {
  email?: string | null;
  /** Sorgente dichiarata dal chiamante (`fonte`, `anagrafica`, `storico`, `convenzione`…). */
  provenienza: string;
  /** true = indirizzo RICOSTRUITO (convenzione MIM): non batte un'osservazione. */
  derivato?: boolean;
}

/** Esito della scelta: l'indirizzo, la sua natura e la sua provenienza. */
export interface SceltaContatto {
  email: string;
  natura: NaturaContatto;
  provenienza: string;
}

/** Candidato normalizzato e validato, con rango calcolato una volta. */
interface Valutato extends SceltaContatto {
  derivato: boolean;
  rango: number;
}

/**
 * Recapito migliore tra i candidati (o `null` se nessuno è un'email):
 * osservati reali → ricostruiti reali → PEC → dominio esterno. A parità di
 * rango vince il primo arrivato, così la FONTE resta davanti alle fonti nostre.
 */
export function scegliContatto(candidati: readonly CandidatoContatto[]): SceltaContatto | null {
  const validi: Valutato[] = [];
  for (const c of candidati) {
    const email = (c.email ?? '').trim().toLowerCase();
    const natura = naturaContatto(email);
    if (!natura) continue;
    validi.push({
      email,
      natura,
      provenienza: c.provenienza,
      derivato: Boolean(c.derivato),
      rango: RANGO_CONTATTO[natura],
    });
  }
  if (validi.length === 0) return null;

  const primari = (v: Valutato): boolean => v.natura !== 'pec' && v.natura !== 'esterno';
  const gruppi: Valutato[][] = [
    validi.filter((v) => primari(v) && !v.derivato),
    validi.filter((v) => primari(v) && v.derivato),
    validi.filter((v) => v.natura === 'pec'),
    validi.filter((v) => v.natura === 'esterno'),
  ];
  for (const gruppo of gruppi) {
    if (gruppo.length === 0) continue;
    let migliore = gruppo[0];
    for (const v of gruppo) if (v.rango < migliore.rango) migliore = v;
    return { email: migliore.email, natura: migliore.natura, provenienza: migliore.provenienza };
  }
  return null;
}

/** Opzioni della regola di aggiornamento del recapito salvato. */
export interface OpzioniAggiornamento {
  /** true = il candidato è RICOSTRUITO (convenzione MIM): non batte un'osservazione. */
  derivato?: boolean;
  /** true = si tocca solo un recapito NON primario (contratto «fill-only»). */
  soloNonPrimari?: boolean;
}

/**
 * True se `candidato` deve SOSTITUIRE `attuale` come recapito primario della riga.
 * Riempie i buchi, sostituisce PEC/dominio personale con una casella reale e —
 * solo tra indirizzi OSSERVATI — accetta un rango strettamente migliore
 * (mail generica → segreteria → PEO). Mai un peggioramento, mai una
 * ricostruzione sopra un dato osservato.
 */
export function eAggiornamentoContatto(
  attuale: string | null | undefined,
  candidato: string | null | undefined,
  opzioni: OpzioniAggiornamento = {},
): boolean {
  const naturaNuova = naturaContatto(candidato);
  if (!naturaNuova) return false;
  const naturaAttuale = naturaContatto(attuale);
  // Nessun recapito (o recapito illeggibile): si riempie il buco.
  if (!naturaAttuale) return true;
  if (opzioni.soloNonPrimari && eContattoPrimario(attuale)) return false;
  // Il salvato è un ripiego (PEC/dominio personale): una casella reale lo batte.
  if (!eContattoPrimario(attuale)) return eContattoPrimario(candidato);
  if (opzioni.derivato) return false;
  return RANGO_CONTATTO[naturaNuova] < RANGO_CONTATTO[naturaAttuale];
}

/** Etichetta della natura per l'interfaccia (`''` se non è un'email). */
export function etichettaContatto(email?: string | null): string {
  const natura = naturaContatto(email);
  return natura ? ETICHETTA_NATURA[natura] : '';
}
