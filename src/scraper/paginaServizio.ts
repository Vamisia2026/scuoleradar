/**
 * ScuoleRadar.it — PAGINE DI SERVIZIO: spiegano, non reclutano (§26.115).
 *
 * Perché esiste. Accanto ai bandi, gli istituti pubblicano le pagine che
 * *spiegano come funziona* il reclutamento: «Messa a disposizione: come inviare
 * la propria candidatura», «Modalità di presentazione delle domande», «FAQ»,
 * «Informazioni generali», «Cos'è la MAD». Sono pagine UTILI — e non sono
 * opportunità: nessuno si candida *a* una spiegazione. Ingestite come avvisi
 * riempiono la bacheca di righe senza scadenza e senza classe, che il candidato
 * apre e richiude (il caso Perugia 14: la pagina che spiegava l'invio delle MAD
 * era in elenco come se fosse un interpello).
 *
 * LA REGOLA (una sola, con una condizione di sicurezza)
 *   una pagina è DI SERVIZIO quando dichiara un intento didascalico (come
 *   inviare, modalità, FAQ, guida, «cos'è») **e non porta né una scadenza né una
 *   classe di concorso**: senza quei due dati non c'è nulla a cui candidarsi.
 *   Con una scadenza o una classe la pagina resta: è un bando che, oltre al
 *   termine, spiega anche come si invia la domanda.
 *
 * L'ordine di lettura è quello del resto del motore: prima la SCADENZA
 * dichiarata (`lib/scadenza.ts`), poi le classi (`campiDocumento`). Questo
 * modulo non inventa nessuno dei due: li riceve dal chiamante.
 *
 * Modulo PURO: zero import, nessuna rete, nessun `node:*`.
 * Guardia: `npm run test:purghe-ingestione` (incluso in `npm test`).
 */

/** Ciò che serve per giudicare una pagina (tutti i campi sono opzionali). */
export interface PaginaServizio {
  titolo?: string | null;
  /** Testo della pagina (o del documento): secondo bacino di segnali. */
  testo?: string | null;
  /** Scadenza DICHIARATA dalla fonte (ISO o testo), `null` se assente. */
  scadenza?: string | null;
  /** Classi di concorso riconosciute nella riga/documento. */
  classi?: readonly string[] | null;
}

/** Segnali didascalici: ognuno porta il proprio motivo leggibile. */
const SEGNALI_SERVIZIO: ReadonlyArray<{ re: RegExp; motivo: string }> = [
  { re: /\bcome\s+(?:inviare|presentare|compilare|richiedere|partecipare)\b/i, motivo: 'istruzioni («come inviare»)' },
  {
    re: /\bmodalità\s+(?:di|per\s+la)\s+(?:invio|presentazione|partecipazione|candidatura)\b/i,
    motivo: 'modalità di invio della domanda',
  },
  {
    re: /\b(?:pagina|scheda|sezione|nota|avviso)\s+informativa\b|\binformazioni\s+generali\b/i,
    motivo: 'pagina informativa',
  },
  { re: /\bdomande\s+frequenti\b|\bFAQ\b/i, motivo: 'domande frequenti' },
  { re: /\bguida\s+(?:alla|al|per|operativa)\b|\bistruzioni\s+per\b/i, motivo: 'guida/istruzioni' },
  { re: /\bcos['’]?\s?è\s+(?:la|il|una|un)\b/i, motivo: 'spiegazione («cos’è»)' },
  {
    re: /\bmessa\s+a\s+disposizione\b[\s\S]{0,120}?\b(?:come|modalità|cos['’]?\s?è|informazioni)\b/i,
    motivo: 'spiegazione della messa a disposizione',
  },
];

/** Titolo e testo compattati: spazi normalizzati, nessun carattere di controllo. */
function compatto(valore?: string | null): string {
  return (valore ?? '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True se la riga porta una scadenza dichiarata (allora non è una pagina di servizio). */
export function haScadenzaDichiarata(pagina: PaginaServizio): boolean {
  return compatto(pagina.scadenza).length > 0;
}

/** True se la riga porta almeno una classe di concorso riconosciuta. */
export function haClasseDichiarata(pagina: PaginaServizio): boolean {
  return (pagina.classi ?? []).some((classe) => compatto(classe).length > 0);
}

/**
 * Motivo per cui la pagina NON è un'opportunità (`null` = nessun segnale, decide
 * il resto del filtro). Il testo si legge SOLO se il titolo non basta: la pagina
 * di servizio si annuncia già nel titolo, come ogni altro atto.
 */
export function motivoPaginaServizio(pagina: PaginaServizio): string | null {
  if (haScadenzaDichiarata(pagina) || haClasseDichiarata(pagina)) return null;

  const titolo = compatto(pagina.titolo);
  const insieme = `${titolo} ${compatto(pagina.testo).slice(0, 4000)}`;
  for (const segnale of SEGNALI_SERVIZIO) {
    if (!segnale.re.test(insieme)) continue;
    return `pagina informativa/di servizio (${segnale.motivo}, senza scadenza né classe)`;
  }
  return null;
}

/** Scorciatoia booleana: true se la pagina è di servizio (mai un'opportunità). */
export function ePaginaServizio(pagina: PaginaServizio): boolean {
  return motivoPaginaServizio(pagina) !== null;
}
