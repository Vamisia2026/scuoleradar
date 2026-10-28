/**
 * ScuoleRadar.it — TABELLE DENNE DEGLI UST: lettura PROFONDA + gate semantico.
 *
 * Perché esiste: i portali degli UST (Arezzo, Grosseto, …) e molti albi pubblicano
 * tabelle-dati con MOLTE colonne — data di scadenza, codice meccanografico,
 * denominazione, classe di concorso, oggetto, link al documento — che il
 * riconoscitore di layout di `table-reporter` non sempre accetta come «tabella
 * interpelli» (mappatura colonne assente, intestazioni atipiche, righe con celle
 * unite). Il risultato, prima, era zero record su pagine che contenevano decine di
 * avvisi veri.
 *
 * Qui la riga è letta con cheerio e RICOMPOSTA (`datiRiga` di `righeTabella.ts`,
 * che sa unire le celle e recuperare le etichette di colonna della scadenza), poi
 * passa un GATE SEMANTICO STRETTO che ammette solo ciò che è un vero interpello di
 * supplenza:
 *
 *   1. rumore amministrativo (`lib/noiseFilter.ts`): scioperi, assemblee,
 *      circolari, determine, gare — il TITOLO decide, il corpo salva solo con un
 *      indicatore di reclutamento;
 *   2. stato CHIUSO dichiarato (chiuso, concluso, revocato, annullato, scaduto);
 *   3. scadenza DICHIARATA: senza data la riga non è candidabile (le tabelle la
 *      dichiarano sempre: se manca, la riga è un'esito o un'intestazione);
 *   4. non scaduta, e dentro la finestra di `GIORNI_ORIZZONTE_OPPORTUNITA` (15
 *      giorni): oltre, la «data» è quasi sempre la fine dell'incarico;
 *   5. segnale di INSEGNAMENTO (interpello, supplenza, sostegno, classe di
 *      concorso, posto, docente, ATA): un elenco di graduatorie non passa.
 *
 * Il link della riga è scelto con una preferenza esplicita: prima un documento o
 * una pagina non di piattaforma (`lib/piattaformeLink.ts`), MAI un login Argo /
 * Spaggiari / Nuvola spacciato per avviso; se non c'è altro si tiene quello che
 * la fonte ha scritto (l'identità dell'avviso resta).
 *
 * PURO: nessuna rete, nessuna scrittura, nessun `new Date()` implicito (la data di
 * riferimento si passa nelle opzioni). Verificato da `npm run test:tabella-ust`
 * (incluso in `npm test`).
 */
import * as cheerio from 'cheerio';
import { estraiCodiceMeccanograficoDaTesto } from '../lib/emailScuola.ts';
import { isAdministrativeNoise } from '../lib/noiseFilter.ts';
import { ePiattaformaPrivata } from '../lib/piattaformeLink.ts';
import { GIORNI_ORIZZONTE_OPPORTUNITA, dataIsoLocale } from '../lib/scadenza.ts';
import { estraiDataScadenza, rilevaClassi } from './parser.ts';
import { datiRiga, titoloVoce } from './righeTabella.ts';
import { scuolaDaRiga } from './scuolaDaRiga.ts';

/** Nodo HTML accettato dalle query cheerio (stessa convenzione di `righeTabella`). */
type NodoHtml = Parameters<cheerio.CheerioAPI>[0];

/** Una riga-dati letta da una tabella: i campi che servono alla certificazione. */
export interface RigaTabellaUst {
  /** Titolo dell'atto (testo del link se descrittivo, altrimenti parte della riga). */
  titolo: string;
  /** Testo completo della riga, celle unite (`datiRiga.contesto`). */
  testo: string;
  /** Scadenza dichiarata in forma ISO (`AAAA-MM-GG`), altrimenti `null`. */
  data: string | null;
  /** Codice meccanografico della scuola, `ND` quando la riga non lo dichiara. */
  codice: string;
  /** Denominazione della scuola leggibile dalla riga (o risolta dal codice). */
  scuola: string | null;
  /** Classi di concorso riconosciute nella riga (forma normalizzata). */
  classi: string[];
  /** Link dell'avviso (assoluto), scelto con `scegliLinkRiga`. */
  link: string | null;
}

/** Esito del gate: `candidabile` o `scartato` con il motivo leggibile. */
export type EsitoRigaUst = RigaTabellaUst & {
  stato: 'candidabile' | 'scartato';
  motivo: string | null;
};

/** Stato dichiarato CHIUSO: un avviso concluso non è un'opportunità. */
const RE_STATO_CHIUSO =
  /\b(?:chius[oaie]|conclus[oaie]|scadut[oaie]|revocat[oaie]|annullat[oaie]|cancellat[oaie]|sospes[oaie]|non\s+pi[uù]\s+(?:attivo|disponibile))\b/i;

/** Segnale di INSEGNAMENTO: senza questo la riga è un elenco, non un interpello. */
const RE_SEGNALE_INSEGNAMENTO =
  /\b(?:interpell\w*|supplenz\w*|supplente|sostegno|docente|insegnante|ATA|collaborator[ei]\s+scolastic[oi]|posto\s+(?:intero|di\s+sostegno)|class[ei]\s+di\s+concorso|graduator\w*\s+di\s+istituto)\b/i;

/** Opzioni del gate: la data di riferimento si passa SEMPRE nei test. */
export interface OpzioniGateUst {
  /** «Oggi» (default: adesso). */
  oggi?: Date;
  /** Finestra massima di candidabilità in giorni (default: 15, §26.82). */
  giorniFinestra?: number;
}

