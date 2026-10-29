/**
 * ScuoleRadar.it — Scraper · ARRICCHIMENTO dall'anagrafica delle scuole.
 *
 * Ponte fra il parser e l'inserimento: prima di scrivere un avviso su `interpelli`
 * si completa con l'anagrafica ufficiale (`../lib/anagraficaScuole.ts`) — nome
 * reale dell'istituto, codice meccanografico, email PEO e PEC. È il punto che
 * rende l'arricchimento **uniforme** su tutte le superfici: Pubblico (bacheca
 * «Radar Live»), Personale (feed dell'utente) e Regionale (Radar di prova)
 * leggono la stessa tabella, quindi nessuna di esse deve sapere dell'anagrafica.
 *
 * Regole:
 *  · l'indice si carica UNA volta per processo (i file pesano ~13 MB: mai a ogni
 *    avviso) e se i file non ci sono lo scraper prosegue identico a prima;
 *  · non si sovrascrive MAI un dato già presente (`arricchisciDaAnagrafica`);
 *  · il conteggio degli avvisi arricchiti finisce in `riepilogoAnagrafica()`,
 *    così il run lo può dichiarare invece di nasconderlo.
 */
import {
  arricchisciDaAnagrafica,
  caricaAnagrafica,
  type IndiceAnagrafica,
} from '../lib/anagraficaScuole.ts';
import {
  dominioUfficialeDaCodice,
  homeUfficialeDaCodice,
  mappaDominiDaAnagrafica,
} from '../lib/dominiAnagrafica.ts';
import { homeEduIt, hostEduIt, statisticheMappa } from '../lib/dominiScuola.ts';
import type { InterpelloParsato } from './parser.ts';

/** Conteggi del run corrente (diagnostica: nessun arricchimento silenzioso). */
export interface RiepilogoAnagrafica {
  /** true se l'anagrafica è stata trovata e letta. */
  disponibile: boolean;
  /** Codici indicizzati. */
  codici: number;
  /** File anagrafici letti. */
  file: number;
  /** Avvisi del run a cui sono stati aggiunti campi. */
  arricchiti: number;
}

let indice: IndiceAnagrafica | null = null;
let annunciata = false;
let arricchiti = 0;

/** Indice condiviso del processo (caricato pigramente, una volta sola). */
function indiceAnagrafica(): IndiceAnagrafica {
  if (!indice) indice = caricaAnagrafica();
  if (!annunciata) {
    annunciata = true;
    const dettaglio = indice.fileLetti.map((f) => `${f.file} (${f.righe} righe)`).join(', ');
    const stat = statisticheMappa(mappaDominiDaAnagrafica(indice));
    console.log(
      indice.disponibile
        ? `• Anagrafica scuole: ${indice.totale} codici meccanografici da ${indice.fileLetti.length} file — ` +
            `${stat.codici} con dominio ufficiale *.edu.it (${stat.domini} domini) — ${dettaglio}`
        : '• Anagrafica scuole NON disponibile (file SCUANAGRAFE assenti): avvisi inseriti senza arricchimento.',
    );
  }
  return indice;
}

/**
 * Avviso parsato → avviso completo (stessa forma, campi mancanti riempiti).
 * Senza anagrafica, o senza nulla da aggiungere, ritorna l'oggetto di partenza.
 */
export function arricchisciConAnagrafica(a: InterpelloParsato): InterpelloParsato {
  const indiceCorrente = indiceAnagrafica();
  if (!indiceCorrente.disponibile) return a;

  const esito = arricchisciDaAnagrafica(indiceCorrente, {
    school_code: a.schoolCode,
    school_name: a.schoolName,
    contact_email: a.contactEmail,
    school_site: a.schoolSite,
    title: a.title,
    province: a.province,
  });
  const { patch } = esito;
  const schoolSite = sitoIstituzionaleUfficiale(
    indiceCorrente,
    patch.school_site ?? a.schoolSite,
    patch.school_code ?? a.schoolCode,
  );
  if (Object.keys(patch).length === 0 && schoolSite === (a.schoolSite ?? null)) return a;

  arricchiti += 1;
  return {
    ...a,
    schoolCode: patch.school_code ?? a.schoolCode,
    schoolName: patch.school_name ?? a.schoolName,
    schoolPec: patch.school_pec ?? a.schoolPec ?? null,
    schoolSite,
    contactEmail: patch.contact_email ?? a.contactEmail,
  };
}

/**
 * SITO ISTITUZIONALE da scrivere in `school_site`, nella priorità che il
 * tabellone poi applica (`departments/radar/flightBoard/linkFonte.ts`):
 *   1. l'host `*.edu.it` già dichiarato dalla riga o dall'anagrafica;
 *   2. il dominio ufficiale del codice meccanografico (`lib/dominiScuola.ts`):
 *      la mappa MIM copre anche i plessi che non dichiarano un sito;
 *   3. il valore grezzo (es. un dominio storico non `.edu.it`): resta com'è,
 *      perché la bacheca lo scarta da sola e non spetta allo scraper censurare.
 */
function sitoIstituzionaleUfficiale(
  indice: IndiceAnagrafica,
  sito?: string | null,
  codice?: string | null,
): string | null {
  const host = hostEduIt(sito) ?? dominioUfficialeDaCodice(indice, codice);
  if (host) return host;
  const grezzo = (sito ?? '').trim();
  return grezzo.length > 0 ? grezzo : null;
}

/**
 * HOME UFFICIALE `.edu.it` dell'istituto di un avviso, PRIMA dell'arricchimento
 * dei campi: serve al presidio del link (`presidioLinkIngresso.ts`), che deve
 * sapere dove mandare l'utente quando la pagina dell'avviso non esiste più.
 * Ordine: sito già dichiarato dalla riga → mappa dell'anagrafica per codice.
 */
export function homeUfficialeAvviso(a: {
  schoolSite?: string | null;
  schoolCode?: string | null;
}): string | null {
  const diretta = homeEduIt(a.schoolSite);
  if (diretta) return diretta;
  return homeUfficialeDaCodice(indiceAnagrafica(), a.schoolCode);
}

/** Conteggi del run (file letti, codici indicizzati, avvisi arricchiti). */
export function riepilogoAnagrafica(): RiepilogoAnagrafica {
  const indiceCorrente = indice ? indice : caricaAnagrafica();
  return {
    disponibile: indiceCorrente.disponibile,
    codici: indiceCorrente.totale,
    file: indiceCorrente.fileLetti.length,
    arricchiti,
  };
}
