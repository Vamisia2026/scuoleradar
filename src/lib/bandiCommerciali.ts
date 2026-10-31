/**
 * ScuoleRadar.it — BANDI CHE NON SONO LAVORO: la severità sui falsi positivi
 * (§26.127).
 *
 * PERCHÉ ESISTE. Con l'ampliamento delle scansioni (100% delle scuole della
 * provincia in domanda, hub regionali letti in profondità, §26.126) cresce anche
 * ciò che l'albo pubblica *accanto* agli interpelli. Le tre famiglie che
 * arrivavano in bacheca:
 *
 *   1. **gare e appalti** — «Bando di gara per la fornitura di arredi», «Procedura
 *      aperta per l'affidamento del servizio di pulizia», «RdO su MEPA»: sono
 *      opportunità per un'IMPRESA, non per un docente;
 *   2. **cessioni e vendite** — «Asta pubblica per l'alienazione dell'immobile»,
 *      «Concessione del servizio di refezione»: si compra o si vende un bene;
 *   3. **pagine spazzatura** — «404», «Pagina non trovata», «Cookie policy»,
 *      «Accessibilità», «Area riservata»: la voce del menu o l'errore del sito,
 *      non un atto.
 *
 * LA REGOLA, IN DUE PASSI
 *   · **protezione** — se il TITOLO dichiara un reclutamento di personale
 *     (`interpello`, `supplenza`, `incarico`, `esperto`, `docente`, `ATA`,
 *     `collaboratore scolastico`, `DSGA`, `tutor`, `formatore`, `conferimento`,
 *     `assunzione`, `messa a disposizione`) la riga RESTA: nessuna regola qui
 *     sotto può scartarla;
 *   · **altrimenti** si guarda l'oggetto: un oggetto di appalto o un marcatore
 *     di piattaforma di acquisti scarta la riga, e così un titolo di vendita, un
 *     contenuto commerciale o una pagina morta.
 *
 * L'ERRORE AMMESSO È NELLA DIREZIONE SICURA. Una gara intitolata «selezione di
 * un esperto per la progettazione» resta in bacheca (falso negativo: una riga di
 * troppo), mentre un interpello vero non si scarta mai per una parola che non
 * capiamo (§26.47). Qualità > quantità, ma senza perdere un'opportunità vera.
 *
 * Il TESTO si legge solo nei primi caratteri: l'oggetto dell'atto sta in testa
 * (il resto è modulo, allegati, firma). Senza testo (la bacheca ha solo i campi
 * del record) il giudizio si ferma al titolo: nessun verdetto su ciò che non si
 * è letto.
 *
 * PURO e senza dipendenze. Lo usano il gate dell'ingestione
 * (`scraper/qualitaOpportunita`) e il giudizio della bacheca
 * (`lib/qualitaAvviso`), quindi una riga commerciale non entra nel database E
 * non resta in vetrina se c'era già. Guardia: `npm run test:bandi-commerciali`.
 */

/** Testo minimo per giudicare una riga: titolo, corpo (facoltativo), classi. */
export interface RigaDaGiudicare {
  titolo?: string | null;
  /** Corpo della pagina o contesto della riga: si leggono solo i primi caratteri. */
  testo?: string | null;
  /** Classi di concorso riconosciute (una classe è già una prova di reclutamento). */
  classi?: readonly string[] | null;
}

/** I motivi, esposti perché le guardie non ripetano i letterali. */
export const MOTIVO_GARA = 'gara/appalto (opportunità per un fornitore, non per il personale)';
export const MOTIVO_PIATTAFORMA =
  'procedura su piattaforma di acquisti (opportunità per un fornitore, non per il personale)';
export const MOTIVO_CESSIONE = 'vendita/concessione di beni (non è un incarico di lavoro)';
export const MOTIVO_COMMERCIALE =
  'contenuto commerciale/istituzionale di servizio (non è un avviso della scuola)';
export const MOTIVO_PAGINA_MORTA = 'pagina non disponibile o voce di servizio (non è un avviso)';
export const MOTIVO_CONCORSO_STUDENTI =
  'borsa di studio/concorso per studenti (non è un incarico di lavoro)';

/** Quanti caratteri di corpo si leggono: l'oggetto dell'atto sta in testa. */
const MAX_TEST_CHARS = 1_500;

/**
 * PROTEZIONE: il titolo dichiara un reclutamento di personale. Volutamente larga
 * — `incarico` copre anche una gara per un incarico di progettazione: meglio una
 * riga di troppo che un interpello perso.
 */
