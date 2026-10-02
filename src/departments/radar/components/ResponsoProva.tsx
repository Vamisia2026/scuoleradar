/**
 * Radar — RESPONSO del box «Prova il Radar» (presentazione pura).
 *
 * Mostra le righe REALI restituite dalla prova dentro un solo schermo e sotto
 * l'elenco mette SEMPRE lo stesso messaggio di conversione
 * (`messaggioConversione`, `lib/provaRadarEngine.ts`): quante opportunità sono
 * state trovate oggi, dove sono state trovate e cosa si porta a casa attivando il
 * Radar. Nessuna via d'uscita e nessuna frase difensiva: se il database non ha
 * avvisi vivi si promette comunque il Radar, mai una schermata vuota.
 */
import { ArrowRight, BellRing, ExternalLink, Radar } from 'lucide-react';
import { nomePresentabileRiga, titoloLeggibile, type RigaBoard } from '@/lib/liveBoard';
import { nomeProvincia } from '../flightBoard/righeBoard';
import { giorniRimanenti, stileScadenza } from '@/lib/scadenza';
import {
  messaggioConversione,
  messaggioRadarInScansione,
  type EsitoProvaRadar,
  type RigaProvaRadar,
} from '@/lib/provaRadarEngine';

/**
 * Nome d'istituto (o ente emittente) presentabile: mai un codice amministrativo,
 * mai una stringa grezza — la direttiva di vetrina vale anche qui
 * (`liveBoard.nomePresentabileRiga`).
 */
function etichettaRiga(riga: RigaProvaRadar): string | null {
  return nomePresentabileRiga(riga as RigaBoard);
}

/**
 * Le due righe di testo di una voce: titolo LEGGIBILE (ripulito dai dump di
 * codici) e, sotto, istituto/ente + città della provincia. Se il titolo è solo un
 * elenco di codici non si mostra affatto: al suo posto va il nome dell'istituto.
 */
function testiRiga(riga: RigaProvaRadar): { principale: string; secondaria: string } {
  const etichetta = etichettaRiga(riga);
  const titolo = titoloLeggibile(riga.title);
  const principale = titolo ?? etichetta ?? '';
  const citta = nomeProvincia(riga.province);
  const secondaria = [
    etichetta && etichetta !== principale ? etichetta : null,
    citta,
  ]
    .filter(Boolean)
    .join(' · ');
  return { principale, secondaria };
}

interface ResponsoProvaProps {
  esito: EsitoProvaRadar;
  /** Nome della provincia provata: entra nel messaggio di conversione. */
  provincia: string;
  /** Apre il setup del Radar (wizard o regalo PRO). */
  onAttiva: () => void;
}

export function ResponsoProva({ esito, provincia, onAttiva }: ResponsoProvaProps) {
  // Nessun avviso vivo nel database: si vende comunque la promessa (mai una
  // schermata vuota e mai una frase difensiva).
  if (esito.gruppo === 'vuoto' || esito.righe.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-accent-200 bg-accent-50 p-3.5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
            <Radar className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-accent-800">
            {messaggioRadarInScansione(provincia)}
          </p>
        </div>
        <button
          onClick={onAttiva}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-600"
        >
          <BellRing className="h-4 w-4" />
          Attiva il tuo Radar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const intestazione =
    esito.gruppo === 'nazionale'
      ? `Mentre in provincia di ${provincia} non ci sono nuovi avvisi, ecco cosa è appena uscito in Italia.`
      : `Di oggi in provincia di ${provincia}: interpelli e supplenze, PON/POR e PNRR, CPIA, ATA e bidelli, selezioni di esperti.`;

  return (
    <div className="animate-fade-in mt-3">
      <div className="rounded-xl border border-accent-200 bg-accent-50 p-3.5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
            <BellRing className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-accent-800">{intestazione}</p>
        </div>

        <ul className="mt-2.5 space-y-1">
          {esito.righe.map((o) => {
            const stile = stileScadenza(giorniRimanenti(o.expiration_date));
            const testi = testiRiga(o);
            return (
              <li key={o.id}>
                <a
                  href={o.source_url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-accent-200 bg-white px-3 py-1.5 transition hover:border-accent-300"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary-800">
                      {testi.principale}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${stile.className}`}
                    >
                      {stile.label}
                    </span>
                  </span>
                  {testi.secondaria && (
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-primary-500">
                      <span className="min-w-0 flex-1 truncate">{testi.secondaria}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-accent-500" />
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-sm font-semibold leading-relaxed text-accent-800">
          {messaggioConversione(esito, provincia)}
        </p>
        <button
          onClick={onAttiva}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-600"
        >
          <BellRing className="h-4 w-4" />
          Attiva il tuo Radar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
