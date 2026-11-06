/**
 * ScuoleRadar.it — IL BANNER DELLA SCANSIONE, DECISO FUORI DALLA UI (§26.146).
 *
 * Perché un modulo puro: la bacheca deve poter dire «questi avvisi sono stati letti
 * due ore fa» oppure «cinque fonti sono isolate e i loro bandi non arrivano» SENZA
 * inventare numeri quando la telemetria manca. Le regole — quando il giro è fresco,
 * quando è in ritardo, quando il silenzio è un guasto — sono qui, in funzioni senza
 * rete e senza orologio interno (l'istante arriva come argomento), così la guardia
 * `npm run test:telemetria-scansione` le verifica numero per numero.
 *
 * L'INPUT è STRUTTURALE: bastano i campi che la Edge `crawler-admin` restituisce
 * (`TelemetriaCrawler` è assegnabile senza adattatori) e i campi assenti valgono
 * «non lo so», mai zero. La FONTE resta una sola: `source_health` (quarantena §26.85,
 * finestra di 60 giorni §26.109) letta dalla Edge e mai dal browser, che non ha i
 * permessi per farlo.
 *
 * Tre esiti e un silenzio:
 *   · `fresca`     — il giro è recente e nessuna fonte è isolata;
 *   · `in-ritardo` — l'ultimo giro ha più di `ORE_PRIMA_DEL_RITARDO` ore, quindi la
 *                    bacheca può essere indietro (la finestra delle fonti è di 2 giorni);
 *   · `isolata`    — almeno una fonte è in quarantena: i suoi avvisi mancano;
 *   · `guasta`     — nessun giro registrato, oppure fonti in errore nell'ultimo giro;
 *   · `null`       — la telemetria non è arrivata: nessun banner, nessun numero finto.
 */

/** I quattro stati che il banner sa raccontare (l'assenza è `null`, non un quinto stato). */
export type TonoScansione = 'fresca' | 'in-ritardo' | 'isolata' | 'guasta';

/**
 * Ciò che serve al banner. Tutto opzionale: un campo assente significa «la Edge non
 * l'ha letto», e un numero non letto NON è uno zero.
 */
export interface TelemetriaScansione {
  /** Fine dell'ultimo giro di ingestione (ISO). */
  ultima_scansione?: string | null;
  /** Pagine lette nelle ultime 24 ore. */
  scansionate_24h?: number | null;
  /** Pagine ancora da leggere in coda. */
  pagine_in_coda?: number | null;
  /** Fonti in errore nell'ultimo giro. */
  in_errore?: number | null;
  /** Fonti in quarantena (`null`/assente = la Edge non le ha lette). */
  fonti_isolate?: readonly unknown[] | null;
  /** Fonti che sbagliano senza essere ancora isolate (`null` = non letto). */
  fonti_in_guasto?: number | null;
  /** Esito dell'ultima run: gli errori sono la seconda fonte del conteggio. */
  ultima_run?: { errori?: number | null } | null;
}

/** Righe pronte per la UI: testo già scritto, nessun numero da formattare a schermo. */
export interface BannerScansione {
  tono: TonoScansione;
  titolo: string;
  dettaglio: string;
}

/** Oltre questo silenzio il giro è in ritardo (la finestra delle fonti è di 2 giorni). */
export const ORE_PRIMA_DEL_RITARDO = 48;

/** Numero finito oppure `null`: i valori sporchi della rete non diventano zeri. */
function numero(valore: unknown): number | null {
  return typeof valore === 'number' && Number.isFinite(valore) ? valore : null;
}

/**
 * Ore passate da un istante ISO: `null` se la data manca o non è leggibile (mai
 * «zero ore fa», che sarebbe una freschezza inventata). Un istante nel futuro vale 0.
 */
export function oreDa(iso: string | null | undefined, adesso: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (adesso.getTime() - t) / 3_600_000);
}

/** Durata in parole, senza cifre superflue: «meno di un'ora fa», «ieri», «3 giorni fa». */
export function durataLeggibile(ore: number | null): string {
  if (ore === null) return 'non registrata';
  if (ore < 1) return "meno di un'ora fa";
  if (ore < 24) {
    const n = Math.round(ore);
    return n === 1 ? "un'ora fa" : `${n} ore fa`;
  }
  if (ore < 48) return 'ieri';
  return `${Math.floor(ore / 24)} giorni fa`;
}

/** «1 fonte isolata» / «5 fonti isolate»: il singolare non è un dettaglio di stile. */
const contoFonti = (n: number): string => (n === 1 ? '1 fonte isolata' : `${n} fonti isolate`);

/**
 * Decide il banner. Ordine delle priorità — prima ciò che TOGLIE avvisi, poi ciò che
 * li rende vecchi: un giro in ritardo ma completo resta meno grave di cinque albi isolati.
 */
export function bannerScansione(
  telemetria: TelemetriaScansione | null | undefined,
  adesso: Date = new Date(),
): BannerScansione | null {
  if (!telemetria) return null;

  const ore = oreDa(telemetria.ultima_scansione, adesso);
  const quando = durataLeggibile(ore);
  const isolate = telemetria.fonti_isolate?.length ?? null;
  const guasti = numero(telemetria.fonti_in_guasto);
  const errori = Math.max(
    numero(telemetria.in_errore) ?? 0,
    numero(telemetria.ultima_run?.errori) ?? 0,
  );

  if (ore === null) {
    return {
      tono: 'guasta',
      titolo: 'Scansione non ancora registrata',
      dettaglio:
        'La telemetria non riporta nessun giro completato: gli avvisi in bacheca possono ' +
        'essere incompleti, non vuoti. La fonte degli avvisi resta l’albo della scuola.',
    };
  }

  if (isolate !== null && isolate > 0) {
    return {
      tono: 'isolata',
      titolo: contoFonti(isolate),
      dettaglio:
        `Ultima scansione ${quando}. Le fonti isolate non vengono lette finché non tornano a ` +
        'pubblicare o qualcuno non le riabilita: i loro bandi possono mancare in bacheca.',
    };
  }

  if (errori > 0 || (guasti ?? 0) > 0) {
    const n = Math.max(errori, guasti ?? 0);
    return {
      tono: 'guasta',
      titolo: n === 1 ? '1 fonte in errore' : `${n} fonti in errore`,
      dettaglio:
        `Ultima scansione ${quando}. Gli albi che hanno risposto male non sono stati letti: ` +
        'la bacheca è parziale, non sbagliata.',
    };
  }

  // Il giro c'è e non ha fonti perse: resta da dire se è VECCHIO.
  if (ore >= ORE_PRIMA_DEL_RITARDO) {
    return {
      tono: 'in-ritardo',
      titolo: `Ultima scansione ${quando}`,
      dettaglio:
        `Sono passate più di ${ORE_PRIMA_DEL_RITARDO / 24} giornate: la bacheca può essere ` +
        'indietro rispetto agli albi. La data di scadenza di ogni avviso resta quella pubblicata.',
    };
  }

  // Fresca: si dicono solo i numeri che la Edge ha davvero letto.
  const parti = [`ultima scansione ${quando}`];
  const pagine = numero(telemetria.scansionate_24h);
  if (pagine !== null) parti.push(`${pagine} pagine lette nelle ultime 24 ore`);
  const coda = numero(telemetria.pagine_in_coda);
  if (coda !== null && coda > 0) parti.push(`${coda} in coda`);
  const dettaglio = parti.join(' · ');
  return {
    tono: 'fresca',
    titolo: 'Albi letti di recente',
    dettaglio: dettaglio.charAt(0).toUpperCase() + dettaglio.slice(1) + '.',
  };
}
