import { useState } from 'react';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import type { Esame } from '../shared/types';
import { CfuErrorBoundary } from '../shared/CfuErrorBoundary';
import { classiCoperteAttive } from './classi';
import { valutaClasseV1, type RisultatoValutazioneV1 } from './valutazioneV1';
import type { CommercialeCfu } from './commerciale';
import { creaTestoDossierV1 } from '../dossier/dossierV1';
import { StepClasse } from './components/StepClasse';
import { StepTitolo } from './components/StepTitolo';
import { StepEsami } from './components/StepEsami';
import { StepAnalisi } from './components/StepAnalisi';
import { StepRisultato } from './components/StepRisultato';
import { StepDossier } from './components/StepDossier';
import { StepWelcome } from './components/StepWelcome';

type Fase = 'benvenuto' | 'classe' | 'titolo' | 'esami' | 'analisi' | 'risultato' | 'dossier';

const ORDINE_FASI: Exclude<Fase, 'benvenuto'>[] = [
  'classe',
  'titolo',
  'esami',
  'analisi',
  'risultato',
  'dossier',
];

const ETICHETTE_FASI: Record<Fase, string> = {
  benvenuto: '0 · Benvenuto',
  classe: '1 · Classe',
  titolo: '2 · Titolo',
  esami: '3 · Esami',
  analisi: 'Calcolo',
  risultato: '4 · Risultato',
  dossier: '5 · Dossier',
};

