/**
 * ScuoleRadar.it — Dipartimento Radar · RENDERING di una riga del tabellone
 * «Radar Live» (`FlightBoardInterpelli`).
 *
 * Solo PRESENTAZIONE: da una riga di `interpelli` alla riga della tavola
 * (classe/tipologia, scuola, descrizione, provincia, scadenza) più le righe di
 * riempimento che tengono ferma l'altezza del tabellone. Nessuna rete, nessuno
 * stato, nessun client: la query resta in `FlightBoardInterpelli.tsx`, i dati
 * derivati in `../rigaBoardDati.ts`.
 *
 * Estratto da `FlightBoardInterpelli.tsx` (che superava le 300 righe del gate
 * strutturale) e poi dai dati derivati, come chiede `.clinerules` §3 (spezzare
 * prima delle 250 righe; componente in `components/`). Etichette di copy e
 * classi di stile sono le stesse: nessun cambiamento visivo.
 *
 * Regola di prodotto invariata: la cella «Scadenza» mostra la scadenza vera
 * quando c'è, altrimenti la data di PUBBLICAZIONE dichiarata («Pubblicato 12
 * set») — mai una data inventata.
 */
import { ExternalLink } from 'lucide-react';
import { titoloLeggibile } from '@/lib/liveBoard';
import { ePdf, hostDi, urlValido, type InterpelloLive } from '../righeBoard';
import { dataItBreve, inferisciTipologia, ottieniUrgenzaOAnzianita } from '../rigaBoardDati';

export interface RigaBoardProps {
  /** Riga presentabile del tabellone (già filtrata e alternata per provincia). */
  riga: InterpelloLive;
  /** Posizione dentro la pagina: decide la tinta alternata delle righe. */
  indice: number;
}

/**
 * Una riga del tabellone. Quando la fonte ufficiale è valida l'intera riga si
 * apre (click, Enter o Spazio), con i link interni che restano cliccabili; senza
 * fonte non c'è nulla da aprire e la riga non è interattiva.
 */
export function RigaBoard({ riga: r, indice }: RigaBoardProps) {
  const tipologiaInferita = inferisciTipologia(r);
  const classe = tipologiaInferita.codice;
  const descrizioneMateria = tipologiaInferita.descrizione;

  const urgenza = ottieniUrgenzaOAnzianita(r.expiration_date, r.created_at);

  const dataScad = dataItBreve(r.expiration_date);
  const dataPub = r.expiration_date ? '' : dataItBreve(r.created_at);
  const urlFonte = urlValido(r.source_url);
  const titoloLink = urlFonte
    ? `${ePdf(urlFonte) ? 'Apri il PDF ufficiale' : 'Apri la pagina ufficiale'}${
        hostDi(urlFonte) ? ` (${hostDi(urlFonte)})` : ''
      }`
    : "Apri l'avviso ufficiale";
  const nomeScuola = r.school_name?.trim() || '';
  const sottotitolo = titoloLeggibile(r.title);
  const apriFonte = (): void => {
    if (urlFonte) window.open(urlFonte, '_blank', 'noopener,noreferrer');
  };
  const rigaClasse = indice % 2 === 0 ? 'bg-white text-primary-800' : 'bg-slate-50 text-primary-800';

  return (
    <tr
      role={urlFonte ? 'link' : undefined}
      tabIndex={urlFonte ? 0 : undefined}
      aria-label={urlFonte ? `${titoloLink}: ${nomeScuola}` : undefined}
      onClick={(ev) => {
        if (!urlFonte) return;
        const bersaglio = ev.target as HTMLElement;
        if (bersaglio.closest('a, button')) return;
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
      style={{ height: '3.5rem' }}
    >
      {/* 1. Classe / Tipologia */}
      <td className="px-4 py-2.5 truncate">
        <span className="block font-mono text-xs font-bold uppercase tracking-wide truncate">{classe}</span>
        {descrizioneMateria && (
          <span className="block truncate text-[11px] font-medium normal-case tracking-normal text-primary-400">
            {descrizioneMateria}
          </span>
        )}
      </td>

      {/* 2. Scuola */}
      <td className="px-4 py-2.5 truncate">
        {urlFonte ? (
          <a
            href={urlFonte}
            target="_blank"
            rel="noopener noreferrer"
            title={`${titoloLink} — nuova scheda`}
            aria-label={`${titoloLink}: ${nomeScuola}`}
            className="group block truncate"
          >
            <span className="flex items-center gap-1.5 truncate">
              <span className="truncate font-semibold underline-offset-4 group-hover:text-accent-600 group-hover:underline">
                {nomeScuola}
              </span>
              {ePdf(urlFonte) && (
                <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-rose-700">
                  PDF
                </span>
              )}
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary-400 transition group-hover:text-accent-500" />
            </span>
          </a>
        ) : (
          <span className="block font-semibold truncate">{nomeScuola}</span>
        )}
      </td>

      {/* 3. Descrizione */}
      <td className="px-4 py-2.5 truncate">
        {urlFonte ? (
          <a
            href={urlFonte}
            target="_blank"
            rel="noopener noreferrer"
            className="group block truncate"
            title={sottotitolo || r.title}
          >
            <span className="block truncate text-xs font-medium text-primary-700 group-hover:text-accent-600 group-hover:underline">
              {sottotitolo || r.title}
            </span>
          </a>
        ) : (
          <span className="block truncate text-xs font-medium text-primary-700">
            {sottotitolo || r.title}
          </span>
        )}
      </td>

      {/* 4. Provincia */}
      <td className="px-4 py-2.5 text-center truncate">
        <span className="inline-flex items-center justify-center rounded-md bg-primary-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-700">
          {r.province || '—'}
        </span>
      </td>

      {/* 5. Scadenza */}
      <td className="px-4 py-2.5 text-center align-middle truncate">
        {(dataScad || dataPub) && (
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500 truncate">
            {dataScad || `Pubblicato ${dataPub}`}
          </span>
        )}
        <span className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ${urgenza.className}`}>
          {urgenza.label}
        </span>
      </td>
    </tr>
  );
}

/**
 * Righe trasparenti che completano la pagina: il tabellone non cambia altezza
 * mentre le pagine ruotano (le caselle vuote sono dichiarate `aria-hidden`).
 */
export function RigheRiempimento({ quante }: { quante: number }) {
  return (
    <>
      {Array.from({ length: Math.max(0, quante) }).map((_, k) => (
        <tr
          key={`spazio-${k}`}
          aria-hidden="true"
          className="bg-white text-primary-800"
          style={{ height: '3.5rem' }}
        >
          <td colSpan={5} className="px-4 py-2.5 select-none text-transparent">
            —
          </td>
        </tr>
      ))}
    </>
  );
}
