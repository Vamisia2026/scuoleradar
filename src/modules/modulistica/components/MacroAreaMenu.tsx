import {
  macroAreeModulistica,
  type MacroAreaModulistica,
  type NomeMacroArea,
} from '@/data/moduli';

interface MacroAreaMenuProps {
  /** Id della macroarea attualmente esplorata. */
  attiva: string | null;
  /** Modalità compatta: riduce l'altezza delle schede (ricerca in corso). */
  compatto?: boolean;
  /** Seleziona/apre la macroarea (click o doppio click). */
  onSeleziona: (area: MacroAreaModulistica) => void;
}

/**
 * Navigazione categorie dell'archivio Modulistica, ordine ufficiale e
 * versioni compatte dei nomi (per ridurre i tab ed evitare lo scroll
 * orizzontale su desktop):
 *   Infanzia · Primaria · Secondaria 1° Grado · Secondaria 2° Grado ·
 *   Università · Comunicazioni · Sostegno · Enti e Altro
 *
 * Le schede NON usano icone: la tipografia è pulita e le etichette
 * multi-parola ("Secondaria 1°/2° Grado") vanno a capo in modo controllato.
 */
interface VoceMenu {
  id: string;
  /** Etichetta completa (per title/accessibilità e nome area). */
  etichetta: string;
  /** Righe visualizzate dentro la scheda (2 righe per le Secondarie). */
  righe: string[];
  aree: NomeMacroArea[];
}

const VOCI_MENU: VoceMenu[] = [
  { id: 'infanzia', etichetta: 'Infanzia', righe: ['Infanzia'], aree: ['Infanzia'] },
  { id: 'primaria', etichetta: 'Primaria', righe: ['Primaria'], aree: ['Primaria'] },
  {
    id: 'secondaria1',
    etichetta: 'Secondaria 1° Grado',
    righe: ['Secondaria', '1° Grado'],
    aree: ['Secondaria 1° Grado'],
  },
  {
    id: 'secondaria2',
    etichetta: 'Secondaria 2° Grado',
    righe: ['Secondaria', '2° Grado'],
    aree: ['Secondaria 2° Grado'],
  },
  { id: 'universita', etichetta: 'Università', righe: ['Università'], aree: ['Università'] },
  {
    id: 'comunicazioni',
    etichetta: 'Comunicazioni',
    righe: ['Comunicazioni'],
    aree: ['Comunicazione Interna'],
  },
  { id: 'sostegno', etichetta: 'Sostegno', righe: ['Sostegno'], aree: ['Sostegno'] },
  {
    id: 'enti-altro',
    etichetta: 'Enti e Altro',
    righe: ['Enti e', 'Altro'],
    aree: ['Enti', 'Altro'],
  },
];

export function MacroAreaMenu({ attiva, compatto = false, onSeleziona }: MacroAreaMenuProps) {
  const voci = VOCI_MENU.map((voce) => {
    const reali = voce.aree
      .map((nome) => macroAreeModulistica.find((m) => m.nome === nome))
      .filter((m): m is MacroAreaModulistica => Boolean(m));
    if (reali.length === 0) return null;
    // Scheda unica per più macroaree ("Enti e Altro"): unisce le due radici.
    const area: MacroAreaModulistica =
      reali.length === 1
        ? reali[0]
        : {
            id: voce.id,
            nome: voce.etichetta as NomeMacroArea,
            descrizione: reali.map((r) => r.descrizione ?? '').filter(Boolean).join(' · '),
            sotto: reali.flatMap((r) => r.sotto),
          };
    return { id: voce.id, etichetta: voce.etichetta, righe: voce.righe, area };
  }).filter(
    (v): v is { id: string; etichetta: string; righe: string[]; area: MacroAreaModulistica } =>
      Boolean(v),
  );

  return (
    <nav
      aria-label="Categorie della modulistica"
      className={`flex items-stretch gap-1 overflow-x-auto rounded-2xl border border-primary-100 bg-white shadow-card [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        compatto ? 'p-1' : 'p-1.5'
      } md:grid md:grid-cols-8 md:gap-1.5 md:overflow-visible`}
    >
      {voci.map(({ id, etichetta, righe, area }) => {
        const selezionata = area.id === attiva;
        return (
          <button
            key={id}
            type="button"
            title={`Esplora ${etichetta} (doppio click per aprire)`}
            onClick={() => onSeleziona(area)}
            onDoubleClick={() => onSeleziona(area)}
            className={`flex shrink-0 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-center font-semibold leading-tight transition-colors duration-150 ease-in-out ${
              compatto ? 'min-h-9 text-xs md:min-h-11 md:text-sm' : 'min-h-10 text-sm md:min-h-14 md:text-base'
            } ${
              selezionata
                ? 'bg-primary-500 text-white shadow-soft'
                : 'text-primary-700 hover:bg-sky-100 hover:text-blue-900'
            }`}
          >
            {righe.map((riga, indice) => (
              <span key={indice} className="block">
                {riga}
              </span>
            ))}
          </button>
        );
      })}
    </nav>
  );
}


