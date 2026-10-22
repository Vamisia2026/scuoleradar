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
 * Regola di prodotto (§26.67, §26.75): la cella «Scadenza» mostra la scadenza VERA
 * (`expiration_date`) con la banda colore dei giorni mancanti; quando la fonte
 * non dichiara una scadenza la riga NON entra nel tabellone (§26.71), quindi il
 * caso «Scadenza n/d» non è più raggiungibile in vetrina. La data di
 * pubblicazione NON è una scadenza e non compare in questa colonna.
 * Palette: SOLO badge pieni ad alto contrasto (rose-700 / amber-600 / emerald-700
 * su testo bianco); nessuna tinta pastello nel tabellone (§26.75).
 */
import { ExternalLink } from 'lucide-react';
import { nomeScuolaRiga, titoloLeggibile } from '@/lib/liveBoard';
import { ePdf, hostDi, estraiProvincia, type InterpelloLive } from '../righeBoard';
import { fonteApribile } from '../linkFonte';
import { badgeScadenza, dataItBreve, inferisciTipologia } from '../rigaBoardDati';

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

  // Colonna «Scadenza»: SOLO la scadenza vera. Senza `expiration_date` la cella
  // mostra il trattino `—` con la banda neutra «Scadenza n/d`: `created_at` non
  // entra MAI nel calcolo (§26.61 / §26.67).
  const urgenza = badgeScadenza(r.expiration_date);

  const dataScad = dataItBreve(r.expiration_date);
  // Dove porta il click: l'avviso vero, oppure la home `.edu.it` dell'istituto
  // quando la fonte pubblicava solo una piattaforma (Argo, Google Forms…). Senza
  // nessuna delle due la riga non entra in vetrina (`linkFonte.fonteApribile`).
  const fonte = fonteApribile(r);
  const urlFonte = fonte?.url ?? null;
  const titoloLink = !fonte
    ? "Apri l'avviso ufficiale"
    : `${
        fonte.tipo === 'sito-scuola'
          ? 'Apri il sito ufficiale della scuola'
          : ePdf(fonte.url)
            ? 'Apri il PDF ufficiale'
            : 'Apri la pagina ufficiale'
      }${hostDi(fonte.url) ? ` (${hostDi(fonte.url)})` : ''}`;
  // Nome SEMPRE reale: `nomeScuolaRiga` scarta i segnaposto («Scuola non
  // specificata / Più plessi») e i dump di codici. Una riga senza istituto è già
  // fuori dalla vetrina a monte (`preparaRigheBoard`): qui resta il vuoto `—`,
  // mai un'etichetta che sembri un nome.
  const nomeScuola = nomeScuolaRiga(r) ?? '—';
  const sottotitolo = titoloLeggibile(r.title);

  // NIENTE SEGNAPOSTO DI SCUOLA (§26.76, direttiva 22/10/2026): il vecchio badge
  // «Scuola non specificata / Più plessi» compariva su TUTTE le righe con
  // anagrafica incompleta — anche quando il nome dell'istituto c'era ed era
  // corretto — e sembrava che il tabellone non sapesse quale scuola emette
  // l'avviso. La colonna «Scuola» mostra solo nomi reali (`nomeScuolaRiga`);
  // quando l'anagrafica è incompleta il marcatore resta nel dato
  // (`anagraficaParziale`), non a schermo.
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
              {fonte?.tipo === 'avviso' && ePdf(fonte.url) && (
                <span className="shrink-0 rounded bg-rose-700 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                  PDF
                </span>
              )}
              {fonte?.tipo === 'sito-scuola' && (
                <span
                  className="shrink-0 rounded bg-slate-600 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white"
                  title="La fonte pubblicava solo una piattaforma (portale Argo, modulo Google…): il link porta al sito ufficiale della scuola"
                >
                  Sito
                </span>
              )}
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary-400 transition group-hover:text-accent-500" />
            </span>
          </a>
        ) : (
          <span className="flex items-center gap-1.5 truncate">
            <span className="truncate font-semibold">{nomeScuola}</span>
          </span>
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
        <span className="inline-flex items-center justify-center rounded-md bg-slate-700 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
          {estraiProvincia(r)}
        </span>
      </td>

      {/* 5. Scadenza — la scadenza vera, oppure il vuoto DICHIARATO (`—`) */}
      <td className="px-4 py-2.5 text-center align-middle truncate">
        <span
          className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500 truncate"
          title={
            urgenza.fonte === 'scadenza'
              ? `Scadenza dichiarata dalla fonte: ${dataScad}`
              : 'La fonte non dichiara una scadenza'
          }
        >
          {dataScad || '—'}
        </span>
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