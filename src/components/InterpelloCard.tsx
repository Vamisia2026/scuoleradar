import { useState } from 'react';
import { Clock, MapPin, GraduationCap, ArrowRight, AlertTriangle, BadgeCheck, BellRing, Star } from 'lucide-react';
import type { Interpello } from '@/data/interpelli';
import { Modal } from './Modal';
import { useApp, LIMITE_NOTIFICHE_PROVA } from '@/contexts/AppContext';
import { classeByCodice } from '@/data/classiConcorso';

function giorniRimanenti(iso: string): number {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const scad = new Date(iso + 'T00:00:00');
  return Math.round((scad.getTime() - oggi.getTime()) / 86400000);
}

export function InterpelloCard({ interpello }: { interpello: Interpello }) {
  const [open, setOpen] = useState(false);
  const { incrementaNotifica, notificheUsate, abbonato, interpelliNotificati, preferenze } = useApp();
  const giorni = giorniRimanenti(interpello.dataScadenza);
  const inScadenza = giorni >= 0 && giorni <= 3;
  const classe = classeByCodice(interpello.classeCodice);
  const giaNotificato = interpelliNotificati.includes(interpello.id);
  const notificheRimanenti = Math.max(LIMITE_NOTIFICHE_PROVA - notificheUsate, 0);
  const isPreferita = preferenze.favoriteSchools.some((s) =>
    s && `${interpello.istituto} ${interpello.titolo}`.toLowerCase().includes(s.toLowerCase()),
  );

  const handleVediDettaglio = () => {
    setOpen(true);
    if (!giaNotificato) incrementaNotifica(interpello.id);
  };

  return (
    <>
      <article className="group rounded-2xl border border-primary-100 bg-white p-5 shadow-card transition hover:shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-base font-bold text-primary-800">{interpello.titolo}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-600">
              <GraduationCap className="h-4 w-4" />
              {interpello.istituto}
            </p>
          </div>
          {isPreferita && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-2.5 py-1 text-xs font-semibold text-white shadow-soft">
              <Star className="h-3.5 w-3.5" />
              Scuola Preferita
            </span>
          )}
          {interpello.compatibilita === 100 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700">
              <BadgeCheck className="h-3.5 w-3.5" />
              100% Compatibile
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 font-medium text-primary-700">
            <MapPin className="h-3.5 w-3.5" />
            {interpello.provinciaNome}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            {interpello.classeCodice}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
              inScadenza
                ? 'bg-error-50 text-error-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Scadenza: {new Date(interpello.dataScadenza).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: 'short',
            })}
            {inScadenza && (
              <span className="ml-1 inline-flex items-center gap-0.5 font-bold">
                <AlertTriangle className="h-3 w-3" />
                In scadenza
              </span>
            )}
          </span>
        </div>

        {classe && (
          <p className="mt-3 text-xs text-primary-500">{classe.denominazione}</p>
        )}

        <button
          onClick={handleVediDettaglio}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
        >
          Vedi dettaglio
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
      </article>

      <Modal open={open} onClose={() => setOpen(false)} title={interpello.titolo} size="lg">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
              <MapPin className="h-4 w-4" />
              {interpello.provinciaNome}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              {interpello.classeCodice}
            </span>
            {interpello.compatibilita === 100 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-700">
                <BadgeCheck className="h-4 w-4" />
                100% Compatibile
              </span>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-primary-700">Istituto</p>
            <p className="text-sm text-primary-800">{interpello.istituto}</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-primary-700">Scadenza</p>
            <p className="text-sm text-primary-800">
              {new Date(interpello.dataScadenza).toLocaleDateString('it-IT', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
              {inScadenza && (
                <span className="ml-2 inline-flex items-center gap-1 font-semibold text-error-600">
                  <AlertTriangle className="h-4 w-4" />
                  In scadenza
                </span>
              )}
            </p>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-primary-700">Descrizione</p>
            <p className="text-sm leading-relaxed text-primary-800">{interpello.descrizione}</p>
          </div>

          <a
            href={interpello.linkFonte}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
          >
            Apri fonte originale
            <ArrowRight className="h-4 w-4" />
          </a>

          {giaNotificato && (
            <div className="flex items-center gap-2 rounded-xl bg-accent-50 px-4 py-3 text-sm text-accent-700">
              <BellRing className="h-4 w-4" />
              Notifica inviata per questo interpello.
            </div>
          )}

          {!abbonato && !giaNotificato && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                notificheRimanenti > 0
                  ? 'border-primary-100 bg-primary-50 text-primary-700'
                  : 'border-secondary-200 bg-secondary-50 text-secondary-800'
              }`}
            >
              {notificheRimanenti > 0 ? (
                <>
                  Ti restano <strong>{notificheRimanenti}</strong> di {LIMITE_NOTIFICHE_PROVA}{' '}
                  notifiche per quest&apos;anno. Passa a PRO per notifiche illimitate.
                </>
              ) : (
                <>
                  Hai usato le tue {LIMITE_NOTIFICHE_PROVA} notifiche per quest&apos;anno. Attiva il
                  piano PRO per continuare a ricevere nuove notifiche senza limiti.
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
