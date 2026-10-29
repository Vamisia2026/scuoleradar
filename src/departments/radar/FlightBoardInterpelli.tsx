/**
 * ScuoleRadar.it — Flight Board degli interpelli in tempo reale (Homepage).
 * Tavola stile aeroporto con le opportunità attive di interpelli, ordinate
 * per data di pubblicazione (`created_at`, più recenti prima; a parità, scadenza
 * più vicina prima). Lettura A PAGINE (`flightBoard/letturaBoard.ts`): il
 * tabellone copre TUTTI gli avvisi attivi, non solo quelli che stanno in una
 * risposta di PostgREST (max 1.000 righe). Chi entra in bacheca lo decide il
 * filtro condiviso `flightBoard/filtroAttivi.ts`: scadenza dichiarata e non ancora
 * passata (§26.71: la finestra dei 60 giorni non vale più in vetrina) e
 * `lib/liveBoard.ts` applica la stessa regola in memoria. Dal §26.100 il filtro
 * **non ha più un tetto in avanti**: la finestra di candidatura di 15 giorni resta
 * al feed e al matching, mentre la vetrina mostra tutte le opportunità ancora
 * aperte — il contatore riflette così il volume attivo reale, e chi scade fra un
 * mese porta la banda blu «Scadenza lontana» invece di sparire. Il totale mostrato è
 * quello delle righe DAVVERO in vetrina: lo STESSO numero che genera le schermate.
 * Le righe presentabili vengono poi alternate per provincia
 * (`diversificaProvince`), così il tabellone è una vetrina NAZIONALE e non la
 * classifica di una sola provincia.
 *
 * RIMOSSO (direttiva cliente): il riquadro di rinvio che stava fra la bacheca e
 * l'offerta PRO. La tavola chiude e la pagina scende direttamente al piano, senza
 * un secondo elenco di avvisi da aprire.
 *
 * Colonne: "Classe / Tipologia", "Scuola", "Descrizione", "Provincia", "Scadenza".
 * Nessun mock, nessuna barra di scorrimento orizzontale, altezza fissa e pulita.
 *
 * PALETTE UFFICIALE (direttiva 29/10/2026, §26.101). Il contenitore della tavola
 * e la testata portano il BLU UFFICIALE `#2B6F9E` (bordo del riquadro, fondo
 * dell'intestazione, pillola delle schermate), le righe respirano fra bianco e
 * AZZURRINO SOFT `#EEF6FB`, i testi poggiano sul NERO `#0C2235`. Le bande di
 * scadenza (verde `#1FA055` · giallo `#E2B33C` · rosso `#D9534F`, etichetta
 * bianca) vivono nella riga (`flightBoard/components/RigaBoard.tsx`). Non resta
 * nessun blu elettrico (`bg-blue-600`) né una tinta fuori coordinamento.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { diversificaProvince, preparaRigheBoard } from '@/lib/liveBoard';
import { metricaBoard, pagineBoard } from './flightBoard/metricaBoard';
import { leggiTutteLePagine } from './flightBoard/letturaBoard';
import { creaLettoreInterpelli } from './flightBoard/letturaInterpelli';
import { filtroAttivi } from './flightBoard/filtroAttivi';
import { fonteApribile } from './flightBoard/linkFonte';
import type { InterpelloLive } from './flightBoard/righeBoard';
import { RigaBoard, RigheRiempimento } from './flightBoard/components/RigaBoard';
import { IntestazioneBoard } from './flightBoard/components/IntestazioneBoard';

const RIGHE_PER_PAGINA = 5;
const ROTAZIONE_MS = 8_000;

/**
 * Rendering della riga: `flightBoard/components/RigaBoard.tsx` (RigaBoard, RigheRiempimento);
 *  intestazione (titolo + contatore): `flightBoard/components/IntestazioneBoard.tsx`;
 *  dati derivati (tipologia, urgenza, date brevi): `flightBoard/rigaBoardDati.ts`;
 *  colonne servite e tolleranza alla migrazione: `flightBoard/letturaInterpelli.ts`. */

