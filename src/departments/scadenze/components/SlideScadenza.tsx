/**
 * Scadenze — slide del Revolver (RIGHE 1-4 della card).
 *
 * RIGA 1-2 · periodo formattato (`formattaPeriodo`)
 * RIGA 3   · descrizione sintetica in MAIUSCOLO (`descrizioneScadenza`)
 * RIGA 4   · target / ordine di scuola, solo se specifico (`targetScadenza`)
 *
 * Presentazione pura: nessuno stato, nessun effetto. I due costruttori di
 * testo sono privati del modulo perché servono solo a questo slide.
 */
import type { ScadenzaProiettata } from '../types';
import { formattaPeriodo } from '../engine';

/**
 * RIGA 3 — Descrizione sintetica dell'evento/attività, in MAIUSCOLO.
 * Esempi: "LAVORETTO HALLOWEEN", "PROVE INVALSI", "IMMATRICOLAZIONE UNIVERSITÀ",
 * "DICHIARAZIONE 730", "TFA SOSTEGNO", "TASSE UNIVERSITARIE".
 */
function descrizioneScadenza(occ: ScadenzaProiettata): string {
  const categoria = (occ.record.category ?? '').toUpperCase().trim();
  const titolo = occ.record.title.toUpperCase();

  if (categoria === 'LAVORETTI') {
    const festa = occ.record.title
      .replace(/^Lavoretto\s*-\s*/i, '')
      .trim()
      .toUpperCase();
    return festa ? `LAVORETTO ${festa}` : 'LAVORETTO';
  }
  if (categoria === 'INVALSI') return 'PROVE INVALSI';

  if (categoria === 'UNIVERSITÀ') {
    if (/TFA|SOSTEGNO/.test(titolo)) return 'TFA SOSTEGNO';
    if (/60 CFU|PERCORSI FORMATIVI|PERCORSI ABILITANTI/.test(titolo)) return 'CORSI 60 CFU';
    if (/MASTER|PERFEZIONAMENTO/.test(titolo)) return 'MASTER E PERFEZIONAMENTO DOCENTI';
    if (/TASSE|CONTRIBUZION/.test(titolo)) return 'TASSE UNIVERSITARIE';
    if (/IMMATRICOL/.test(titolo)) return 'IMMATRICOLAZIONE UNIVERSITÀ';
    if (/ESAMI|APPELLI/.test(titolo)) return 'ISCRIZIONI ESAMI';
  }

  if (categoria === 'FISCO & INPS') {
    if (/\b730\b/.test(titolo)) return 'DICHIARAZIONE 730';
    if (/ISEE/.test(titolo)) return 'RINNOVO ISEE';
    if (/PENSIONAMENTO/.test(titolo)) return 'DOMANDA PENSIONAMENTO';
    if (/MOBILIT|TRASFERIMENTO/.test(titolo)) return 'DOMANDA MOBILITÀ';
    if (/GRADUATORIE|GPS/.test(titolo)) return 'GRADUATORIE GPS';
    if (/NASPI/.test(titolo)) return 'DOMANDA NASPI';
    if (/CARTA DEL DOCENTE/.test(titolo)) return 'CARTA DEL DOCENTE';
    if (/POLIZZA/.test(titolo)) return 'POLIZZA ASSICURATIVA';
    if (/PCTO/.test(titolo)) return 'RENDICONTAZIONE PCTO';
  }

  // Fallback generico: prima frase significativa del titolo (pulita da parentesi).
  return titolo
    .replace(/[()]/g, ' ')
    .split(/\s+-\s+/)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * RIGA 4 — Target / ordine di scuola. Compilato SOLO se la scadenza è
 * specifica (es. INFANZIA E PRIMARIA, SECONDARIA I GRADO, UNIVERSITÀ).
 * Vuoto per destinazioni generali (Tutti, Tutti i Gradi, Docenti/ATA,
 * GPS/Mobilità/730).
 */
function targetScadenza(occ: ScadenzaProiettata): string | null {
  const target = (occ.record.target ?? '').trim();
  if (!target) return null;
  const basso = target.toLowerCase();
  const generico =
    /^(tutti(\s.*)?|scuola|docenti(\s+e\s+ata)?(\s+di ruolo)?(\s+precari)?|precari scuola)$/.test(
      basso,
    );
  if (generico) return null;
  return target
    .toUpperCase()
    .replace(/\s*\/\s*/g, ' E ')
    .replace('SEC I GRADO', 'SECONDARIA I GRADO')
    .replace('SEC II GRADO', 'SECONDARIA II GRADO');
}

interface SlideScadenzaProps {
  /** Occorrenza proiettata da mostrare. */
  occ: ScadenzaProiettata;
  /** true quando lo slide è quello visibile (clone di testa escluso). */
  attivo: boolean;
}

export function SlideScadenza({ occ, attivo }: SlideScadenzaProps) {
  const target = targetScadenza(occ);
  const descrizione = descrizioneScadenza(occ);

  return (
                <div
                  aria-hidden={!attivo}
                  className="flex h-full w-full shrink-0 flex-col items-center justify-center gap-2 px-4 text-center sm:gap-2.5 sm:px-8"
                >
                  <p className="font-display text-base font-black uppercase leading-none tracking-tight text-primary-900 sm:text-2xl">
                    {formattaPeriodo(occ)}
                  </p>
                  <p
                    title={descrizione}
                    className="line-clamp-2 max-w-[95%] text-xs font-bold uppercase leading-snug tracking-[0.05em] text-primary-700 sm:text-sm"
                  >
                    {descrizione}
                  </p>
                  {target && (
                    <span className="inline-flex items-center rounded-full bg-primary-100/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-600 sm:text-[11px]">
                      {target}
                    </span>
                  )}
                </div>
  );
}
