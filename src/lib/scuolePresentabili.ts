/**
 * ScuoleRadar.it — SUGGERIMENTI DEL CAMPO SCUOLA (§26.65), PURI.
 *
 * Il campo «Scuole preferite / escluse» delle Preferenze Radar non digita su un
 * elenco statico: propone i NOMI del feed reale. Qui ci sono le due funzioni che
 * servono al campo e al selettore di provincia che gli sta accanto:
 *
 *   · `scuolePresentabili(avvisi)` → i nomi d'istituto che si possono PROPORRE:
 *     titoli di sezione, materie e dump di codici non sono scuole;
 *   · `provinceSuggerite(note)`    → le province che il selettore può offrire.
 *
 * Estratto da `filtriScuole.ts` (§26.62) per tenere quel modulo entro la soglia
 * dei 250 righe: là restano le due LISTE (blacklist/whitelist) e l'ambito
 * provinciale, la loro resa nel campo sta qui. Nessuno stato, nessuna query: la
 * sorgente è il feed già in memoria (`scuoleNote`, lo stesso confronto delle liste).
 */
import { scuoleNote, siglaProvincia, type AvvisoConProvincia, type ScuolaNota } from './filtriScuole';
import { nomeIstitutoPresentabile } from './nomeIstituto';

/**
 * SCUOLE PRESENTABILI — i nomi d'istituto che si possono PROPORRE (§26.65).
 *
 * Il campo scuola non deve mai suggerire un titolo di sezione, una materia o un
 * dump di codici: il giudizio è quello già in uso per la vetrina
 * (`nomeIstitutoPresentabile`, §26.59 — testa d'istituto + denominazione, nessun
 * codice), quindi `«lettere g) e i)»`, `«Conversazione in lingua straniera»` e
 * `«A041 | B017»` non entrano nei suggerimenti. Il nome viene anche RIPULITO dal
 * suo taglio procedurale (`«IC ALBIGNASEGO Interpello per copertura posti»` →
 * `«IC ALBIGNASEGO»`), così i suggerimenti sono nomi veri. Senza doppioni.
 */
export function scuolePresentabili(avvisi: readonly AvvisoConProvincia[] | null | undefined): ScuolaNota[] {
  const out: ScuolaNota[] = [];
  const viste = new Set<string>();
  for (const nota of scuoleNote(avvisi)) {
    const nome = nomeIstitutoPresentabile(nota.nome);
    if (!nome) continue;
    const chiave = `${nome.toLowerCase()}|${nota.provinciaCodice}`;
    if (viste.has(chiave)) continue;
    viste.add(chiave);
    out.push({ ...nota, nome });
  }
  return out;
}

/** Provincia di un suggerimento, nella forma del campo «Provincia» accanto. */
export interface ProvinciaSuggerita {
  codice: string;
  nome: string;
}

/**
 * OMONIMIE — i nomi d'istituto che nell'ambito compaiono in PIÙ di una provincia.
 *
 * Sono la sola ragione per cui la provincia va detta: «IIS Volta» esiste in più
 * province, e senza sapere DOVE sta la scuola la preferenza (o la blacklist)
 * colpirebbe anche l'istituto omonimo di un'altra regione. Il campo la usa per
 * parlarne **solo quando il rischio esiste davvero** (mai un avviso a vuoto), e
 * il confronto è quello delle liste: nome in minuscolo + sigla normalizzata, una
 * voce per nome, in ordine alfabetico. Se il nome è già univoco, elenco vuoto.
 */
export function omonimieScuole(note: readonly ScuolaNota[] | null | undefined): string[] {
  const per = new Map<string, { nome: string; province: Set<string> }>();
  for (const n of note ?? []) {
    const nome = (n.nome ?? '').trim();
    const codice = siglaProvincia(n.provinciaCodice);
    if (!nome || !codice) continue;
    const voce = per.get(nome.toLowerCase()) ?? { nome, province: new Set<string>() };
    voce.province.add(codice);
    per.set(nome.toLowerCase(), voce);
  }
  return [...per.values()]
    .filter((v) => v.province.size > 1)
    .map((v) => v.nome)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Le province che il selettore del campo scuola può offrire: quelle dei
 * suggerimenti presenti, senza doppioni e in ordine alfabetico di nome. Vuoto
 * quando il feed non ha scuole presentabili (il campo resta a testo libero).
 */
export function provinceSuggerite(note: readonly ScuolaNota[] | null | undefined): ProvinciaSuggerita[] {
  const per = new Map<string, string>();
  for (const n of note ?? []) {
    const codice = siglaProvincia(n.provinciaCodice);
    if (!codice) continue;
    const nome = (n.provinciaNome ?? '').trim() || codice;
    const attuale = per.get(codice);
    // Si tiene il nome più informativo (una sigla da sola non batte il nome).
    if (!attuale || attuale === codice) per.set(codice, nome);
  }
  return [...per.entries()]
    .map(([codice, nome]) => ({ codice, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome) || a.codice.localeCompare(b.codice));
}
