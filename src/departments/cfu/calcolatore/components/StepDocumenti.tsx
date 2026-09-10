import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowRight, FileText, GraduationCap, Image, Trash2, Upload, Wand2 } from 'lucide-react';
import type { AllegatoCfu, Esame } from '../../shared/types';
import {
  allegatoDaFile,
  classificaFile,
  parseEsamiDaTesto,
  righeVersoEsami,
} from '../../shared/ocrUtils';
import { PrivacyBadge } from './PrivacyBadge';
import { NOTA_OCR_FOTO_CFU } from '../../shared/tutorIntro';

type ModalitaInserimento = 'documento' | 'testo' | 'manuale';

interface StepDocumentiProps {
  esami: Esame[];
  allegati: AllegatoCfu[];
  onAggiungiEsame: (esame: Esame) => void;
  onRimuoviEsame: (id: string) => void;
  onImpostaEsami: (esami: Esame[]) => void;
  onAggiungiAllegati: (file: File[]) => void;
  onRimuoviAllegato: (id: string) => void;
  onCaricaDemo: () => void;
  onContinua: () => void;
}

let contatoreLocale = 0;
function nuovoId(prefix: string): string {
  contatoreLocale += 1;
  return `${prefix}-${contatoreLocale}-${Date.now()}`;
}

