/**
 * ScuoleRadar.it — Dipartimento Notizie · VOCE EDITORIALE unica.
 *
 * Riferimento permanente: docs/BLOG_EDITORIAL_GUIDELINES.md
 *
 * Un solo posto decide COME si scrive una notizia ("colto ma sciolto": preciso
 * ma leggibile), così promozione, ingestione e rigenerazione dell'archivio non
 * divergono. Il modulo è PURO (nessuna rete, nessun accesso ai dati) e fornisce:
 *
 *  - `REGOLE_VOCE`         → le regole vincolanti di stile e di contenuto;
 *  - `bloccoVoceEditoriale()` → lo stesso blocco pronto per i prompt LLM;
 *  - `espandiAcronimi()`   → l'applicazione della regola "prima menzione".
 */

import { GLOSSARIO_ACRONIMI } from './lessicoScuola';

/** Nome della voce editoriale del dipartimento (una sola, per tutti i canali). */
export const NOME_VOCE = 'colto ma sciolto';

export interface RegolaVoce {
  /** Chiave stabile della regola (usata dai test e dai prompt). */
  id: string;
  /** Regola vincolante, in forma affermativa e verificabile. */
  testo: string;
}

/**
 * REGOLE VINCOLANTI della voce editoriale Notizie. Sono specifiche di prodotto:
 * chi genera o rigenera un articolo (LLM o template) deve rispettarle tutte.
 */
export const REGOLE_VOCE: readonly RegolaVoce[] = [
  {
    id: 'voce',
    testo:
      'Voce colto ma sciolto: termini precisi al posto del gergo inutile, frasi brevi, seconda persona ("hai", "puoi", "devi"). Chi legge non è del settore: se una frase richiede un dizionario, va riscritta.',
  },
  {
    id: 'prima_menzione',
    testo:
      'Ogni sigla, acronimo o termine tecnico è spiegato tra parentesi alla PRIMA menzione (es. "GPS (Graduatorie Provinciali per le Supplenze)", "SPID (Sistema Pubblico di Identità Digitale)"); nelle occorrenze successive si usa la sigla, senza ripetere la spiegazione.',
  },
  {
    id: 'fatti',
    testo:
      'Solo fatti contenuti nella fonte ufficiale: nessun dato inventato, nessuna previsione, nessuna interpretazione personale.',
  },
  {
    id: 'zero_burocratese',
    testo:
      'Vietate le aperture e le formule burocratiche ("Il Ministero ha comunicato che", "Si comunica", "È stato pubblicato", "La notizia riguarda"): si apre da che cosa cambia per chi legge.',
  },
  {
    id: 'zero_press',
    testo:
      'Vietato il tono da comunicato stampa o celebrativo: nessun elogio, nessun "importante opportunità" o "grande risultato", nessun evento promozionale, nessun inventario di attività.',
  },
  {
    id: 'zero_politica',
    testo:
      'Nessun riferimento a dichiarazioni, interviste, discorsi, cerimonie o schieramenti politici: contano solo gli atti che vincolano il personale della scuola.',
  },
  {
    id: 'pratico',
    testo:
      'Ogni paragrafo dice qualcosa di operativo: che cosa cambia, a chi serve, entro quando e che cosa fare.',
  },
  {
    id: 'zero_fluff',
    testo:
      'Nessuna promessa vuota ("ti avvisiamo appena esce", "le date saranno confermate") e nessun rinvio vago ("verifica nel testo ufficiale"): le indicazioni portano al documento.',
  },
  {
    id: 'link_unico',
    testo:
      'Un solo link nel testo dell’articolo: quello diretto al documento o all’avviso ufficiale (nessun indice, nessuna home, nessun segnaposto).',
  },
  {
    id: 'nessuna_cta',
    testo:
      'Nessun footer, firma, invito a iscriversi, link al blog o call to action promozionale.',
  },
];

/** Aperture e formule vietate: citate come contro-esempi nei prompt. */
export const APERTURE_VIETATE: readonly string[] = [
  'Il Ministero ha comunicato che…',
  'Il MIM ha pubblicato…',
  'È stato pubblicato…',
  'Si comunica che…',
  'La notizia riguarda…',
];

/**
 * Blocco della voce editoriale pronto per i prompt LLM: una riga per regola,
 * nello stesso ordine di `REGOLE_VOCE` (nessuna duplicazione nei prompt).
 */
export function bloccoVoceEditoriale(): string {
  return REGOLE_VOCE.map((r) => `- ${r.testo}`).join('\n');
}

/** Aperture da evitare, in un'unica riga citabile dentro un prompt. */
export function apertureVietateTesto(): string {
  return APERTURE_VIETATE.map((a) => `"${a}"`).join(', ');
}

/**
 * Spiega gli ACRONIMI alla prima occorrenza: "GPS" → "GPS (Graduatorie
 * Provinciali per le Supplenze)". Restituisce il testo aggiornato e le sigle
 * spiegate, così le chiamate successive (sintesi, corpo) non le ripetono.
 */
export function espandiAcronimi(
  testo: string,
  giàSpiegati: Set<string> = new Set(),
): { testo: string; spiegati: string[] } {
  let out = testo ?? '';
  const spiegati: string[] = [];
  for (const [sigla, spiegazione] of Object.entries(GLOSSARIO_ACRONIMI)) {
    if (giàSpiegati.has(sigla)) continue;
    // Già spiegato nel testo (forma estesa presente) → niente doppioni.
    if (out.toLowerCase().includes(spiegazione.toLowerCase().slice(0, 24))) {
      giàSpiegati.add(sigla);
      continue;
    }
    const re = new RegExp(`\\b${sigla}\\b(?!\\s*\\()`);
    // Se la sigla è già spiegata tra parentesi nel testo (es. "(POLIS)"), non si
    // annida una seconda parentesi: si considera spiegata.
    if (new RegExp(`\\(\\s*${sigla}\\b`).test(out)) {
      giàSpiegati.add(sigla);
      continue;
    }
    if (!re.test(out)) continue;
    out = out.replace(re, `${sigla} (${spiegazione})`);
    giàSpiegati.add(sigla);
    spiegati.push(sigla);
  }
  return { testo: out, spiegati };
}
