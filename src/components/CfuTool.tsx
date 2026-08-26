import { useMemo, useState } from 'react';
import {
  Plus, Trash2, CheckCircle2, XCircle, AlertTriangle, BookOpen, Calculator, Sparkles, Search, X, GraduationCap,
} from 'lucide-react';
import { useApp, type Esame } from '@/contexts/AppContext';
import { classiConcorso, type ClasseConcorso } from '@/data/classiConcorso';
import { ServiziPaywall } from '@/components/ServiziPaywall';

/** Preset dei titoli di studio: selezionando un titolo si caricano gli esami tipici del corso. */
interface TitoloStudio {
  codice: string;
  nome: string;
  esamiTipici: { materia: string; cfu: number; settore: string }[];
}

const TITOLI_STUDIO: TitoloStudio[] = [
  {
    codice: 'L-19',
    nome: "Scienze dell'educazione e della formazione",
    esamiTipici: [
      { materia: "Scienze dell'educazione – Pedagogia generale e sociale", cfu: 12, settore: 'M-PED/01' },
      { materia: "Psicologia dello sviluppo e dell'educazione", cfu: 8, settore: 'M-PSI/04' },
      { materia: 'Filosofia teoretica', cfu: 6, settore: 'M-FIL/01' },
      { materia: 'Discipline storiche – Storia contemporanea', cfu: 6, settore: 'M-STO/04' },
      { materia: 'Letteratura italiana', cfu: 8, settore: 'L-FIL-LET/10' },
      { materia: 'Linguistica generale', cfu: 6, settore: 'L-LIN/01' },
      { materia: 'Sociologia generale', cfu: 6, settore: 'SPS/07' },
    ],
  },
  {
    codice: 'LM-85',
    nome: 'Scienze pedagogiche',
    esamiTipici: [
      { materia: "Scienze dell'educazione – Pedagogia generale e sociale", cfu: 12, settore: 'M-PED/01' },
      { materia: 'Pedagogia sperimentale', cfu: 8, settore: 'M-PED/04' },
      { materia: "Psicologia dello sviluppo e dell'educazione", cfu: 8, settore: 'M-PSI/04' },
      { materia: 'Filosofia teoretica', cfu: 8, settore: 'M-FIL/01' },
      { materia: 'Discipline storiche – Storia contemporanea', cfu: 6, settore: 'M-STO/04' },
      { materia: 'Letteratura italiana', cfu: 8, settore: 'L-FIL-LET/10' },
      { materia: 'Sociologia generale', cfu: 6, settore: 'SPS/07' },
    ],
  },
  {
    codice: 'LM-14',
    nome: 'Filologia moderna',
    esamiTipici: [
      { materia: 'Letteratura italiana', cfu: 12, settore: 'L-FIL-LET/10' },
      { materia: 'Linguistica italiana', cfu: 8, settore: 'L-FIL-LET/12' },
      { materia: 'Filologia romanza', cfu: 8, settore: 'L-FIL-LET/09' },
      { materia: 'Lingua e letteratura latina', cfu: 12, settore: 'L-FIL-LET/04' },
      { materia: 'Discipline storiche – Storia moderna', cfu: 6, settore: 'M-STO/02' },
    ],
  },
  {
    codice: 'LM-40',
    nome: 'Matematica',
    esamiTipici: [
      { materia: 'Analisi matematica', cfu: 12, settore: 'MAT/05' },
      { materia: 'Algebra', cfu: 8, settore: 'MAT/02' },
      { materia: 'Geometria', cfu: 8, settore: 'MAT/03' },
      { materia: 'Fisica generale', cfu: 12, settore: 'FIS/01' },
      { materia: 'Discipline informatiche – Fondamenti di informatica', cfu: 6, settore: 'INF/01' },
    ],
  },
  {
    codice: 'LM-37',
    nome: 'Lingue e letterature moderne',
    esamiTipici: [
      { materia: 'Lingua e traduzione – Lingua inglese', cfu: 12, settore: 'L-LIN/12' },
      { materia: 'Lingua e letteratura inglese', cfu: 8, settore: 'L-LIN/10' },
      { materia: 'Linguistica generale', cfu: 6, settore: 'L-LIN/01' },
      { materia: 'Filologia romanza', cfu: 6, settore: 'L-FIL-LET/09' },
      { materia: 'Letteratura italiana', cfu: 8, settore: 'L-FIL-LET/10' },
    ],
  },
  {
    codice: 'V.O.',
    nome: 'Laurea Vecchio Ordinamento / diploma magistrale',
    esamiTipici: [
      { materia: "Scienze dell'educazione – Pedagogia", cfu: 12, settore: 'M-PED/01' },
      { materia: 'Psicologia dello sviluppo', cfu: 8, settore: 'M-PSI/04' },
      { materia: 'Letteratura italiana', cfu: 8, settore: 'L-FIL-LET/10' },
      { materia: 'Matematica – Elementi di matematica', cfu: 6, settore: 'MAT/02' },
      { materia: 'Discipline storiche – Storia', cfu: 6, settore: 'M-STO/04' },
    ],
  },
];