/** Step B — Carica il libretto/statino oppure inserisci gli esami a mano. */
export function StepDocumenti({
  esami,
  allegati,
  onAggiungiEsame,
  onRimuoviEsame,
  onImpostaEsami,
  onAggiungiAllegati,
  onRimuoviAllegato,
  onCaricaDemo,
  onContinua,
}: StepDocumentiProps) {
  const [modalita, setModalita] = useState<ModalitaInserimento>('documento');
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [erroreFile, setErroreFile] = useState<string | null>(null);
  const [materia, setMateria] = useState('');
  const [cfu, setCfu] = useState('');
  const [ssd, setSsd] = useState('');
  const [testo, setTesto] = useState('');
  const [nota, setNota] = useState<string | null>(null);

  const cambiaFile = (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files ?? []);
    if (fileList.length === 0) return;
    setErroreFile(null);
    const validi: File[] = [];
    for (const file of fileList) {
      const verifica = classificaFile(file.name, file.type, file.size);
      if (!verifica.ammesso) setErroreFile(verifica.motivo ?? 'File non valido.');
      else if (allegatoDaFile(file)) validi.push(file);
    }
    if (validi.length > 0) onAggiungiAllegati(validi);
    if (inputFileRef.current) inputFileRef.current.value = '';
  };

  const aggiungiManuale = (e: FormEvent) => {
    e.preventDefault();
    const valoreCfu = Number.parseFloat(cfu.replace(',', '.'));
    if (!materia.trim()) {
      setNota('Scrivi la denominazione dell\u2019esame.');
      return;
    }
    if (!Number.isFinite(valoreCfu) || valoreCfu <= 0) {
      setNota('Indica i CFU/ECTS dell\u2019esame.');
      return;
    }
    onAggiungiEsame({
      id: nuovoId('esame'),
      denominazione: materia.trim(),
      cfu: Math.round(valoreCfu * 10) / 10,
      ssd: ssd.trim() ? ssd.trim().toUpperCase() : null,
      fonte: 'manuale',
      affidabilita: ssd.trim() ? 'alta' : 'media',
    });
    setMateria('');
    setCfu('');
    setSsd('');
    setNota(null);
  };

  const riconosciTesto = () => {
    const riconosciuti = righeVersoEsami(parseEsamiDaTesto(testo));
    if (riconosciuti.length === 0) {
      setNota('Nessun esame riconosciuto. Formato per riga: Materia — 6 CFU — M-PED/01.');
      return;
    }
    onImpostaEsami([...esami, ...riconosciuti]);
    setNota(`${riconosciuti.length} esami riconosciuti e aggiunti.`);
    setTesto('');
  };

  const pronto = esami.length > 0 || allegati.length > 0;
  const totaleCfu = esami.reduce((somma, e) => somma + e.cfu, 0);
  const moduli: { chiave: ModalitaInserimento; etichetta: string }[] = [
    { chiave: 'documento', etichetta: 'Carica documento' },
    { chiave: 'testo', etichetta: 'Incolla l\u2019elenco' },
    { chiave: 'manuale', etichetta: 'Inserimento manuale' },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-widest text-primary-400">
          Documenti · 02
        </p>
        <h3 className="text-2xl font-extrabold leading-snug text-primary-900 sm:text-3xl">
          Fammi vedere la tua carriera universitaria
        </h3>
        <p className="max-w-3xl text-base leading-relaxed text-primary-600 sm:text-lg">
          Certificato di laurea con l&apos;elenco degli esami sostenuti, oppure piano di studi o
          libretto: carica un file (JPG, PNG o PDF), incolla l&apos;elenco oppure inserisci tutto a
          mano.
        </p>
      </div>

      <PrivacyBadge />

      <div className="flex flex-wrap gap-1.5">
        {moduli.map((m) => (
          <button
            key={m.chiave}
            type="button"
            onClick={() => {
              setModalita(m.chiave);
              setNota(null);
            }}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition ${
              modalita === m.chiave
                ? 'bg-primary-800 text-white shadow-soft'
                : 'bg-slate-100 text-primary-600 hover:bg-slate-200'
            }`}
          >
            {m.etichetta}
          </button>
        ))}
      </div>

      {modalita === 'documento' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => inputFileRef.current?.click()}
            className="group flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-5 py-8 text-center transition hover:border-primary-300 hover:bg-primary-50/40"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-primary-600 transition group-hover:bg-primary-100">
              <Upload className="h-6 w-6" />
            </span>
            <span className="text-base font-bold text-primary-800">
              Clicca per allegare il certificato di laurea o il piano di studi
            </span>
            <span className="text-sm font-medium text-primary-400">
              JPG · PNG · PDF — fino a 10 MB — più file insieme
            </span>
          </button>
          <input
            ref={inputFileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            multiple
            className="hidden"
            onChange={cambiaFile}
          />
          {erroreFile && <p className="text-sm font-semibold text-error-600">{erroreFile}</p>}
          <p className="flex items-start gap-2 rounded-xl bg-white px-4 py-3 text-sm leading-relaxed text-primary-600 ring-1 ring-primary-100 sm:text-base">
            <Image className="mt-0.5 h-5 w-5 shrink-0 text-secondary-500" />
            {NOTA_OCR_FOTO_CFU}
          </p>
          {allegati.length > 0 && (
            <ul className="space-y-1.5">
              {allegati.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {a.tipo === 'pdf' ? (
                    <FileText className="h-4 w-4 shrink-0 text-secondary-500" />
                  ) : (
                    <Image className="h-4 w-4 shrink-0 text-secondary-500" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-primary-700">
                    {a.nomeFile}
                    {a.suggerimento && (
                      <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-500">
                        {a.suggerimento}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label="Rimuovi allegato"
                    onClick={() => onRimuoviAllegato(a.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modalita === 'testo' && (
        <div className="space-y-2.5">
          <textarea
            value={testo}
            onChange={(e) => {
              setTesto(e.target.value);
              setNota(null);
            }}
            rows={6}
            placeholder={
              'Esempio (una materia per riga):\nPedagogia generale — 6 CFU — M-PED/01\nAnalisi matematica I — 9 CFU — MAT/05'
            }
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-primary-800 placeholder:text-primary-300 focus:border-primary-300 focus:bg-white focus:outline-none"
          />
          <button
            type="button"
            onClick={riconosciTesto}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
          >
            <Wand2 className="h-4 w-4" />
            Riconosci esami dal testo
          </button>
        </div>
      )}

      {modalita === 'manuale' && (
        <form onSubmit={aggiungiManuale} className="space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-[1fr_5rem_9rem_auto]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-primary-400">
                Denominazione esame
              </span>
              <input
                value={materia}
                onChange={(e) => setMateria(e.target.value)}
                placeholder="Es. Didattica generale"
                className="input w-full"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-primary-400">
                CFU
              </span>
              <input
                value={cfu}
                onChange={(e) => setCfu(e.target.value)}
                inputMode="decimal"
                placeholder="6"
                className="input w-full"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-primary-400">
                SSD (facoltativo)
              </span>
              <input
                value={ssd}
                onChange={(e) => setSsd(e.target.value)}
                placeholder="M-PED/01"
                className="input w-full font-mono"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-[38px] items-center gap-1 self-end rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition hover:bg-primary-600"
            >
              + Aggiungi
            </button>
          </div>
        </form>
      )}

      {nota && (
        <p className="rounded-xl bg-primary-50 px-4 py-2.5 text-sm font-medium leading-relaxed text-primary-700">
          {nota}
        </p>
      )}

      <button
        type="button"
        onClick={onCaricaDemo}
        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary-300 bg-primary-50/50 px-4 py-2.5 text-sm font-bold text-primary-700 transition hover:bg-primary-100/60"
      >
        <GraduationCap className="h-4 w-4" />
        Prova con il piano di studi di esempio (dati dimostrativi)
      </button>

      {esami.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <p className="mb-2.5 text-sm font-bold uppercase tracking-wide text-primary-500">
            Esami in archivio ({esami.length}) · {totaleCfu} CFU
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {esami.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-primary-700"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{e.denominazione}</span>
                <span className="shrink-0 font-mono text-xs text-secondary-600">
                  {e.ssd ?? 'SSD —'}
                </span>
                <span className="shrink-0 font-bold text-primary-500">{e.cfu} CFU</span>
                <button
                  type="button"
                  aria-label="Rimuovi esame"
                  onClick={() => onRimuoviEsame(e.id)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <p className="max-w-xl text-sm font-medium leading-relaxed text-primary-500 sm:text-base">
          {pronto
            ? 'Documentazione acquisita: procedi con la lettura.'
            : 'Serve almeno un esame oppure un documento caricato per aprire la cartella.'}
        </p>
        <button
          type="button"
          onClick={onContinua}
          disabled={!pronto}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-6 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Calcola i tuoi CFU
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
