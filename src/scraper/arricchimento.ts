/**
 * ScuoleRadar.it — ARRICCHIMENTO dell'avviso: scadenza e recapiti (§26.90).
 *
 * Passo 5 della pipeline (`index.ts`): quando l'elenco non dichiara la scadenza
 * o non pubblica un recapito, il dato si cerca sulla PAGINA UFFICIALE dell'avviso
 * e nei suoi allegati — mai inventato. Verificato da `scripts/test-arricchimento.ts`:
 *   · **scadenza** solo se il testo la dichiara (`scadenza`, `entro il`, `termine`):
 *     una data nuda non basta e un avviso senza data resta senza data (GATE 2);
 *   · **recapito** scelto per pertinenza all'istituto (`punteggioEmailScuola`),
 *     con la convenzione MIM sul codice meccanografico come ultima ratio.
 *
 * Il downloader è INIETTATO (`ScaricaPagina`): nessuna connessione parte da qui,
 * così le regole si provano offline. `index.ts` passa `scaricaPagina` (axios).
 */

import {
  estraiDataScadenza,
  punteggioEmailScuola,
  type InterpelloParsato,
} from './parser.ts';
import {
  emailDaHtml,
  eDocumentoBinario,
  sottolinkCandidati,
  testoLeggibile,
} from './contattiHtml.ts';
import {
  emailDaCodiceMeccanografico,
  estraiCodiceMeccanograficoDaTesto,
  normalizzaCodiceMeccanografico,
  risolviEmailUfficialeScuola,
} from '../lib/emailScuola.ts';

/** Lettore di una pagina: l'unica porta verso la rete (iniettata). */
export type ScaricaPagina = (url: string) => Promise<string>;

/* ------------------------------- Scadenze ------------------------------- */

/**
 * Arricchisce la SCADENZA degli avvisi che non la dichiarano nell'elenco:
 * scarica la PAGINA UFFICIALE e prova a estrarre "scadenza / entro il / termine…"
 * dal suo testo. Best-effort e limitato (max N richieste); non inventa mai date.
 */
export async function arricchisciScadenze(
  avvisi: InterpelloParsato[],
  opts: { scarica: ScaricaPagina; max?: number },
): Promise<number> {
  const max = opts.max ?? 20;
  const senzaScadenza = avvisi.filter((a) => !a.expirationDate && a.link);
  if (senzaScadenza.length === 0) return 0;
  let arricchiti = 0;
  for (const a of senzaScadenza.slice(0, max)) {
    try {
      const html = await opts.scarica(a.link as string);
      const testo = testoLeggibile(html);
      const scad = estraiDataScadenza(testo);
      if (scad) {
        a.expirationDate = scad;
        arricchiti += 1;
      }
    } catch {
      // pagina non raggiungibile: l'avviso resta senza scadenza (nessuna data inventata)
    }
  }
  console.log(
    `• Scadenze: ${arricchiti}/${Math.min(senzaScadenza.length, max)} arricchite dalla pagina ufficiale (${senzaScadenza.length} avvisi senza data dichiarata).`,
  );
  return arricchiti;
}

/**
 * Cerca l'email di candidatura su PIÙ fonti collegate all'avviso:
 *   1. il link di dettaglio e gli altri link candidati della voce;
 *   2. i sottolink documentali (allegati/circolari) della pagina di dettaglio.
 * Sceglie l'indirizzo più pertinente all'istituto. Non inventa nulla.
 *
 * `usaCodice = false` (§26.90) spegne l'ULTIMA RATIO della risoluzione: il codice
 * meccanografico viene comunque letto e restituito (serve al nome/PEC della
 * scuola), ma non genera l'indirizzo `codice@istruzione.it`. È il comportamento
 * atteso da `SCRAPER_EMAIL_DA_CODICE=0`: prima del refactor il flag valeva solo
 * per il passo successivo e la derivazione rientrava da qui.
 */
