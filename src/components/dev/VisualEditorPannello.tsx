/**
 * ScuoleRadar.it — VISUAL EDITOR (click-to-edit, solo sviluppo): pannello di modifica.
 *
 * Interfaccia del sistema: riceve dal provider blocchi e callback e mostra in basso a sinistra i
 * CONTROLLI in un unico badge — conteggio dei testi trovati e delle modifiche, esportazione,
 * azzeramento della pagina o di tutte le pagine, uscita — più, quando serve, UNA sola scheda:
 *   · nessun testo selezionato → solo il badge (nessun pannello né testo descrittivo);
 *   · testo selezionato → casella con «Salva», «Ripristina» (solo se modificato) e «Chiudi»;
 *   · esportazione → testo pronto da incollare nel codice o JSON scaricabile.
 * Il pannello è marcato `data-sr-visual-editor`: la scansione lo ignora e i click qui dentro non
 * aprono altre caselle (è l'eccezione prevista dalle regole dell'editor stesso).
 */
import { useState } from 'react';
import { Copy, Download, Pencil, RotateCcw, X } from 'lucide-react';
import { type BloccoEditabile } from '@/lib/visualEditorScansione';
import {
  esportaJsonRotte,
  esportaTestoRotta,
  overrideTutteLeRotte,
  type OverrideRotta,
} from '@/lib/visualEditorStore';
import { VisualEditorCasella } from '@/components/dev/VisualEditorCasella';
import {
  PULSANTE,
  PULSANTE_BADGE,
  PULSANTE_PIENO,
  copia,
  quandoEsportato,
  scarica,
} from '@/components/dev/visualEditorUi';

/** Proprietà del pannello: attivazione, dati e azioni forniti dal provider. */
export interface PropsVisualEditorPannello {
  /** True se l'editor è acceso (badge verde, click-to-edit attivo). */
  attivo: boolean;
  /** Accende/spegne l'editor (la scelta è ricordata fra i refresh). */
  onImpostaAttivo: (valore: boolean) => void;
  /** Pagina corrente: è la chiave delle modifiche. */
  rotta: string;
  /** Blocchi di testo trovati nella pagina (per i conteggi). */
  blocchi: BloccoEditabile[];
  /** Modifiche salvate della pagina corrente. */
  modifiche: OverrideRotta;
  /** Blocco selezionato (casella aperta), se c'è. */
  blocco: BloccoEditabile | null;
  /** Apre/chiude la casella di un blocco. */
  onSeleziona: (chiave: string | null) => void;
  /** Scrive (o riporta al codice, se il campo resta vuoto) il testo di un blocco. */
  onScrivi: (chiave: string, valore: string) => void;
  /** Riporta il blocco al testo del codice. */
  onRipristina: (chiave: string) => void;
  /** Riporta al codice tutti i testi della pagina. */
  onAzzeraRotta: () => void;
  /** Riporta al codice tutti i testi di tutte le pagine. */
  onAzzeraTutto: () => void;
}

/**
 * Badge dei controlli (conteggi, esportazione, azzeramento, uscita) più la scheda del momento:
 * casella di modifica oppure esportazione. Nessun pannello descrittivo: i comandi bastano a
 * spiegarsi. Non sa nulla del DOM: riceve dati e azioni dal provider.
 */
