/**
 * ScuoleRadar.it — «LINEA ROSSA»: la barra di comando del pannello Admin (§26.110).
 *
 * Sostituisce il pannello «Crawler Telemetry» del System Health Check della DEV
 * Bar (§26.97): stesso dato, altra posizione e altro peso. Il motore si guarda
 * dove si prendono le decisioni — il pannello Admin di produzione — non in un
 * modale che si apre solo in sviluppo. Il nome del file resta quello storico:
 * il nome di prodotto è «Linea Rossa».
 *
 * Forma: fascia alta poche decine di pixel, fondo `primary-900` (#0C2235), una
 * linea rossa (`error-500`, #D9534F) come segno di riconoscimento, un punto di
 * stato e quattro numeri; il dettaglio (ultima run, fonti isolate con i giorni
 * che mancano) sta dietro il chevron e non ruba spazio ad abbonamenti e
 * comunicazioni.
 *
 * DATI VERI, MAI ZERI — i numeri arrivano dalla Edge `crawler-admin`, l'unica a
 * poter leggere `discovered_links`, `scraper_runs` e `source_health`. Quando il
 * dato manca (Edge non deployata, sessione assente, campo non ancora esposto)
 * la cella mostra «—»: uno zero è un'affermazione, un «—» è un fatto. La
 * finestra dei 60 giorni vive in `src/lib/sourceQuarantine.ts`, non qui.
 *
 * PERMESSI — nessun permesso nuovo: la barra vive solo dentro `AdminPage`, dopo
 * il gate `ADMIN_EMAILS` (`@/lib/utentiAdmin`), e la Edge ricontrolla comunque
 * lato server (admin · allowlist DEV · segreto di sviluppo). Il dispatch
 * dichiara chi lo ha autorizzato (`autorizzato_da`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Play, RefreshCw } from 'lucide-react';
import { GIORNI_QUARANTENA, quaranteneAttive } from '@/lib/sourceQuarantine';
import { avviaScansioneWhitelist, CrawlerTelemetriaError, leggiTelemetriaCrawler, quando, type TelemetriaCrawler } from '@/services/crawlerTelemetry';

/** Intervallo e durata del polling dopo un avvio (5 s × 24 = 2 minuti). */
const INTERVALLO_MS = 5_000;
const MAX_GIRI = 24;
/** Quante fonti isolate si elencano: oltre, la riga diventa un registro. */
const MAX_ISOLATE = 4;

/** Stato dichiarato dalla barra: punto + parola, mai solo un colore. */
const TONO = {
  ok: { punto: 'bg-accent-500', testo: 'text-accent-500', parola: 'in linea' },
  attenzione: { punto: 'bg-secondary-450', testo: 'text-secondary-450', parola: 'da guardare' },
  errore: { punto: 'bg-error-500', testo: 'text-error-500', parola: 'senza dati' },
  attesa: { punto: 'bg-primary-300', testo: 'text-primary-300', parola: 'in attesa' },
} as const;
type Tono = keyof typeof TONO;

const BTN_BARRA =
  'inline-flex items-center gap-1 rounded-md border border-primary-700 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-50 transition hover:bg-primary-800 disabled:opacity-60';
const BTN_SCANSIONE =
  'inline-flex items-center gap-1 rounded-md border border-secondary-450 bg-secondary-450 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white transition hover:bg-secondary-500 disabled:opacity-60';

interface Cella {
  etichetta: string;
  /** `null` = dato assente: si scrive «—», non `0`. */
  valore: number | null;
  nota: string;
}

/** Un numero della telemetria, oppure `null` se il campo non c'è (deploy vecchio). */
const numero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** Host leggibile di una fonte (la riga del dettaglio resta su una linea). */
const hostDi = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

interface Props {
  /** false = nessuna sessione admin reale: la barra dichiara il vuoto. */
  attiva?: boolean;
}