function IndicatoreFasi({ attiva, indice }: { attiva: Fase; indice: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Avanzamento">
      {ORDINE_FASI.map((fase, posizione) => {
        const completata = posizione < indice;
        const corrente = fase === attiva;
        return (
          <li
            key={fase}
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition ${
              corrente
                ? 'bg-white text-primary-800 shadow-soft'
                : completata
                  ? 'bg-accent-500/90 text-white'
                  : 'bg-white/10 text-primary-100 ring-1 ring-white/15'
            }`}
          >
            {completata ? '✓ ' : ''}
            {ETICHETTE_FASI[fase]}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Calcolatore CFU — console del Dipartimento CFU (V1).
 *
 * Percorso: Benvenuto → Classe obiettivo → Titolo di studio → Esami →
 * Calcolo → Risultato → Dossier. Il verdetto mostrato è quello del motore
 * (`valutaClasseV1` → adapter `esitoUtente`): nessun dato viene inventato e
 * nessun documento viene caricato o conservato.
 *
 * `commerciale` è OPZIONALE e arriva dalla pagina (contesto applicativo): se
 * assente, il risultato non mostra alcuna CTA. Il calcolo non è mai bloccato.
 */
export function CalcolatoreCfuApp({ commerciale }: { commerciale?: CommercialeCfu } = {}) {
  const [fase, setFase] = useState<Fase>('benvenuto');
  const [classeCodice, setClasseCodice] = useState<string | null>(null);
  const [classeLaurea, setClasseLaurea] = useState('');
  const [dataProcedura, setDataProcedura] = useState('');
  const [esami, setEsami] = useState<Esame[]>([]);
  const [valutazione, setValutazione] = useState<RisultatoValutazioneV1 | null>(null);
  const [testoDossier, setTestoDossier] = useState<string | null>(null);

  const classeObiettivo =
    classiCoperteAttive().find((classe) => classe.codice === classeCodice) ?? null;
  const indiceCorrente = fase === 'benvenuto' ? -1 : ORDINE_FASI.indexOf(fase);
  const cfuInseriti = Math.round(esami.reduce((somma, esame) => somma + esame.cfu, 0) * 10) / 10;

  const aggiungiEsame = (esame: Esame) => setEsami((precedenti) => [...precedenti, esame]);
  const rimuoviEsame = (id: string) =>
    setEsami((precedenti) => precedenti.filter((esame) => esame.id !== id));
  const impostaEsami = (nuovi: Esame[]) => setEsami(nuovi);

  /** Calcolo vero e proprio: il verdetto arriva dal motore, non dalla UI. */
  const eseguiCalcolo = () => {
    if (!classeObiettivo) {
      setFase('classe');
      return;
    }
    setValutazione(
      valutaClasseV1({
        classe: classeObiettivo,
        esami,
        classeLaurea: classeLaurea.trim() ? classeLaurea.trim().toUpperCase() : null,
        dataProcedura: dataProcedura || null,
      }),
    );
    setFase('risultato');
  };

  const apriDossier = () => {
    if (!valutazione) return;
    setTestoDossier(
      creaTestoDossierV1(valutazione.utente, {
        classeLaurea: classeLaurea.trim().toUpperCase(),
        dataProcedura,
        esamiInseriti: esami.length,
        cfuInseriti,
      }),
    );
    setFase('dossier');
  };

  const ricomincia = () => {
    setClasseCodice(null);
    setClasseLaurea('');
    setDataProcedura('');
    setEsami([]);
    setValutazione(null);
    setTestoDossier(null);
    setFase('benvenuto');
  };

  return (
    <CfuErrorBoundary>
      <div className="overflow-hidden rounded-3xl border border-primary-100 bg-white shadow-card">
        {/* Testata Dipartimento CFU */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-accent-300 ring-1 ring-white/15">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent-300">
                  Dipartimento CFU
                </p>
                <h2 className="text-xl font-extrabold text-white sm:text-2xl">Calcolatore CFU</h2>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-200 ring-1 ring-white/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Requisiti verificati sulle fonti
            </span>
          </div>
          {fase !== 'benvenuto' && (
            <div className="mt-4">
              <IndicatoreFasi attiva={fase} indice={indiceCorrente} />
            </div>
          )}
        </div>

        {/* Corpo del percorso */}
        <div className="px-4 py-4 sm:px-6">
          {fase === 'benvenuto' && <StepWelcome onInizia={() => setFase('classe')} />}

          {fase === 'classe' && (
            <StepClasse
              selezionata={classeCodice}
              onSeleziona={setClasseCodice}
              onContinua={() => setFase('titolo')}
            />
          )}

          {fase === 'titolo' && (
            <StepTitolo
              classeLaurea={classeLaurea}
              dataProcedura={dataProcedura}
              onCambiaClasseLaurea={setClasseLaurea}
              onCambiaDataProcedura={setDataProcedura}
              onIndietro={() => setFase('classe')}
              onContinua={() => setFase('esami')}
            />
          )}

          {fase === 'esami' && (
            <StepEsami
              esami={esami}
              classeCodice={classeObiettivo?.codice ?? ''}
              onAggiungiEsame={aggiungiEsame}
              onRimuoviEsame={rimuoviEsame}
              onImpostaEsami={impostaEsami}
              onIndietro={() => setFase('titolo')}
              onContinua={() => setFase('analisi')}
            />
          )}

          {fase === 'analisi' && classeObiettivo && (
            <StepAnalisi
              classeCodice={classeObiettivo.codice}
              classeDenominazione={classeObiettivo.denominazione}
              esamiInseriti={esami.length}
              cfuInseriti={cfuInseriti}
              classeLaurea={classeLaurea}
              dataProcedura={dataProcedura}
              onCompletata={eseguiCalcolo}
            />
          )}

          {fase === 'risultato' && valutazione && (
            <StepRisultato
              esito={valutazione.utente}
              commerciale={commerciale}
              onModificaEsami={() => setFase('esami')}
              onVaiDossier={apriDossier}
              onRicomincia={ricomincia}
            />
          )}

          {fase === 'risultato' && !valutazione && (
            <div className="py-6 text-center text-base text-primary-500">
              Il risultato non è disponibile: torna agli esami e ripeti il calcolo.
            </div>
          )}

          {fase === 'dossier' && valutazione && testoDossier && (
            <StepDossier
              esito={valutazione.utente}
              testo={testoDossier}
              nomeFile={`Requisiti-${valutazione.utente.classeCodice}`}
              onTornaRisultato={() => setFase('risultato')}
              onRicomincia={ricomincia}
            />
          )}
        </div>
      </div>
    </CfuErrorBoundary>
  );
}
