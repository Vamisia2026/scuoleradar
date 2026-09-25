/**
 * Profilo · sezione «Documenti» (contenitore a due tab).
 *
 *   1. «Moduli scaricati»  → archivio dei moduli UFFICIALI (Modulistica);
 *   2. «I Miei Documenti»  → spazio di storage personale dell'utente (con disclaimer).
 *
 * La tendina sostituisce la vecchia «Modelli Scaricati di Recente»: stesso punto
 * d'accesso (menu utente → Documenti) ma con lo spazio personale accanto agli
 * archivi ufficiali. `?sezione=documenti` apre la sezione, `&tab=miei` il secondo tab.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Accordion } from '@/components/Accordion';
import { ModuliScaricati } from './ModuliScaricati';
import { MieiDocumenti } from '@/components/documenti/MieiDocumenti';

type TabDocumenti = 'moduli' | 'miei';

const TAB: { id: TabDocumenti; label: string }[] = [
  { id: 'moduli', label: '📄 Moduli scaricati' },
  { id: 'miei', label: '🗂️ I Miei Documenti' },
];

export function DocumentiProfilo() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<TabDocumenti>(searchParams.get('tab') === 'miei' ? 'miei' : 'moduli');
  const [aperto, setAperto] = useState(true);

  return (
    <Accordion
      icona="🗂️"
      titolo="Documenti"
      aperto={aperto}
      onToggle={() => setAperto((v) => !v)}
    >
      {/* Tab (archivio ufficiale · storage personale) */}
      <div
        role="tablist"
        aria-label="Documenti"
        className="mb-3 inline-flex flex-wrap gap-1 rounded-xl bg-primary-50 p-1"
      >
        {TAB.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id ? 'bg-white text-primary-800 shadow-soft' : 'text-primary-600 hover:text-primary-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'moduli' ? (
        <>
          <p className="mb-2 text-xs leading-relaxed text-primary-500">
            L&apos;archivio dei <strong>moduli ufficiali</strong> che hai scaricato dalla Modulistica:
            riscaricali, stampali o rimuovili dallo storico.
          </p>
          <ModuliScaricati />
        </>
      ) : (
        <MieiDocumenti />
      )}
    </Accordion>
  );
}
