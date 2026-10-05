/**
 * ScuoleRadar · ISTITUTO EMITTENTE dell'avviso (riga riusabile).
 *
 * Direttiva di prodotto: la SCUOLA che emette l'opportunità è SEMPRE visibile —
 * sulla card della dashboard, nella modale di dettaglio e nella scheda pubblica
 * `/interpello/:id`. Quando il bando non pubblica un nome presentabile si mostra la
 * dicitura GESTITA (`SCUOLA_NON_SPECIFICATA`) con la nota «anagrafica in
 * aggiornamento»: mai una riga vuota e mai un nome inventato (§26.47/§26.48).
 *
 * Un solo componente per i tre punti: l'etichetta della scuola non può divergere.
 */
import { GraduationCap } from 'lucide-react';
import { SCUOLA_NON_SPECIFICATA } from '@/lib/statoArricchimento';

/** Nome presentabile per la vetrina: quello reale, altrimenti la dicitura gestita. */
function istitutoDaMostrare(istituto?: string | null): {
  nome: string;
  approssimativo: boolean;
} {
  const nome = (istituto ?? '').trim();
  return nome
    ? { nome, approssimativo: false }
    : { nome: SCUOLA_NON_SPECIFICATA, approssimativo: true };
}

interface IstitutoEmittenteProps {
  /** Istituto così com'è nel dato (anche `''`/`null`). */
  istituto?: string | null;
  /** Classi extra del contenitore (spaziature del chiamante). */
  className?: string;
}

/** Riga «scuola emittente»: icona + nome (o dicitura gestita) + nota se approssimativa. */
export function IstitutoEmittente({ istituto, className = '' }: IstitutoEmittenteProps) {
  const { nome, approssimativo } = istitutoDaMostrare(istituto);
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium text-primary-700 ${className}`.trim()}
    >
      <GraduationCap className="h-4 w-4 shrink-0" />
      <span>{nome}</span>
      {approssimativo && (
        <span className="text-xs font-normal text-slate-500">anagrafica in aggiornamento</span>
      )}
    </p>
  );
}
