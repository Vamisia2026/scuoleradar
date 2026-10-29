/**
 * ScuoleRadar.it — REGOLA della pulizia pre-pubblicazione di `interpelli` (pura).
 *
 * Vive qui e non nello script perché è una REGOLA, non un effetto: la usano il
 * comando `npm run dati:pulisci`, il suo test (`scripts/test-pulizia-interpelli.ts`)
 * e — come contratto — chi legge la bacheca (`departments/radar/flightBoard/linkFonte.ts`).
 *
 * Tre decisioni per riga, nessuna euristica nuova:
 *   1. **dominio ufficiale** (`src/lib/dominiScuola.ts`): il `school_site` della
 *      riga è normalizzato all'host `*.edu.it`; se manca si prende quello della
 *      scuola dalla mappa dell'anagrafica MIM — così il tabellone può sostituire i
 *      link «trampolino» (Argo, Nuvola, moduli Google) con la home dell'istituto.
 *   2. **validità del link** (`src/lib/validitaLink.ts`): un avviso che risponde
 *      404/410 o non risponde affatto non si pubblica; se l'istituto ha una home
 *      `.edu.it` il click porta lì (dichiarato `sito-scuola`), altrimenti la riga
 *      si scarta.
 *   3. **nome scuola fittizio**: sigle di classe, «VISUALIZZA INTERPELLI» e simili
 *      non sono denominazioni → `school_name = NULL` (come prima di questa regola).
 *
 * L'allarme finale esiste perché un controllo di rete può fallire per causa NOSTRA
 * (rete assente, DNS aziendale): oltre la soglia di scarti il piano si dichiara
 * sospetto e lo script NON applica le cancellazioni.
 */
import { dominioDaCodice, homeEduIt, hostEduIt, type MappaDomini } from '../../src/lib/dominiScuola.ts';
import { decidiPubblicazione, type EsitoPingLink } from '../../src/lib/validitaLink.ts';

/** Riga minima che serve alla pulizia (le colonne recenti possono mancare). */
export interface RigaPulizia {
  id: string;
  title?: string | null;
  school_name?: string | null;
  school_code?: string | null;
  source_url?: string | null;
  school_site?: string | null;
  contact_email?: string | null;
  school_pec?: string | null;
}

/** Modifica proposta per una riga; `motivi` finisce nel report. */
export interface AggiornamentoPulizia {
  id: string;
  patch: {
    school_site?: string;
    source_url?: string;
    school_name?: null;
  };
  motivi: string[];
}

/** Riga non pubblicabile (link morto e nessuna home ufficiale). */
export interface CancellazionePulizia {
  id: string;
  motivo: string;
}

/** Conteggi del piano (diagnostica: nessuna modifica silenziosa). */
export interface ConteggiPulizia {
  esaminate: number;
  sitoPresente: number;
  sitoAggiunto: number;
  sitoAssente: number;
  linkControllati: number;
  linkTenuti: number;
  linkSostituiti: number;
  linkScartati: number;
  linkNonVerificati: number;
  nomiAzzerati: number;
}

/** Piano completo: cosa aggiornare, cosa cancellare e se fidarsi. */
export interface PianoPulizia {
  aggiorna: AggiornamentoPulizia[];
  cancella: CancellazionePulizia[];
  conteggi: ConteggiPulizia;
  /** Oltre la soglia di scarti il piano NON va applicato (probabile guasto di rete). */
  allarme: { troppiScarti: boolean; soglia: number; quota: number };
}

/** Oltre questa quota di scarti il piano è sospetto (30%). */
export const SOGLIA_SCARTI = 0.3;
/** Sotto questo numero di scarti l'allarme non scatta (campione piccolo). */
export const MINIMO_SCARTI_ALLARME = 5;

/**
 * Nome scuola NON valido (sigle/classe/etichette generiche): non è una
 * denominazione, quindi va riportato a `NULL`.
 */
export function nomeScuolaDaAzzerare(scuola?: string | null): boolean {
  const s = (scuola ?? '').trim();
  if (!s) return false;
  if (/^visualizza/i.test(s)) return true;
  if (!/[a-zà-ÿ]/.test(s)) return true; // solo maiuscole/codici (es. "EEEE", "ADEE | EEEE")
  if (/\b(?:[A-Z]{1,2}-?\d{2,3}|AD[A-Z]{2,3})\b/.test(s)) return true; // contiene un codice classe
  return false;
}


