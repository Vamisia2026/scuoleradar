/**
 * ScuoleRadar.it — TAILORING DEL RECAPITO (modulo PURO, punto unico di decisione).
 *
 * REGOLA DI SERVIZIO (direttiva 06/10/2026, §26.68): un'interpellanza GENUINA non
 * si perde per un'anagrafica incompleta. Quando la fonte non pubblica l'email di
 * candidatura, il recapito si CUCE da fonti nostre, in ordine di autorevolezza:
 *
 *   1. `fonte`       — l'email trovata nella pagina/PDF/allegato (o già risolta a
 *                      monte dalla pipeline);
 *   2. `anagrafica`  — il registro ufficiale MIM (file SCUANAGRAFE,
 *                      `lib/anagraficaScuole.ts`): denominazione + PEO + PEC;
 *   3. `storico`     — il NOSTRO database (`interpelli`): stessa scuola già
 *                      risolta in passato — un recapito OSSERVATO è più preciso di
 *                      uno ricostruito, ed è l'unica fonte che cresce da sola;
 *   4. `convenzione` — la PEO/PEC ricostruita dal codice meccanografico
 *                      (convenzione MIM, `lib/emailScuola.ts`).
 *
 * Se nessuna fonte produce un recapito il risultato è ONESTO: `email: null`,
 * `daRevisionare: true`. La riga resta in bacheca, la notifica parte senza il
 * blocco contatto (§26.68) e la segnalazione va alla revisione interna: nessun
 * silenzio e nessuna email inventata (policy dati §26.47).
 *
 * Modulo PURO e isomorfo (nessuna rete, nessun `node:fs`): importabile dallo
 * scraper (Node) e dal browser. Chi fornisce le fonti è il chiamante:
 *  · scraper all'inserimento → `scraper/tailoringInterpelli.ts`;
 *  · manutenzione dati → `scripts/arricchisci-interpelli.ts`.
 * Verificato da `npm run test:tailoring`.
 */
import { emailAvviso } from './alertInterpello';

/** Da dove arriva il recapito risolto. */
export type ProvenienzaContatto = 'fonte' | 'anagrafica' | 'storico' | 'convenzione' | 'nessuna';

/** Recapito di candidatura offerto da una fonte: PEO (candidature) e PEC (atti). */
export interface RecapitoCandidatura {
  email?: string | null;
  pec?: string | null;
}

/** Fonti interrogate, dalla più autorevole alla meno (tutte opzionali). */
export interface FontiTailoring {
  /** Email trovata nella fonte (o già risolta a monte dalla pipeline). */
  emailFonte?: string | null;
  /** Registro ufficiale MIM (SCUANAGRAFE) per l'istituto della riga. */
  anagrafica?: RecapitoCandidatura | null;
  /** Storico interno: stessa scuola già risolta in `interpelli`. */
  storico?: RecapitoCandidatura | null;
  /** Convenzione MIM sul codice meccanografico. */
  convenzione?: RecapitoCandidatura | null;
}

/** Esito del tailoring: il recapito, la sua provenienza e la segnalazione. */
export interface EsitoTailoring {
  /** Email di candidatura risolta (`null` = nessuna fonte la produce). */
  email: string | null;
  /** PEC risolta, quando una qualche fonte la dichiara. */
  pec: string | null;
  /** Chi ha fornito l'email. */
  provenienza: ProvenienzaContatto;
  /** true = nessuna fonte ha prodotto un recapito: la riga va segnalata. */
  daRevisionare: boolean;
}

/** Etichetta leggibile della provenienza (log del run, report, diagnosi). */
export const ETICHETTA_PROVENIENZA: Record<ProvenienzaContatto, string> = {
  fonte: 'email della fonte',
  anagrafica: 'registro ufficiale (SCUANAGRAFE)',
  storico: 'storico interno',
  convenzione: 'convenzione MIM',
  nessuna: 'nessuna fonte',
};

/**
 * Cuce il recapito di candidatura di UNA riga: vince la PRIMA fonte che dichiara
 * un'email valida, mentre la PEC si prende da qualunque fonte la offra (serve agli
 * atti formali e alla diagnostica, §26.41: non si ricostruisce se c'è la PEO).
 *
 * Un'email malformata (`non-una-email`) NON interrompe la ricerca: si scende alla
 * fonte successiva. Mai un indirizzo inventato: solo valori reali, normalizzati
 * (`emailAvviso`).
 */
export function risolviContattoAvviso(fonti: FontiTailoring = {}): EsitoTailoring {
  const candidate: Array<[ProvenienzaContatto, RecapitoCandidatura | null | undefined]> = [
    ['fonte', { email: fonti.emailFonte }],
    ['anagrafica', fonti.anagrafica],
    ['storico', fonti.storico],
    ['convenzione', fonti.convenzione],
  ];
  let email: string | null = null;
  let provenienza: ProvenienzaContatto = 'nessuna';
  let pec: string | null = null;
  for (const [nome, recapito] of candidate) {
    if (!email) {
      const candidata = emailAvviso(recapito?.email ?? null);
      if (candidata) {
        email = candidata;
        provenienza = nome;
      }
    }
    if (!pec) pec = emailAvviso(recapito?.pec ?? null);
  }
  return { email, pec, provenienza, daRevisionare: email === null };
}
