/**
 * Interpello · scheda strutturata dell'avviso (`/interpello/:id`).
 *
 * Stessa gerarchia di card ed email: titolo ripulito, istituto, pill di
 * provincia/classe/scadenza, righe obbligatorie e opzionali, email di
 * candidatura, guida operativa e UN SOLO bottone verso la fonte ESTERNA con
 * etichetta onesta (mai «Candidati» se punta a un Albo Pretorio).
 *
 * Tutte le derivazioni (`costruisciAvviso`, stile scadenza, link esterno,
 * guida) vivono qui: l'unico input è l'avviso risolto dalla pagina.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Clock, GraduationCap, MapPin } from 'lucide-react';
import { etichettaClasseMateria } from '@/data/classiConcorso';
import type { Interpello } from '@/data/interpelli';
import {
  EMAIL_ETICHETTA_WEB,
  EMAIL_ICONA,
  ICONA_RIGA,
  costruisciAvviso,
  etichettaFonteLink,
  formatDataAvviso,
  formatDataAvvisoLunga,
  pulisciTitoloAvviso,
  suggerimentoRicercaAvviso,
  urlEsterna,
} from '@/lib/alertInterpello';
import { giorniRimanenti, stileScadenza } from '@/lib/scadenza';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

interface SchedaAvvisoProps {
  /** Avviso già risolto dalla pagina (per `id` o `hash_id`). */
  interpello: Interpello;
}

export function SchedaAvviso({ interpello }: SchedaAvvisoProps) {
  // Feature flags: il ritorno al Radar compare solo se il dipartimento è attivo.
  const { visibile } = useFeatureFlags();
  const etichettaClasse = etichettaClasseMateria(interpello.classeCodice, interpello.materia);
  const avviso = costruisciAvviso({
    provincia: interpello.provinciaNome || interpello.provinciaCodice,
    ordine: interpello.ordine,
    classCode: interpello.classeCodice,
    classCodes: interpello.classiCodes,
    materia: interpello.materia,
    scadenza: interpello.dataScadenza,
    schoolName: interpello.istituto,
    // Email di candidatura: dentro l'avviso strutturato, così è resa OGNI volta
    // che la pipeline la estrae (anche per link di riepilogo/"Stampa").
    email: interpello.contactEmail,
  });
  const titolo = pulisciTitoloAvviso(
    interpello.titolo,
    `Interpello ${etichettaClasse || interpello.provinciaNome || interpello.provinciaCodice}`,
  );
  const stile = stileScadenza(giorniRimanenti(interpello.dataScadenza));
  // ROUTING: si espone SOLO la fonte ESTERNA originale (mai un link interno).
  const linkFonte = urlEsterna(interpello.linkFonte);
  const linkValido = Boolean(linkFonte);
  // GUIDA OPERATIVA: pagina tabellare/"Stampa" o fonte ufficiale mancante.
  const guida = suggerimentoRicercaAvviso({
    url: linkFonte,
    classe: interpello.classeCodice,
    provincia: interpello.provinciaNome || interpello.provinciaCodice,
    schoolName: interpello.istituto,
    email: avviso.email,
  });

  return (
    <article className="rounded-2xl border border-primary-100 bg-white p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-bold text-primary-800 sm:text-2xl">{titolo}</h1>
      {interpello.istituto && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-primary-600">
          <GraduationCap className="h-4 w-4" />
          {interpello.istituto}
        </p>
      )}

      {/* Gerarchia STRETTA: obbligatorie sempre, opzionali solo se presenti. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 font-medium text-primary-700">
          <MapPin className="h-3.5 w-3.5" />
          {interpello.provinciaNome || interpello.provinciaCodice}
        </span>
        {etichettaClasse && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            {etichettaClasse}
          </span>
        )}
        {avviso.scadenzaValida ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${stile.className}`}>
            <Clock className="h-3.5 w-3.5" />
            Scadenza: {formatDataAvviso(interpello.dataScadenza)}
            <span className="ml-1 font-bold">{stile.label}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            Scadenza non indicata
          </span>
        )}
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {avviso.obbligatorie.map((r) => (
          <div key={r.etichetta} className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm font-semibold text-primary-700">
              {ICONA_RIGA[r.etichetta] ?? ''} {r.etichetta}
            </dt>
            <dd className="text-sm text-primary-800">
              {r.etichetta === 'Scadenza' ? formatDataAvvisoLunga(interpello.dataScadenza) : r.valore}
            </dd>
          </div>
        ))}
        {avviso.opzionali.map((r) => (
          <div key={r.etichetta} className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm font-semibold text-primary-700">
              {ICONA_RIGA[r.etichetta] ?? ''} {r.etichetta}
            </dt>
            <dd className="text-sm text-primary-800">{r.valore}</dd>
          </div>
        ))}
        {avviso.email && (
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm font-semibold text-primary-700">
              {EMAIL_ICONA} {EMAIL_ETICHETTA_WEB}
            </dt>
            <dd className="text-sm text-primary-800">
              <a href={`mailto:${avviso.email}`} className="break-all text-primary-600 underline">
                {avviso.email}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {!avviso.scadenzaValida && (
        <p className="mt-4 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-600">
          La scadenza non è indicata nella fonte: la trovi nell&apos;avviso originale.
        </p>
      )}

      {/* GUIDA OPERATIVA: come trovare la riga e candidarsi quando la fonte è un
          elenco/"Stampa" o non è disponibile. */}
      {guida && (
        <p className="mt-4 rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          ℹ️ {guida}
        </p>
      )}

      {/* UN SOLO bottone verso la fonte ESTERNA, con etichetta ONESTA. */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {linkValido ? (
          <a
            href={linkFonte ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            {etichettaFonteLink(linkFonte)}
            <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <span className="text-sm text-primary-500">
            La fonte ufficiale non è indicata per questo avviso.
          </span>
        )}
        {visibile('radar') && (
          <Link
            to="/dashboard/radar"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna al Radar Scuole
          </Link>
        )}
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-primary-500">
        <BadgeCheck className="h-4 w-4" />
        Dati provenienti dalle fonti ufficiali (Albo Pretorio / siti istituzionali).
      </p>
    </article>
  );
}
