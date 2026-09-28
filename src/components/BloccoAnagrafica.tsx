/**
 * Blocco ANAGRAFICA riutilizzabile (fine percorso del wizard Radar / form di
 * registrazione).
 *
 * Nome, cognome, genere ed età: i dati demografici di base che personalizzano le
 * email (Cara/Caro) e il profilo; genere ed età alimentano anche le statistiche di
 * settore. Il NOME è una stringa libera: nomi composti restano intatti, mai
 * spezzati in nome/cognome.
 *
 * Il contenitore decide dove salvare (bozza di registrazione + `profiles`): qui
 * c'è solo la presentazione, così lo stesso blocco vive nel wizard e altrove.
 * Nessuna spiegazione paternalistica e nessuna etichetta «facoltativo»: i campi si
 * spiegano con il proprio nome e, se serve un contesto, arriva dal chiamante con
 * la prop `nota`.
 */
export interface DatiAnagrafica {
  nome: string;
  cognome: string;
  genere: 'M' | 'F' | null;
  /** Età come stringa: il campo può restare vuoto. */
  eta: string;
}

interface BloccoAnagraficaProps {
  dati: DatiAnagrafica;
  onChange: (patch: Partial<DatiAnagrafica>) => void;
  /** Titolo del blocco (default: «Il tuo profilo»). */
  titolo?: string;
  /** Riga di contesto, mostrata SOLO se il chiamante la fornisce. */
  nota?: string;
  /** Compatto: usato dove lo spazio verticale è prezioso. */
  compatto?: boolean;
}

const campoInput =
  'w-full rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-800 focus:border-primary-400 focus:outline-none';

/** Campo compatto (wizard a prova di scroll: meno altezza, stesso contenuto). */
const campoInputCompatto =
  'w-full rounded-lg border border-primary-200 px-2.5 py-1.5 text-sm text-primary-800 focus:border-primary-400 focus:outline-none';

export function BloccoAnagrafica({ dati, onChange, titolo, nota, compatto }: BloccoAnagraficaProps) {
  const campo = compatto ? campoInputCompatto : campoInput;
  return (
    <div className={`rounded-xl border border-primary-100 bg-primary-50/40 ${compatto ? 'p-3' : 'p-4'}`}>
      <p className="text-sm font-bold text-primary-800">{titolo ?? 'Il tuo profilo'}</p>
      {nota && <p className="mt-0.5 text-xs text-primary-500">{nota}</p>}

      <div className={`${compatto ? 'mt-2 gap-2' : 'mt-3 gap-3'} grid sm:grid-cols-2`}>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-primary-700">Nome</span>
          <input
            type="text"
            value={dati.nome}
            onChange={(e) => onChange({ nome: e.target.value })}
            className={campo}
            autoComplete="given-name"
            placeholder="Nome"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-primary-700">Cognome</span>
          <input
            type="text"
            value={dati.cognome}
            onChange={(e) => onChange({ cognome: e.target.value })}
            className={campo}
            autoComplete="family-name"
            placeholder="Cognome"
          />
        </label>
        <div>
          <span className="mb-1 block text-xs font-semibold text-primary-700">Genere</span>
          <div className="grid grid-cols-2 gap-2">
            {(['F', 'M'] as const).map((valore) => (
              <button
                key={valore}
                type="button"
                onClick={() => onChange({ genere: dati.genere === valore ? null : valore })}
                aria-pressed={dati.genere === valore}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  dati.genere === valore
                    ? 'border-accent-400 bg-accent-50 text-accent-700'
                    : 'border-primary-200 bg-white text-primary-600 hover:bg-primary-50'
                }`}
              >
                {valore === 'F' ? 'Donna' : 'Uomo'}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-primary-700">Età (anni)</span>
          <input
            type="number"
            inputMode="numeric"
            min={14}
            max={100}
            value={dati.eta}
            onChange={(e) => onChange({ eta: e.target.value })}
            className={campo}
            placeholder="Età"
          />
        </label>
      </div>
    </div>
  );
}
