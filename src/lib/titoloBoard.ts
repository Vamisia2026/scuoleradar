/**
 * ScuoleRadar.it — Dal TITOLO dell'avviso alla riga del «Radar Live» (modulo puro).
 *
 * Perché un modulo a parte: `liveBoard.ts` è il gate della vetrina e vive già al
 * limite delle righe del gate strutturale; la lettura del titolo (separatori,
 * sigle, code di procedura) è una responsabilità distinta e va provata da sola.
 *
 * Due domande, due funzioni:
 *
 * 1. `nomeScuolaDaTitolo` — QUAL È L'ISTITUTO? Strategia a tre passate, tutte
 *    filtrate dallo stesso gate (`nomeIstituto.ts`), così non può uscire un
 *    codice amministrativo spacciato per nome:
 *      a. SEGMENTI: il titolo si spezza sui separatori forti («—», «–», « - »,
 *         «|», «:», «•», a capo) e si prova dall'ULTIMO al primo (nelle fonti
 *         reali il nome sta in coda: «… – IC CICAGNA – Cicagna»);
 *      b. TESTE: se nessun segmento basta si cerca la prima testa d'istituto
 *         («IC», «I.I.S.», «Liceo», «Istituto», «Convitto»…) DENTRO il titolo e
 *         si prova da lì, accorciando la coda una parola alla volta. Serve per i
 *         titoli che nominano la scuola dopo la procedura («Interpello supplenza
 *         IC CARRARESE EUGANEO A-022 del 20/10/2026»), dove la classe di
 *         concorso in coda farebbe scartare tutto il frammento.
 *    Nessun nome inventato: se il gate non approva, si restituisce `null` e la
 *    riga resta fuori dalla vetrina (`preparaRigheBoard`).
 *
 * 2. `eTitoloSoloData` — IL TITOLO DICE QUALCOSA? Un titolo fatto della sola
 *    riga di pubblicazione («PUBBLICATO IL 18/10/2026», «Avviso di
 *    pubblicazione del 18/10/2026») non descrive l'opportunità: in bacheca
 *    occuperebbe una riga senza dire nulla. Questi avvisi non entrano
 *    (`preparaRigheBoard`), come già accade per le righe senza scadenza.
 */
import { nomeIstitutoPresentabile } from './nomeIstituto.ts';

/** Separatori forti: dove un titolo reale stacca la procedura dall'istituto. */
const SEPARATORI = /\s*[—–•|»]\s*|\s+-\s+|\s*:\s*|\n+/;

/**
 * Teste d'istituto: dove può INIZIARE il nome quando il titolo non separa.
 * Volutamente senza la parola «Scuola» da sola: «Scuola primaria posto
 * Montessori» è un'etichetta di posto, non un istituto (il gate la scarta, ma
 * tanto vale non proporla).
 */
const TESTA_ISTITUTO =
  /\b(?:I\.?\s?C\.?|I\.?\s?S\.?\s?I\.?\s?S\.?|I\.?\s?I\.?\s?S\.?|ISIS|IIS|ITIS|IPSIA|IPSCT|ITC|ITE|ITI|ITG|IPSC|IPS|CPIA|ISA|SMS|Liceo|Licei|Istituto|Ist\.|Convitto|Collegio|Educandato|Circolo|Comprensivo|Omnicomprensivo|Direzione\s+Didattica)/gi;

/** Parole che compongono la riga di PUBBLICAZIONE (non descrivono l'avviso). */
const PAROLE_PUBBLICAZIONE =
  /\b(?:pubblicat[oaie]|pubblicazione|avviso|prot(?:ocollo)?|n|il|in\s+data|data|del|dal|alle|ore)\b/gi;

/**
 * Nome d'istituto ricavato dal titolo dell'avviso, altrimenti `null`.
 * È l'ULTIMO ripiego di `nomeScuolaRiga`: prima vengono `school_name` e il
 * registro per codice meccanografico (dati certi), poi il testo della fonte.
 */
export function nomeScuolaDaTitolo(titolo?: string | null): string | null {
  const testo = (titolo ?? '').replace(/\s+/g, ' ').trim();
  if (testo.length < 4) return null;

  // a. Segmenti, dall'ultimo al primo.
  const segmenti = testo
    .split(SEPARATORI)
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = segmenti.length - 1; i >= 0; i -= 1) {
    const nome = nomeIstitutoPresentabile((segmenti[i].split(',')[0] ?? '').trim());
    if (nome) return nome;
  }

  // b. Teste d'istituto dentro il titolo, coda accorciata a ogni tentativo.
  for (const testa of testo.matchAll(TESTA_ISTITUTO)) {
    const nome = nomeDaCoda(testo.slice(testa.index ?? 0));
    if (nome) return nome;
  }

  return null;
}

/**
 * Prova la coda dal più LUNGO al più corto: vince il nome più completo che il
 * gate approva. Accorciare è necessario quando la coda porta un codice che il
 * gate rifiuta in blocco («… EUGANEO A-022 del 20/10/2026»).
 */
function nomeDaCoda(coda: string): string | null {
  const parole = coda.split(/\s+/).filter(Boolean).slice(0, 8);
  for (let n = parole.length; n >= 2; n -= 1) {
    const nome = nomeIstitutoPresentabile(parole.slice(0, n).join(' '));
    if (nome) return nome;
  }
  return null;
}

/**
 * True se il titolo NON descrive l'avviso: contiene solo la riga di
 * pubblicazione e/o una data («PUBBLICATO IL 18/10/2026»). Una riga così in
 * bacheca occuperebbe una schermata senza dire niente: resta fuori.
 */
export function eTitoloSoloData(titolo?: string | null): boolean {
  const testo = (titolo ?? '').replace(/\s+/g, ' ').trim();
  if (!testo) return true;
  const residuo = testo
    .replace(PAROLE_PUBBLICAZIONE, ' ')
    .replace(/\d{1,4}(?:[/.\-:]\d{1,4})*/g, ' ')
    .replace(/[^A-Za-zÀ-ÿ]+/g, ' ')
    .trim();
  return residuo.split(/\s+/).filter((p) => p.length >= 4).length === 0;
}