/** Link non apribili o non informativi: ancore interne, script, protocolli strani. */
function usabile(href: string): boolean {
  const pulito = href.trim();
  return Boolean(pulito) && pulito !== '#' && !/^(?:javascript|mailto|tel):/i.test(pulito) && !pulito.startsWith('#');
}

/**
 * Link della riga con una PREFERENZA dichiarata: prima un documento/pagina non di
 * piattaforma, poi un qualsiasi link non di piattaforma, infine il primo link
 * scritto dalla fonte. `null` se la riga non ne ha.
 *
 * Perché non «il primo `<a>`»: sulle tabelle UST la prima ancora è spesso
 * l'icona del registro elettronico (Argo/Spaggiari), che per l'utente è una
 * pagina di login; l'avviso vero è il PDF accanto.
 */
export function scegliLinkRiga(
  $: cheerio.CheerioAPI,
  riga: NodoHtml,
  baseUrl: string
): { url: string; testo: string } | null {
  const candidati: Array<{ url: string; testo: string; piattaforma: boolean; documento: boolean }> = [];
  $(riga)
    .find('a[href]')
    .each((_, ancora) => {
      const href = ($(ancora).attr('href') ?? '').trim();
      if (!usabile(href)) return;
      let url: string;
      try {
        url = new URL(href, baseUrl).toString();
      } catch {
        return;
      }
      if (!/^https?:/i.test(url)) return;
      const testo = $(ancora).text().replace(/\s+/g, ' ').trim();
      candidati.push({
        url,
        testo,
        piattaforma: ePiattaformaPrivata(url),
        documento: /(\.pdf|\.docx?|\.odt|allegato|avviso|interpell|graduator|domanda)/i.test(url),
      });
    });
  if (candidati.length === 0) return null;
  const scelto =
    candidati.find((c) => !c.piattaforma && c.documento) ??
    candidati.find((c) => !c.piattaforma) ??
    candidati[0];
  return { url: scelto.url, testo: scelto.testo };
}

/**
 * Scadenza dichiarata nel testo di una riga (etichette di colonna comprese).
 * Esportata perché è il ripiego con cui `table-reporter` recupera le righe in cui
 * la mappatura delle colonne non ha trovato la data.
 */
export function scadenzaDaRiga(testo: string): string | null {
  return estraiDataScadenza(testo);
}

/**
 * Righe-dati di TUTTE le tabelle della pagina. Nessun giudizio: una riga di
 * intestazione, una riga di impaginazione e una cella unica non producono nulla
 * (`datiRiga` restituisce `null`), e le righe ripetute da tabelle annidate
 * vengono lette una volta sola.
 */
export function leggiRigheTabellaUst(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  max = 600
): RigaTabellaUst[] {
  const righe: RigaTabellaUst[] = [];
  const viste = new Set<string>();
  $('table tr').each((_, tr) => {
    const dati = datiRiga($, tr, max);
    if (!dati) return;
    const link = scegliLinkRiga($, tr, baseUrl);
    const titolo = titoloVoce(dati.contesto, link?.testo ?? '');
    const chiave = `${titolo}|${dati.contesto}|${link?.url ?? ''}`;
    if (viste.has(chiave)) return;
    viste.add(chiave);
    const codice = estraiCodiceMeccanograficoDaTesto(dati.contesto) ?? 'ND';
    righe.push({
      titolo,
      testo: dati.contesto,
      data:
        scadenzaDaRiga(`${dati.suggerimenti} · ${dati.contesto}`) ??
        scadenzaDaRiga(dati.contesto),
      codice,
      scuola: scuolaDaRiga(dati.contesto, codice === 'ND' ? null : codice),
      classi: rilevaClassi(dati.contesto),
      link: link?.url ?? null,
    });
  });
  return righe;
}

/**
 * GATE SEMANTICO STRETTO su una riga di tabella. Ordine: rumore amministrativo →
 * stato chiuso → scadenza dichiarata → scaduta → fuori finestra → segnale di
 * insegnamento. Il primo motivo vince e finisce nei log (e nel report degli
 * scarti): uno scarto muto è indistinguibile da un guasto.
 */
export function valutaRigaUst(
  riga: RigaTabellaUst,
  opts: OpzioniGateUst = {}
): EsitoRigaUst {
  const oggi = opts.oggi ?? new Date();
  const finestra = opts.giorniFinestra ?? GIORNI_ORIZZONTE_OPPORTUNITA;
  const scarto = (motivo: string): EsitoRigaUst => ({ ...riga, stato: 'scartato', motivo });

  if (!riga.testo.trim()) return scarto('riga vuota');

  const rumore = isAdministrativeNoise(riga.testo, riga.titolo || riga.testo);
  if (rumore.isNoise) return scarto(rumore.reason ?? 'rumore amministrativo');

  if (RE_STATO_CHIUSO.test(riga.testo)) return scarto('avviso chiuso/revocato');

  if (!riga.data) return scarto('scadenza non dichiarata');

  const oggiIso = dataIsoLocale(oggi);
  if (riga.data < oggiIso) return scarto('bando scaduto');

  const limite = dataIsoLocale(new Date(oggi.getTime() + finestra * 86_400_000));
  if (riga.data > limite) return scarto(`scadenza oltre la finestra di ${finestra} giorni`);

  if (riga.classi.length === 0 && !RE_SEGNALE_INSEGNAMENTO.test(riga.testo)) {
    return scarto('non è un interpello di supplenza');
  }
  return { ...riga, stato: 'candidabile', motivo: null };
}

/** Scorciatoia: pagina → esiti del gate (candidabili E scarti, con il motivo). */
export function leggiTabellaUst(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  opts: OpzioniGateUst = {}
): EsitoRigaUst[] {
  return leggiRigheTabellaUst($, baseUrl).map((riga) => valutaRigaUst(riga, opts));
}
