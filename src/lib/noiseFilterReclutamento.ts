/**
 * ScuoleRadar.it — INDICATORI DI RECLUTAMENTO DEL LESSICO REALE (§26.141).
 *
 * Modulo sorello di `noiseFilter.ts` (come `noiseFilterAta.ts` e
 * `noiseFilterSindacale.ts`): le formule con cui gli istituti pubblicano davvero
 * una ricerca di persone vivono qui per tenere il filtro principale sotto la
 * soglia di attenzione delle 250 righe.
 *
 * Sono INDICATORI POSITIVI: servono a salvare una voce che porta un segnale di
 * rumore SOFT (una circolare, un orario) e che però annuncia un reclutamento con
 * parole che il filtro non conosceva — «ricerca di personale», «selezione di
 * personale», «esperto esterno».
 *
 * IL CONFINE, dichiarato: qui NON entra la parola «concorso». In una scuola
 * «concorso» è anche quello degli alunni (concorso letterario, di poesia, di
 * fotografia): ammetterla salverebbe una circolare per le famiglie spacciandola
 * per un bando. Il rumore inutile (scioperi, consigli di classe, menu mensa,
 * circolari alunni, elezioni degli organi collegiali) resta fuori come prima.
 *
 * PURO: nessuna dipendenza, nessun I/O.
 */
export const INDICATORI_RECLUTAMENTO: readonly RegExp[] = [
  /\bricerca\s+(?:di\s+)?personale\b/i,
  /\bselezion[ei]\s+(?:di\s+|del\s+|per\s+il\s+)?personale\b/i,
  /\bespert[oi]\s+estern[oi]\b/i,
];
