/**
 * Radar Live — Flight Board degli interpelli in tempo reale (Homepage).
 * Tavola stile aeroporto con le opportunità attive di `interpelli`, ordinate
 * per data di pubblicazione (created_at, più recenti prima).
 *  - NESSUN filtro per provincia/classe: pool nazionale completo di tutte le
 *    categorie (select pubblica su interpelli, policy `read interpelli`).
 *  - 5 righe FISSE per pagina (altezza bloccata, nessuno shift della pagina),
 *    rotazione automatica ogni 8 s con indicatore "Pagina X di Y";
 *  - badge scadenza in base ai giorni rimanenti;
 *  - colonna Scuola/Titolo CLICCABILE → fonte originale in nuova scheda;
 *  - DORMANCY/AUTO-WAKE: dati STRETTAMENTE reali dalla tabella `interpelli`; se
 *    0 elementi attivi la sezione resta nascosta e riappare da sola al primo
 *    interpello reale inserito dallo scraper (polling silenzioso ogni 30 s).
 */
import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, Radar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { giorniRimanenti, stileScadenza } from '@/lib/scadenza';
import { preparaRigheBoard } from '@/lib/liveBoard';
import { materiaClasse } from '@/data/classiConcorso';
import { estraiCitta, ePdf, hostDi, urlValido, type InterpelloLive } from './flightBoard/righeBoard';

const RIGHE_PER_PAGINA = 5;
const ROTAZIONE_MS = 8_000;

