/**
 * Landing — FORM di REGISTRAZIONE PARZIALE (nome, cognome, email).
 *
 * UNICO form di registrazione parziale della homepage: lo monta la chiusura
 * commerciale dell'offerta PRO (`LandingOffertaPro`), unica superficie del flusso.
 * I tre campi sono input nativi OBBLIGATORI (`required`:
 * nome, cognome, email) e il submit NON apre una seconda schermata: il contenitore
 * scrive i tre dati nella BOZZA (`lib/bozzaRegistrazione.ts`) e avvia la modale di
 * configurazione del Radar, che li trova già compilati (nome, cognome ed email di
 * notifica) — un solo passaggio, nessun doppione. La configurazione chiesta dal
 * cliente è quella PRO a 4 province.
 *
 * Presentazione pura: la logica di prefill vive nel contenitore (`LandingPage`).
 */
import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Radar } from 'lucide-react';

export interface DatiRegistrazioneRapida {
  nome: string;
  cognome: string;
  email: string;
}

export interface FormRegistrazioneRapidaProps {
  /** Apre la configurazione del Radar con i dati già precompilati. */
  onSubmit: (dati: DatiRegistrazioneRapida) => void;
  /**
   * Etichetta del pulsante. Default «ATTIVA IL TUO RADAR» — la stessa scritta
   * esatta del pulsante dell'hero e della checklist di prodotto
   * (`comunicazione/05_abbonamenti_pagamenti/checklist_pagamenti.md`): la sezione
   * sotto l'hero e la chiusura PRO del form dicono la stessa cosa.
   */
  etichetta?: string;
}

const CAMPO =
  'w-full rounded-xl border border-primary-200 bg-white px-4 py-3 text-sm text-primary-800 transition focus:border-primary-500';

export function FormRegistrazioneRapida({
  onSubmit,
  etichetta = 'ATTIVA IL TUO RADAR',
}: FormRegistrazioneRapidaProps) {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [errore, setErrore] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const dati = { nome: nome.trim(), cognome: cognome.trim(), email: email.trim() };
    if (!dati.nome || !dati.cognome || !dati.email) {
      setErrore('Inserisci nome, cognome ed email per attivare il Radar.');
      return;
    }
    setErrore('');
    onSubmit(dati);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-primary-700">Nome</span>
        <input
          type="text"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={CAMPO}
          autoComplete="given-name"
          placeholder="Nome"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-primary-700">Cognome</span>
        <input
          type="text"
          required
          value={cognome}
          onChange={(e) => setCognome(e.target.value)}
          className={CAMPO}
          autoComplete="family-name"
          placeholder="Cognome"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-primary-700">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={CAMPO}
          autoComplete="email"
          placeholder="La tua email"
        />
      </label>

      <div className="sm:col-span-3">
        {errore && (
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-600">
            <AlertCircle className="h-4 w-4" />
            {errore}
          </p>
        )}
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2B6F9E] px-6 py-3.5 text-base font-black uppercase tracking-wide text-white shadow-soft transition hover:bg-[#225a82]"
        >
          <Radar className="h-5 w-5" />
          {etichetta}
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-2 text-xs text-primary-500">
          Nessun passaggio intermedio: nome, cognome ed email sono già impostati nella
          configurazione.
        </p>
      </div>
    </form>
  );
}
