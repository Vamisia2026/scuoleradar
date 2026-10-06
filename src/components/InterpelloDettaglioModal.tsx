/**
 * Interpello · MODALE di dettaglio dell'opportunità.
 *
 * Estratto da `InterpelloCard` per rispettare il limite delle 300 righe per file del
 * gate strutturale: la card resta la vetrina compatta, il dettaglio vive qui.
 *
 * Mostra la stessa gerarchia della card e delle email — **scuola emittente** in
 * evidenza (`IstitutoEmittente`), righe obbligatorie (Provincia · Ordine ·
 * Classe/Materia · Scadenza), opzionali + recapito di candidatura, guida operativa
 * e UN SOLO **link diretto alla fonte ufficiale**, con etichetta onesta.
 */
import { AlertTriangle, ArrowRight, BadgeCheck, BellRing, Sparkles, Star } from 'lucide-react';
import type { Interpello } from '@/data/interpelli';
import { LIMITE_NOTIFICHE_PROVA, useApp } from '@/contexts/AppContext';
import {
  EMAIL_ETICHETTA_WEB,
  EMAIL_ICONA,
  etichettaFonteLink,
  formatDataAvvisoLunga,
  type AvvisoStrutturato,
} from '@/lib/alertInterpello';
import {
  bandaCompatibilita,
  descrizioneCompetenzaSecondaria,
  descrizioneJollySemantico,
  descrizioneScuolaPreferita,
  ETICHETTA_COMPETENZA_SECONDARIA,
  ETICHETTA_JOLLY_SEMANTICO,
  ETICHETTA_SCUOLA_PREFERITA,
} from '@/lib/compatibilita';
import { scuolaPreferita } from '@/lib/filtriScuole';
import { IstitutoEmittente } from './IstitutoEmittente';
import { Modal } from './Modal';

interface InterpelloDettaglioModalProps {
  interpello: Interpello;
  open: boolean;
  onClose: () => void;
  /** Avviso strutturato già derivato dalla card (una sola derivazione). */
  avviso: AvvisoStrutturato;
  /** Titolo ripulito mostrato nell'intestazione della modale. */
  titolo: string;
  /** Link ESTERNO alla fonte ufficiale, o `null` se la fonte non è indicata. */
  linkEsterno: string | null;
  /** Guida operativa (`suggerimentoRicercaAvviso`), o `null`. */
  guida: string | null;
  /** True quando la scadenza è imminente o già passata. */
  inScadenza: boolean;
}

