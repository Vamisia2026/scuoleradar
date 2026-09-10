import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  FileText,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { setPostLoginRedirect } from '@/lib/showroomRedirect';
import { track } from '@/lib/analytics';
import { CfuSeoMeta, type DomandaFaq } from './SeoMeta';
import { DESCRIZIONE_BREVE_CFU, DISCLAIMER_INDICATIVO } from '../shared/normativa';
import { PRIVACY_PROMESSA_CFU } from '../shared/privacy';
import { CfuTutorIntro } from '../shared/CfuTutorIntro';

const FAQ_CALCOLATORE_CFU: DomandaFaq[] = [
  {
    domanda: 'Come funziona il calcolatore CFU per le classi di concorso?',
    risposta:
      "Inserisci gli esami del tuo percorso universitario (denominazione, CFU/ECTS e settore scientifico-disciplinare) oppure carica libretto o statino. Il calcolatore confronta i tuoi crediti con i requisiti delle classi di concorso e ti mostra i CFU coperti e quelli mancanti.",
  },
  {
    domanda: 'Cosa sono i CFU e gli ECTS?',
    risposta:
      'I CFU (crediti formativi universitari) corrispondono agli ECTS europei: un anno di studio a tempo pieno vale 60 crediti. I requisiti di accesso alle classi di concorso si misurano in CFU maturati in specifici settori scientifico-disciplinari.',
  },
  {
    domanda: 'Cosa significano le Tabelle A e B del D.P.R. 19/2016?',
    risposta:
      'Il regolamento D.P.R. 19/2016 individua nelle Tabelle allegate le classi di concorso e i relativi titoli di accesso. Il calcolatore usa queste tabelle per verificare in modo indicativo quali classi il tuo percorso ti rende ammissibile.',
  },
  {
    domanda: 'La verifica del calcolatore sostituisce quella ufficiale?',
    risposta:
      'No: il risultato è indicativo e non certifica nulla. La valutazione definitiva spetta all\u2019istituzione scolastica o all\u2019USR: ogni valutazione include la nota metodologica e ogni Dossier l\u2019avvertenza di verifica.',
  },
  {
    domanda: 'I miei documenti vengono salvati?',
    risposta: PRIVACY_PROMESSA_CFU,
  },
];

const PASSO_CALCOLATORE = [
  {
    emoji: '1',
    titolo: 'Dici perché sei qui',
    testo:
      'Scelta rapida tra classe obiettivo, calcolo della laurea, preparazione concorso o chiarezza generale: il calcolo parte dal tuo bisogno.',
  },
  {
    emoji: '2',
    titolo: 'Carichi libretto o elenco esami',
    testo:
      'JPG, PNG o PDF con lettura in tempo reale ed eliminazione immediata, oppure inserimento manuale di materia, CFU e SSD (es. M-PED/01, L-LIN/12).',
  },
  {
    emoji: '3',
    titolo: 'Ricevi orientamento e Dossier',
    testo:
      'Punti di forza, classi accessibili e CFU mancanti per i tuoi obiettivi. Generi il Dossier Requisiti ScuoleRadar da consegnare in segreteria.',
  },
];

const ANALIZZATI_DAL_CALCOLATORE = [
  'Esami, voti e crediti di ogni anno accademico',
  'Conversione CFU ↔ ECTS (60 crediti = 1 anno a tempo pieno)',
  'Riconoscimento dei settori scientifico-disciplinari (SSD)',
  'Verifica indicativa su Tabelle A/B del D.P.R. 19/2016',
  'Classi di concorso accessibili con i tuoi CFU',
  'CFU mancanti, ambito per ambito, per le classi obiettivo',
];

