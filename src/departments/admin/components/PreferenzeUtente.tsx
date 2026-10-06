/**
 * Dipartimento Admin — PREFERENZE Radar dell'utente in CHIARO (blocco condiviso).
 *
 * Una sola derivazione (`preferenzeUtenteAdmin`) e una sola resa per le DUE
 * superfici Admin: la scheda di dettaglio del tab «Utenti» (`variante="dettaglio"`)
 * e la card utente del tab «Radar» (`variante="compatto"`). Così l'Admin non ha
 * più «buchi» rispetto alla vista utente — ordini di scuola, classi, materie,
 * tag personalizzati, province e scuole preferite/escluse ci sono SEMPRE, in
 * entrambe le viste.
 */
import { Chips } from '../adminUi';
import type { AdminUtente } from '../types';
import { preferenzeUtenteAdmin } from './derivaPreferenzeUtente';

interface RigaPreferenza {
  etichetta: string;
  valori: string[];
}

/** Righe comuni alle due varianti (l'ordine è quello dei pannelli del Radar utente). */
function righe(u: AdminUtente): RigaPreferenza[] {
  const p = preferenzeUtenteAdmin(u);
  return [
    { etichetta: 'Ordini di scuola', valori: p.ordini },
    { etichetta: 'Classi di concorso', valori: p.classi },
    { etichetta: 'Materie', valori: p.materieClassi },
    { etichetta: 'Materie e competenze extra', valori: p.materie },
    { etichetta: 'Tag personalizzati', valori: p.tag },
    { etichetta: 'Province', valori: p.province },
    { etichetta: 'Scuole preferite', valori: p.scuolePreferite },
    { etichetta: 'Scuole escluse (blacklist)', valori: p.scuoleEscluse },
  ];
}

export function PreferenzeUtente({
  utente,
  variante = 'dettaglio',
}: {
  utente: AdminUtente;
  /** `dettaglio` = righe della scheda · `compatto` = griglia della card. */
  variante?: 'dettaglio' | 'compatto';
}) {
  const elenco = righe(utente);

  if (variante === 'compatto') {
    const preferite = utente.favorite_schools?.length ?? 0;
    const escluse = utente.ignored_schools?.length ?? 0;
    return (
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-primary-700">
        {elenco
          .filter((r) => !r.etichetta.startsWith('Scuole'))
          .map((r) => (
            <div key={r.etichetta}>
              <div className="text-[10px] font-bold uppercase text-primary-400">{r.etichetta}</div>
              <Chips valori={r.valori} />
            </div>
          ))}
        <div>
          <div className="text-[10px] font-bold uppercase text-primary-400">Scuole preferite / escluse</div>
          <span className="text-xs">
            {preferite} / {escluse}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 text-xs text-primary-700">
      {elenco.map((r) => (
        <p key={r.etichetta}>
          <b>{r.etichetta}:</b> <Chips valori={r.valori} />
        </p>
      ))}
    </div>
  );
}