export function LineaRossa({ attiva = true }: Props) {
  const [dati, setDati] = useState<TelemetriaCrawler | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [live, setLive] = useState(false);
  const [aperta, setAperta] = useState(false);
  const timer = useRef<number | null>(null);

  const carica = useCallback(async () => {
    try {
      setDati(await leggiTelemetriaCrawler());
      setErrore(null);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Telemetria non disponibile.');
    }
  }, []);

  useEffect(() => {
    if (attiva) void carica();
  }, [attiva, carica]);

  // Nessun intervallo sopravvive all'uscita dal pannello.
  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current);
  }, []);

  const fermaTimer = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setLive(false);
  };

  const lancia = async () => {
    setInCorso(true);
    setAvviso(null);
    try {
      const esito = await avviaScansioneWhitelist();
      if (esito.telemetria) setDati(esito.telemetria);
      setErrore(null);
      // Chi ha autorizzato il dispatch è diagnosi: in produzione «admin», in locale
      // «segreto» o «sviluppo-locale». La barra lo scrive, non lo presume.
      const chi = esito.autorizzato_da ? ` · autorizzato come ${esito.autorizzato_da}` : '';
      setAvviso(`Giro avviato su ${esito.repo} (${esito.workflow})${chi}. Rileggo i numeri ogni ${INTERVALLO_MS / 1000} s.`);
      fermaTimer();
      let giri = 0;
      setLive(true);
      timer.current = window.setInterval(() => {
        giri += 1;
        void carica();
        if (giri >= MAX_GIRI) fermaTimer();
      }, INTERVALLO_MS);
    } catch (err) {
      // §26.122 — la barra NON si spegne: se la Edge manda la telemetria insieme
      // all'errore si mostra quella, e il messaggio dice che il dato resta valido.
      if (err instanceof CrawlerTelemetriaError && err.telemetria) setDati(err.telemetria);
      const m = err instanceof Error ? err.message : 'Avvio della scansione non riuscito.';
      setErrore(/resta valida|giro periodico/i.test(m) ? m : `${m} La telemetria qui sopra resta valida: il giro periodico non dipende da questo pulsante.`);
    } finally {
      setInCorso(false);
    }
  };

  const isolate = quaranteneAttive(dati?.fonti_isolate ?? null);
  const tono: Tono = errore ? 'errore' : !dati ? 'attesa' : isolate && isolate.length > 0 ? 'attenzione' : 'ok';
  const celle: Cella[] = [
    { etichetta: 'Coda', valore: numero(dati?.pagine_in_coda), nota: 'pagine da leggere' },
    { etichetta: 'Fonti', valore: numero(dati?.fonti_whitelist), nota: dati ? `${dati.scansionate_24h} / 24h` : 'in attesa' },
    { etichetta: 'Interpelli', valore: numero(dati?.interpelli_attivi), nota: dati ? `${dati.interpelli_totali} in archivio` : 'in attesa' },
    { etichetta: 'Isolate', valore: isolate ? isolate.length : null,
      nota: isolate === null ? 'dato assente' : isolate.length === 0 ? 'nessuna' : `riprova entro ${GIORNI_QUARANTENA} g` },
  ];

  if (!attiva) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary-300" aria-hidden="true" />
        <p className="text-[10px] font-black uppercase tracking-[0.20em] text-primary-500">Linea Rossa</p>
        <p className="text-[11px] leading-snug text-primary-500">
          Telemetria non disponibile senza sessione admin reale. In sviluppo: <code className="rounded bg-white px-1 text-primary-700">VITE_CRAWLER_DEV_SECRET</code> in <code className="rounded bg-white px-1 text-primary-700">.env.local</code>.
        </p>
      </div>
    );
  }
  return (
    <section
      aria-live="polite"
      aria-label="Linea Rossa: telemetria del crawler"
      className="rounded-xl border border-primary-800 bg-primary-900 px-3 py-2 text-primary-50"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* La linea rossa: il segno della barra, non un bordo decorativo. */}
        <div className="flex items-center gap-2 border-l-2 border-error-500 pl-2">
          <span className={`h-1.5 w-1.5 rounded-full ${TONO[tono].punto}`} aria-hidden="true" />
          <span className="text-[10px] font-black uppercase tracking-[0.20em]">Linea Rossa</span>
          <span className={`text-[9px] font-bold uppercase tracking-wide ${TONO[tono].testo}`}>{TONO[tono].parola}</span>
        </div>

        {celle.map((c) => (
          <div key={c.etichetta} className="border-l border-primary-700 pl-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-primary-300">{c.etichetta}</p>
            <p className="text-sm font-bold leading-tight tabular-nums">
              {c.valore === null ? '—' : c.valore.toLocaleString('it-IT')}
            </p>
            <p className="text-[9px] leading-tight text-primary-300">{c.nota}</p>
          </div>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden text-[10px] text-primary-300 sm:inline">
            {dati ? `agg. ${quando(dati.aggiornato_il)}` : 'nessun dato'}
          </span>
          <button type="button" onClick={() => void carica()} aria-label="Rileggi la telemetria"
            title="Rileggi i numeri dal database" className={BTN_BARRA}>
            <RefreshCw className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => void lancia()} disabled={inCorso}
            title="Lancia una scansione della whitelist ora" className={BTN_SCANSIONE}>
            {inCorso ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Scansione
          </button>
          <button type="button" onClick={() => setAperta((v) => !v)} aria-expanded={aperta}
            aria-label={aperta ? 'Chiudi il dettaglio' : 'Apri il dettaglio'} className={BTN_BARRA}>
            <ChevronDown className={`h-3 w-3 transition ${aperta ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {(avviso || errore || live) && (
        <p title={avviso ?? errore ?? undefined}
          className={`mt-1.5 text-[10px] leading-snug ${errore ? 'line-clamp-2 text-error-500' : live ? 'truncate text-accent-500' : 'truncate text-primary-200'}`}>
          {errore ?? avviso ?? `Aggiornamento live: rileggo i numeri ogni ${INTERVALLO_MS / 1000} s.`}
        </p>
      )}

      {aperta && (
        <div className="mt-2 grid gap-2 rounded-lg bg-primary-50 p-2 text-[11px] leading-snug text-primary-800 md:grid-cols-2">
          <div className="space-y-0.5">
            <p><span className="font-bold">Ultima scansione:</span> {dati ? quando(dati.ultima_scansione) : '—'}</p>
            <p><span className="font-bold">Ultima run:</span>{' '}
              {dati?.ultima_run
                ? `${quando(dati.ultima_run.started_at)} · ${dati.ultima_run.esito} · ${dati.ultima_run.nuovi}/${dati.ultima_run.trovati} nuovi · ${dati.ultima_run.errori} errori`
                : dati ? 'nessuna run registrata' : '—'}
            </p>
            <p><span className="font-bold">In guasto (non isolate):</span> {numero(dati?.fonti_in_guasto) ?? '—'}</p>
            <p><span className="font-bold">Aggiornato:</span> {dati ? quando(dati.aggiornato_il) : '—'}</p>
          </div>
          <div>
            <p className="font-bold">Fonti in quarantena</p>
            {isolate === null ? (
              <p className="text-primary-500">Dato assente: la Edge non espone ancora <code>fonti_isolate</code>{' '}
                (ridistribuisci <code>crawler-admin</code>).</p>
            ) : isolate.length === 0 ? (
              <p className="text-primary-500">Nessuna fonte isolata: il giro legge tutta la whitelist.</p>
            ) : (
              <ul className="mt-0.5 space-y-0.5">
                {isolate.slice(0, MAX_ISOLATE).map((fonte) => (
                  <li key={fonte.url} className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold" title={fonte.url}>{hostDi(fonte.url)}</span>
                    <span className="shrink-0 text-primary-500">{fonte.motivo ?? 'motivo non dichiarato'} · {fonte.giorni} g</span>
                  </li>
                ))}
                {isolate.length > MAX_ISOLATE && <li className="text-primary-500">+{isolate.length - MAX_ISOLATE} altre</li>}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

