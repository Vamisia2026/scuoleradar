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
      "Scegli la classe di concorso da verificare, indica la classe di laurea del tuo titolo e inserisci gli esami (denominazione, CFU/ECTS e settore SSD) a mano oppure incollando l'elenco. Il calcolatore confronta i tuoi crediti con i requisiti scritti nella norma e ti mostra, requisito per requisito, cosa risulta soddisfatto, cosa manca e cosa va verificato.",
  },
  {
    domanda: 'Cosa sono i CFU e gli ECTS?',
    risposta:
      'I CFU (crediti formativi universitari) corrispondono agli ECTS europei: un anno di studio a tempo pieno vale 60 crediti. I requisiti di accesso alle classi di concorso si misurano in CFU maturati in specifici settori scientifico-disciplinari.',
  },
  {
    domanda: 'Su quali norme si basa il calcolo e quali classi coprite?',
    risposta:
      'Il calcolo usa le fonti normative dichiarate accanto al risultato (per le classi disponibili oggi: DM 22/12/2023, G.U. n. 34 del 10/02/2024, Tabella A). Mostriamo solo le classi di concorso per cui abbiamo una copertura normativa verificata: le altre non vengono proposte per non darti risposte non controllate.',
  },
  {
    domanda: 'La verifica del calcolatore sostituisce quella ufficiale?',
    risposta:
      "No: il risultato è indicativo e non certifica nulla. La valutazione definitiva spetta all'istituzione scolastica o all'USR: ogni esito riporta le fonti applicate e i punti che richiedono verifica.",
  },
  {
    domanda: 'I miei dati vengono salvati?',
    risposta: PRIVACY_PROMESSA_CFU,
  },
];

const PASSO_CALCOLATORE = [
  {
    emoji: '1',
    titolo: 'Scegli la classe obiettivo',
    testo:
      'Parti dalla classe di concorso che ti interessa: sai subito quali classi sono coperte oggi da una verifica normativa reale.',
  },
  {
    emoji: '2',
    titolo: 'Dichiara titolo ed esami',
    testo:
      'Classe di laurea del titolo, data della procedura e elenco esami con CFU e settore SSD: se non conosci un settore puoi dirlo, non lo inventiamo.',
  },
  {
    emoji: '3',
    titolo: 'Leggi il verdetto e cosa manca',
    testo:
      'Requisiti soddisfatti, carenze, punti da verificare e fonti normative applicate. Se la norma non consente un giudizio automatico, te lo diciamo: nessun CFU stimato a occhio.',
  },
];

const ANALIZZATI_DAL_CALCOLATORE = [
  'Esami dichiarati con crediti e settore SSD',
  'Classe di laurea del titolo come requisito di accesso',
  'Requisiti di CFU scritti nella fonte normativa della classe',
  'Vincoli di gruppo e clausole alternative (OR) nella loro forma reale',
  'Esito per requisito: soddisfatto, non soddisfatto o da verificare',
  'Carenze pubblicate dal motore solo quando sono calcolabili',
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
        descrizione="Scegli la classe di concorso, indica classe di laurea ed esami con CFU e settore SSD: vedi requisito per requisito cosa risulta soddisfatto, cosa manca e cosa verificare, con le fonti normative applicate."
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

          {/* Presentazione "tutor universitario": cosa serve e come funziona la verifica */}
          <div className="mt-8 max-w-4xl">
            <CfuTutorIntro />
          </div>

          {/* CTA principale funnel */}
          <div className="mt-8 flex flex-col items-start gap-5 rounded-3xl border border-secondary-100 bg-gradient-to-r from-secondary-500 to-secondary-700 p-6 text-white shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="text-xl font-extrabold leading-snug sm:text-2xl">
                Registrati in 5 secondi: il Calcolatore CFU è gratuito e basta un account
              </p>
              <p className="mt-2 text-base leading-relaxed text-secondary-100">
                Nessuna carta richiesta: verifica dei requisiti sulla classe che ti interessa,
                esito requisito per requisito e Dossier in .txt da portare in segreteria.
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
                  Registrati e inizia gratis
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
              <ShieldCheck className="h-4 w-4 text-accent-500" /> Nessun documento da caricare
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
                  Cosa verifica il calcolatore
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
                Esempio · esami inseriti a mano
              </p>
              <dl className="mt-4 space-y-3 text-base">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="font-medium text-primary-700">Lingua e letteratura latina</dt>
                  <dd className="font-mono text-sm font-bold text-primary-800">24 CFU · L-FIL-LET/04</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="font-medium text-primary-700">Letteratura italiana</dt>
                  <dd className="font-mono text-sm font-bold text-primary-800">12 CFU · L-FIL-LET/10</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="font-medium text-primary-700">Storia greca</dt>
                  <dd className="font-mono text-sm font-bold text-primary-800">12 CFU · L-ANT/02</dd>
                </div>
              </dl>
              <div className="mt-4 rounded-xl bg-primary-50 px-4 py-3 text-sm leading-relaxed text-primary-600 sm:text-base">
                Ogni esame viene confrontato con i <strong>requisiti scritti nella norma</strong> per
                la classe scelta: da lì nascono il verdetto, le carenze e i punti che richiedono
                verifica.
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
