import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderOpen, Download, CheckCircle2, Search, Info, ImageDown, Trash2 } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useApp } from '@/contexts/AppContext';
import {
  moduli,
  macroAree,
  conAggiuntaInCima,
  STORAGE_KEY_MODULI_SCARICATI,
  type Modulo,
  type MacroArea,
  type ModuloScaricato,
} from '@/data/moduli';

export function ModuliPage() {
  const { abbonato } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vista, setVista] = useState<'catalogo' | 'miei'>(() =>
    searchParams.get('tab') === 'miei' ? 'miei' : 'catalogo',
  );
  const [scaricato, setScaricato] = useState<string | null>(null);
  const [macroArea, setMacroArea] = useState<MacroArea>('Tutti');
  const [query, setQuery] = useState('');
  const [moduliScaricati, setModuliScaricati] = useLocalStorage<ModuloScaricato[]>(
    STORAGE_KEY_MODULI_SCARICATI,
    [],
  );

  const moduliFiltrati = useMemo(() => {
    const q = query.trim().toLowerCase();
    return moduli.filter((m) => {
      const matchArea = macroArea === 'Tutti' || m.macroArea === macroArea;
      const matchQuery = !q || `${m.nome} ${m.descrizione} ${m.categoria}`.toLowerCase().includes(q);
      return matchArea && matchQuery;
    });
  }, [macroArea, query]);

  const handleDownload = (m: Modulo) => {
    setScaricato(m.nome);
    // Salva il modulo nello storico del profilo (localStorage condiviso con la pagina Profilo)
    setModuliScaricati(conAggiuntaInCima(moduliScaricati, m));
    if (abbonato) {
      alert(`Download simulato di "${m.nome}" (${m.tipo}) senza logo/branding per gli abbonati PRO.`);
    } else {
      alert(
        `Download simulato di "${m.nome}" (${m.tipo}) con logo/branding ScuoleRadar.it. Passa al piano PRO per scaricare i documenti puliti.`,
      );
    }
  };

  const rimuoviModulo = (id: string) =>
    setModuliScaricati(moduliScaricati.filter((m) => m.id !== id));

  const apriMiei = () => {
    setVista('miei');
    setSearchParams({ tab: 'miei' }, { replace: true });
  };

  const apriCatalogo = () => {
    setVista('catalogo');
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-bold text-primary-800">Moduli</h2>
      </div>

      {/* Disclaimer legale */}
      <div className="flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
        <p className="text-sm leading-relaxed text-primary-700">
          I modelli sono messi a disposizione gratuitamente per tutti gli utenti. Non costituiscono
          documento ufficiale né hanno valore legale; verificare sempre le specifiche richieste della
          scuola.
        </p>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <p className="text-sm text-primary-600">
          Modelli e documenti pronti all&apos;uso per la tua vita professionale. Scaricali, compilali e inviali.
        </p>

        {/* Ricerca rapida */}
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca un modulo o documento..."
            className="w-full rounded-xl border border-primary-200 bg-white py-2.5 pl-10 pr-4 text-sm text-primary-800 outline-none transition focus:border-primary-400"
          />
        </div>

        {/* Tab Macro-Aree + I miei Modelli Scaricati */}
        <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-primary-50 p-1">
          {macroAree.map((area) => (
            <button
              key={area}
              onClick={() => {
                setMacroArea(area);
                apriCatalogo();
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                macroArea === area && vista === 'catalogo'
                  ? 'bg-white text-primary-700 shadow-soft'
                  : 'text-primary-600 hover:text-primary-800'
              }`}
            >
              {area}
            </button>
          ))}
          <button
            onClick={apriMiei}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              vista === 'miei'
                ? 'bg-secondary-500 text-white shadow-soft'
                : 'text-secondary-700 hover:bg-secondary-50'
            }`}
          >
            <Download className="h-4 w-4" />
            I miei Modelli Scaricati
          </button>
        </div>

        {vista === 'miei' ? (
          <div className="mt-4">
            {moduliScaricati.length === 0 ? (
              <p className="rounded-xl border border-dashed border-primary-100 p-8 text-center text-sm text-primary-400">
                Non hai ancora scaricato modelli. Torna al catalogo e scarica il primo documento.
              </p>
            ) : (
              <ul className="space-y-2">
                {moduliScaricati.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-primary-800">{m.nome}</p>
                      <p className="text-xs text-primary-400">
                        {m.tipo} · {m.categoria}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => handleDownload(m)}
                        aria-label={`Scarica di nuovo ${m.nome}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Scarica
                      </button>
                      <button
                        onClick={() => rimuoviModulo(m.id)}
                        aria-label={`Rimuovi ${m.nome} dalla cronologia`}
                        className="rounded-lg p-2 text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-primary-400">
              La cronologia di download è condivisa con la sezione &quot;Modelli Scaricati di
              Recente&quot; del tuo profilo.
            </p>
          </div>
        ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {moduliFiltrati.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-primary-100 p-8 text-center text-sm text-primary-400">
              Nessun modulo trovato con i filtri attuali.
            </div>
          ) : (
            moduliFiltrati.map((m) => (
              <div
                key={m.nome}
                className="flex items-start justify-between gap-3 rounded-xl border border-primary-100 bg-slate-50 p-4 transition hover:border-primary-200"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
                      {m.tipo}
                    </span>
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-500">
                      {m.categoria}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-bold text-primary-800">{m.nome}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-primary-500">{m.descrizione}</p>
                </div>
                <button
                  onClick={() => handleDownload(m)}
                  aria-label={`Scarica ${m.nome}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                  {scaricato === m.nome ? (
                    <CheckCircle2 className="h-4 w-4 text-accent-500" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
        )}

        <p className="mt-4 text-xs text-primary-400">
          I moduli sono forniti a scopo dimostrativo. Verifica sempre la modulistica vigente presso gli enti competenti.
        </p>
        {!abbonato && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-primary-400">
            <ImageDown className="h-3.5 w-3.5" />
            I documenti scaricati in versione gratuita includono il logo/branding ScuoleRadar.it —
            rimuovilo con il piano PRO.
          </p>
        )}
      </div>
    </div>
  );
}
