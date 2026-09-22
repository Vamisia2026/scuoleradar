import { useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, GraduationCap, Info } from 'lucide-react';
import { classiCoperteAttive } from '../classi';

/** Modalità di dichiarazione della classe di laurea del titolo. */
type ModalitaTitolo = 'nota' | 'altra' | 'non-so';

interface StepTitoloProps {
  /** Classe di laurea del titolo dichiarata ('' = non dichiarata). */
  classeLaurea: string;
  /** Data della procedura in formato ISO ('' = non dichiarata). */
  dataProcedura: string;
  onCambiaClasseLaurea: (valore: string) => void;
  onCambiaDataProcedura: (valore: string) => void;
  onIndietro: () => void;
  onContinua: () => void;
}

function modalitaDaValore(classeLaurea: string, ammesse: readonly string[]): ModalitaTitolo {
  if (!classeLaurea) return 'non-so';
  return ammesse.includes(classeLaurea) ? 'nota' : 'altra';
}

/**
 * Fase 2 — Titolo di studio e data della procedura.
 *
 * Sono i due dati che il motore chiede per decidere: la classe di laurea è un
 * requisito di accesso dichiarato dalla norma, la data della procedura colloca
 * il calcolo nel contesto normativo corretto. Nessun valore viene inventato:
 * "non lo so" lascia il dato non dichiarato e il motore risponde con cautela.
 */
export function StepTitolo({
  classeLaurea,
  dataProcedura,
  onCambiaClasseLaurea,
  onCambiaDataProcedura,
  onIndietro,
  onContinua,
}: StepTitoloProps) {
  const classi = classiCoperteAttive();
  const ammesse = [...new Set(classi.flatMap((classe) => [...classe.classiLaureaAmmesse]))];
  const [modalita, setModalita] = useState<ModalitaTitolo>(() =>
    modalitaDaValore(classeLaurea, ammesse),
  );
  const [altra, setAltra] = useState(() => (ammesse.includes(classeLaurea) ? '' : classeLaurea));

  const cambiaModalita = (nuova: ModalitaTitolo) => {
    setModalita(nuova);
    if (nuova === 'non-so') onCambiaClasseLaurea('');
    if (nuova === 'altra') onCambiaClasseLaurea(altra.trim().toUpperCase());
  };

  const opzioniModalita: { chiave: ModalitaTitolo; etichetta: string }[] = [
    {
      chiave: 'nota',
      etichetta: ammesse.length > 0 ? `Ho ${ammesse.join(' / ')}` : 'Ho la classe ammessa',
    },
    { chiave: 'altra', etichetta: 'Ho un\u2019altra classe di laurea' },
    { chiave: 'non-so', etichetta: 'Non lo so' },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-widest text-primary-400">
          Titolo di studio · 02
        </p>
        <h3 className="text-2xl font-extrabold leading-snug text-primary-900 sm:text-3xl">
          Il tuo titolo di studio
        </h3>
        <p className="max-w-3xl text-base leading-relaxed text-primary-600 sm:text-lg">
          La norma ammette all&apos;insegnamento solo determinate classi di laurea: è il primo
          requisito verificato. Se non lo sai, dillo: il calcolo resta onesto invece di tirare a
          indovinare.
        </p>
      </div>

      <section className="rounded-2xl border border-primary-100 bg-white p-4 shadow-soft sm:p-5">
        <h4 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-primary-700">
          <GraduationCap className="h-4 w-4 text-primary-500" /> Classe di laurea del titolo
        </h4>

        <div className="mt-3 flex flex-wrap gap-2">
          {opzioniModalita.map((opzione) => (
            <button
              key={opzione.chiave}
              type="button"
              onClick={() => cambiaModalita(opzione.chiave)}
              aria-pressed={modalita === opzione.chiave}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                modalita === opzione.chiave
                  ? 'bg-primary-800 text-white shadow-soft'
                  : 'bg-slate-100 text-primary-600 hover:bg-slate-200'
              }`}
            >
              {opzione.etichetta}
            </button>
          ))}
        </div>

        {modalita === 'nota' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ammesse.map((codice) => (
              <button
                key={codice}
                type="button"
                onClick={() => onCambiaClasseLaurea(codice)}
                aria-pressed={classeLaurea === codice}
                className={`rounded-xl border px-4 py-2 font-mono text-sm font-bold transition ${
                  classeLaurea === codice
                    ? 'border-primary-500 bg-primary-50 text-primary-800'
                    : 'border-slate-200 bg-white text-primary-600 hover:border-primary-200'
                }`}
              >
                {codice}
              </button>
            ))}
          </div>
        )}

        {modalita === 'altra' && (
          <label className="mt-3 block max-w-xs">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-primary-400">
              Codice della tua classe di laurea
            </span>
            <input
              value={altra}
              onChange={(e) => {
                setAltra(e.target.value);
                onCambiaClasseLaurea(e.target.value.trim().toUpperCase());
              }}
              placeholder="es. LM-13"
              className="input w-full font-mono"
            />
          </label>
        )}

        {modalita === 'non-so' && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-primary-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" />
            Senza la classe di laurea il requisito di accesso resta non verificabile: il risultato
            sarà «serve una verifica», non un no.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-primary-100 bg-white p-4 shadow-soft sm:p-5">
        <h4 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-primary-700">
          <CalendarDays className="h-4 w-4 text-primary-500" /> Data della procedura (facoltativa)
        </h4>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-primary-600">
          Indica quando pensi di presentare domanda o concorso: serve a collocare il calcolo nella
          versione corretta della norma. Se non lo sai, lascia vuoto.
        </p>
        <input
          type="date"
          value={dataProcedura}
          onChange={(e) => onCambiaDataProcedura(e.target.value)}
          className="input mt-3 max-w-xs"
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onIndietro}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Cambia classe
        </button>
        <button
          type="button"
          onClick={onContinua}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600"
        >
          Inserisci gli esami
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
