/* Refactor UI (parte 5): AssistenteAIPage — Accesso in Anteprima.
   Uso: node scripts/_refactor-ui5.mjs */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const scrivi = (f, txt) => {
  const norm = txt.split('\n').join('\r\n');
  fs.writeFileSync(path.join(root, f), norm, 'utf8');
};

const parte1 = `import { useState, type FormEvent } from 'react';
import { Send, MapPin, GraduationCap, Sparkles } from 'lucide-react';
import { province } from '@/data/province';
import { useToast } from '@/components/Toast';

/** Province ordinate per nome per il select "Provincia". */
const provinceOrdinate = [...province].sort((a, b) => a.nome.localeCompare(b.nome));

/**
 * Assistente Sindacalista Virtuale — Accesso in Anteprima.
 * Pagina di richiesta di accesso per chi vuole provare il servizio:
 * niente robot, niente disclaimer, niente ricompense: solo il modulo di interesse.
 */
export function AssistenteAIPage() {
  const { mostraToast } = useToast();
  const [nomeCognome, setNomeCognome] = useState('');
  const [emailAccesso, setEmailAccesso] = useState('');
  const [provinciaRif, setProvinciaRif] = useState('');
  const [ruolo, setRuolo] = useState('');
  const [eta, setEta] = useState('');

  const handleRichiediAccesso = (e: FormEvent) => {
    e.preventDefault();
    if (!nomeCognome.trim() || !emailAccesso.trim() || !provinciaRif || !ruolo) return;
    try {
      localStorage.setItem(
        'scuoleradar:richiesta_assistente',
        JSON.stringify({
          nomeCognome: nomeCognome.trim(),
          email: emailAccesso.trim(),
          provincia: provinciaRif,
          ruolo,
          eta,
          data: new Date().toISOString(),
        }),
      );
    } catch {
      // localStorage non disponibile
    }
    setNomeCognome('');
    setEmailAccesso('');
    setProvinciaRif('');
    setRuolo('');
    setEta('');
    mostraToast(
      'successo',
      'Richiesta inviata: ti faremo sapere appena l\\u2019accesso in anteprima sarà disponibile.',
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary-600" />
          <h2 className="text-3xl font-bold text-primary-800">
            Accesso in Anteprima – Assistente Sindacalista Virtuale
          </h2>
        </div>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-primary-600">
          Un assistente che conosce il mondo della scuola: graduatorie, mobilità, supplenze,
          requisiti e normativa scolastica. Invece di perdere ore tra circolari e FAQ, fai una
          domanda e ricevi una risposta chiara, con i riferimenti giusti e i moduli che ti servono.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-500">
          Stiamo selezionando i primi docenti che vogliono provarlo in anteprima. Lascia i tuoi dati
          qui sotto: ti contatteremo appena l&apos;accesso sarà disponibile.
        </p>
      </div>

      <form
        onSubmit={handleRichiediAccesso}
        className="rounded-2xl border border-primary-100 bg-white p-6 shadow-card"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-primary-700">Nome e Cognome</span>
            <input
              type="text"
              required
              value={nomeCognome}
              onChange={(e) => setNomeCognome(e.target.value)}
              placeholder="Mario Rossi"
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-primary-700">Email</span>
            <input
              type="email"
              required
              value={emailAccesso}
              onChange={(e) => setEmailAccesso(e.target.value)}
              placeholder="mario@esempio.it"
              className="input"
            />
          </label>
`;
const parte2 = `          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary-700">
              <MapPin className="h-3.5 w-3.5" />
              Provincia
            </span>
            <select
              required
              value={provinciaRif}
              onChange={(e) => setProvinciaRif(e.target.value)}
              className="input"
            >
              <option value="">Seleziona la provincia…</option>
              {provinceOrdinate.map((p) => (
                <option key={p.codice} value={p.codice}>
                  {p.nome} ({p.codice})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary-700">
              <GraduationCap className="h-3.5 w-3.5" />
              Ruolo
            </span>
            <select required value={ruolo} onChange={(e) => setRuolo(e.target.value)} className="input">
              <option value="">Seleziona…</option>
              <option value="ruolo">Insegnante di ruolo</option>
              <option value="gps">Inserito in GPS</option>
              <option value="interpelli">Cerco interpelli e supplenze</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-primary-700">Età (anni)</span>
            <input
              type="number"
              min={18}
              max={99}
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder="Es. 34"
              className="input"
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 sm:w-auto"
        >
          <Send className="h-4 w-4" />
          Richiedi accesso in anteprima
        </button>
      </form>
    </div>
  );
}
`;
scrivi('src/pages/AssistenteAIPage.tsx', parte1 + parte2);
console.log('  ✓ AssistenteAIPage: riscritta come richiesta di Accesso in Anteprima');
