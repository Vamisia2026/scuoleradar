/**
 * ScuoleRadar.it — TARGET di scansione: dal codice PROVINCIA del catalogo alla
 * CITTÀ della coda (`public.scan_targets`).
 *
 * La coda ha UNA riga per città (i 20 capoluoghi di regione + Asti, seed della
 * migrazione `20260929102443`), mentre tutto il resto dell'applicazione ragiona
 * per CODICE PROVINCIA (preferenze utente, `interpelli.province`, fonti dello
 * scraper). Questo modulo è l'unica traduzione fra i due mondi, in entrambe le
 * direzioni:
 *   · `capoluogoDaProvincia` / `cittaTargetDaProvince` → quali città coprono le
 *     province di un utente: a quelle va indirizzata la richiesta di scansione;
 *   · `provinciaDaCitta` → quale provincia deve scansionare il consumatore della
 *     coda (`src/scraper/coda.ts`) quando prende in carico una città.
 *
 * PERCHÉ IL CAPOLUOGO: la scansione è REGIONALE — l'hub di reclutamento dell'USR
 * copre la regione e le fonti restituiscono avvisi di tutte le sue province.
 * Attivare una provincia qualunque (es. Cuneo) deve quindi ri-scansionare il
 * capoluogo della regione (Torino), non creare una riga per provincia.
 *
 * Puro e isomorfo (nessun I/O): lo usa il browser (richieste di scansione) e il
 * worker Node. Verificato da `npm run test:coda:sync`, che incrocia questo
 * registro con il seed SQL: **una città del seed senza provincia nel catalogo
 * blocca il test** — è così che è emersa la provincia mancante `PZ` (Potenza),
 * senza la quale il target di Potenza non era scansionabile.
 */
import { province } from '../data/province';

/** Voce del catalogo province (`@/data/province`). */
export type VoceProvincia = (typeof province)[number];

/**
 * Capoluogo di regione: la città del target di scansione che copre la regione.
 * Ogni valore DEVE esistere nel catalogo province (`nome`) dentro la STESSA
 * regione: `npm run test:coda:sync` lo verifica regione per regione, quindi una
 * regione senza capoluogo o un capoluogo scritto male non passano.
 */
export const CAPOLUOGHI_REGIONE: Readonly<Record<string, string>> = {
  Abruzzo: "L'Aquila",
  Basilicata: 'Potenza',
  Calabria: 'Catanzaro',
  Campania: 'Napoli',
  'Emilia-Romagna': 'Bologna',
  'Friuli-Venezia Giulia': 'Trieste',
  Lazio: 'Roma',
  Liguria: 'Genova',
  Lombardia: 'Milano',
  Marche: 'Ancona',
  Molise: 'Campobasso',
  Piemonte: 'Torino',
  Puglia: 'Bari',
  Sardegna: 'Cagliari',
  Sicilia: 'Palermo',
  Toscana: 'Firenze',
  'Trentino-Alto Adige': 'Trento',
  Umbria: 'Perugia',
  "Valle d'Aosta": 'Aosta',
  Veneto: 'Venezia',
};

/**
 * Target di scansione che NON sono capoluoghi di regione: righe del seed dedicate
 * a un hub di reclutamento specifico (Asti, pilota del 29/09/2026). Restano vivi:
 * la richiesta per la provincia di Asti li copre insieme a Torino, così il target
 * non resta `idle` per sempre.
 */
export const TARGET_AGGIUNTIVI: readonly string[] = ['Asti'];

/**
 * Chiave di confronto tollerante: minuscole, senza accenti (Forlì → forli) e con
 * l'apostrofo dritto (`L’Aquila` tipografico → `L'Aquila`) — i nomi arrivano da
 * catalogo, da pagine web e da URL, e non sono scritti allo stesso modo.
 */
function chiaveNome(testo: string): string {
  return (testo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc\u0060\u00b4]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Voce del catalogo per codice provincia (maiuscolo), oppure null. */
export function provinciaDaCodice(codice: string): VoceProvincia | null {
  const c = (codice ?? '').trim().toUpperCase();
  if (!c) return null;
  return province.find((p) => p.codice === c) ?? null;
}

/**
 * Codice provincia di una città del catalogo (`'Roma'` → `'RM'`), oppure null se
 * il nome non è una provincia: mai indovinare la provincia di una città ignota.
 */
export function provinciaDaCitta(citta: string): string | null {
  const chiave = chiaveNome(citta);
  if (!chiave) return null;
  return province.find((p) => chiaveNome(p.nome) === chiave)?.codice ?? null;
}

/**
 * Città del target che copre una provincia: il capoluogo della sua regione
 * (`'CN'` → `'Torino'`). `null` per un codice ignoto o per una regione senza
 * capoluogo registrato (mai un target inventato).
 */
export function capoluogoDaProvincia(codice: string): string | null {
  const voce = provinciaDaCodice(codice);
  if (!voce) return null;
  return CAPOLUOGHI_REGIONE[voce.regione] ?? null;
}

/**
 * Città della coda da ri-scansionare per un elenco di province: il capoluogo di
 * ogni regione coinvolta, più i target aggiuntivi quando la provincia è quella
 * pilota (`['AT']` → `['Asti', 'Torino']`). Elenco ordinato e senza duplicati:
 * dieci province di una regione restano UNA città da scansionare.
 */
export function cittaTargetDaProvince(codici: readonly string[] | null | undefined): string[] {
  const citta = new Set<string>();
  for (const codice of codici ?? []) {
    const voce = provinciaDaCodice(codice);
    if (!voce) continue;
    const capoluogo = CAPOLUOGHI_REGIONE[voce.regione];
    if (capoluogo) citta.add(capoluogo);
    const chiaveProvincia = chiaveNome(voce.nome);
    for (const aggiuntivo of TARGET_AGGIUNTIVI) {
      if (chiaveNome(aggiuntivo) === chiaveProvincia) citta.add(aggiuntivo);
    }
  }
  return [...citta].sort();
}
