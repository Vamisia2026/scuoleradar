/**
 * Bacheca · BANNER DELLA SCANSIONE (§26.146).
 *
 * Perché sopra la bacheca: le opportunità mostrate sono quelle che l'ultimo giro di
 * ingestione è riuscito a leggere. Se il giro è vecchio o ha lasciato fonti isolate,
 * l'utente deve saperlo PRIMA di concludere «di bandi non ce ne sono» — è la stessa
 * regola di onestà della pagina (`bachecaScarsa`, §26.141), applicata alla freschezza.
 *
 * Il testo e le priorità vivono in `lib/telemetriaScansione` (puro, con guardia); qui
 * c'è solo la veste e la chiamata alla Edge `crawler-admin`, che è l'unica via per
 * leggere `source_health` (tabella di servizio: il browser non ha i permessi). Se la
 * Edge tace — non deployata, sessione scaduta, rete giù — il banner NON compare: uno
 * stato inventato sarebbe peggio di nessuno stato.
 */
import { useEffect, useState } from 'react';
import { leggiTelemetriaCrawler, type TelemetriaCrawler } from '@/services/crawlerTelemetry';
import { bannerScansione, type TonoScansione } from '@/lib/telemetriaScansione';

/** Veste dei quattro toni: riquadro, icona e colore del testo in un punto solo. */
const VESTE: Record<TonoScansione, { riquadro: string; icona: string; testo: string }> = {
  fresca: { riquadro: 'border-emerald-200 bg-emerald-50', icona: '✓', testo: 'text-emerald-800' },
  'in-ritardo': { riquadro: 'border-amber-200 bg-amber-50', icona: '⏳', testo: 'text-amber-900' },
  isolata: { riquadro: 'border-amber-300 bg-amber-50', icona: '⛔', testo: 'text-amber-900' },
  guasta: { riquadro: 'border-rose-200 bg-rose-50', icona: '⚠', testo: 'text-rose-900' },
};

interface Props {
  /** `false` per i visitatori senza sessione: la Edge chiede un JWT, inutile bussare. */
  attivo?: boolean;
  /** Telemetria già letta (test o pannelli): se c'è, nessuna chiamata di rete. */
  telemetria?: TelemetriaCrawler | null;
}

export function BannerTelemetriaScansione({ attivo = true, telemetria }: Props) {
  const [dati, setDati] = useState<TelemetriaCrawler | null>(telemetria ?? null);

  useEffect(() => {
    // Telemetria iniettata dal chiamante: è già la verità, non si sovrascrive.
    if (!attivo || telemetria !== undefined) return;
    let vivo = true;
    leggiTelemetriaCrawler()
      .then((t) => {
        if (vivo) setDati(t);
      })
      .catch(() => {
        // Silenzio deliberato: la telemetria non è un contenuto, è un di più.
        if (vivo) setDati(null);
      });
    return () => {
      vivo = false;
    };
  }, [attivo, telemetria]);

  const banner = attivo ? bannerScansione(dati) : null;
  if (!banner) return null;

  const veste = VESTE[banner.tono];
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl border px-4 py-2.5 ${veste.riquadro}`}
    >
      <span aria-hidden className="text-base leading-none">
        {veste.icona}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${veste.testo}`}>{banner.titolo}</p>
        <p className={`mt-0.5 text-[11px] leading-relaxed ${veste.testo}`}>{banner.dettaglio}</p>
      </div>
    </div>
  );
}
