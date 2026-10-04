/**
 * ScuoleRadar.it — Flight Board degli interpelli in tempo reale (Homepage).
 * Tavola stile aeroporto con le opportunità attive di interpelli, ordinate
 * per data di pubblicazione (`created_at`, più recenti prima; a parità, scadenza
 * più vicina prima). Lettura A PAGINE (`flightBoard/letturaBoard.ts`): il
 * tabellone copre TUTTI gli avvisi attivi, non solo quelli che stanno in una
 * risposta di PostgREST (max 1.000 righe). Chi entra in bacheca lo decide il
 * filtro condiviso `flightBoard/filtroAttivi.ts`: scadenza non passata OPPURE
 * nessuna scadenza ma pubblicato negli ultimi 60 giorni (`lib/liveBoard.ts`).
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
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { diversificaProvince, preparaRigheBoard } from '@/lib/liveBoard';
import { metricaBoard, pagineBoard } from './flightBoard/metricaBoard';
import { leggiTutteLePagine } from './flightBoard/letturaBoard';
import { filtroAttivi } from './flightBoard/filtroAttivi';
import { urlValido, type InterpelloLive } from './flightBoard/righeBoard';
import { RigaBoard, RigheRiempimento } from './flightBoard/components/RigaBoard';

const RIGHE_PER_PAGINA = 5;
const ROTAZIONE_MS = 8_000;

/** Colonne servite alla tavola: una sola definizione per tutte le pagine lette. */
const COLONNE_INTERPELLI =
  'id, title, school_name, school_code, province, class_codes, materia, expiration_date, created_at, source_url';

/** Rendering della riga: `flightBoard/components/RigaBoard.tsx` (RigaBoard, RigheRiempimento);
 *  dati derivati (tipologia, urgenza, date brevi): `flightBoard/rigaBoardDati.ts`. */

export function FlightBoardInterpelli() {
  const [righe, setRighe] = useState<InterpelloLive[]>([]);
  const [pagina, setPagina] = useState(0);
  const [caricato, setCaricato] = useState(false);
  const [totaleAttivi, setTotaleAttivi] = useState<number | null>(null);

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

      // Conteggio esatto degli avvisi attivi: query leggera (`head: true`) che
      // alimenta l'etichetta della vetrina e CHIUDE la lettura a pagine.
      const { count } = await client
        .from('interpelli')
        .select('id', { count: 'exact', head: true })
        .or(filtro);
      if (!attivo) return;
      setTotaleAttivi(typeof count === 'number' ? count : null);

      // TUTTI gli avvisi attivi, a pagine (`flightBoard/letturaBoard.ts`):
      // PostgREST non consegna più di 1.000 righe per richiesta, quindi una
      // lettura singola taglierebbe il resto in silenzio.
      const lettura = await leggiTutteLePagine<InterpelloLive>({
        attese: typeof count === 'number' ? count : null,
        chiave: (r) => r.id,
        chiediPagina: async (da, a) => {
          const { data, error } = await client
            .from('interpelli')
            .select(COLONNE_INTERPELLI)
            .or(filtro)
            .order('created_at', { ascending: false })
            .order('expiration_date', { ascending: true, nullsFirst: false })
            .order('id', { ascending: false })
            .range(da, a);
          return { data: (data ?? null) as InterpelloLive[] | null, error };
        },
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

      const conFonte = lettura.righe.filter((r) => Boolean(urlValido(r.source_url)));

      const pronte = diversificaProvince(preparaRigheBoard(conFonte));

      const attivi: InterpelloLive[] = pronte.map((p) => ({
        ...p.riga,
        school_name: p.scuola,
        expiration_date: p.scadenza,
        // Marcatore di vetrina: il nome mostrato è un ripiego (nome grezzo del
        // bando o «Anagrafica in aggiornamento») → la riga lo dichiara. La riga
        // resta comunque in bacheca (direttiva 04/10/2026, §26.47).
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
  // UNICA fonte della scala: le schermate contano le righe DAVVERO in vetrina
  // (`RIGHE_PER_PAGINA` righe ciascuna). La stessa `pagine` governa l'etichetta,
  // la rotazione automatica e il taglio delle righe mostrate: mai un conteggio
  // diverso da quello che il tabellone può davvero mostrare.
  const pagine = pagineBoard(totale, RIGHE_PER_PAGINA);
  const paginaSicura = pagina < pagine ? pagina : 0;
  const metrica = metricaBoard({
    righeCaricate: totale,
    totaleReale: totaleAttivi,
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
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Radar Live: Tutti gli Interpelli Scuola e Avvisi di Reclutamento in Italia
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Scansione in tempo reale h24 di tutti gli interpelli nazionali, supplenze brevi e annuali, bandi PNRR/PON e avvisi per Docenti di ogni ordine e grado, Personale ATA, Collaboratori Scolastici ed Esperti Esterni.
          </p>
          {metrica.etichettaTotale && (
            <div className="mt-3 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <span className="w-2 h-2 mr-2 bg-emerald-500 rounded-full animate-pulse" />
                {metrica.etichettaTotale.toUpperCase()}
              </div>
              <h2 className="text-base sm:text-lg lg:text-xl font-extrabold text-blue-600 tracking-tight whitespace-nowrap">
                CLICKA SU UN’OFFERTA DI LAVORO QUALSIASI PER VEDERE CHE SONO AVVISI VERI, NON ESEMPI!
              </h2>
            </div>
          )}
        </div>

        {vuoto && (
          <div className="rounded-xl border border-primary-100 bg-slate-900 px-6 py-10 text-center shadow-card">
            <p className="text-lg font-bold text-white sm:text-xl">Nessun bando attivo al momento</p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              La scansione resta accesa: appena lo scraper intercetta un interpello reale lo trovi qui, senza dover ricaricare la pagina.
            </p>
          </div>
        )}

        {!vuoto && (
          <div className="overflow-hidden rounded-xl border border-primary-100 bg-slate-900 shadow-card">
            <div className="overflow-x-hidden">
              <div key={`pagina-${paginaSicura}`} className="flight-slide-in w-full">
                <table className="w-full text-left text-sm table-fixed">
                  <thead className="bg-slate-800 text-[11px] uppercase tracking-[0.14em] text-slate-300">
                    <tr>
                      <th className="px-4 py-3 w-[15%]">Classe / Tipologia</th>
                      <th className="px-4 py-3 w-[24%]">Scuola</th>
                      <th className="px-4 py-3 w-[37%]">Descrizione</th>
                      <th className="px-4 py-3 w-[11%] text-center">Provincia</th>
                      <th className="px-4 py-3 w-[13%] text-center">Scadenza</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-card">
              {metrica.etichettaPagine}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}