/**
 * «I Miei Documenti» — spazio di STORAGE PERSONALE dell'utente (piattaforma).
 *
 * Componente CONDIVISO da due superfici:
 *   - profilo → sezione «Documenti», tab «I Miei Documenti»;
 *   - Modulistica → terza tab «I Miei Documenti».
 *
 * Caricamento dei file personali (PDF, JPG, PNG, Word, TXT) con **trascinamento o
 * selezione** (area dedicata `AreaCaricamentoDocumenti`), apertura ed eliminazione.
 * I file restano nel **browser** dell'utente (`localStorage`): nessun upload sui
 * nostri server — scelta di privacy dichiarata nel disclaimer.
 *
 * DISCLAIMER: spazio a uso esclusivo dell'utente, che ne è l'unico responsabile.
 */
import { useEffect, useState } from 'react';
import { AlertCircle, Download, ShieldAlert, Trash2 } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { AreaCaricamentoDocumenti } from './AreaCaricamentoDocumenti';
import {
  LIMITE_BYTE_DOCUMENTO,
  LIMITE_BYTE_TOTALE,
  LIMITE_DOCUMENTI,
  aggiungiMioDocumento,
  byteTotali,
  formattaDimensione,
  leggiMieiDocumenti,
  rimuoviMioDocumento,
  salvaMieiDocumenti,
  validaNuovoDocumento,
  type MioDocumento,
} from '@/lib/mieiDocumenti';

export function MieiDocumenti() {
  const { mostraToast } = useToast();
  const [documenti, setDocumenti] = useState<MioDocumento[]>([]);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState('');

  // Lettura dell'archivio al montaggio (localStorage: dati già dell'utente).
  useEffect(() => {
    setDocumenti(leggiMieiDocumenti());
  }, []);

  const byteUsati = byteTotali(documenti);
  const alLimite = documenti.length >= LIMITE_DOCUMENTI;

  /** Legge un file come data URL (Promise: nessun callback annidato). */
  const leggiFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const lettore = new FileReader();
      lettore.onerror = () => reject(new Error('lettura non riuscita'));
      lettore.onload = () => {
        const risultato = lettore.result;
        if (typeof risultato === 'string' && risultato) resolve(risultato);
        else reject(new Error('contenuto vuoto'));
      };
      lettore.readAsDataURL(file);
    });

  /**
   * Carica uno o più file (selezione o trascinamento) rispettando i limiti.
   * Esito SEMPRE esplicito: se il browser è pieno o un file non è ammesso
   * l'utente lo legge, mai un salvataggio silenziosamente perso.
   */
  const caricaFiles = async (files: File[]) => {
    if (files.length === 0 || caricamento) return;
    setCaricamento(true);
    setErrore('');
    let elenco = documenti;
    let aggiunti = 0;
    let primoErrore = '';
    for (const file of files) {
      const validazione = validaNuovoDocumento(elenco, file);
      if (!validazione.ok) {
        primoErrore = primoErrore || validazione.errore;
        continue;
      }
      try {
        const dataUrl = await leggiFile(file);
        elenco = aggiungiMioDocumento(elenco, {
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          nome: file.name,
          tipo: file.type,
          dimensione: file.size,
          caricatoIl: new Date().toISOString(),
          dataUrl,
        });
        aggiunti += 1;
      } catch {
        primoErrore = primoErrore || `Non riusciamo a leggere «${file.name}».`;
      }
    }
    setCaricamento(false);
    if (aggiunti > 0) {
      const esito = salvaMieiDocumenti(elenco);
      if (esito.ok) {
        setDocumenti(elenco);
        mostraToast(
          'successo',
          aggiunti === 1 ? 'Documento salvato.' : `${aggiunti} documenti salvati.`,
        );
      } else {
        setErrore(esito.errore);
      }
    }
    if (primoErrore) setErrore(primoErrore);
  };

  const elimina = (id: string) => {
    const elenco = rimuoviMioDocumento(documenti, id);
    const esito = salvaMieiDocumenti(elenco);
    if (!esito.ok) {
      setErrore(esito.errore);
      return;
    }
    setDocumenti(elenco);
    setErrore('');
    mostraToast('successo', 'Documento rimosso.');
  };

  return (
    <div>
      {/* DISCLAIMER: spazio dell'utente, sua la responsabilità. */}
      <div className="flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2.5 text-xs leading-relaxed text-warning-800">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Spazio di storage a uso esclusivo dell&apos;utente.</strong> I file che carichi sono
          sotto la <strong>tua totale responsabilità</strong>: usa questo spazio solo per documenti tuoi
          o di cui hai il diritto di disporre; non caricare dati sensibili di terzi (sanitari,
          giudiziari, di minori) né materiale protetto da copyright. ScuoleRadar non verifica i
          contenuti, non li usa per altre finalità e non risponde di un uso improprio. I file restano
          salvati nel tuo browser: se svuoti i dati del sito andranno persi.
        </p>
      </div>

      {/* Area di rilascio: trascinamento o selezione dal computer. */}
      <div className="mt-3">
        <AreaCaricamentoDocumenti
          caricamento={caricamento}
          alLimite={alLimite}
          riepilogo={`PDF, JPG, PNG, Word · max ${formattaDimensione(LIMITE_BYTE_DOCUMENTO)} per file · ${documenti.length}/${LIMITE_DOCUMENTI} documenti · ${formattaDimensione(byteUsati)} di ${formattaDimensione(LIMITE_BYTE_TOTALE)}`}
          onFiles={(files) => void caricaFiles(files)}
        />
      </div>

      {errore && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {errore}
        </p>
      )}

      {documenti.length === 0 ? (
        <p className="mt-3 text-sm text-primary-400">
          Non hai ancora caricato documenti. Qui puoi tenere a portata di mano i tuoi file utili per la
          scuola: titoli, certificazioni, autocertificazioni, moduli compilati.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {documenti.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary-800">{d.nome}</p>
                <p className="text-xs text-primary-400">
                  {formattaDimensione(d.dimensione)} · caricato il{' '}
                  {new Date(d.caricatoIl).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={d.dataUrl}
                  download={d.nome}
                  aria-label={`Scarica ${d.nome}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Apri
                </a>
                <button
                  type="button"
                  onClick={() => elimina(d.id)}
                  aria-label={`Elimina ${d.nome}`}
                  className="rounded-lg p-2 text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
