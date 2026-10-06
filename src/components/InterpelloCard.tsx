/**
 * Interpello · CARD dell'opportunità (vetrina della dashboard).
 *
 * La card mostra SUBITO ciò che serve per decidere: titolo, **scuola emittente**
 * (`IstitutoEmittente`), pill di provincia/ordine/classe/scadenza e — accanto a
 * «Vedi dettaglio» — il **link DIRETTO alla fonte ufficiale** (`etichettaFonteLink`,
 * etichetta onesta: PDF / Albo Pretorio / riepilogo «Stampa» / avviso).
 *
 * Il dettaglio vive in `InterpelloDettaglioModal` (estratto per rispettare il limite
 * di 300 righe per file del gate strutturale): stessa scuola in evidenza e stesso
 * link, una sola derivazione dei dati.
 */
import { useState } from 'react';
import { ArrowRight, BadgeCheck, Clock, GraduationCap, MapPin, Sparkles, Star } from 'lucide-react';
import type { Interpello } from '@/data/interpelli';
import { useApp } from '@/contexts/AppContext';
import { etichettaClasseMateria } from '@/data/classiConcorso';
import {
  costruisciAvviso,
  etichettaFonteLink,
  formatDataAvviso,
  pulisciTitoloAvviso,
  scegliClasseRilevante,
  suggerimentoRicercaAvviso,
  urlEsterna,
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
import { giorniRimanenti, stileScadenza } from '@/lib/scadenza';
import { InterpelloDettaglioModal } from './InterpelloDettaglioModal';
import { IstitutoEmittente } from './IstitutoEmittente';

export function InterpelloCard({ interpello }: { interpello: Interpello }) {
  const [open, setOpen] = useState(false);
  const { incrementaNotifica, interpelliNotificati, preferenze } = useApp();
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
  // SCUOLA PREFERITA (Modalità 5 — whitelist): l'inclusione è d'ufficio anche
  // quando il punteggio è insufficiente. Il flag arriva dalla bacheca
  // (`scuolaPreferita`); il confronto testuale è lo stesso helper puro, così card
  // e feed non possono divergere.
  const preferita = interpello.scuolaPreferita ?? scuolaPreferita(preferenze.favoriteSchools, interpello);
  // COMPATIBILITÀ: banda cromatica UNICA (`src/lib/compatibilita.ts`) — verde ≥ 80,
  // arancio ≥ 70, rosso ≥ 60 (suggerimento extra). Sotto soglia: nessun badge.
  // Il MOTIVO dello scostamento (lingua affine, area affine, provincia limitrofa)
  // arriva dal feed e finisce nel tooltip: si dichiara, non si nasconde.
  const banda = bandaCompatibilita(interpello.compatibilita, interpello.motivoCompatibilita);
  // LIVELLO SECONDARIO (§26.63): quando una competenza del profilo è stata trovata nel
  // testo (`competenzaSecondaria`, calcolata dalla bacheca) la card lo dichiara: il
  // punteggio è sfumato di qualche punto e nasconderlo lo farebbe sembrare casuale.
  const competenzaSecondaria = interpello.competenzaSecondaria ?? null;
  // JOLLY SEMANTICO (§26.64): la competenza riconosciuta PER INTERO, che ha garantito il
  // pavimento d'eccellenza o l'ingresso d'ufficio fuori dalle proprie province. Quando c'è,
  // parla lei: sotto non si duplica la sfumatura della §26.63.
  const jollySemantico = interpello.jollySemantico ?? null;
  // ROUTING: la card espone SOLO la fonte ESTERNA originale (mai un link interno
  // della piattaforma spacciato per "fonte").
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
            {/* SCUOLA EMITTENTE: sempre visibile (nome reale, oppure la dicitura
                gestita quando il bando non la pubblica) — mai una riga vuota. */}
            <IstitutoEmittente istituto={interpello.istituto} className="mt-1" />
          </div>
          {/* Modalità 5: punteggio basso MA scuola preferita → etichetta dedicata
              (mai un voto insufficiente); punteggio buono → l'etichetta resta
              accanto al match, per dire DA DOVE arriva l'opportunità.
              Livello secondario (§26.63): sotto, la competenza che ha SFUMATO il voto. */}
          <div className="flex flex-col items-end gap-2">
            {preferita ? (
              <span
                title={descrizioneScuolaPreferita(banda.punteggio)}
                className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-2.5 py-1 text-xs font-semibold text-white shadow-soft"
              >
                <Star className="h-3.5 w-3.5" />
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
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${banda.className}`}
                >
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {banda.etichetta}
                </span>
              )
            )}
            {/* Livello secondario: una sola storia per card e dettaglio — col match PIENO
                (§26.64) parla il jolly; altrimenti la sfumatura delle competenze (§26.63). */}
            {jollySemantico ? (
              <span
                title={descrizioneJollySemantico(jollySemantico, banda.punteggio)}
                className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white shadow-soft"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {ETICHETTA_JOLLY_SEMANTICO}: {jollySemantico}
              </span>
            ) : (
              competenzaSecondaria && (
                <span
                  title={descrizioneCompetenzaSecondaria(competenzaSecondaria, banda.punteggio)}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 ring-1 ring-inset ring-accent-200"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {ETICHETTA_COMPETENZA_SECONDARIA}: {competenzaSecondaria}
                </span>
              )
            )}
          </div>
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

        {/* AZIONI: link DIRETTO alla fonte ufficiale + dettaglio. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {linkEsterno ? (
            <a
              href={linkEsterno}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              {etichettaFonteLink(linkEsterno)}
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <span className="text-sm text-primary-500">
              Fonte ufficiale non indicata: usa i recapiti dell&apos;avviso.
            </span>
          )}
          <button
            onClick={handleVediDettaglio}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
          >
            Vedi dettaglio
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </article>

      <InterpelloDettaglioModal
        interpello={interpello}
        open={open}
        onClose={() => setOpen(false)}
        avviso={avviso}
        titolo={titoloPulito}
        linkEsterno={linkEsterno}
        guida={guida}
        inScadenza={inScadenza}
      />
    </>
  );
}
