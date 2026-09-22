/**
 * Interpello · stato «reindirizzamento» (`/interpello/:id`).
 *
 * Fallback del redirect immediato verso la pagina ufficiale: mostra il
 * messaggio di apertura e lascia il link diretto a disposizione nel caso il
 * redirect automatico venga bloccato dal browser.
 */
import { ArrowRight } from 'lucide-react';
import type { Interpello } from '@/data/interpelli';
import { etichettaFonteLink } from '@/lib/alertInterpello';

interface ReindirizzamentoAllaFonteProps {
  /** Avviso di cui si sta aprendo la fonte ufficiale. */
  interpello: Interpello;
}

export function ReindirizzamentoAllaFonte({ interpello }: ReindirizzamentoAllaFonteProps) {
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
