/**
 * Blocco ANAGRAFICA riutilizzabile (wizard Radar da Guest / form di registrazione).
 *
 * Raccolta facoltativa di nome, cognome, genere ed età: sono i dati demografici di
 * base che personalizzano le email (Cara/Caro) e il profilo. Il NOME è una stringa
 * libera: nomi composti o ragioni («Bison Productions») restano intatti, mai
 * spezzati in nome/cognome.
 *
 * Il contenitore decide dove salvare (bozza di registrazione + `profiles`): qui
 * c'è solo la presentazione, così lo stesso blocco vive nel wizard e altrove.
 */
export interface DatiAnagrafica {
  nome: string;
  cognome: string;
  genere: 'M' | 'F' | null;
  /** Età come stringa: il campo può restare vuoto (facoltativo). */
  eta: string;
}

interface BloccoAnagraficaProps {
  dati: DatiAnagrafica;
  onChange: (patch: Partial<DatiAnagrafica>) => void;
  /** Testo di aiuto (il wizard spiega che i dati non verranno richiesti di nuovo). */
  nota?: string;
  /** Compatto: usato dove lo spazio verticale è prezioso. */
  compatto?: boolean;
}

const campoInput =
  'w-full rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-800 focus:border-primary-400 focus:outline-none';

/** Campo compatto (wizard a prova di scroll: meno altezza, stesso contenuto). */
const campoInputCompatto =
  'w-full rounded-lg border border-primary-200 px-2.5 py-1.5 text-sm text-primary-800 focus:border-primary-400 focus:outline-none';

export function BloccoAnagrafica({ dati, onChange, nota, compatto }: BloccoAnagraficaProps) {
  const campo = compatto ? campoInputCompatto : campoInput;
  return (
    <div className={`rounded-xl border border-primary-100 bg-primary-50/40 ${compatto ? 'p-3' : 'p-4'}`}>
      <p className="text-sm font-bold text-primary-800">Qualche dato su di te</p>
      <p className="mt-0.5 text-xs text-primary-500">
        {nota ?? 'Facoltativo: personalizza le email e il profilo. Puoi compilarlo anche dopo.'}
      </p>

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