/**
 * Costruisce il piano di pulizia: `esiti` è ciò che il controllo HTTP ha
 * osservato (URL → esito). Una riga senza esito NON si cancella: un controllo non
 * eseguito non è una prova che il link sia morto.
 */
export function costruisciPianoPulizia(
  righe: ReadonlyArray<RigaPulizia>,
  opts: {
    mappa?: MappaDomini | null;
    esiti?: ReadonlyMap<string, EsitoPingLink> | null;
  } = {},
): PianoPulizia {
  const conteggi: ConteggiPulizia = {
    esaminate: 0,
    sitoPresente: 0,
    sitoAggiunto: 0,
    sitoAssente: 0,
    linkControllati: 0,
    linkTenuti: 0,
    linkSostituiti: 0,
    linkScartati: 0,
    linkNonVerificati: 0,
    nomiAzzerati: 0,
  };
  const aggiorna: AggiornamentoPulizia[] = [];
  const cancella: CancellazionePulizia[] = [];

  for (const riga of righe) {
    conteggi.esaminate += 1;
    const patch: AggiornamentoPulizia['patch'] = {};
    const motivi: string[] = [];

    // 1) DOMINIO UFFICIALE: host `*.edu.it` della riga, altrimenti dalla mappa MIM.
    const sitoAttuale = hostEduIt(riga.school_site);
    const sito = sitoAttuale ?? dominioDaCodice(opts.mappa, riga.school_code);
    if (sito && sito !== riga.school_site) {
      patch.school_site = sito;
      motivi.push(
        sitoAttuale ? 'sito istituzionale normalizzato' : 'sito ufficiale dall’anagrafica MIM',
      );
      conteggi.sitoAggiunto += 1;
    } else if (sito) {
      conteggi.sitoPresente += 1;
    } else {
      conteggi.sitoAssente += 1;
    }

    // 2) NOME SCUOLA fittizio.
    if (nomeScuolaDaAzzerare(riga.school_name)) {
      patch.school_name = null;
      motivi.push('nome scuola non reale');
      conteggi.nomiAzzerati += 1;
    }

    // 3) VALIDITÀ DEL LINK (il controllo HTTP può non essere stato eseguito).
    const link = (riga.source_url ?? '').trim();
    const esito = link ? opts.esiti?.get(link) : undefined;
    const home = homeEduIt(sito) ?? homeEduIt(riga.contact_email) ?? homeEduIt(riga.school_pec);
    const decisione = decidiPubblicazione({ link, esito, home });
    if (esito) conteggi.linkControllati += 1;
    else conteggi.linkNonVerificati += 1;

    if (decisione.azione === 'scarta') {
      cancella.push({ id: riga.id, motivo: decisione.motivo });
      conteggi.linkScartati += 1;
      continue; // riga fuori dalla bacheca: nessuna modifica da scrivere
    }
    if (decisione.azione === 'home-istituzionale' && decisione.url) {
      patch.source_url = decisione.url;
      motivi.push(decisione.motivo);
      conteggi.linkSostituiti += 1;
    } else {
      conteggi.linkTenuti += 1;
    }

    if (Object.keys(patch).length > 0) aggiorna.push({ id: riga.id, patch, motivi });
  }

  const quota = conteggi.esaminate > 0 ? conteggi.linkScartati / conteggi.esaminate : 0;
  const troppiScarti = conteggi.linkScartati >= MINIMO_SCARTI_ALLARME && quota >= SOGLIA_SCARTI;
  return {
    aggiorna,
    cancella,
    conteggi,
    allarme: { troppiScarti, soglia: SOGLIA_SCARTI, quota },
  };
}

/** Riga di report: conteggi del piano in una frase, con l'allarme se scatta. */
export function descriviPiano(piano: PianoPulizia): string {
  const c = piano.conteggi;
  const base =
    `${c.esaminate} righe esaminate · sito dalla mappa ${c.sitoAggiunto} (già presente ${c.sitoPresente}, ` +
    `assente ${c.sitoAssente}) · link controllati ${c.linkControllati} (tenuti ${c.linkTenuti}, ` +
    `sostituiti con la home ${c.linkSostituiti}, scartati ${c.linkScartati}) · ` +
    `non verificati ${c.linkNonVerificati} · nomi azzerati ${c.nomiAzzerati}`;
  const allarme = piano.allarme.troppiScarti
    ? ` · ⚠ scarti ${(piano.allarme.quota * 100).toFixed(0)}% (soglia ${(piano.allarme.soglia * 100).toFixed(0)}%)`
    : '';
  return `${base}${allarme}`;
}
