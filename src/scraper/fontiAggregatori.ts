/**
 * ScuoleRadar.it — AGGREGATORI PRIVATI NEL REGISTRO FONTI (Node-only, DATI).
 *
 * §26.123 — PERCHÉ ESISTE. Fino al 31/10/2026 l'indice nazionale e i 19 archivi
 * regionali di `scuolainterpelli.it` erano fonti **ATTIVE** del motore: la fonte
 * più produttiva del run e la ragione per cui in bacheca comparivano righe il cui
 * unico link era un portale terzo. Un aggregatore non è una fonte, è un
 * concorrente: le voci restano qui **registrate e spente** — la copertura si
 * dichiara, non si simula — e il motivo è scritto una volta sola.
 *
 * Il blocco vive in un file a parte perché `fonti.ts` sta al limite di dimensione
 * del gate strutturale (250 righe): la logica resta là, i dati stanno qui.
 */
import type { FonteInterpelli } from './fontiTipi.ts';
import { AGGREGATORI_REGIONALI } from './fontiRegistro.ts';

/** Indice nazionale dell'aggregatore (SPENTO, §26.123). */
export const AGGREGATORE_NAZIONALE =
  'https://www.scuolainterpelli.it/interpelli-scuola-aggiornati/';

/**
 * Motivo dichiarato su OGNI voce: finisce nel registro e nei report
 * (`npm run fonti:verifica`). Deve restare ≥ 20 caratteri: la guardia
 * `test:scraper:fonti` pretende un motivo scritto su ogni fonte spenta.
 */
const MOTIVO_AGGREGATORE =
  'aggregatore privato concorrente: non è una fonte istituzionale e le sue righe ' +
  'non sono atti dell’istituto (§26.109 · §26.123). La copertura si dichiara, non si simula.';

/** Le 20 voci spente: indice nazionale + un archivio per regione. */
export const AGGREGATORI_SPENTI: FonteInterpelli[] = [
  {
    id: 'aggregatore-nazionale',
    etichetta: 'Aggregatore interpelli — indice nazionale (SPENTO)',
    url: AGGREGATORE_NAZIONALE,
    tipo: 'aggregatore',
    regioni: [],
    capoluogo: null,
    nazionale: true,
    attiva: false,
    verificata: null,
    note: MOTIVO_AGGREGATORE,
  },
  ...AGGREGATORI_REGIONALI.map(([regione, slug]) => ({
    id: `aggregatore-${regione.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    etichetta: `Aggregatore interpelli — archivio ${regione} (SPENTO)`,
    url: `https://www.scuolainterpelli.it/${slug}/`,
    tipo: 'aggregatore' as const,
    regioni: [regione],
    capoluogo: null,
    nazionale: true,
    attiva: false,
    verificata: null,
    note: MOTIVO_AGGREGATORE,
  })),
];
