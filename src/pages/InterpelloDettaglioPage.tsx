import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Clock, GraduationCap, MapPin } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from './LandingPage';
import { supabase } from '@/lib/supabase';
import { mapInterpelloDBToInterpello, type InterpelloDB } from '@/lib/matchingEngine';
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
import { chiaveInterpelloDaParam } from '@/lib/interpelloRouting';
import { etichettaClasseMateria } from '@/data/classiConcorso';
import { giorniRimanenti, stileScadenza } from '@/lib/scadenza';

/** Colonne necessarie per ricostruire l'avviso strutturato. */
const COLONNE_INTERPELLI =
  'id,hash_id,title,province,class_codes,school_name,school_code,source_url,expiration_date,created_at,contact_email,materia';

/** Converte una riga legacy della tabella `notices` (solo colonne disponibili). */
function daNotices(r: {
  id: string;
  title: string | null;
  source_url: string | null;
  province: string | null;
  class_codes: string[] | null;
  expiration_date: string | null;
}): Interpello {
  return {
    id: r.id,
    titolo: r.title ?? 'Avviso ufficiale',
    istituto: '',
    provinciaCodice: (r.province ?? '').toUpperCase(),
    provinciaNome: (r.province ?? '').toUpperCase(),
    classeCodice: (r.class_codes ?? [])[0] ?? '',
    classiCodes: (r.class_codes ?? []).filter(Boolean),
    ordine: 'secondaria2',
    dataScadenza: r.expiration_date ?? '',
    descrizione: r.title ?? '',
    linkFonte: r.source_url ?? '',
    contactEmail: null,
    compatibilita: 100,
  };
}

/**
 * Reindirizza IMMEDIATAMENTE alla fonte ufficiale ESTERNA dell'avviso, quando
 * esiste un URL http(s) valido e NON interno alla piattaforma. È il comportamento
 * richiesto dai deep link delle notifiche: nessuna scheda interna intermedia,
 * nessun "Avviso non più disponibile" quando la pagina istituzionale è nota, e
 * nessun rimbalzo su ScuoleRadar (la scheda interna non è mai una "fonte").
 * Ritorna `true` se il redirect è stato avviato.
 */
function reindirizzaAllaFonte(interpello: Interpello): boolean {
  const link = urlEsterna(interpello.linkFonte);
  if (!link) return false;
  try {
    window.location.replace(link);
  } catch {
    return false;
  }
  return true;
}

/**
 * Scheda pubblica di un avviso (`/interpello/:id`).
 *
 * È l'atterraggio dei DEEP LINK delle notifiche quando l'avviso non ha una fonte
 * esterna: prima del fix questa rotta non esisteva e il catch-all reindirizzava
 * l'utente sulla HOME (perdendo il contesto dell'avviso). La pagina:
 *  · risolve l'avviso per `id` (uuid) o `hash_id` (chiave usata dalle notifiche);
 *  · mostra la STESSA gerarchia strutturata di card ed email;
 *  · espone UN SOLO bottone verso la fonte ufficiale, con etichetta onesta
 *    (mai "Candidati" se punta a un Albo Pretorio o a una pagina di avviso);
 *  · se l'avviso non esiste più lo DICE con garbo, senza rimbalzare sulla Home.
 */
export function InterpelloDettaglioPage() {
  const { id } = useParams<{ id: string }>();
  const [stato, setStato] = useState<'caricamento' | 'trovato' | 'assente' | 'reindirizzamento'>(
    'caricamento',
  );
  const [interpello, setInterpello] = useState<Interpello | null>(null);

  useEffect(() => {
    let annullato = false;
    const chiave = chiaveInterpelloDaParam(id);
    const client = supabase;
    if (!chiave || !client) {
      setStato('assente');
      return;
    }
    const carica = async (): Promise<void> => {
      const { data } = await client
        .from('interpelli')
        .select(COLONNE_INTERPELLI)
        .eq(chiave.colonna, chiave.valore)
        .maybeSingle();
      if (annullato) return;
      if (data) {
        const trovato = mapInterpelloDBToInterpello(data as InterpelloDB);
        // LINK DIRETTO: chi arriva dal deep link di una notifica deve atterrare
        // IMMEDIATAMENTE sulla pagina istituzionale originale, mai su una scheda
        // interna con "Avviso non più disponibile".
        if (reindirizzaAllaFonte(trovato)) {
          setInterpello(trovato);
          setStato('reindirizzamento');
          return;
        }
        setInterpello(trovato);
        setStato('trovato');
        return;
      }
      // Fallback legacy: tabella `notices` (stessa chiave di ricerca).
      const { data: legacy } = await client
        .from('notices')
        .select('id,title,source_url,province,class_codes,expiration_date')
        .eq(chiave.colonna, chiave.valore)
        .maybeSingle();
      if (annullato) return;
      if (legacy) {
        const trovato = daNotices(legacy);
        if (reindirizzaAllaFonte(trovato)) {
          setInterpello(trovato);
          setStato('reindirizzamento');
          return;
        }
        setInterpello(trovato);
        setStato('trovato');
        return;
      }
      setStato('assente');
    };
    void carica();
    return () => {
      annullato = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
      <Header />
      <main>
        <section aria-label="Dettaglio avviso" className="bg-gradient-to-b from-primary-50 to-white">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
            {stato === 'caricamento' && (
              <p className="text-sm text-primary-600">Caricamento dell&apos;avviso…</p>
            )}
            {stato === 'reindirizzamento' && interpello && (
              <ReindirizzamentoAllaFonte interpello={interpello} />
            )}
            {stato === 'assente' && <AvvisoAssente />}
            {stato === 'trovato' && interpello && <SchedaAvviso interpello={interpello} />}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/** Stato "reindirizzamento": fallback del redirect verso la fonte ufficiale. */
function ReindirizzamentoAllaFonte({ interpello }: { interpello: Interpello }) {
  return (
    <div className="rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
      <h1 className="text-xl font-bold text-primary-800">Apertura della pagina ufficiale…</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-primary-600">
        Ti stiamo portando direttamente sull&apos;avviso ufficiale della scuola o dell&apos;ente.
      </p>
      <a
        href={interpello.linkFonte}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
      >
        {etichettaFonteLink(interpello.linkFonte)}
        <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );
}

/** Stato "avviso non disponibile": mai un rimbalzo silenzioso sulla Home. */
function AvvisoAssente() {
  return (
    <div className="rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
      <h1 className="text-xl font-bold text-primary-800">Avviso non più disponibile</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-primary-600">
        Questo avviso non è presente nell&apos;archivio (potrebbe essere stato rimosso dalla fonte
        ufficiale o essere scaduto). Nessun problema: il tuo Radar continua a controllare per te le
        opportunità nella tua provincia e per le tue classi di concorso.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/dashboard/radar"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          Vai al Radar Scuole
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alla home
        </Link>
      </div>
    </div>
  );
}


/** Scheda strutturata dell'avviso: stessa gerarchia di card ed email. */
function SchedaAvviso({ interpello }: { interpello: Interpello }) {
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
        <Link
          to="/dashboard/radar"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna al Radar Scuole
        </Link>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-primary-500">
        <BadgeCheck className="h-4 w-4" />
        Dati provenienti dalle fonti ufficiali (Albo Pretorio / siti istituzionali).
      </p>
    </article>
  );
}

