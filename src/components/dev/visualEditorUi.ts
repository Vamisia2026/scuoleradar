/**
 * ScuoleRadar.it — VISUAL EDITOR (click-to-edit, solo sviluppo): pezzi condivisi dell'interfaccia.
 *
 * Stili dei pulsanti ed effetti di browser usati dalle schede del pannello
 * (`VisualEditorPannello.tsx`) e dalla casella di scrittura (`VisualEditorCasella.tsx`).
 * Stanno qui per non ripeterli — e per non far crescere i file dei componenti oltre il limite
 * di righe previsto dalla governance (`docs/MODULAR_ARCHITECTURE.md`).
 */

/** Stile dei pulsanti secondari del pannello. */
export const PULSANTE =
  'inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-sky-700 hover:text-sky-800';

/** Stile del pulsante principale («Salva»). */
export const PULSANTE_PIENO =
  'inline-flex items-center gap-1 rounded-md bg-sky-700 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-sky-800';

/** Stile dei pulsanti dentro il badge scuro. */
export const PULSANTE_BADGE =
  'inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-white/25';

/** Ora leggibile per le esportazioni (nel modulo puro dello store non c'è nessun orologio). */
export function quandoEsportato(): string {
  return new Date().toLocaleString('it-IT');
}

/** Avvia il download di un file di testo generato nel browser (esportazione delle modifiche). */
export function scarica(nomeFile: string, contenuto: string, tipo: string): void {
  if (typeof document === 'undefined') return;
  const indirizzo = URL.createObjectURL(new Blob([contenuto], { type: tipo }));
  const collegamento = document.createElement('a');
  collegamento.href = indirizzo;
  collegamento.download = nomeFile;
  document.body.appendChild(collegamento);
  collegamento.click();
  collegamento.remove();
  URL.revokeObjectURL(indirizzo);
}

/** Copia negli appunti con esito: ritorna true se il browser ha accettato. */
export async function copia(testo: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(testo);
    return true;
  } catch {
    return false;
  }
}