export async function cercaEmailNelleFonti(
  a: InterpelloParsato,
  scarica: ScaricaPagina,
  usaCodice = true,
): Promise<{ email: string | null; codice: string | null }> {
  const tuttiLink = [
    ...new Set([a.link, ...(a.linkCandidati ?? [])].filter((u): u is string => Boolean(u))),
  ];
  // Il codice meccanografico può stare ANCHE nell'URL di un documento binario
  // (PDF) o di una pagina di riepilogo/"Stampa" — es. `…/ASTF01000X-interpello.pdf`.
  // Va letto PRIMA di scartare i link non leggibili come testo, altrimenti si
  // perde la casella ufficiale (PEO) proprio sugli avvisi più "poveri".
  let codice =
    normalizzaCodiceMeccanografico(a.schoolCode) ??
    estraiCodiceMeccanograficoDaTesto(tuttiLink.join(' '));
  const radici = tuttiLink
    .filter((u) => /^https?:\/\//i.test(u) && !eDocumentoBinario(u))
    .slice(0, 2);
  if (radici.length === 0) return { email: null, codice };

  const visitate = new Set<string>();
  const emailTrovate = new Set<string>();
  const pagine: { html: string; url: string }[] = [];

  // Livello 1: pagine di dettaglio / link candidati (testo + mailto:).
  for (const url of radici) {
    if (visitate.has(url)) continue;
    visitate.add(url);
    try {
      const html = await scarica(url);
      pagine.push({ html, url });
      codice = codice ?? estraiCodiceMeccanograficoDaTesto(testoLeggibile(html));
      for (const e of emailDaHtml(html)) emailTrovate.add(e);
    } catch {
      // pagina non raggiungibile: si prosegue
    }
  }

  // Livello 2 (solo se ancora nulla): un livello di profondità verso gli allegati.
  if (emailTrovate.size === 0) {
    for (const { html, url } of pagine) {
      for (const sub of sottolinkCandidati(html, url, 2)) {
        if (visitate.has(sub) || eDocumentoBinario(sub)) continue;
        visitate.add(sub);
        try {
          const htmlAllegato = await scarica(sub);
          codice = codice ?? estraiCodiceMeccanograficoDaTesto(testoLeggibile(htmlAllegato));
          for (const e of emailDaHtml(htmlAllegato)) emailTrovate.add(e);
        } catch {
          // allegato non raggiungibile
        }
      }
    }
  }

  let migliore: string | null = null;
  let migliorPunteggio = -Infinity;
  // Il codice (anche quello appena ricavato da URL/pagina) aiuta a preferire la
  // casella effettivamente legata all'istituto.
  const ctxFinale = { schoolCode: codice ?? a.schoolCode, schoolName: a.schoolName };
  for (const e of emailTrovate) {
    const p = punteggioEmailScuola(e, ctxFinale);
    if (p > migliorPunteggio) {
      migliorPunteggio = p;
      migliore = e;
    }
  }
  return {
    email:
      risolviEmailUfficialeScuola({
        emailsTrovate: migliore ? [migliore] : [],
        schoolCode: usaCodice ? (codice ?? a.schoolCode) : null,
      })?.email ?? null,
    codice,
  };
}

/**
 * Email istituzionale derivata dal codice meccanografico: SOLO la convenzione
 * UFFICIALE del Ministero (`codice@istruzione.it`). Nessun indirizzo costruito su
 * un codice malformato e nessun nome di scuola inventato (direttiva 04/10/2026,
 * §26.47 — il vecchio `resolveSchoolByCode` fabbricava «Istituto &lt;codice&gt;»).
 */
export function emailIstituzionaleDaCodice(schoolCode?: string | null): string | null {
  return emailDaCodiceMeccanografico(schoolCode ?? '')?.peo ?? null;
}

/** Sotto questa soglia l'email è considerata debole → vale la pena approfondire. */
export const SOGLIA_EMAIL_AFFIDABILE = 30;

/**
 * Arricchisce l'EMAIL di candidatura scavando su più fonti (pagina di dettaglio,
 * allegati, altri link candidati) e confrontando la pertinenza con l'istituto.
 * Ultima ratio: email istituzionale derivata dal codice meccanografico
 * (convenzione MIM, vedi `emailScuola.ts`). "Email non disponibile" resta solo
 * se NESSUNA fonte produce un indirizzo. Non inventa nulla oltre tale convenzione.
 */
export async function arricchisciContatti(
  avvisi: InterpelloParsato[],
  opts: { scarica: ScaricaPagina; max?: number; usaCodice?: boolean },
): Promise<number> {
  const max = opts.max ?? 20;
  const usaCodice = opts.usaCodice ?? true;
  if (avvisi.length === 0) return 0;

  // Priorità agli avvisi SENZA email (poi a quelli con email).
  const ordinati = [...avvisi].sort(
    (x, y) => (x.contactEmail ? 1 : 0) - (y.contactEmail ? 1 : 0),
  );
  const campione = ordinati.slice(0, max);

  let migliorati = 0;
  let daPagine = 0;
  let daCodice = 0;
  for (const a of campione) {
    const ctx = { schoolCode: a.schoolCode, schoolName: a.schoolName };
    const attuale = a.contactEmail ?? null;
    let migliore = attuale;
    let migliorPunteggio = attuale ? punteggioEmailScuola(attuale, ctx) : -Infinity;

    // Approfondisce su più fonti solo se manca l'email o è debole.
    if (migliorPunteggio < SOGLIA_EMAIL_AFFIDABILE) {
      const esito = await cercaEmailNelleFonti(a, opts.scarica, usaCodice);
      // Il codice meccanografico può emergere anche dalla pagina ufficiale:
      // salvarlo permette la risoluzione PEO/PEC e il nome reale della scuola.
      if (esito.codice && !a.schoolCode) a.schoolCode = esito.codice;
      const trovata = esito.email;
      if (trovata) {
        const p = punteggioEmailScuola(trovata, ctx);
        if (p > migliorPunteggio) {
          migliore = trovata;
          migliorPunteggio = p;
          daPagine += 1;
        }
      }
    }

    // Ultima ratio / RINFORZO: convenzione MIM sul codice meccanografico.
    // Si usa l'email derivata sia quando manca un contatto, sia quando quello
    // trovato è DEBOLE (es. dominio personale) e la derivata è più pertinente:
    // così si evita "Email non disponibile" (o un contatto sbagliato) quando
    // l'istituto ha una casella istituzionale desumibile dal codice.
    if (usaCodice && a.schoolCode && (!migliore || migliorPunteggio < SOGLIA_EMAIL_AFFIDABILE)) {
      const derivata = emailIstituzionaleDaCodice(a.schoolCode);
      if (derivata) {
        const p = punteggioEmailScuola(derivata, ctx);
        if (!migliore || p > migliorPunteggio) {
          migliore = derivata;
          migliorPunteggio = p;
          daCodice += 1;
        }
      }
    }

    if (migliore && migliore !== attuale) {
      a.contactEmail = migliore;
      migliorati += 1;
    }
  }

  console.log(
    `• Contatti: ${migliorati} email trovate/migliorate su ${campione.length} avvisi ` +
      `(${daPagine} dalle pagine collegate, ${daCodice} derivate dal codice meccanografico).`,
  );
  return migliorati;
}
