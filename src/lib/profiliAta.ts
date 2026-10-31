/**
 * ScuoleRadar.it — TUTTI I LAVORATORI DELLA SCUOLA: i profili del personale ATA
 * (modulo PURO, §26.126).
 *
 * PERCHÉ ESISTE. Fino al 31/10/2026 l'ingestione riconosceva SOLO i codici dei
 * docenti (`A-12`, `ADEE`, `A042`, `AB25`): un bando per collaboratori
 * scolastici, assistenti amministrativi o assistenti tecnici entrava con
 * `class_codes` VUOTO — quindi con la sola firma «GENERALE». Nel database la
 * riga c'era, ma nessun profilo poteva agganciarla: la RPC `match_interpelli`
 * filtra per `class_codes && varianti` e un array vuoto non interseca nulla.
 * Risultato: il personale ATA (segreteria, bidelli, tecnici) non riceveva MAI
 * un'opportunità, pur essendo metà della scuola.
 *
 * LE TRE ETICHETTE DEL CATALOGO (`src/data/classiConcorso.ts`, `ordine: 'ata'`):
 *   · `ATA-AA` — Assistente amministrativo (segreteria)
 *   · `ATA-AT` — Assistente tecnico (laboratori)
 *   · `ATA-CS` — Collaboratore scolastico (bidelli)
 *
 * LA REGOLA (due gradini, dichiarati)
 *   1. **profilo ESPLICITO** — il testo nomina il profilo («collaboratori
 *      scolastici», «bidelli», «assistenti amministrativi», «personale di
 *      segreteria», «assistenti tecnici»): quella è la classe dell'avviso;
 *   2. **FAMIGLIA ATA** — il testo dichiara il personale ATA senza il profilo
 *      («personale ATA», «bando ATA», «ATA – a.s. 2026/27», «settore ATA»): il
 *      bando è aperto a TUTTI i profili, quindi l'avviso porta **tutte e tre** le
 *      classi. Un'opportunità ATA non si scarta e non si indovina: si dichiara
 *      per intero.
 *
 * Il token «ATA» da solo è ammesso SOLO come parola intera: «data», «ATAC»,
 * «ATA24» non lo contengono. Nessuna euristica sul resto del testo.
 *
 * LIMITE DICHIARATO. La funzione giudica il TESTO che riceve: se il chiamante le
 * passa una pagina intera (come fa il parser universale), un «personale ATA» nel
 * menu della scuola vale come nel titolo dell'avviso. È lo stesso comportamento
 * dei codici docente, ed è il verso giusto dell'errore per questa direttiva:
 * meglio un avviso ATA in più (che il match per provincia e il punteggio
 * ridimensionano) che un bando vero invisibile a chi lavora in segreteria.
 *
 * Il codice è la forma CANONICA del catalogo (`ATA-AA`): `normalizzaClasse`
 * (`matchingEngine`) e `classe_chiave` (SQL) la lasciano invariata — la
 * conversione riguarda solo il formato «lettere + numero» — quindi le varianti
 * della RPC (`ATA-AA` e `ATAAA`) intercettano la riga.
 *
 * Guardia: `npm run test:profili-ata` (inclusa in `npm test`).
 */

/** I profili ATA del catalogo, nell'ordine in cui si presentano all'utente. */
export const CODICI_ATA = ['ATA-AA', 'ATA-AT', 'ATA-CS'] as const;

/** Codice di un profilo ATA del catalogo. */
export type CodiceAta = (typeof CODICI_ATA)[number];

/** Etichetta leggibile di ogni profilo (mai il solo codice nei post). */
const ETICHETTE_ATA: Record<CodiceAta, string> = {
  'ATA-AA': 'Assistente amministrativo',
  'ATA-AT': 'Assistente tecnico',
  'ATA-CS': 'Collaboratore scolastico',
};

