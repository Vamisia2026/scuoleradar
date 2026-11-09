/**
 * Bacheca · IL RADAR STA LAVORANDO (§26.146 · §26.149 · §26.150 · §26.151).
 *
 * Perché sopra la bacheca: le opportunità mostrate sono quelle che l'ultimo ciclo di
 * ingestione è riuscito a leggere. Da §26.151 il riquadro parla come una persona e non come un
 * referto — «Ultimo controllo: oggi alle 14:06 · 502 bacheche scolastiche controllate nelle
 * ultime 24 ore · 478 avvisi scartati perché fuori tema» — e quando il radar riposa lo dice:
 * il badge `STANDBY` compare di notte, il sabato e la domenica, con la ripresa («domattina alle
 * 08:00» oppure «lunedì mattina»). Un orario di lavoro non è un guasto, e il banner non deve
 * far credere il contrario.
 *
 * Le fonti temporaneamente sorde (quarantena, errori per fonte) NON compaiono qui: sono
 * materia del pannello Admin — la Linea Rossa, §26.110 — e in una vetrina che deve dire «sto
 * lavorando» diventavano un allarme che l'utente leggeva come un errore proprio.
 *
 * Il testo e le soglie vivono in `lib/telemetriaScansione` (puro, con guardia); qui c'è la
 * veste, il polling e la chiamata alla Edge `crawler-admin`, che è l'unica via per leggere la
 * telemetria di servizio (il browser non ha i permessi su `source_health`). Se la Edge tace —
 * non deployata, sessione scaduta, rete giù — il banner NON compare: uno stato inventato
 * sarebbe peggio di nessuno stato.
 *
 * §26.149 — LA FRESCHEZZA SI RILEGGE, NON SI SIMULA. L'orologio interno ricalcola ogni mezzo
 * minuto «14 minuti fa» (nessuna chiamata), e lo stato vero si rilegge ogni cinque minuti e al
 * ritorno sulla scheda: il ciclo del worker è orario dentro la finestra feriale, quindi il
 * numero mostrato invecchia di minuti, non di giorni. Non esiste alcun percorso che scriva un
 * istante finto al posto di quello letto.
 *
 * L'OROLOGIO DEL COMPONENTE NON DECIDE NIENTE. `adesso` viene passato alla lib, che è l'unica
 * a sapere che ora è in Italia (`finestraScansione`): un browser rimasto su un altro fuso
 * vede lo stesso standby di un browser ad Asti.
 */
import { useEffect, useState } from 'react';
import { Activity, Moon, Radar, RefreshCw, ShieldCheck, type LucideIcon } from 'lucide-react';
import { leggiTelemetriaCrawler, type TelemetriaCrawler } from '@/services/crawlerTelemetry';
import { bannerScansione, type TonoScansione } from '@/lib/telemetriaScansione';

/** Ogni quanto si rilegge lo stato (il worker gira ogni ora: cinque minuti bastano). */
const RILETTURA_MS = 5 * 60 * 1000;

/** Ogni quanto si ricalcola l'età del ciclo senza bussare alla rete. */
const OROLOGIO_MS = 30 * 1000;

/** Veste di un tono: barra d'accento, pastiglia dell'icona, badge e pallino in un punto solo. */
interface VesteTono {
  barra: string;
  icona: string;
  badge: string;
  pallino: string;
  Icona: LucideIcon;
}

/**
 * Veste dei cinque toni. Nessun fondo da «errore» e nessuna icona di divieto: l'azzurro-verde è
 * lo stato in diretta, l'azzurro il servizio operativo, l'ambra tenue l'attesa, il grigio la
 * luna dello standby (il radar riposa, non è guasto).
 */
const VESTE: Record<TonoScansione, VesteTono> = {
  standby: {
    barra: 'border-l-primary-200',
    icona: 'bg-primary-50 text-primary-400',
    badge: 'bg-primary-50 text-primary-500',
    pallino: 'bg-primary-300',
    Icona: Moon,
  },
  live: {
    barra: 'border-l-accent-500',
    icona: 'bg-accent-100 text-accent-700',
    badge: 'bg-accent-500 text-white',
    pallino: 'bg-white animate-pulse-soft',
    Icona: Radar,
  },
  attivo: {
    barra: 'border-l-primary-400',
    icona: 'bg-primary-100 text-primary-600',
    badge: 'bg-primary-100 text-primary-700',
    pallino: 'bg-accent-500',
    Icona: Activity,
  },
  'in-ritardo': {
    barra: 'border-l-secondary-300',
    icona: 'bg-secondary-100 text-secondary-700',
    badge: 'bg-secondary-100 text-secondary-700',
    pallino: 'bg-secondary-500',
    Icona: RefreshCw,
  },
  guasta: {
    barra: 'border-l-primary-200',
    icona: 'bg-primary-50 text-primary-500',
    badge: 'bg-primary-50 text-primary-600',
    pallino: 'bg-primary-300',
    Icona: ShieldCheck,
  },
};

interface Props {
  /** `false` per i visitatori senza sessione: la Edge chiede un JWT, inutile bussare. */
  attivo?: boolean;
  /** Telemetria già letta (test o pannelli): se c'è, nessuna chiamata di rete. */
  telemetria?: TelemetriaCrawler | null;
}

export function BannerTelemetriaScansione({ attivo = true, telemetria }: Props) {
  const [dati, setDati] = useState<TelemetriaCrawler | null>(telemetria ?? null);
  // «Adesso» è stato locale: invecchiare l'età del ciclo non è una chiamata di rete.
  const [adesso, setAdesso] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAdesso(new Date()), OROLOGIO_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Telemetria iniettata dal chiamante: è già la verità, non si sovrascrive.
    if (!attivo || telemetria !== undefined) return;
    let vivo = true;
    const rileggi = (): void => {
      leggiTelemetriaCrawler()
        .then((t) => {
          if (vivo) setDati(t);
        })
        .catch(() => {
          // Silenzio deliberato: la telemetria non è un contenuto, è un di più.
          if (vivo) setDati(null);
        });
    };
    rileggi();
    const id = setInterval(() => {
      // Scheda in secondo piano: nessuna lettura sprecata; la freschezza riparte al focus.
      if (document.visibilityState !== 'hidden') rileggi();
    }, RILETTURA_MS);
    window.addEventListener('focus', rileggi);
    return () => {
      vivo = false;
      clearInterval(id);
      window.removeEventListener('focus', rileggi);
    };
  }, [attivo, telemetria]);

  const banner = attivo ? bannerScansione(dati, adesso) : null;
  if (!banner) return null;

  const { barra, icona, badge, pallino, Icona: IconaStato } = VESTE[banner.tono];
  return (
    <div
      role="status"
      className={`rounded-2xl border border-l-4 border-primary-100 bg-white px-4 py-3.5 shadow-card ${barra}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${icona}`}
        >
          <IconaStato className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge}`}
            >
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${pallino}`} />
              {banner.badge}
            </span>
            <p className="text-sm font-semibold text-primary-800">{banner.titolo}</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-primary-600">{banner.dettaglio}</p>
          {banner.misure.length > 0 && (
            <dl className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {banner.misure.map((m) => (
                <div key={m.etichetta} className="rounded-xl bg-primary-50/70 px-2.5 py-1.5">
                  <dt className="text-[9px] font-semibold uppercase tracking-wider text-primary-500">
                    {m.etichetta}
                  </dt>
                  <dd className="text-base font-bold leading-tight tabular-nums text-primary-800">
                    {m.valore}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

