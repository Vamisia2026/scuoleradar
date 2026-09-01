import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BellRing, CheckCircle2, Radar, Database, SlidersHorizontal } from 'lucide-react';
import { Header } from '@/components/Header';
import { InterpelloCard } from '@/components/InterpelloCard';
import { useApp, LIMITE_NOTIFICHE_PROVA } from '@/contexts/AppContext';
import { interpelli } from '@/data/interpelli';
import { classeByCodice } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { Footer } from './LandingPage';

interface TabNav {
  to: string;
  label: string;
  end?: boolean;
  accent?: boolean;
}

export function DashboardLayout() {
  const tabs: TabNav[] = [
    { to: '/dashboard/radar', label: '📡 Radar Scuole', end: true },
    { to: '/dashboard/cv', label: '📄 Crea CV' },
    { to: '/dashboard/cfu', label: '🎓 Check CFU' },
    { to: '/dashboard/assistente-ai', label: '💬 Assistente Sindacalista Virtuale' },
    { to: '/dashboard/moduli', label: '📁 Moduli' },
    { to: '/dashboard/purefocus', label: '🧘 Pure Focus' },
    { to: '/dashboard/invita', label: '🎁 Invita un Collega', accent: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-primary-100 bg-white p-1.5 shadow-card">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-soft'
                    : t.accent
                      ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200 hover:bg-accent-100'
                      : 'text-primary-700 hover:bg-primary-50'
                }`
              }
            >
              {t.label}
              {t.accent && (
                <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Novembre
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <main className="mt-6 min-w-0">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}

export function DashboardPage() {
  const {
    user,
    interpelliFiltrati,
    preferenze,
    notificheUsate,
    abbonato,
    origineDati,
    openVetrina,
    openRadarWizard,
  } = useApp();

  const limiteRaggiunto = !abbonato && notificheUsate >= LIMITE_NOTIFICHE_PROVA;
  const notificheRimanenti = Math.max(LIMITE_NOTIFICHE_PROVA - notificheUsate, 0);

  // Vetrina Freemium: gli utenti non loggati vedono un campione dell'offerta
  // (max 3 interpelli) prima di essere invitati a registrarsi.
  const feedVetrina = !user && interpelliFiltrati.length === 0 ? interpelli : interpelliFiltrati;
  const interpelliVisibili = abbonato ? feedVetrina : feedVetrina.slice(0, 3);
  const limiteFeedRaggiunto = !abbonato && feedVetrina.length > 3;

  // Etichette per lo stato vuoto del Radar (dalle preferenze dell'utente).
  const classeEtichetta = preferenze.classiCodici
    .map((c) => classeByCodice(c)?.denominazione ?? c)
    .filter(Boolean)
    .join(', ');
  const provinciaEtichetta = preferenze.provinceCodici
    .map((c) => province.find((p) => p.codice === c)?.nome ?? c)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      {/* Radar Scuole — header bold del servizio attivo (massima chiarezza) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-primary-900">
            <Radar className="h-6 w-6 text-primary-500" />
            Radar Scuole
          </h1>
          <p className="mt-0.5 max-w-2xl text-sm font-medium text-primary-500">
            Interpelli, supplenze, PNRR e bandi: solo le opportunità che ti riguardano, in tempo reale.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-700 ring-1 ring-accent-200">
          <Database className="h-3.5 w-3.5" />
          Servizio attivo
        </span>
      </div>

      {/* Vetrina Freemium: copy di conversione per gli utenti non loggati */}
      {!user ? (
        <div className="rounded-2xl border border-secondary-200 bg-secondary-50 p-6 shadow-card">
          <h3 className="text-2xl font-bold text-primary-900">
            Smetti di perdere tempo. Cerchiamo noi per te.
          </h3>
          <p className="mt-2 text-lg leading-relaxed text-primary-700">
            Imposta qui i tuoi radar. Ti avvisiamo appena troviamo un&apos;opportunità per te, via
            email e Telegram. Se non ricevi nulla, è perché non c&apos;è nulla di interessante. Non
            ti preoccupare, fai altro.
          </p>
          <p className="mt-3 text-base leading-relaxed text-primary-700">
            Ti facciamo provare il servizio con 3 segnalazioni su misura per te. Se trovi lavoro
            grazie a noi e non vuoi pagare, siamo contenti per te. Dillo ai tuoi amici e siamo pari.
            Se vuoi che continuiamo a monitorare le opportunità per te, la scelta più conveniente è
            l&apos;abbonamento annuale da €49, che ti dà accesso a tutti i nostri servizi illimitati.
            Te lo ripaghi con meno di due ore di lavoro all&apos;anno.
          </p>
          <button
            onClick={() => openVetrina('radar')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Imposta le tue ricerche
          </button>
        </div>
      ) : (
        <div
          className={`rounded-2xl border p-5 shadow-card ${
            abbonato
              ? 'border-accent-200 bg-accent-50'
              : limiteRaggiunto
                ? 'border-secondary-200 bg-secondary-50'
                : 'border-primary-100 bg-white'
          }`}
        >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
                abbonato ? 'bg-accent-500 text-white' : 'bg-primary-500 text-white'
              }`}
            >
              {abbonato ? <CheckCircle2 className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-sm font-semibold text-primary-800">
                {abbonato
                  ? 'Sei abbonato: notifiche illimitate.'
                  : notificheRimanenti > 0
                    ? `Ti restano ${notificheRimanenti} di ${LIMITE_NOTIFICHE_PROVA} notifiche di prova`
                    : 'Notifiche di prova completate'}
              </p>
              <p className="text-xs text-primary-500">
                {abbonato
                  ? 'Riceverai tutte le notifiche pertinenti, senza limiti.'
                  : notificheRimanenti > 0
                    ? 'Le notifiche dell\'anno: 3 gratuite, si rinnovano a ogni anno solare.'
                    : 'Passa a PRO per continuare a ricevere notifiche.'}
              </p>
            </div>
          </div>
        </div>
        {(limiteRaggiunto || limiteFeedRaggiunto) && (
          <p className="mt-3 text-sm text-secondary-800">
            Hai usato le tue {LIMITE_NOTIFICHE_PROVA} notifiche per quest&apos;anno: i contenuti
            restano accessibili. Con il PRO ricevi notifiche illimitate, oppure riparti da 3 il
            prossimo anno.
          </p>
        )}
        </div>
      )}

      {/* Feed */}
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Radar className="h-5 w-5 text-primary-600" />
          <h2 className="text-2xl font-bold text-primary-800">Opportunità mappate</h2>
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600">
            {interpelliFiltrati.length}
          </span>
          {origineDati === 'supabase' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
              <Database className="h-3 w-3" />
              Dati reali da Supabase
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-500">
              Dati di esempio (fallback)
            </span>
          )}
        </div>

        {interpelliFiltrati.length === 0 ? (
          <div className="animate-fade-in rounded-2xl border border-primary-100 bg-white p-10 text-left shadow-card">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
              <Radar className="h-7 w-7 text-primary-400" />
            </span>
            {!preferenze.onboarded ? (
              <>
                <h3 className="mt-4 text-lg font-bold text-primary-800">Configura il tuo profilo</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-primary-500">
                  Scegli province, classi di concorso e materie per vedere solo le opportunità che ti
                  riguardano davvero.
                </p>
                <button
                  type="button"
                  onClick={openRadarWizard}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Completa il profilo
                </button>
              </>
            ) : (
              <>
                <h3 className="mt-4 text-lg font-bold text-primary-800">
                  Nessuna nuova opportunità oggi
                  {classeEtichetta ? ` per la classe ${classeEtichetta}` : ''}
                  {provinciaEtichetta ? ` in provincia di ${provinciaEtichetta}` : ''}.
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-primary-500">
                  Imposta il tuo Radar e rilassati: ti avvisiamo noi appena esce qualcosa di
                  interessante per te!
                </p>
                <button
                  type="button"
                  onClick={openRadarWizard}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Imposta il tuo Radar
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="animate-fade-in grid gap-4">
            {interpelliVisibili.map((i) => (
              <InterpelloCard key={i.id} interpello={i} />
            ))}
          </div>
        )}

        <p className="mt-6 max-w-2xl text-left text-sm text-primary-500">
          Interpelli, bandi per esperti, CPIA e progetti scolastici: mostriamo solo ciò che ti riguarda davvero.
        </p>
      </div>

    </div>
  );
}