/**
 * Codice ATA in forma canonica: `ata-aa` · `ATA AA` · `ata_aa` · `ATA‑AA`
 * (trattino tipografico) → `ATA-AA`. `null` se non è un profilo del catalogo.
 */
export function normalizzaCodiceAta(codice?: string | null): CodiceAta | null {
  const c = (codice ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_\u2010-\u2015]+/g, '-');
  return (CODICI_ATA as readonly string[]).includes(c) ? (c as CodiceAta) : null;
}

/** True se il codice è un profilo ATA del catalogo (in qualunque grafia). */
export function eCodiceAta(codice?: string | null): boolean {
  return normalizzaCodiceAta(codice) !== null;
}

/** Etichetta leggibile («ATA-CS» → «Collaboratore scolastico»); `null` se ignoto. */
export function etichettaProfiloAta(codice?: string | null): string | null {
  const canonico = normalizzaCodiceAta(codice);
  return canonico ? ETICHETTE_ATA[canonico] : null;
}

/* ------------------------------- Riconoscimento ------------------------------- */

/**
 * Famiglia ATA dichiarata senza profilo. `ATA` come parola intera: è la forma
 * dei titoli («Personale ATA», «Bando ATA a.s. 2026/27»), mentre «data», «ATAC»
 * e «ATA24» restano fuori grazie ai confini di parola.
 */
const RE_FAMIGLIA_ATA =
  /\b(?:personale|comparto|settore|area|profil[oi])\s+(?:di\s+|del\s+|della\s+|dei\s+)?ata\b|(?:^|[^a-z0-9])ata(?:$|[^a-z0-9])/i;

/** Profilo ATA ESPLICITO: il testo nomina il mestiere, non solo la famiglia. */
const RE_PROFILI_ATA: ReadonlyArray<{ codice: CodiceAta; re: RegExp }> = [
  {
    codice: 'ATA-AA',
    re: /\bassistent[ei]\s+amministrativ|\bpersonale\s+(?:di\s+|della\s+)?segreteria\b|\bsegreteria\s+amministrativ/i,
  },
  {
    codice: 'ATA-AT',
    re: /\bassistent[ei]\s+tecnic|\baiutanti?\s+tecnic|\bpersonale\s+tecnic[oi]\s+(?:di\s+)?laborator/i,
  },
  {
    codice: 'ATA-CS',
    re: /\bcollaborator[ei]\s+scolastic|\bbidell[oi]\b|\bpersonale\s+(?:ausiliario|di\s+ausilio)\b/i,
  },
];

/**
 * Codici ATA dichiarati dal testo, in ordine di catalogo (`ATA-AA`, `ATA-AT`,
 * `ATA-CS`). Testo vuoto o nessun riferimento ATA → lista vuota: **non si
 * indovina** un profilo per un bando che non lo nomina.
 *
 * `famiglia: false` restituisce SOLO i profili espliciti (serve a chi vuole la
 * precisione massima, es. una visura manuale).
 */
export function codiciAtaDaTesto(
  testo?: string | null,
  opts: { famiglia?: boolean } = {},
): CodiceAta[] {
  const t = (testo ?? '').trim();
  if (!t) return [];
  const espliciti = new Set<CodiceAta>();
  for (const { codice, re } of RE_PROFILI_ATA) {
    if (re.test(t)) espliciti.add(codice);
  }
  // Famiglia dichiarata e nessun profilo esplicito → il bando è aperto a tutti.
  const famiglia = opts.famiglia !== false && RE_FAMIGLIA_ATA.test(t);
  if (espliciti.size === 0 && !famiglia) return [];
  return CODICI_ATA.filter((codice) => espliciti.has(codice) || famiglia);
}

/**
 * True se il testo parla di personale ATA in qualunque forma (famiglia o
 * profilo): è il segnale usato dal pre-filtro del rumore e dai titoli.
 */
export function dichiaraPersonaleAta(testo?: string | null): boolean {
  return codiciAtaDaTesto(testo).length > 0;
}