export function FlightBoardInterpelli() {
  const { openRadarSetup } = useApp();
  // Stato iniziale vuoto → sezione dormiente finché non ci sono interpelli reali.
  const [righe, setRighe] = useState<InterpelloLive[]>([]);
  const [pagina, setPagina] = useState(0);

  /**
   * Dormancy / auto-wake: carica i dati REALI da `interpelli` subito e poi ogni
   * 30 s (polling silenzioso). Ammesse SOLO righe con source_url valido.
   * Mostra SOLO gli interpelli ATTIVI: quelli SCADUTI vengono esclusi
   * automaticamente (`eInterpelloAttivo`) dalle liste pubbliche.
   * La sezione resta nascosta se non c'è alcun interpello attivo con fonte ufficiale.
   */
  useEffect(() => {
    if (!supabase) {
      setRighe([]);
      return;
    }
    const client = supabase;
    let attivo = true;
    const carica = async (): Promise<void> => {
      const { data, error } = await client
        .from('interpelli')
        .select(
          'id, title, school_name, school_code, province, class_codes, materia, expiration_date, created_at, source_url',
        )
        .order('created_at', { ascending: false })
        .limit(500);
      if (!attivo) return;
      if (error) {
        console.warn('[flight-board] lettura interpelli:', error.message);
        return; // mantiene lo stato precedente; nuovo tentativo al prossimo tick
      }
      // VETRINA PROFESSIONALE: entra nel tabellone solo una riga COMPLETA (fonte
      // apribile + scadenza valida + scuola risolta). Le righe con "Scuola non
      // indicata"/"Scadenza n/d" vengono prima arricchite (nome dal registro per
      // codice meccanografico o dal titolo, scadenza valida) e, se resta un
      // buco, SCARTATE: mai placeholder in una vista pubblica.
      const conFonte = ((data ?? []) as InterpelloLive[]).filter((r) =>
        Boolean(urlValido(r.source_url)),
      );
      const attivi: InterpelloLive[] = preparaRigheBoard(conFonte).map((p) => ({
        ...p.riga,
        school_name: p.scuola,
        expiration_date: p.scadenza,
      }));
      // Aggiorna SOLO se il contenuto è cambiato (evita re-render/slide inutili).
      setRighe((prev) => {
        const stessoInizio = prev[0]?.id === attivi[0]?.id;
        const stessaFine = prev[prev.length - 1]?.id === attivi[attivi.length - 1]?.id;
        return prev.length === attivi.length && stessoInizio && stessaFine ? prev : attivi;
      });
    };
    void carica();
    const id = window.setInterval(() => void carica(), 30_000);
    return () => {
      attivo = false;
      window.clearInterval(id);
    };
  }, []);

  const totale = righe.length;
  const pagine = Math.max(1, Math.ceil(totale / RIGHE_PER_PAGINA));
  const paginaSicura = pagina < pagine ? pagina : 0;

  // Rotazione automatica solo se ci sono più di 5 elementi.
  useEffect(() => {
    if (totale <= RIGHE_PER_PAGINA) return;
    const t = window.setInterval(() => {
      setPagina((p) => (p + 1) % pagine);
    }, ROTAZIONE_MS);
    return () => window.clearInterval(t);
  }, [totale, pagine]);

  // Dormiente: nessun interpello reale attivo → non viene renderizzato nulla.
  if (totale === 0) return null;

  const visibili = righe.slice(paginaSicura * RIGHE_PER_PAGINA, paginaSicura * RIGHE_PER_PAGINA + RIGHE_PER_PAGINA);

  return (
    <section aria-label="Radar Live — interpelli in tempo reale" className="bg-white py-8">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-primary-900 sm:text-3xl">
              Radar Live: Tutti gli Interpelli Scuola e Avvisi di Reclutamento in Italia
            </h2>
            <p className="mt-2 text-base text-primary-600">
              Scansione in tempo reale h24 di tutti gli interpelli nazionali, supplenze brevi e
              annuali, bandi PNRR/PON e avvisi per Docenti di ogni ordine e grado, Personale ATA,
              Collaboratori Scolastici ed Esperti Esterni.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {totale} attivi
          </span>
        </div>

        {/* Contenitore ad ALTEZZA STATICA: la slide animata non sposta la pagina */}
        <div className="overflow-hidden rounded-xl border border-primary-100 bg-slate-900 shadow-card">
          <div className="overflow-x-auto overflow-y-hidden">
            <div key={`pagina-${paginaSicura}`} className="flight-slide-in w-full">
              <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-800 text-[11px] uppercase tracking-[0.14em] text-slate-300">
              <tr>
                <th className="px-4 py-3">Classe / Tipologia</th>
                <th className="px-4 py-3">Scuola &amp; Città</th>
                <th className="px-4 py-3 text-center">Provincia</th>
                <th className="px-4 py-3 text-center">Scadenza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {visibili.map((r, i) => {
                const classe = r.class_codes?.[0] ?? '—';
                // Materia ufficiale accanto al codice classe (es. "A-22 · …").
                const materia = r.class_codes?.[0]
                  ? materiaClasse(r.class_codes[0], r.materia)
                  : null;
                const giorni = giorniRimanenti(r.expiration_date);
                const stile = stileScadenza(giorni);
                const dataScad = r.expiration_date
                  ? new Date(
                      r.expiration_date.length <= 10
                        ? `${r.expiration_date}T00:00:00`
                        : r.expiration_date,
                    ).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
                  : '';
                // Link diretto alla risorsa PIÙ SPECIFICA disponibile: il parser
                // ha già scelto allegato/PDF → pagina ufficiale → fallback ente.
                const urlFonte = urlValido(r.source_url);
                const titoloLink = urlFonte
                  ? `${ePdf(urlFonte) ? 'Apri il PDF ufficiale' : 'Apri la pagina ufficiale'}${
                      hostDi(urlFonte) ? ` (${hostDi(urlFonte)})` : ''
                    }`
                  : "Apri l'avviso ufficiale";
                // La scuola è GARANTITA dal filtro (`preparaRigheBoard`): il
                // fallback qui è solo di sicurezza, mai un placeholder.
                const nomeScuola = r.school_name?.trim() || r.title;
                const citta = estraiCitta(r);
                const etichettaScuola =
                  citta && !nomeScuola.toUpperCase().includes(citta.toUpperCase())
                    ? `${nomeScuola} — ${citta}`
                    : nomeScuola;
                const apriFonte = (): void => {
                  if (urlFonte) window.open(urlFonte, '_blank', 'noopener,noreferrer');
                };
                const rigaClasse = i % 2 === 0 ? 'bg-white text-primary-800' : 'bg-slate-50 text-primary-800';
                return (
                  <tr
                    key={r.id}
                    role={urlFonte ? 'link' : undefined}
                    tabIndex={urlFonte ? 0 : undefined}
                    aria-label={
                      urlFonte ? `${titoloLink}: ${r.school_name || r.title}` : undefined
                    }
                    onClick={(ev) => {
                      if (!urlFonte) return;
                      const bersaglio = ev.target as HTMLElement;
                      if (bersaglio.closest('a, button')) return; // link interni gestiscono il click
                      apriFonte();
                    }}
                    onKeyDown={(ev) => {
                      if (!urlFonte || (ev.key !== 'Enter' && ev.key !== ' ')) return;
                      const bersaglio = ev.target as HTMLElement;
                      if (bersaglio.closest('a, button')) return;
                      ev.preventDefault();
                      apriFonte();
                    }}
                    className={`${rigaClasse} ${urlFonte ? 'cursor-pointer' : ''}`}
                    style={{ height: '3.5rem' }} // altezza FISSA per riga: il pannello non si muove
                  >
                    <td className="px-4 py-2.5">
                      <span className="block font-mono text-xs font-bold uppercase tracking-wide">{classe}</span>
                      {materia && (
                        <span className="block max-w-[16rem] truncate text-[11px] font-medium normal-case tracking-normal text-primary-400">
                          {materia}
                        </span>
                      )}
                    </td>
                    <td className="min-w-0 px-4 py-2.5">
                      {urlFonte ? (
                        <a
                          href={urlFonte}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${titoloLink} — nuova scheda`}
                          aria-label={`${titoloLink}: ${r.school_name || r.title}`}
                          className="group block min-w-0"
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="min-w-0 truncate font-semibold underline-offset-4 group-hover:text-accent-600 group-hover:underline">
                              {etichettaScuola}
                            </span>
                            {ePdf(urlFonte) && (
                              <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-rose-700">
                                PDF
                              </span>
                            )}
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary-400 transition group-hover:text-accent-500" />
                          </span>
                          <span className="block max-w-md truncate text-xs text-primary-400 group-hover:text-primary-600">
                            {r.title}
                          </span>
                        </a>
                      ) : (
                        <>
                          <span className="block font-semibold">{etichettaScuola}</span>
                          <span className="block max-w-md truncate text-xs text-primary-400">{r.title}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
                        {r.province || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center align-middle">
                      {dataScad && (
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {dataScad}
                        </span>
                      )}
                      <span className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${stile.className}`}>
                        {stile.label}
                      </span>
                      {urlFonte && (
                        <a
                          href={urlFonte}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1.5 inline-flex text-primary-400 transition hover:text-primary-600"
                          title="Apri l'avviso ufficiale"
                          aria-hidden="true"
                          tabIndex={-1}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Righe di completamento: il pannello mantiene SEMPRE 5 righe di altezza */}
              {Array.from({ length: Math.max(0, RIGHE_PER_PAGINA - visibili.length) }).map((_, k) => (
                <tr
                  key={`spazio-${k}`}
                  aria-hidden="true"
                  className="bg-white text-primary-800"
                  style={{ height: '3.5rem' }}
                >
                  <td colSpan={4} className="px-4 py-2.5 select-none text-transparent">
                    —
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
            </div>
          </div>
        </div>

        {pagine > 1 && (
          <div className="mt-5 flex items-center justify-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-card">
              Pagina {paginaSicura + 1} di {pagine} - Aggiornamento automatico
            </span>
          </div>
        )}

        <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-primary-200 bg-white p-6 text-center shadow-card">
          <p className="text-base leading-relaxed text-primary-800">
            Tutti gli avvisi ufficiali, pubblicati ogni giorno dagli Uffici Scolastici e dalle Scuole
            Italiane.
          </p>
          <p className="mt-2 text-lg font-bold leading-snug text-primary-900">
            Attiva il Radar per filtrare solo quelli della tua provincia e classe di concorso.
          </p>
          <button
            type="button"
            onClick={openRadarSetup}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-7 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-soft transition hover:bg-primary-600 hover:shadow-md active:scale-[0.98]"
          >
            <Radar className="h-5 w-5" />
            Attiva il mio Radar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