interface RisultatoClasse {
  classe: ClasseConcorso;
  ammissibile: boolean;
  dettagli: { ambito: string; richiesto: number; presente: number; mancante: number }[];
}

function valutaCfu(esami: Esame[]): RisultatoClasse[] {
  return classiConcorso.map((classe) => {
    const dettagli = classe.requisitiCfu.map((req) => {
      // match semplice: somma CFU esami che contengono parole chiave dell'ambito
      const parole = req.ambito.toLowerCase().split(/[\s,]+/).filter((p) => p.length > 4);
      const presente = esami
        .filter((e) =>
          parole.some((p) => e.materia.toLowerCase().includes(p) || e.settore.toLowerCase().includes(p)),
        )
        .reduce((sum, e) => sum + e.cfu, 0);
      return {
        ambito: req.ambito,
        richiesto: req.cfu,
        presente: Math.min(presente, req.cfu),
        mancante: Math.max(0, req.cfu - presente),
      };
    });
    const ammissibile = dettagli.every((d) => d.mancante === 0);
    return { classe, ammissibile, dettagli };
  });
}

export function CfuTool() {
  const { esami, setEsami, abbonato, crediti, consumaCredito, user, openVetrina } = useApp();
  const [materia, setMateria] = useState('');
  const [cfu, setCfu] = useState(6);
  const [settore, setSettore] = useState('');
  const [titoloInput, setTitoloInput] = useState('');
  const [titoloSelezionato, setTitoloSelezionato] = useState<TitoloStudio | null>(null);
  const [sbloccato, setSbloccato] = useState(false);

  // Computazione dei risultati SEMPRE (prima di ogni early-return): rispetta le
  // Rules of Hooks (useMemo non può stare dopo un return condizionale, altrimenti
  // al passaggio vetrina→account React lancerebbe "Rendered more hooks...").
  const risultati = valutaCfu(esami);
  const ammissibili = risultati.filter((r) => r.ammissibile);

  /** Aggregazione dei CFU mancanti per ambito (SSD), con le classi interessate. */
  const cfuMancanti = useMemo(() => {
    const perAmbito = new Map<string, number>();
    const classiPerAmbito = new Map<string, string[]>();
    risultati.forEach((r) => {
      if (r.ammissibile) return;
      r.dettagli
        .filter((d) => d.mancante > 0)
        .forEach((d) => {
          perAmbito.set(d.ambito, (perAmbito.get(d.ambito) ?? 0) + d.mancante);
          const classi = classiPerAmbito.get(d.ambito) ?? [];
          if (!classi.includes(r.classe.codice)) classi.push(r.classe.codice);
          classiPerAmbito.set(d.ambito, classi);
        });
    });
    return [...perAmbito.entries()]
      .map(([ambito, cfu]) => ({ ambito, cfu, classi: classiPerAmbito.get(ambito) ?? [] }))
      .sort((a, b) => b.cfu - a.cfu);
  }, [risultati]);

  const totaleCfuMancanti = cfuMancanti.reduce((sum, x) => sum + x.cfu, 0);

  // Vetrina Freemium: gli utenti non autenticati vengono invitati a registrarsi.
  if (!user) {
    return (
      <div className="rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
          <Calculator className="h-7 w-7 text-primary-400" />
        </span>
        <h3 className="mt-4 text-lg font-bold text-primary-800">Check CFU riservato</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-primary-500">
          La verifica delle classi di concorso richiede un account gratuito e poi 1 credito a
          consumo oppure il piano PRO.
        </p>
        <button
          onClick={() => openVetrina('cfu')}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
        >
          <Sparkles className="h-4 w-4" />
          Crea un account per continuare
        </button>
      </div>
    );
  }

  // Paywall: SOLO gli utenti Base senza crediti vengono bloccati.
  // Gli utenti PRO hanno accesso illimitato; i Base con crediti usano il tool
  // attivo e consumano 1 credito per sbloccare la verifica.
  if (!abbonato && crediti === 0) {
    return (
      <ServiziPaywall
        titolo="Check CFU riservato"
        messaggio="La verifica delle classi di concorso richiede il piano PRO oppure 1 credito a consumo."
      />
    );
  }

  const applicaTitolo = (titolo: TitoloStudio) => {
    setTitoloSelezionato(titolo);
    setTitoloInput(`${titolo.codice} – ${titolo.nome}`);
    const esamiTipici = titolo.esamiTipici.filter(
      (p) => !esami.some((e) => e.materia === p.materia && e.settore === p.settore),
    );
    if (esamiTipici.length > 0) {
      setEsami([
        ...esami,
        ...esamiTipici.map((p) => ({ id: crypto.randomUUID(), materia: p.materia, cfu: p.cfu, settore: p.settore })),
      ]);
    }
  };

  const clearTitolo = () => {
    setTitoloSelezionato(null);
    setTitoloInput('');
  };

  const onTitoloChange = (value: string) => {
    setTitoloInput(value);
    const match = TITOLI_STUDIO.find(
      (t) =>
        t.codice.toLowerCase() === value.trim().toLowerCase() ||
        t.nome.toLowerCase() === value.trim().toLowerCase(),
    );
    if (match) applicaTitolo(match);
  };

  const aggiungi = () => {
    if (!materia.trim() || cfu <= 0) return;
    setEsami([
      ...esami,
      { id: crypto.randomUUID(), materia: materia.trim(), cfu, settore: settore.trim() },
    ]);
    setMateria('');
    setCfu(6);
    setSettore('');
  };

  const rimuovi = (id: string) => setEsami(esami.filter((e) => e.id !== id));

  return (
    <div className="space-y-6">
      {/* Titolo di Studio / Laurea */}
      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <h3 className="flex items-center gap-1.5 text-base font-bold text-primary-800">
          <GraduationCap className="h-5 w-5 text-primary-500" />
          Il tuo Titolo di Studio / Laurea
        </h3>
        <p className="mt-1 text-sm text-primary-600">
          Seleziona il tuo corso di laurea per caricare automaticamente gli esami tipici e valutare
          subito le classi di concorso accessibili.
        </p>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
          <input
            type="text"
            value={titoloInput}
            onChange={(e) => onTitoloChange(e.target.value)}
            placeholder="Es. L-19, LM-85, Laurea Vecchio Ordinamento..."
            list="titoli-studio"
            className="input pl-10 pr-9"
          />
          {titoloSelezionato && (
            <button
              onClick={clearTitolo}
              aria-label="Rimuovi titolo di studio"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-primary-400 transition hover:bg-primary-50 hover:text-error-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <datalist id="titoli-studio">
          {TITOLI_STUDIO.map((t) => (
            <option key={t.codice} value={`${t.codice} – ${t.nome}`} />
          ))}
        </datalist>
        {titoloSelezionato && (
          <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
            <strong>
              {titoloSelezionato.codice} – {titoloSelezionato.nome}
            </strong>
            : esami tipici caricati ({titoloSelezionato.esamiTipici.length}). Puoi modificarli o
            rimuoverli dalla lista sotto.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <h3 className="text-base font-bold text-primary-800">I tuoi esami universitari</h3>
        <p className="mt-1 text-sm text-primary-600">
          Inserisci materia, CFU e settore scientifico-disciplinare. Verificheremo le classi di concorso accessibili.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px_1fr_auto]">
          <input
            type="text"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            placeholder="Materia (es. Letteratura italiana)"
            className="input"
          />
          <input
            type="number"
            min={1}
            value={cfu}
            onChange={(e) => setCfu(parseInt(e.target.value) || 0)}
            placeholder="CFU"
            className="input"
          />
          <input
            type="text"
            value={settore}
            onChange={(e) => setSettore(e.target.value)}
            placeholder="Settore (es. L-FIL-LET/10)"
            className="input"
          />
          <button
            onClick={aggiungi}
            disabled={!materia.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Aggiungi
          </button>
        </div>

        {esami.length > 0 && (
          <div className="mt-4 space-y-2">
            {esami.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-primary-100 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-primary-800">{e.materia}</p>
                  <p className="text-xs text-primary-500">
                    {e.cfu} CFU{e.settore ? ` · ${e.settore}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => rimuovi(e.id)}
                  aria-label="Rimuovi esame"
                  className="rounded-lg p-1.5 text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-primary-800">
            Classi di concorso accessibili / da integrare
          </h3>
          {!abbonato ? (
            <span className="rounded-full bg-secondary-50 px-3 py-1 text-xs font-semibold text-secondary-700">
              Bloccata · usa 1 credito
            </span>
          ) : (
            <span className="rounded-full bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-700">
              {ammissibili.length} ammissibili
            </span>
          )}
        </div>

        {!abbonato && !sbloccato ? (
          <div className="mt-4 rounded-xl border border-secondary-200 bg-secondary-50 p-4 text-center">
            <p className="text-sm text-secondary-800">
              La verifica consumerà <strong>1 credito a consumo</strong> (ne hai {crediti}). Con il
              piano PRO è inclusa senza limiti.
            </p>
            <button
              onClick={() => void consumaCredito().then((esito) => esito.ok && setSbloccato(true))}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
            >
              <Sparkles className="h-4 w-4" />
              Consuma 1 credito per verificare i CFU
            </button>
          </div>
        ) : esami.length === 0 ? (
          <p className="mt-4 text-sm text-primary-400">
            Aggiungi almeno un esame per vedere le classi di concorso accessibili.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {risultati.map((r) => (
              <div
                key={r.classe.codice}
                className={`rounded-xl border p-4 ${
                  r.ammissibile ? 'border-accent-200 bg-accent-50' : 'border-primary-100 bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-primary-800">
                      {r.classe.codice} – {r.classe.denominazione}
                    </p>
                    <p className="mt-0.5 text-xs text-primary-500">
                      {r.classe.materie.join(', ')}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      r.ammissibile ? 'bg-accent-500 text-white' : 'bg-error-50 text-error-700'
                    }`}
                  >
                    {r.ammissibile ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ammissibile
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        Non ammissibile
                      </>
                    )}
                  </span>
                </div>

                {!r.ammissibile && (
                  <div className="mt-3 space-y-1">
                    {r.dettagli
                      .filter((d) => d.mancante > 0)
                      .map((d, i) => (
                        <p key={i} className="text-xs text-error-600">
                          Mancano <strong>{d.mancante} CFU</strong> in: {d.ambito} (presenti {d.presente}/{d.richiesto})
                        </p>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {esami.length > 0 && totaleCfuMancanti > 0 && (
          <div className="mt-4 rounded-xl border border-warning-200 bg-warning-50 p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-warning-800">
              <AlertTriangle className="h-4 w-4" />
              CFU mancanti per completare il profilo ({totaleCfuMancanti} CFU)
            </h4>
            <p className="mt-1 text-xs text-warning-700">
              Per accedere alle classi evidenziate come non ammissibili ti mancano i seguenti ambiti
              (settori SSD): integrandoli potresti sbloccare nuove classi di concorso.
            </p>
            <ul className="mt-3 space-y-2">
              {cfuMancanti.map((m) => (
                <li
                  key={m.ambito}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-primary-800">{m.ambito}</p>
                    <p className="truncate text-xs text-primary-400">
                      Classi interessate: {m.classi.join(', ')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-warning-100 px-2.5 py-1 text-xs font-bold text-warning-700">
                    {m.cfu} CFU
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA affiliato (placeholder) */}
            <div className="mt-4 flex flex-col gap-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-white" />
                <div>
                  <p className="text-sm font-bold text-white">Ti mancano dei CFU?</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/90">
                    Scopri come integrarli online con enti riconosciuti MIM.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Richiedi Info
                </a>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-800"
                >
                  Integrati ORA
                </a>
              </div>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-primary-400">
          Valutazione indicativa basata su requisiti minimi. Verifica sempre la normativa vigente e il bando di riferimento.
        </p>
      </div>
    </div>
  );
}