export function FlightBoardInterpelli() {
  const [righe, setRighe] = useState<InterpelloLive[]>([]);
  const [pagina, setPagina] = useState(0);
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setRighe([]);
      return;
    }
    const client = supabase;
    let attivo = true;
    const carica = async (): Promise<void> => {
      const adesso = new Date();
      const filtro = filtroAttivi(adesso);

      // Conteggio esatto degli avvisi attivi: serve solo a CHIUDERE la lettura a
      // pagine, non più all'etichetta (§26.71: il numero mostrato è quello delle
      // righe in vetrina, lo stesso che genera le schermate — il conteggio grezzo
      // del database diceva «869 avvisi attivi» mentre il tabellone ne pagina 396).
      const { count } = await client
        .from('interpelli')
        .select('id', { count: 'exact', head: true })
        .or(filtro);
      if (!attivo) return;

      // TUTTI gli avvisi attivi, a pagine (`flightBoard/letturaBoard.ts`):
      // PostgREST non consegna più di 1.000 righe per richiesta, quindi una
      // lettura singola taglierebbe il resto in silenzio.
      const lettura = await leggiTutteLePagine<InterpelloLive>({
        attese: typeof count === 'number' ? count : null,
        chiave: (r) => r.id,
        chiediPagina: creaLettoreInterpelli(client, filtro),
      });
      if (!attivo) return;
      if (lettura.errore) {
        console.warn('[flight-board] lettura interpelli:', lettura.errore);
        // Nessuna riga letta: nessun aggiornamento, si resta sullo stato
        // precedente (mai una vetrina vuota per un errore di rete).
        if (lettura.righe.length === 0) return;
      } else if (!lettura.esaustiva) {
        console.warn(
          `[flight-board] lettura parziale: ${lettura.righe.length} righe in ${lettura.pagineLette} pagine`,
        );
      }
      if (lettura.duplicati > 0) {
        console.warn(`[flight-board] ${lettura.duplicati} righe ripetute scartate`);
      }

      // FONTE APRIBILE (§26.76, direttiva 22/10/2026): la riga entra solo se il
      // click porta a una pagina verificabile — l'avviso vero, oppure la home
      // `.edu.it` dell'istituto quando la fonte pubblicava solo una piattaforma
      // (portale Argo, Nuvola/ClasseViva, modulo Google, cartella WeTransfer).
      // Prima bastava «un URL valido»: i link di piattaforma restavano in bacheca
      // per giorni e aprivano una pagina di login o un modulo scaduto, cioè un
      // link morto spacciato per «avviso ufficiale».
      const conFonte = lettura.righe.filter((r) => fonteApribile(r) !== null);

      const pronte = diversificaProvince(preparaRigheBoard(conFonte));

      const attivi: InterpelloLive[] = pronte.map((p) => ({
        ...p.riga,
        school_name: p.scuola,
        expiration_date: p.scadenza,
        // Stato dell'anagrafica: informativo. Da §26.76 NON è più un badge a
        // schermo (il vecchio «Scuola non specificata / Più plessi» compariva su
        // tutte le righe con anagrafica incompleta e sembrava che la scuola non
        // si sapesse): la colonna mostra solo nomi reali.
        anagrafica_parziale: p.anagraficaParziale,
      }));

      setRighe((prev) => {
        const stessoInizio = prev[0]?.id === attivi[0]?.id;
        const stessaFine = prev[prev.length - 1]?.id === attivi[attivi.length - 1]?.id;
        return prev.length === attivi.length && stessoInizio && stessaFine ? prev : attivi;
      });
      setCaricato(true);
    };

    void carica();
    const id = window.setInterval(() => void carica(), 30_000);
    return () => {
      attivo = false;
      window.clearInterval(id);
    };
  }, []);

  const totale = righe.length;
  // UNICA fonte della scala: schermate e totale mostrato nascono dallo STESSO
  // numero — le righe DAVVERO in vetrina. Mai un totale che parla di avvisi
  // diversi da quelli leggibili (§26.71: «869 avvisi attivi» con «Schermata 1 di 80»).
  const pagine = pagineBoard(totale, RIGHE_PER_PAGINA);
  const paginaSicura = pagina < pagine ? pagina : 0;
  const metrica = metricaBoard({
    righeCaricate: totale,
    totaleReale: totale,
    righePerPagina: RIGHE_PER_PAGINA,
    pagina: paginaSicura + 1,
  });

  useEffect(() => {
    if (totale <= RIGHE_PER_PAGINA) return;
    const t = window.setInterval(() => {
      setPagina((p) => (p + 1) % pagine);
    }, ROTAZIONE_MS);
    return () => window.clearInterval(t);
  }, [totale, pagine]);

  if (!caricato) return null;

  const vuoto = totale === 0;
  const visibili = righe.slice(
    paginaSicura * RIGHE_PER_PAGINA,
    paginaSicura * RIGHE_PER_PAGINA + RIGHE_PER_PAGINA,
  );

  return (
    /* Monitor a scorrimento con gli avvisi di lavoro in tempo reale: PROTETTO da
       qualsiasi editor testuale. `contentEditable={false}` lo esclude dalla
       modifica anche quando un contenitore esterno viene reso editabile;
       `translate="no"` + la classe `notranslate` impediscono alla traduzione
       automatica del browser di avvolgere le celle in nodi estranei (le righe
       cambiano da sole a ogni rotazione: nodi aggiunti dall'editor farebbero
       fallire l'aggiornamento di React); `spellCheck={false}` e `select-none`
       chiudono le altre vie di editing/selezione. Le righe restano cliccabili. */
    <section
      aria-label="Radar Live — interpelli in tempo reale"
      className="notranslate select-none bg-white py-8"
      contentEditable={false}
      spellCheck={false}
      suppressContentEditableWarning
      translate="no"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <IntestazioneBoard etichettaTotale={metrica.etichettaTotale} />

        {vuoto && (
          <div className="rounded-xl border border-[#2B6F9E] bg-[#EEF6FB] px-6 py-10 text-center shadow-card">
            <p className="text-lg font-bold text-[#0C2235] sm:text-xl">Nessun bando attivo al momento</p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-[#1B4768]">
              La scansione resta accesa: appena lo scraper intercetta un interpello reale lo trovi qui, senza dover ricaricare la pagina.
            </p>
          </div>
        )}

        {!vuoto && (
          <div className="overflow-hidden rounded-xl border border-[#2B6F9E] bg-white shadow-card">
            <div className="overflow-x-hidden">
              <div key={`pagina-${paginaSicura}`} className="flight-slide-in w-full">
                <table className="w-full text-left text-sm table-fixed">
                  <thead className="border-b border-[#2B6F9E] bg-[#2B6F9E] text-[11px] uppercase tracking-[0.14em] text-white">
                    <tr>
                      <th className="px-4 py-3 w-[15%]">Classe / Tipologia</th>
                      <th className="px-4 py-3 w-[24%]">Scuola</th>
                      <th className="px-4 py-3 w-[37%]">Descrizione</th>
                      <th className="px-4 py-3 w-[11%] text-center">Provincia</th>
                      <th className="px-4 py-3 w-[13%] text-center">Scadenza</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9E0EF]">
                    {visibili.map((r, i) => (
                      <RigaBoard key={r.id} riga={r} indice={i} />
                    ))}

                    <RigheRiempimento quante={RIGHE_PER_PAGINA - visibili.length} />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!vuoto && pagine > 1 && (
          <div className="mt-5 flex items-center justify-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1FA055] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1FA055]" />
            </span>
            <span className="inline-flex items-center rounded-full bg-[#2B6F9E] px-5 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-card">
              {metrica.etichettaPagine}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}