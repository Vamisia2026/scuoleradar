/**
 * ScuoleRadar.it — VISUAL EDITOR (click-to-edit, solo sviluppo): provider di radice.
 *
 * Monta il sistema UNA volta sola, dentro il router, e lo rende disponibile a tutta l'app:
 *   · `useVisualEditor(pathname)` fa il lavoro (scansione, click-to-edit, override);
 *   · l'ANELLO tratteggiato è un `<div>` `fixed` che segue il blocco sotto il puntatore o quello
 *     selezionato: viene posizionato scrivendo direttamente lo stile, senza re-render per ogni
 *     movimento del mouse;
 *   · il PANNELLO (`VisualEditorPannello.tsx`) mostra badge, guida, casella di scrittura ed
 *     esportazione.
 *
 * In produzione il componente restituisce l'albero intatto: niente effetti, niente DOM in più.
 * In `App.tsx` è montato come FRATELLO degli altri overlay (non avvolge l'app: non gli serve, la
 * pagina la legge dal DOM). L'unica dipendenza dal router è `pathname`.
 */
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useVisualEditor } from '@/hooks/useVisualEditor';
import { VisualEditorPannello } from '@/components/dev/VisualEditorPannello';
import type { NodoDom } from '@/lib/visualEditorRegole';

/** Accende il sistema solo in sviluppo: in build di produzione non monta nessun effetto. */
export function VisualEditorProvider({ children }: { children?: ReactNode }) {
  if (!import.meta.env.DEV) return <>{children}</>;
  return <SessioneVisualEditor>{children}</SessioneVisualEditor>;
}

function SessioneVisualEditor({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const {
    attivo,
    impostaAttivo,
    blocchi,
    modifiche,
    selezionato,
    elementoSelezionato,
    seleziona,
    bloccoDaElemento,
    scrivi,
    ripristina,
    azzeraRotta,
    azzeraTutto,
  } = useVisualEditor(pathname);

  const anello = useRef<HTMLDivElement | null>(null);
  const puntato = useRef<NodoDom | null>(null);

  /** Allinea l'anello al blocco selezionato o, se non c'è, a quello sotto il puntatore. */
  const posiziona = useCallback(() => {
    const cornice = anello.current;
    if (!cornice) return;
    const elemento = elementoSelezionato ?? puntato.current;
    if (!elemento) {
      cornice.style.display = 'none';
      return;
    }
    const rettangolo = (elemento as unknown as HTMLElement).getBoundingClientRect();
    cornice.style.display = 'block';
    cornice.style.top = `${rettangolo.top - 2}px`;
    cornice.style.left = `${rettangolo.left - 2}px`;
    cornice.style.width = `${rettangolo.width + 4}px`;
    cornice.style.height = `${rettangolo.height + 4}px`;
  }, [elementoSelezionato]);

  // Inseguimento del puntatore: solo a editor acceso e mai sopra l'interfaccia dell'editor.
  useEffect(() => {
    if (!attivo) {
      puntato.current = null;
      if (anello.current) anello.current.style.display = 'none';
      return undefined;
    }
    const suMossa = (evento: MouseEvent) => {
      const bersaglio = evento.target;
      const dentroInterfaccia =
        bersaglio instanceof Element &&
        bersaglio.closest('[data-sr-visual-editor],[data-sr-dev-toolbar]') !== null;
      puntato.current = dentroInterfaccia
        ? null
        : bloccoDaElemento(bersaglio as unknown as NodoDom)?.elemento ?? null;
      posiziona();
    };
    document.addEventListener('mousemove', suMossa, { passive: true });
    window.addEventListener('scroll', posiziona, { passive: true, capture: true });
    window.addEventListener('resize', posiziona);
    return () => {
      document.removeEventListener('mousemove', suMossa);
      window.removeEventListener('scroll', posiziona, true);
      window.removeEventListener('resize', posiziona);
    };
  }, [attivo, bloccoDaElemento, posiziona]);

  // Selezione o pagina nuova: l'anello si riallinea subito, senza aspettare il mouse.
  useEffect(() => {
    posiziona();
  }, [posiziona]);

  // Esc: prima chiude la casella aperta, poi spegne l'editor.
  useEffect(() => {
    if (!attivo) return undefined;
    const suTasto = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      if (selezionato) seleziona(null);
      else impostaAttivo(false);
    };
    document.addEventListener('keydown', suTasto);
    return () => document.removeEventListener('keydown', suTasto);
  }, [attivo, selezionato, seleziona, impostaAttivo]);

  return (
    <>
      {children}
      {/* Anello di evidenziazione: nessun click, quindi `pointer-events-none` */}
      <div
        ref={anello}
        data-sr-visual-editor
        aria-hidden="true"
        className="pointer-events-none fixed z-[58] rounded-md border-2 border-dashed border-sky-700/80 bg-sky-700/5"
        style={{ display: 'none' }}
      />
      <VisualEditorPannello
        attivo={attivo}
        onImpostaAttivo={impostaAttivo}
        rotta={pathname}
        blocchi={blocchi}
        modifiche={modifiche}
        blocco={selezionato}
        onSeleziona={seleziona}
        onScrivi={scrivi}
        onRipristina={ripristina}
        onAzzeraRotta={azzeraRotta}
        onAzzeraTutto={azzeraTutto}
      />
    </>
  );
}
