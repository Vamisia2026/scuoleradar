import { useState, type FormEvent } from 'react';
import { GraduationCap, Info } from 'lucide-react';
import type { Esame } from '../../shared/types';
import { parseEsamiDaTesto, righeVersoEsami } from '../../shared/ocrUtils';
import { ArchivioEsami } from './documenti/ArchivioEsami';
import { AzioniContinua } from './documenti/AzioniContinua';
import { PannelloManuale, type CampoManuale } from './documenti/PannelloManuale';
import { PannelloTesto } from './documenti/PannelloTesto';
import { TabInserimento, type ModalitaInserimento } from './documenti/TabInserimento';

interface StepEsamiProps {
  esami: Esame[];
  /** Sigla della classe obiettivo, solo per il contesto mostrato all'utente. */
  classeCodice: string;
  onAggiungiEsame: (esame: Esame) => void;
  onRimuoviEsame: (id: string) => void;
  onImpostaEsami: (esami: Esame[]) => void;
  onIndietro: () => void;
  onContinua: () => void;
}

let contatoreLocale = 0;
function nuovoId(prefix: string): string {
  contatoreLocale += 1;
  return `${prefix}-${contatoreLocale}-${Date.now()}`;
}

/**
 * Fase 3 — Esami sostenuti.
 *
 * Nessun documento: si inseriscono a mano o si incolla l'elenco. Il settore SSD
 * è una scelta esplicita («conosco il settore» oppure «non lo so»): un esame
 * senza settore resta non dichiarato e il calcolo lo segnala.
 */
export function StepEsami({
  esami,
  classeCodice,
  onAggiungiEsame,
  onRimuoviEsame,
  onImpostaEsami,
  onIndietro,
  onContinua,
}: StepEsamiProps) {
  const [modalita, setModalita] = useState<ModalitaInserimento>('manuale');
  const [materia, setMateria] = useState('');
  const [cfu, setCfu] = useState('');
  const [ssd, setSsd] = useState('');
  const [ssdNonNoto, setSsdNonNoto] = useState(false);
  const [testo, setTesto] = useState('');
  const [nota, setNota] = useState<string | null>(null);

  const aggiungiManuale = (e: FormEvent) => {
    e.preventDefault();
    const valoreCfu = Number.parseFloat(cfu.replace(',', '.'));
    if (!materia.trim()) {
      setNota('Scrivi la denominazione dell\u2019esame.');
      return;
    }
    if (!Number.isFinite(valoreCfu) || valoreCfu <= 0) {
      setNota('Indica i CFU dell\u2019esame (es. 6 oppure 9,5).');
      return;
    }
    const settore = ssd.trim().toUpperCase();
    if (!ssdNonNoto && !settore) {
      setNota('Dichiara il settore SSD dell\u2019esame oppure scegli «Non lo so».');
      return;
    }
    onAggiungiEsame({
      id: nuovoId('esame'),
      denominazione: materia.trim(),
      cfu: Math.round(valoreCfu * 10) / 10,
      ssd: ssdNonNoto ? null : settore,
      fonte: 'manuale',
      affidabilita: ssdNonNoto ? 'media' : 'alta',
    });
    setMateria('');
    setCfu('');
    setSsd('');
    setSsdNonNoto(false);
    setNota(null);
  };

  const riconosciTesto = () => {
    const riconosciuti = righeVersoEsami(parseEsamiDaTesto(testo));
    if (riconosciuti.length === 0) {
      setNota('Nessun esame riconosciuto. Formato per riga: Materia — 6 CFU — L-FIL-LET/04.');
      return;
    }
    onImpostaEsami([...esami, ...riconosciuti]);
    const senzaSettore = riconosciuti.filter((esame) => !esame.ssd).length;
    setNota(
      `${riconosciuti.length} esami aggiunti.` +
        (senzaSettore > 0
          ? ` ${senzaSettore} senza settore SSD: verranno segnalati nel calcolo.`
          : ''),
    );
    setTesto('');
  };

  const senzaSettore = esami.filter((esame) => !esame.ssd).length;
  const totaleCfu = esami.reduce((somma, esame) => somma + esame.cfu, 0);

  return (
    <div className="animate-fade-in space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-widest text-primary-400">Esami · 03</p>
        <h3 className="text-2xl font-extrabold leading-snug text-primary-900 sm:text-3xl">
          Gli esami della tua carriera
        </h3>
        <p className="max-w-3xl text-base leading-relaxed text-primary-600 sm:text-lg">
          Inserisci gli esami sostenuti con i CFU e il settore SSD: sono i dati con cui verifichiamo
          i requisiti della classe{' '}
          <strong className="font-mono text-primary-800">{classeCodice}</strong>. Li trovi sul
          certificato di laurea, sul piano di studi o sul libretto.
        </p>
      </div>

      <TabInserimento
        modalita={modalita}
        onCambia={(nuova) => {
          setModalita(nuova);
          setNota(null);
        }}
      />

      {modalita === 'manuale' && (
        <PannelloManuale
          campi={{ materia, cfu, ssd, ssdNonNoto }}
          onCambia={(campo: CampoManuale, valore) => {
            if (campo === 'materia') setMateria(valore);
            else if (campo === 'cfu') setCfu(valore);
            else setSsd(valore);
          }}
          onSsdNonNoto={setSsdNonNoto}
          onAggiungi={aggiungiManuale}
        />
      )}
      {modalita === 'testo' && (
        <PannelloTesto
          testo={testo}
          onCambiaTesto={(valore) => {
            setTesto(valore);
            setNota(null);
          }}
          onRiconosci={riconosciTesto}
        />
      )}

      {nota && (
        <p className="rounded-xl bg-primary-50 px-4 py-2.5 text-sm font-medium leading-relaxed text-primary-700">
          {nota}
        </p>
      )}

      {esami.length > 0 && senzaSettore > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-warning-50 px-4 py-3 text-sm leading-relaxed text-warning-800 ring-1 ring-warning-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {senzaSettore === 1
            ? 'Un esame non ha un settore SSD dichiarato: se serve una soglia precisa, il calcolo chiederà una verifica invece di stimare.'
            : `${senzaSettore} esami non hanno un settore SSD dichiarato: se servono soglie precise, il calcolo chiederà una verifica invece di stimare.`}
        </p>
      )}

      {esami.length === 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-primary-500">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" />
          Nessun esame inserito: puoi aggiungerli uno per uno oppure incollare l&apos;elenco del
          libretto.
        </p>
      )}

      {esami.length > 0 && (
        <ArchivioEsami esami={esami} totaleCfu={totaleCfu} onRimuoviEsame={onRimuoviEsame} />
      )}

      <button
        type="button"
        onClick={onIndietro}
        className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
      >
        ← Titolo e classe
      </button>

      <AzioniContinua
        pronto={esami.length > 0}
        senzaSettore={senzaSettore}
        onContinua={onContinua}
      />
    </div>
  );
}