export function VisualEditorPannello({
  attivo,
  onImpostaAttivo,
  rotta,
  blocchi,
  modifiche,
  blocco,
  onSeleziona,
  onScrivi,
  onRipristina,
  onAzzeraRotta,
  onAzzeraTutto,
}: PropsVisualEditorPannello) {
  const [esportazione, setEsportazione] = useState<{
    testo: string;
    nome: string;
    modo: 'pagina' | 'tutte';
  } | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const modificati = Object.keys(modifiche).length;

  // Editor spento: resta il solo invito ad accenderlo, discreto, in basso a sinistra.
  if (!attivo) {
    return (
      <button
        type="button"
        data-sr-visual-editor
        onClick={() => onImpostaAttivo(true)}
        title="«Click-to-edit» dei testi: clicca un testo della pagina e modificalo (solo sviluppo)"
        className="fixed bottom-4 left-4 z-[60] inline-flex items-center gap-1.5 rounded-full bg-primary-900/95 px-3.5 py-2 text-xs font-bold text-white shadow-soft ring-1 ring-white/20 transition hover:bg-primary-700"
      >
        <Pencil className="h-3.5 w-3.5 text-secondary-400" />
        Modifica testi
      </button>
    );
  }

  /** Prepara l'esportazione: testo pronto per il codice (pagina) o JSON (tutte le pagine). */
  const preparaEsportazione = (modo: 'pagina' | 'tutte') => {
    if (modo === 'pagina') {
      setEsportazione({
        testo: esportaTestoRotta(rotta, modifiche, quandoEsportato()),
        nome: `scuoleradar-testi${rotta.replace(/\//g, '-')}.txt`,
        modo,
      });
    } else {
      setEsportazione({
        testo: esportaJsonRotte(overrideTutteLeRotte()),
        nome: 'scuoleradar-testi-tutte-le-pagine.json',
        modo,
      });
    }
    setAvviso(null);
  };

  const suCopia = async () => {
    if (!esportazione) return;
    const esito = await copia(esportazione.testo);
    setAvviso(esito ? 'Copiato negli appunti' : 'Copia non riuscita: seleziona il testo a mano');
    window.setTimeout(() => setAvviso(null), 2400);
  };

  return (
    <>
      {/* Badge: quanti testi ha trovato la pagina e quante modifiche sono in memoria */}
      <div
        data-sr-visual-editor
        className="fixed bottom-4 left-4 z-[60] flex flex-wrap items-center gap-1.5 rounded-full bg-primary-900/95 px-3 py-1.5 text-xs font-bold text-white shadow-soft ring-1 ring-white/20"
      >
        <Pencil className="h-3.5 w-3.5 text-secondary-400" />
        <span>Visual Editor</span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">
          {blocchi.length} testi · {modificati} modificati
        </span>
        <button
          type="button"
          className={PULSANTE_BADGE}
          onClick={() => preparaEsportazione('pagina')}
        >
          Esporta
        </button>
        <button
          type="button"
          className={PULSANTE_BADGE}
          title="Riporta al codice tutti i testi di questa pagina"
          onClick={onAzzeraRotta}
        >
          <RotateCcw className="h-3 w-3" />
          Azzera
        </button>
        <button
          type="button"
          className={PULSANTE_BADGE}
          title="Riporta al codice tutti i testi di tutte le pagine"
          onClick={onAzzeraTutto}
        >
          Azzera tutte
        </button>
        <button type="button" className={PULSANTE_BADGE} onClick={() => onImpostaAttivo(false)}>
          Esci
        </button>
      </div>

      {esportazione ? (
        <div
          data-sr-visual-editor
          className="fixed bottom-20 left-4 z-[64] flex max-h-[70vh] w-[26rem] flex-col rounded-xl bg-white p-3 shadow-card ring-2 ring-sky-700"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-primary-900">Esportazione · {rotta}</p>
            <button
              type="button"
              aria-label="Chiudi esportazione"
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setEsportazione(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="mt-2 min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-700">
            {esportazione.testo}
          </pre>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button type="button" className={PULSANTE_PIENO} onClick={() => void suCopia()}>
              <Copy className="h-3 w-3" />
              Copia
            </button>
            <button
              type="button"
              className={PULSANTE}
              onClick={() =>
                scarica(
                  esportazione.nome,
                  esportazione.testo,
                  esportazione.modo === 'tutte' ? 'application/json' : 'text/plain',
                )
              }
            >
              <Download className="h-3 w-3" />
              Scarica
            </button>
            <button
              type="button"
              className={PULSANTE}
              onClick={() => preparaEsportazione(esportazione.modo === 'pagina' ? 'tutte' : 'pagina')}
            >
              {esportazione.modo === 'pagina' ? 'Tutte le pagine (.json)' : 'Solo questa pagina'}
            </button>
          </div>
          {avviso && <p className="mt-1.5 text-[11px] font-medium text-accent-700">{avviso}</p>}
        </div>
      ) : blocco ? (
        <div
          data-sr-visual-editor
          className="fixed bottom-20 left-4 z-[64] w-[21rem] rounded-xl bg-white p-3 shadow-card ring-2 ring-sky-700"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-primary-900">{blocco.dove}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {blocco.tag.toLowerCase()} · {blocco.modificato ? 'modificato' : 'testo del codice'}
              </p>
            </div>
            <button
              type="button"
              aria-label="Chiudi la casella"
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={() => onSeleziona(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <VisualEditorCasella
            key={blocco.chiave}
            blocco={blocco}
            onScrivi={onScrivi}
            onRipristina={onRipristina}
          />
        </div>
      ) : null}
    </>
  );
}

