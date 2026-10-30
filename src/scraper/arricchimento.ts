/**
 * ScuoleRadar.it — ARRICCHIMENTO dell'avviso: scadenza e recapiti (§26.90).
 *
 * Passo 5 della pipeline (`index.ts`): quando l'elenco non dichiara la scadenza
 * o non pubblica un recapito, il dato si cerca sulla PAGINA UFFICIALE dell'avviso
 * e nei suoi allegati — mai inventato. Verificato da `scripts/test-arricchimento.ts`:
 *   · **scadenza** solo se il testo la dichiara (`scadenza`, `entro il`, `termine`):
 *     una data nuda non basta e un avviso senza data resta senza data (GATE 2);
 *   · **recapito** scelto per GERARCHIA di natura (`lib/gerarchiaContatti.ts`, §26.116:
 *     PEO → segreteria → dirigenza → generica → PEC) e, a parità di natura, per
 *     pertinenza all'istituto (`punteggioEmailScuola`); la convenzione MIM sul
 *     codice meccanografico resta l'ultima ratio (mai sopra una casella osservata).
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
} from '../lib/emailScuola.ts';
import {
  eAggiornamentoContatto,
  eContattoPrimario,
  scegliContatto,
} from '../lib/gerarchiaContatti.ts';

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
  // Il codice (anche quello appena ricavato da URL/pagina) aiuta a preferire la
  // casella effettivamente legata all'istituto.
  const ctxFinale = { schoolCode: codice ?? a.schoolCode, schoolName: a.schoolName };
  // §26.116 — GERARCHIA tra le email osservate nella fonte: PEO, segreteria,
  // dirigenza, generica; PEC solo se non c'è altro. A parità di natura resta il
  // criterio di prima (pertinenza all'istituto, `punteggioEmailScuola`).
  const osservate = [...emailTrovate]
    .map((email) => ({ email, provenienza: 'fonte', punteggio: punteggioEmailScuola(email, ctxFinale) }))
    .sort((x, y) => y.punteggio - x.punteggio);
  const scelta = scegliContatto(osservate);
  // La PEO ricostruita dal codice vale solo per una casella NON reale: una PEC
  // trovata nella pagina non deve sopravvivere alla PEO ufficiale dell'istituto.
  // Un dominio personale (gmail…) non è MAI un recapito: al massimo lo si legge
  // per il codice meccanografico.
  const derivata = usaCodice ? emailIstituzionaleDaCodice(codice ?? a.schoolCode) : null;
  if (!scelta || scelta.natura === 'esterno') migliore = derivata;
  else migliore = eContattoPrimario(scelta.email) ? scelta.email : (derivata ?? scelta.email);
  return { email: migliore, codice };
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

  // §26.116 — PRIORITÀ: prima chi NON ha un recapito reale (buco, PEC o dominio
  // personale), poi chi ne ha già uno buono. L'arricchimento opportunistico
  // completa le righe candidate senza consumare il budget su quelle a posto.
  const daMigliorare = (a: InterpelloParsato): number => (eContattoPrimario(a.contactEmail) ? 1 : 0);
  const ordinati = [...avvisi].sort((x, y) => daMigliorare(x) - daMigliorare(y));
  const campione = ordinati.slice(0, max);

  let migliorati = 0;
  let daPagine = 0;
  let daCodice = 0;
  for (const a of campione) {
    const attuale = a.contactEmail ?? null;
    let migliore = attuale;

    // Approfondisce su più fonti quando il recapito manca o quando quello che
    // c'è NON è una casella reale (PEC/dominio personale): è lo scavo
    // opportunistico che trasforma una PEC nella PEO dell'istituto.
    if (!eContattoPrimario(attuale)) {
      const esito = await cercaEmailNelleFonti(a, opts.scarica, usaCodice);
      // Il codice meccanografico può emergere anche dalla pagina ufficiale:
      // salvarlo permette la risoluzione PEO/PEC e il nome reale della scuola.
      if (esito.codice && !a.schoolCode) a.schoolCode = esito.codice;
      const trovata = esito.email;
      if (trovata && eAggiornamentoContatto(migliore, trovata)) {
        migliore = trovata;
        daPagine += 1;
      }
    }

    // Ultima ratio / RINFORZO: convenzione MIM sul codice meccanografico. Si usa
    // quando il recapito manca o quando quello presente NON è una casella reale
    // (PEC, dominio personale). Una ricostruzione non sale mai sopra una casella
    // osservata: quella è la casella che il bando indica.
    if (usaCodice && a.schoolCode && !eContattoPrimario(migliore)) {
      const derivata = emailIstituzionaleDaCodice(a.schoolCode);
      if (derivata && eAggiornamentoContatto(migliore, derivata, { derivato: true })) {
        migliore = derivata;
        daCodice += 1;
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
