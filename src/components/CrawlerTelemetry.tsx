/**
 * ScuoleRadar.it — «Crawler Telemetry» del System Health Check (solo DEV).
 *
 * Quattro numeri che dicono se il motore sta lavorando davvero:
 *   · fonti in whitelist lette dal runner (`active_crawler`);
 *   · pagine scoperte e ancora in coda (`pending`);
 *   · voci scartate dal motore (rumore, viste vuote, parcheggi, domini spenti);
 *   · interpelli vivi nel database (`expiration_date` ≥ oggi).
 * Sotto: ultima scansione e ultima run di ingestione. Il pulsante
 * «Lancia scansione whitelist ora» fa il dispatch del workflow GitHub tramite la
 * Edge `crawler-admin` e poi RILEGGE i numeri ogni 5 secondi per due minuti:
 * il pannello si aggiorna da solo mentre il giro gira, senza ricaricare la pagina.
 *
 * Nessun numero è calcolato qui: arrivano tutti dalla Edge (`crawler-admin`), che
 * è l'unica a poter leggere le tabelle di servizio. Se la Edge non risponde o la
 * sessione non è attiva, il pannello lo dichiara invece di mostrare zeri finti.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, Filter, Inbox, Loader2, Play, RefreshCw, Radar } from 'lucide-react';
import {
  avviaScansioneWhitelist,
  leggiTelemetriaCrawler,
  quando,
  type TelemetriaCrawler,
} from '@/services/crawlerTelemetry';

/** Intervallo e durata del polling dopo un avvio (5 s × 24 = 2 minuti). */
const INTERVALLO_MS = 5_000;
const MAX_GIRI = 24;

interface Voce {
  etichetta: string;
  valore: number;
  nota: string;
  icona: React.ReactNode;
  tono: string;
}

export function CrawlerTelemetry() {
  const [dati, setDati] = useState<TelemetriaCrawler | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [aggiornamentoLive, setAggiornamentoLive] = useState(false);
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
    void carica();
  }, [carica]);

  // Nessun intervallo sopravvive alla chiusura del pannello.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    },
    [],
  );

  const lancia = async () => {
    setInCorso(true);
    setAvviso(null);
    try {
      const esito = await avviaScansioneWhitelist();
      if (esito.telemetria) setDati(esito.telemetria);
      setErrore(null);
      // Chi ha autorizzato (admin · segreto di sviluppo · sessione) è diagnosi utile:
      // se il trigger passa dalla DEV Bar senza login lo si vede scritto qui.
      const chi = esito.autorizzato_da ? ` · autorizzato come ${esito.autorizzato_da}` : '';
      setAvviso(
        `Giro avviato su ${esito.repo} (${esito.workflow})${chi}. I numeri si aggiornano da soli: ` +
          'la coda inizia a muoversi appena il runner parte.',
      );
      if (timer.current !== null) window.clearInterval(timer.current);
      let giri = 0;
      setAggiornamentoLive(true);
      timer.current = window.setInterval(() => {
        giri += 1;
        void carica();
        if (giri >= MAX_GIRI) {
          if (timer.current !== null) window.clearInterval(timer.current);
          timer.current = null;
          setAggiornamentoLive(false);
        }
      }, INTERVALLO_MS);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Avvio della scansione non riuscito.');
    } finally {
      setInCorso(false);
    }
  };


  const voci: Voce[] = [
    {
      etichetta: 'Fonti in whitelist',
      valore: dati?.fonti_whitelist ?? 0,
      nota: dati ? `${dati.scansionate_24h} ricontrollate nelle ultime 24h` : 'in attesa',
      icona: <Radar className="h-4 w-4" />,
      tono: 'border-accent-200 bg-accent-50 text-accent-700',
    },
    {
      etichetta: 'Pagine scoperte in coda',
      valore: dati?.pagine_in_coda ?? 0,
      nota: 'scoperte dai giri di discovery, da leggere',
      icona: <Inbox className="h-4 w-4" />,
      tono: 'border-primary-200 bg-primary-50 text-primary-700',
    },
    {
      etichetta: 'Voci scartate',
      valore: dati?.scarti ?? 0,
      nota: dati ? `${dati.in_errore} ferme per errore interno` : 'in attesa',
      icona: <Filter className="h-4 w-4" />,
      tono: 'border-warning-200 bg-warning-50 text-warning-700',
    },
    {
      etichetta: 'Interpelli attivi',
      valore: dati?.interpelli_attivi ?? 0,
      nota: dati ? `${dati.interpelli_totali} in archivio (anche scaduti)` : 'in attesa',
      icona: <CalendarClock className="h-4 w-4" />,
      tono: 'border-primary-200 bg-white text-primary-800',
    },
  ];

  return (
    <section className="rounded-lg border border-primary-100 bg-white p-2" aria-live="polite">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-500">
          <Radar className="h-3.5 w-3.5" />
          Crawler Telemetry
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-primary-400">
            {dati ? `aggiornato ${quando(dati.aggiornato_il)}` : 'nessun dato'}
          </span>
          <button
            type="button"
            onClick={() => void carica()}
            aria-label="Rileggi la telemetria"
            title="Rileggi i numeri dal database"
            className="rounded-md border border-primary-200 bg-white p-1 text-primary-600 transition hover:bg-primary-50"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
        {voci.map((voce) => (
          <div key={voce.etichetta} className={`rounded-md border px-2 py-1.5 ${voce.tono}`}>
            <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide">
              {voce.icona}
              {voce.etichetta}
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums leading-none">
              {voce.valore.toLocaleString('it-IT')}
            </p>
            <p className="mt-0.5 text-[9px] leading-tight opacity-80">{voce.nota}</p>
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-primary-500">
        <span>
          Ultima scansione: <strong>{quando(dati?.ultima_scansione)}</strong>
          {dati?.ultima_run && (
            <>
              {' · '}ultima run: <strong>{dati.ultima_run.esito}</strong> ({dati.ultima_run.nuovi}{' '}
              nuovi su {dati.ultima_run.trovati}, {dati.ultima_run.errori} errori)
            </>
          )}
        </span>
        {aggiornamentoLive && (
          <span className="inline-flex items-center gap-1 font-semibold text-accent-700">
            <Loader2 className="h-3 w-3 animate-spin" /> aggiornamento live
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => void lancia()}
        disabled={inCorso}
        className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-800 bg-primary-800 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {inCorso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Lancia scansione whitelist ora
      </button>

      {avviso && (
        <p className="mt-1 rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-[10px] leading-snug text-accent-700">
          {avviso}
        </p>
      )}
      {errore && (
        <p className="mt-1 rounded-md border border-error-200 bg-error-50 px-2 py-1 text-[10px] leading-snug text-error-700">
          {errore}
        </p>
      )}
    </section>
  );
}
