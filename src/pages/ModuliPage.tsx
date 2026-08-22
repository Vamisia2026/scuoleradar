import { useState } from 'react';
import { FolderOpen, Download, CheckCircle2 } from 'lucide-react';

interface Modulo {
  nome: string;
  categoria: string;
  tipo: string;
  descrizione: string;
}

const moduli: Modulo[] = [
  {
    nome: 'Domanda di supplenza breve',
    categoria: 'Supplenze',
    tipo: 'DOCX',
    descrizione: 'Modello compilabile per la domanda di supplenza breve da inviare alle scuole.',
  },
  {
    nome: 'Domanda di messa a disposizione (MAD)',
    categoria: 'Supplenze',
    tipo: 'DOCX',
    descrizione: 'Modello aggiornato per la messa a disposizione per insegnamenti di ogni ordine e grado.',
  },
  {
    nome: 'Autocertificazione titoli di studio',
    categoria: 'Burocrazia',
    tipo: 'PDF',
    descrizione: 'Dichiarazione sostitutiva di certificazione dei titoli posseduti (DPR 445/2000).',
  },
  {
    nome: 'Lettera di presentazione',
    categoria: 'Candidature',
    tipo: 'DOCX',
    descrizione: 'Template professionale per presentare la tua candidatura alle istituzioni scolastiche.',
  },
  {
    nome: 'Checklist mobilità annuale',
    categoria: 'Mobilità',
    tipo: 'PDF',
    descrizione: 'Elenco dei documenti e delle scadenze da seguire per la mobilità annuale.',
  },
  {
    nome: 'Modulo deleghe e consenso privacy',
    categoria: 'Burocrazia',
    tipo: 'PDF',
    descrizione: 'Modello di delega e informativa privacy per i rapporti con le segreterie scolastiche.',
  },
];

export function ModuliPage() {
  const [scaricato, setScaricato] = useState<string | null>(null);

  const handleDownload = (m: Modulo) => {
    setScaricato(m.nome);
    alert(`Download simulato di "${m.nome}" (${m.tipo}). In una versione completa il file verrebbe scaricato realmente.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-bold text-primary-800">Moduli</h2>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <p className="text-sm text-primary-600">
          Modelli e documenti pronti all\u2019uso per la tua vita professionale. Scaricali, compilali e inviali.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {moduli.map((m) => (
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
          ))}
        </div>

        <p className="mt-4 text-xs text-primary-400">
          I moduli sono forniti a scopo dimostrativo. Verifica sempre la modulistica vigente presso gli enti competenti.
        </p>
      </div>
    </div>
  );
}
