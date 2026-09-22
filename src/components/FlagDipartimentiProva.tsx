/**
 * ScuoleRadar.it — PROVA LIVE delle feature flags, dentro la DEV Toolbar.
 *
 * Mostra — senza aprire modali — le due cose che servono mentre si legge la
 * toolbar laterale:
 *   1. effetto immediato in NAVBAR: l'elenco dei dipartimenti visibili ora, calcolato
 *      con la stessa funzione usata da `BarraStrumenti`/`MenuMobile`/`DashboardLayout`
 *      (`visibile(modulo)`), quindi è una prova reale e non una simulazione;
 *   2. effetto immediato del CLICK: il valore grezzo salvato in
 *      `localStorage → sr_flag_dipartimenti`, riletto a ogni render (quindi cambia
 *      sotto gli occhi appena si preme OFF | TEST | ON), più un test di
 *      scrittura/rilettura su richiesta che ripristina il valore precedente.
 *
 * Componente di sola PRESENTAZIONE: legge lo store condiviso e non lo modifica.
 */
import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { DIPARTIMENTI, STORAGE_KEY_FLAG_DIPARTIMENTI } from '@/config/features';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

/** Valore grezzo degli override salvati (`null` = nessuno override o storage bloccato). */
function leggiSalvato(): string | null {
  try {
    return typeof window === 'undefined'
      ? null
      : window.localStorage.getItem(STORAGE_KEY_FLAG_DIPARTIMENTI);
  } catch {
    return null;
  }
}

/** Round-trip di scrittura/rilettura sulla chiave VERA, con ripristino del valore. */
function verificaScrittura(): string {
  const chiave = STORAGE_KEY_FLAG_DIPARTIMENTI;
  try {
    const precedente = window.localStorage.getItem(chiave);
    const prova = JSON.stringify({ radar: 'test' });
    window.localStorage.setItem(chiave, prova);
    const riletto = window.localStorage.getItem(chiave);
    if (precedente === null) window.localStorage.removeItem(chiave);
    else window.localStorage.setItem(chiave, precedente);
    return riletto === prova
      ? `✓ localStorage operativo: scritto e riletto «${chiave}» (valore precedente ripristinato).`
      : `✗ Rilettura diversa da quanto scritto: il browser sta bloccando «${chiave}».`;
  } catch {
    return `✗ localStorage non disponibile (navigazione privata o storage bloccato): gli override restano validi solo in questa sessione.`;
  }
}

export function FlagDipartimentiProva() {
  const { visibile, eAdmin, forzaDev } = useFeatureFlags();
  const [esito, setEsito] = useState<string | null>(null);

  const visibili = DIPARTIMENTI.filter((d) => visibile(d.id));
  const nascosti = DIPARTIMENTI.filter((d) => !visibile(d.id));
  const salvato = leggiSalvato();
  const etichettaNascosti = eAdmin
    ? 'Solo admin (TEST) o spenti (OFF): '
    : forzaDev
      ? 'Nascosti, ma sbloccati qui dal forzatura DEV: '
      : 'Nascosti (OFF) o solo admin (TEST): ';

  return (
    <div className="mt-2 space-y-1.5 rounded-xl border border-primary-100 bg-slate-50 px-3 py-2">
      {/* Prova 1 — effetto immediato in navbar. */}
      <p className="text-[11px] font-semibold text-primary-700">
        <Eye className="mr-1 inline h-3.5 w-3.5" />
        Navbar ora:{' '}
        <span className="font-normal text-primary-500">
          {visibili.length > 0
            ? visibili.map((d) => `${d.emoji} ${d.nome}`).join(' · ')
            : 'nessun dipartimento'}
        </span>
      </p>
      {nascosti.length > 0 && (
        <p className="text-[10px] leading-relaxed text-primary-400">
          <EyeOff className="mr-1 inline h-3 w-3" />
          {etichettaNascosti}
          {nascosti.map((d) => d.nome).join(', ')}
        </p>
      )}

      {/* Prova 2 — valore persistito, riletto a ogni click sui toggle. */}
      <p className="break-all text-[10px] leading-relaxed text-primary-400">
        Salvato ora in <code className="rounded bg-white px-1">{STORAGE_KEY_FLAG_DIPARTIMENTI}</code>:{' '}
        <code className="rounded bg-white px-1">
          {salvato ?? '{} — nessun override, si usano i valori del codice'}
        </code>
      </p>
      <button
        type="button"
        onClick={() => setEsito(verificaScrittura())}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-primary-700 transition hover:bg-primary-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Verifica scrittura localStorage
      </button>
      {esito && <p className="text-[10px] leading-relaxed text-primary-500">{esito}</p>}
    </div>
  );
}
