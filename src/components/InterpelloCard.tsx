import { useState } from 'react';
import { Clock, MapPin, GraduationCap, ArrowRight, AlertTriangle, BadgeCheck, BellRing, Star } from 'lucide-react';
import type { Interpello } from '@/data/interpelli';
import { Modal } from './Modal';
import { useApp, LIMITE_NOTIFICHE_PROVA } from '@/contexts/AppContext';
import { etichettaClasseMateria } from '@/data/classiConcorso';
import {
  EMAIL_ETICHETTA_WEB,
  EMAIL_ICONA,
  costruisciAvviso,
  etichettaFonteLink,
  formatDataAvviso,
  formatDataAvvisoLunga,
  pulisciTitoloAvviso,
  scegliClasseRilevante,
  suggerimentoRicercaAvviso,
  urlEsterna,
} from '@/lib/alertInterpello';
import { giorniRimanenti, stileScadenza } from '@/lib/scadenza';

export function InterpelloCard({ interpello }: { interpello: Interpello }) {
  const [open, setOpen] = useState(false);
  const { incrementaNotifica, notificheUsate, abbonato, interpelliNotificati, preferenze } = useApp();
  const giorni = giorniRimanenti(interpello.dataScadenza);
  const stile = stileScadenza(giorni);
  const inScadenza = stile.livello === 'imminente' || stile.livello === 'scaduto';
  // Etichetta leggibile: CODICE + nome ufficiale della materia/classe.
  // Si sceglie la classe COERENTE con il titolo (evita "Primaria" + titolo della
  // secondaria: Ordine di scuola e Classe/Materia restano allineati).
  const classePerAvviso =
    scegliClasseRilevante(interpello.classiCodes, interpello.titolo) || interpello.classeCodice;
  const etichettaClasse = etichettaClasseMateria(classePerAvviso, interpello.materia);
  // Avviso STRUTTURATO: obbligatorie (Provincia, Ordine, Classe, Scadenza) +
  // opzionali (Scuola, Pubblicato) mostrate solo se presenti.
  const avviso = costruisciAvviso({
    provincia: interpello.provinciaNome || interpello.provinciaCodice,
    ordine: interpello.ordine,
    classCode: classePerAvviso,
    classCodes: interpello.classiCodes,
    materia: interpello.materia,
    scadenza: interpello.dataScadenza,
    schoolName: interpello.istituto,
    // Email di candidatura: nell'avviso strutturato (asset PRO), così è resa
    // ogni volta che la pipeline la estrae — anche su link di riepilogo/"Stampa".
    email: interpello.contactEmail,
    titolo: interpello.titolo,
  });
  const provinciaTxt = interpello.provinciaNome || interpello.provinciaCodice;
  const ordineTxt = avviso.obbligatorie.find((r) => r.etichetta === 'Ordine di scuola')?.valore ?? '';
  const scadenzaOk = avviso.scadenzaValida;
  // Titolo pulito dai "dump" di codici classe delle tabelle sorgente.
  const titoloPulito = pulisciTitoloAvviso(
    interpello.titolo,
    `Interpello ${etichettaClasse || interpello.provinciaNome || interpello.provinciaCodice}`,
  );
  const giaNotificato = interpelliNotificati.includes(interpello.id);
  const notificheRimanenti = Math.max(LIMITE_NOTIFICHE_PROVA - notificheUsate, 0);
  const isPreferita = preferenze.favoriteSchools.some((s) =>
    s && `${interpello.istituto} ${interpello.titolo}`.toLowerCase().includes(s.toLowerCase()),
  );
  // ROUTING: la scheda espone SOLO la fonte ESTERNA originale (mai un link
  // interno della piattaforma spacciato per "fonte").
  const linkEsterno = urlEsterna(interpello.linkFonte);
  // GUIDA OPERATIVA: pagina tabellare/"Stampa" o fonte ufficiale mancante.
  const guida = suggerimentoRicercaAvviso({
    url: linkEsterno,
    classe: classePerAvviso,
    provincia: interpello.provinciaNome || interpello.provinciaCodice,
    schoolName: interpello.istituto,
    email: avviso.email,
  });

  const handleVediDettaglio = () => {
    setOpen(true);
    if (!giaNotificato) incrementaNotifica(interpello.id);
  };

  return (
    <>
      <article className="group rounded-2xl border border-primary-100 bg-white p-5 shadow-card transition hover:shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-base font-bold text-primary-800">{titoloPulito}</h3>
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

        {/* Gerarchia obbligatoria: Provincia · Ordine · Classe/Materia · Scadenza. */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 font-medium text-primary-700">
            <MapPin className="h-3.5 w-3.5" />
            {provinciaTxt}
          </span>
          {ordineTxt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 font-medium text-primary-700">
              <GraduationCap className="h-3.5 w-3.5" />
              {ordineTxt}
            </span>
          )}
          {etichettaClasse && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
              {etichettaClasse}
            </span>
          )}
          {scadenzaOk ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${stile.className}`}
            >
              <Clock className="h-3.5 w-3.5" />
              Scadenza: {formatDataAvviso(interpello.dataScadenza)}
              <span className="ml-1 inline-flex items-center gap-0.5 font-bold">{stile.label}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Scadenza non indicata
            </span>
          )}
        </div>

        <button
          onClick={handleVediDettaglio}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
        >
          Vedi dettaglio
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
      </article>

      <Modal open={open} onClose={() => setOpen(false)} title={titoloPulito} size="lg">
        <div className="space-y-4">
          {interpello.compatibilita === 100 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-700">
              <BadgeCheck className="h-4 w-4" />
              100% Compatibile
            </span>
          )}

          {/* OBBLIGATORIE — sempre presenti: Provincia · Ordine · Classe/Materia · Scadenza. */}
          <dl className="grid gap-3 sm:grid-cols-2">
            {avviso.obbligatorie.map((r) => (
              <div key={r.etichetta} className="rounded-xl bg-slate-50 p-4">
                <dt className="text-sm font-semibold text-primary-700">{r.etichetta}</dt>
                <dd className="text-sm text-primary-800">
                  {r.etichetta === 'Scadenza' ? formatDataAvvisoLunga(interpello.dataScadenza) : r.valore}
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
          {!scadenzaOk && (
            <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-600">
              La scadenza non è indicata nella fonte: la trovi nell’avviso originale.
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
            {/* Email candidature: blocco presente SOLO se l'indirizzo è stato
                estratto (mai uno stato negativo tipo "Non indicata"). Etichetta
                e icona sono le stesse di email e Telegram. */}
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
              <p className="mb-1 text-sm font-semibold text-primary-700">Dettagli dall’avviso</p>
              <p className="text-sm leading-relaxed text-primary-800">{interpello.descrizione}</p>
            </div>
          )}

          {/* GUIDA OPERATIVA: come trovare la riga e candidarsi quando la fonte è
              un elenco/"Stampa" o non è disponibile. */}
          {guida && (
            <p className="rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
              ℹ️ {guida}
            </p>
          )}

          {/* UN SOLO link verso la FONTE ESTERNA (se disponibile). */}
          {linkEsterno ? (
            <a
              href={linkEsterno}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
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
    </>
  );
}