export function InterpelloDettaglioModal({
  interpello,
  open,
  onClose,
  avviso,
  titolo,
  linkEsterno,
  guida,
  inScadenza,
}: InterpelloDettaglioModalProps) {
  const { abbonato, interpelliNotificati, notificheUsate, preferenze } = useApp();
  const giaNotificato = interpelliNotificati.includes(interpello.id);
  const notificheRimanenti = Math.max(LIMITE_NOTIFICHE_PROVA - notificheUsate, 0);
  // COMPATIBILITÀ: stessa banda cromatica della card (verde ≥ 80 · arancio ≥ 70 ·
  // rosso ≥ 60 «extra») e stesso motivo dichiarato: una sola regola, card e
  // dettaglio non possono divergere.
  const banda = bandaCompatibilita(interpello.compatibilita, interpello.motivoCompatibilita);
  // Modalità 5: la scuola preferita ha l'etichetta dedicata anche qui.
  const preferita =
    interpello.scuolaPreferita ?? scuolaPreferita(preferenze.favoriteSchools, interpello);
  // LIVELLO SECONDARIO (§26.63 · §26.64): la competenza che ha sfumato il punteggio, oppure
  // il match PIENO che invece il voto l'ha garantito (pavimento o ingresso d'ufficio).
  const competenzaSecondaria = interpello.competenzaSecondaria ?? null;
  const jollySemantico = interpello.jollySemantico ?? null;

  return (
    <Modal open={open} onClose={onClose} title={titolo} size="lg">
      <div className="space-y-4">
        {/* SCUOLA EMITTENTE anche nel dettaglio: mai un buco di contesto. */}
        <IstitutoEmittente istituto={interpello.istituto} />

        {/* Modalità 5: scuola preferita → etichetta dedicata (inclusione
            d'ufficio), con il match accanto quando il punteggio è sufficiente.
            Livello secondario (§26.63): accanto, la competenza che ha sfumato il voto. */}
        <div className="flex flex-wrap items-center gap-2">
          {preferita ? (
            <span
              title={descrizioneScuolaPreferita(banda.punteggio)}
              className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-3 py-1 text-sm font-semibold text-white shadow-soft"
            >
              <Star className="h-4 w-4" />
              {ETICHETTA_SCUOLA_PREFERITA}
              {banda.visibile && (
                <span className="ml-1 rounded-full bg-white/25 px-1.5 font-bold">
                  {banda.punteggio}%
                </span>
              )}
            </span>
          ) : (
            banda.visibile && (
              <span
                title={banda.descrizione}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${banda.className}`}
              >
                <BadgeCheck className="h-4 w-4" />
                {banda.etichetta}
              </span>
            )
          )}
          {/* Livello secondario (§26.63 · §26.64): col match PIENO parla il jolly. */}
          {jollySemantico ? (
            <span
              title={descrizioneJollySemantico(jollySemantico, banda.punteggio)}
              className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1 text-sm font-semibold text-white shadow-soft"
            >
              <Sparkles className="h-4 w-4" />
              {ETICHETTA_JOLLY_SEMANTICO}: {jollySemantico}
            </span>
          ) : (
            competenzaSecondaria && (
              <span
                title={descrizioneCompetenzaSecondaria(competenzaSecondaria, banda.punteggio)}
                className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-700 ring-1 ring-inset ring-accent-200"
              >
                <Sparkles className="h-4 w-4" />
                {ETICHETTA_COMPETENZA_SECONDARIA}: {competenzaSecondaria}
              </span>
            )
          )}
        </div>

        {/* OBBLIGATORIE — sempre presenti: Provincia · Ordine · Classe/Materia · Scadenza. */}
        <dl className="grid gap-3 sm:grid-cols-2">
          {avviso.obbligatorie.map((r) => (
            <div key={r.etichetta} className="rounded-xl bg-slate-50 p-4">
              <dt className="text-sm font-semibold text-primary-700">{r.etichetta}</dt>
              <dd className="text-sm text-primary-800">
                {r.etichetta === 'Scadenza'
                  ? formatDataAvvisoLunga(interpello.dataScadenza)
                  : r.valore}
                {r.etichetta === 'Scadenza' && inScadenza && (
                  <span className="ml-2 inline-flex items-center gap-1 font-semibold text-error-600">
                    <AlertTriangle className="h-4 w-4" /> In scadenza
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/* Scadenza assente: gestita con garbo (niente blocchi grezzi "Non indicata"). */}
        {!avviso.scadenzaValida && (
          <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-600">
            La scadenza non è indicata nella fonte: la trovi nell&apos;avviso originale.
          </p>
        )}

        {/* OPZIONALI + EMAIL — mostrate SOLO se presenti (nessun placeholder). */}
        <dl className="grid gap-3 sm:grid-cols-2">
          {avviso.opzionali.map((r) => (
            <div key={r.etichetta} className="rounded-xl bg-slate-50 p-4">
              <dt className="text-sm font-semibold text-primary-700">{r.etichetta}</dt>
              <dd className="text-sm text-primary-800">{r.valore}</dd>
            </div>
          ))}
          {/* Email candidature: blocco presente SOLO se l'indirizzo è stato estratto
              (mai uno stato negativo tipo "Non indicata"); stessa etichetta di email. */}
          {avviso.email && (
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-sm font-semibold text-primary-700">
                {EMAIL_ICONA} {EMAIL_ETICHETTA_WEB}
              </dt>
              <dd className="text-sm text-primary-800">
                <a
                  href={`mailto:${avviso.email}`}
                  className="break-all text-primary-600 underline transition hover:text-primary-800"
                >
                  {avviso.email}
                </a>
              </dd>
            </div>
          )}
        </dl>

        {interpello.descrizione && interpello.descrizione.trim() !== interpello.titolo.trim() && (
          <div>
            <p className="mb-1 text-sm font-semibold text-primary-700">Dettagli dall&apos;avviso</p>
            <p className="text-sm leading-relaxed text-primary-800">{interpello.descrizione}</p>
          </div>
        )}

        {/* GUIDA OPERATIVA: come trovare la riga e candidarsi quando la fonte è un
            elenco/"Stampa" o non è disponibile. */}
        {guida && (
          <p className="rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            ℹ️ {guida}
          </p>
        )}

        {/* UN SOLO link verso la FONTE ESTERNA (se disponibile): pulsante in evidenza. */}
        {linkEsterno ? (
          <a
            href={linkEsterno}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            {etichettaFonteLink(linkEsterno)}
            <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <span className="text-sm text-primary-500">
            La fonte ufficiale non è indicata: usa i recapiti qui sopra.
          </span>
        )}

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
  );
}