const RE_PERSONALE =
  /\b(?:interpell\w*|supplen\w*|supplent\w*|incaric\w*|espert\w*|docen\w*|insegnant\w*|personale|ata\b|dsga|bidell\w*|collaborator\w*|assistent\w*|tutor\w*|formator\w*|educator\w*|reclutament\w*|conferiment\w*|assunzion\w*|candidatur\w*|messa\s+a\s+disposizione|disponibilit\w*\s+all['’]?insegnamento)/i;

/** OGGETTO di un appalto: si compra un bene o un servizio, non si assume. */
const RE_OGGETTO_APPALTO =
  /\b(?:gara|gare|appalt\w*|fornitur\w*|acquist\w*|affidament\w*|aggiudicazion\w*|subappalt\w*|lavori\s+(?:pubblici|di\s+manutenzione))\b/i;

/** MARCATORI di una procedura su piattaforma di acquisti (basta uno). */
const RE_PIATTAFORMA =
  /(?:\bMEPA\b|\bRDO\b|\bRdO\b|trattativa\s+diretta|ordine\s+diretto|mercato\s+elettronico|piattaforma\s+(?:di\s+)?(?:approvvigionament\w*|acquist\w*|negoziazion\w*)|stazione\s+appaltante|operatore\s+economico|indagine\s+di\s+mercato|richiesta\s+di\s+offerta)/i;

/** CESSIONE di beni: asta, alienazione, vendita, locazione, concessione. */
const RE_CESSIONE =
  /\b(?:asta\s+pubblica|alienazion\w*|vendita|locazione|concessione\s+(?:demaniale|di\s+servizi|amministrativa|del\s+servizio)|comodato)\b/i;

/** COMMERCIALE/ISTITUZIONALE: si promuove qualcosa, non si assume nessuno. */
const RE_COMMERCIALE =
  /\b(?:casa\s+editrice|promozion\w*|sponsor\w*|pubblicit\w*|abbonament\w*|offerta\s+speciale|scont\w*|gadget)\b/i;

/** PAGINA MORTA o voce di servizio del sito. */
const RE_PAGINA_MORTA =
  /\b(?:404|not\s+found|pagina\s+non\s+trovata|pagina\s+inesistente|errore\s+(?:404|500|503)|in\s+manutenzione|cookie\s+policy|privacy\s+policy|informativa\s+privacy|accessibilit[àa]|mappa\s+del\s+sito|area\s+riservata|accedi|login|registrati)\b/i;

/** CONCORSO per STUDENTI: una borsa di studio non è un posto di lavoro. */
const RE_CONCORSO_STUDENTI =
  /\b(?:bors[ae]\s+di\s+studio|premio\s+(?:letterario|nazionale|di\s+poesia)|concorso\s+(?:per\s+)?(?:gli\s+)?student\w*)\b/i;

/** Testo normalizzato (NBSP compresi) e limitato per il corpo. */
function normalizza(valore: string | null | undefined, max = MAX_TEST_CHARS): string {
  return (valore ?? '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** True se il titolo dichiara un reclutamento di personale (protezione). */
export function dichiaraPersonale(titolo?: string | null): boolean {
  return RE_PERSONALE.test(normalizza(titolo, 300));
}

/**
 * Motivo per cui la riga NON è un'opportunità di lavoro (`null` = è un avviso
 * plausibile e resta). L'ordine va dalla protezione al verdetto: prima il
 * personale, poi le gare, poi i marcatori di piattaforma, poi cessioni,
 * commerciale, pagine morte e concorsi per studenti.
 */
export function motivoBandoCommerciale(riga: RigaDaGiudicare): string | null {
  const titolo = normalizza(riga.titolo, 300);
  const corpo = normalizza(riga.testo);
  if (!titolo && !corpo) return null;
  // PROTEZIONE: un titolo di reclutamento (o una classe di concorso dichiarata)
  // tiene la riga in gioco. Nessuna regola sotto può scartarla.
  if (dichiaraPersonale(titolo)) return null;
  if ((riga.classi ?? []).some((classe) => Boolean((classe ?? '').trim()))) return null;

  if (RE_OGGETTO_APPALTO.test(titolo)) return MOTIVO_GARA;
  if (RE_PIATTAFORMA.test(titolo) || RE_PIATTAFORMA.test(corpo)) return MOTIVO_PIATTAFORMA;
  // L'oggetto nel corpo vale solo per la gara dichiarata in testa al testo: una
  // pagina che CITA una gara (menù, avviso correlato) non è una gara.
  if (RE_OGGETTO_APPALTO.test(corpo.slice(0, 400))) return MOTIVO_GARA;
  if (RE_CESSIONE.test(titolo)) return MOTIVO_CESSIONE;
  if (RE_COMMERCIALE.test(titolo)) return MOTIVO_COMMERCIALE;
  if (RE_PAGINA_MORTA.test(titolo)) return MOTIVO_PAGINA_MORTA;
  if (RE_CONCORSO_STUDENTI.test(titolo)) return MOTIVO_CONCORSO_STUDENTI;
  return null;
}
