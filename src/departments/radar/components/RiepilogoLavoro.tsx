/**
 * Radar — riepilogo «In cosa puoi lavorare» (box della pagina Profilo).
 *
 * Prima qui c'era una dicitura FISSA di riempimento («Classi di Concorso
 * Monitorate (A-22, A-11, ecc.)»): identica per tutti, anche con il profilo
 * vuoto — il box risultava «vuoto» perché non leggeva nulla. Adesso si leggono le
 * preferenze REALI (classi di concorso, competenze di catalogo, parole chiave) e
 * le si mostrano come pill; se non c'è nulla, si spiega cosa manca e si porta al
 * Radar per configurarlo.
 *
 * Presentazione pura: nessuna query propria, lo stato arriva dal contesto (le
 * preferenze sono idratate al bootstrap del profilo e salvate su `profiles`).
 */
import { BookOpen, Briefcase, Sparkles, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { classeByCodice } from '@/data/classiConcorso';
import { materie } from '@/data/ordiniMaterie';

/** Pill di una voce del profilo (classe, competenza o parola chiave). */
function Pill({ titolo, testo }: { titolo: string; testo?: string }) {
  return (
    <span
      title={testo || titolo}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700"
    >
      <strong className="font-bold">{titolo}</strong>
      {testo && <span className="truncate">{testo}</span>}
    </span>
  );
}

export function RiepilogoLavoro() {
  const { preferenze } = useApp();
  const classi = preferenze.classiCodici.map((codice) => ({
    codice,
    nome: classeByCodice(codice)?.denominazione ?? '',
  }));
  const competenze = preferenze.materieId.map(
    (id) => materie.find((m) => m.id === id)?.nome ?? id,
  );
  const parole = preferenze.materieCustom;
  const vuoto = classi.length === 0 && competenze.length === 0 && parole.length === 0;

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-primary-900">In cosa puoi lavorare</h3>
          <p className="text-xs text-primary-500">
            Classi di concorso, competenze e parole chiave del tuo Radar
          </p>
        </div>
      </div>

      {vuoto ? (
        <div className="mt-4 rounded-xl border border-dashed border-primary-200 bg-primary-50/60 p-3">
          <p className="text-xs leading-relaxed text-primary-600">
            Non hai ancora indicato classi di concorso né competenze: il tuo Radar non sa cosa
            cercare per te.
          </p>
          <Link
            to="/dashboard/radar"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-600"
          >
            Configura il tuo Radar
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {classi.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-400">
                <BookOpen className="h-3.5 w-3.5" /> Classi di concorso
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {classi.map((c) => (
                  <Pill key={c.codice} titolo={c.codice} testo={c.nome} />
                ))}
              </div>
            </div>
          )}

          {competenze.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-400">
                <Sparkles className="h-3.5 w-3.5" /> Competenze e laboratori extra
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {competenze.map((nome, indice) => (
                  <Pill key={`${nome}-${indice}`} titolo={nome} />
                ))}
              </div>
            </div>
          )}

          {parole.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-400">
                <Tag className="h-3.5 w-3.5" /> Parole chiave personali
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {parole.map((p) => (
                  <Pill key={p} titolo={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