/** Landing pubblica del Dipartimento CFU (SEO + funnel di registrazione). */
export function CalcolatoreCfuLanding() {
  const navigate = useNavigate();
  const { user, openAuthModal } = useApp();

  const avviaCalcolatore = () => {
    if (user) {
      navigate('/dashboard/calcolatore-cfu');
      return;
    }
    track('cfu_landing_cta_click', { utente: 'guest' });
    setPostLoginRedirect('/dashboard/calcolatore-cfu');
    openAuthModal('registrazione');
  };

  return (
    <div className="bg-white">
      <CfuSeoMeta
        titolo="Calcolatore CFU per classi di concorso — verifica i tuoi requisiti"
        descrizione="Inserisci esami, CFU/ECTS e SSD: scopri subito quali classi di concorso puoi insegnare e quanti CFU ti mancano. Calcolo indicativo su Tabelle A/B del D.P.R. 19/2016."
        urlCanonica="/calcolatore-cfu"
        faq={FAQ_CALCOLATORE_CFU}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 via-white to-white">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-12 sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary-700">
            <GraduationCap className="h-3.5 w-3.5" />
            Dipartimento CFU · Strumento per docenti e aspiranti docenti
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight text-primary-900 sm:text-5xl">
            Calcolatore CFU: scopri quali classi di concorso puoi insegnare
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-primary-700 sm:text-xl">
            {DESCRIZIONE_BREVE_CFU}
          </p>

          {/* Presentazione "tutor universitario": cosa serve e come funziona l'upload */}
          <div className="mt-8 max-w-4xl">
            <CfuTutorIntro />
          </div>

          {/* CTA principale funnel */}
          <div className="mt-8 flex flex-col items-start gap-5 rounded-3xl border border-secondary-100 bg-gradient-to-r from-secondary-500 to-secondary-700 p-6 text-white shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="text-xl font-extrabold leading-snug sm:text-2xl">
                Registrati in 5 secondi e attiva 1 Mese PRO Gratis per accedere al Calcolatore CFU
              </p>
              <p className="mt-2 text-base leading-relaxed text-secondary-100">
                Nessuna carta richiesta: calcolo in tempo reale della tua carriera, orientamento
                sulle classi di concorso e Dossier pronto per la segreteria.
              </p>
            </div>
            <button
              type="button"
              onClick={avviaCalcolatore}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-secondary-700 shadow-soft transition hover:bg-secondary-50"
            >
              {user ? 'Apri il Calcolatore CFU' : (
                <>
                  <UserPlus className="h-5 w-5" />
                  Inizia gratis — 1 mese di PRO
                </>
              )}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm font-semibold text-primary-600 sm:text-base">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-accent-500" /> Inserimento manuale rapido
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-accent-500" /> Documenti eliminati dopo la lettura
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-accent-500" /> Dossier Requisiti ScuoleRadar
            </li>
          </ul>
        </div>
      </section>

      {/* Come funziona */}
      <section className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary-600" />
            <h2 className="text-2xl font-extrabold text-primary-900 sm:text-3xl">
              Il percorso in 3 passi
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {PASSO_CALCOLATORE.map((passo) => (
              <div
                key={passo.titolo}
                className="rounded-2xl border border-primary-100 bg-primary-50/40 p-5"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-800 text-base font-black text-white shadow-soft">
                  {passo.emoji}
                </span>
                <h3 className="mt-3 text-xl font-bold text-primary-900">{passo.titolo}</h3>
                <p className="mt-2 text-base leading-relaxed text-primary-600">{passo.testo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cosa calcola il calcolatore */}
      <section className="bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-secondary-500" />
                <h2 className="text-2xl font-extrabold text-primary-900 sm:text-3xl">
                  Cosa legge e valuta il calcolatore
                </h2>
              </div>
              <ul className="mt-6 space-y-2.5">
                {ANALIZZATI_DAL_CALCOLATORE.map((voce) => (
                  <li key={voce} className="flex items-start gap-3 text-base leading-relaxed text-primary-700">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-accent-500" />
                    {voce}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-relaxed text-primary-500">
                {DISCLAIMER_INDICATIVO}
              </p>
            </div>
            <div className="rounded-3xl border border-primary-100 bg-white p-6 shadow-card">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary-400">
                Esempio · lettura di un libretto
              </p>
              <dl className="mt-4 space-y-3 text-base">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="font-medium text-primary-700">Didattica generale</dt>
                  <dd className="font-mono text-sm font-bold text-primary-800">6 CFU · M-PED/03</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="font-medium text-primary-700">Lingua inglese</dt>
                  <dd className="font-mono text-sm font-bold text-primary-800">12 CFU · L-LIN/12</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="font-medium text-primary-700">Analisi matematica I</dt>
                  <dd className="font-mono text-sm font-bold text-primary-800">9 CFU · MAT/05</dd>
                </div>
              </dl>
              <div className="mt-4 rounded-xl bg-primary-50 px-4 py-3 text-sm leading-relaxed text-primary-600 sm:text-base">
                Ogni esame viene tradotto in <strong>CFU per ambito</strong> e confrontato con i
                requisiti delle classi: ecco come nascono l&apos;orientamento e il calcolo dei CFU
                mancanti.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ (SEO) */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-extrabold text-primary-900 sm:text-3xl">
            Domande frequenti sul Calcolatore CFU
          </h2>
          <div className="mt-8 space-y-3">
            {FAQ_CALCOLATORE_CFU.map((voce) => (
              <details
                key={voce.domanda}
                className="group rounded-2xl border border-primary-100 bg-white p-4 shadow-soft"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-bold leading-relaxed text-primary-800">
                  {voce.domanda}
                  <span className="shrink-0 text-primary-400 transition group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-3 text-base leading-relaxed text-primary-600">{voce.risposta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA finale */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-secondary-900">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <GraduationCap className="mx-auto h-10 w-10 text-accent-300" />
          <h2 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
            Il tuo futuro in cattedra parte da 24 CFU ben messi
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-primary-100">
            Verifica oggi la tua carriera: classi accessibili, ambiti da integrare e il Dossier
            pronto per la segreteria.
          </p>
          <button
            type="button"
            onClick={avviaCalcolatore}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-accent-500 px-8 py-4 text-base font-bold text-white shadow-soft transition hover:bg-accent-600"
          >
            <UserPlus className="h-5 w-5" />
            Registrati in 5 secondi e attiva 1 Mese PRO Gratis
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
