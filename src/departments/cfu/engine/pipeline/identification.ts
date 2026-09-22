/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/identification.
 *
 * STAGE 1 — IDENTIFICAZIONE.
 * Raccoglie, senza interpretarli: classe di concorso obiettivo, dati del titolo,
 * date rilevanti e sistema accademico. I campi assenti vengono ELENCATI in
 * `datiMancanti` e non vengono mai colmati per deduzione.
 */
import type { DateRilevanza, TitoloAccademicoCanonico } from '../types';
import type { ContestoIdentificazione, SistemaAccademico } from './types';

export interface ParametriIdentificazione {
  readonly classeCodice: string;
  readonly denominazioneClasse?: string | null;
  readonly titolo?: TitoloAccademicoCanonico | null;
  readonly dateRilevanza?: DateRilevanza;
}

/** Sistema accademico dichiarato dal titolo (nessuna inferenza sul merito). */
export function sistemaAccademicoDaTitolo(
  titolo?: TitoloAccademicoCanonico | null,
): SistemaAccademico {
  if (!titolo) return 'non-dichiarato';
  const paese = (titolo.paese ?? '').trim().toLowerCase();
  if (titolo.titoloEstero === true || (paese !== '' && paese !== 'italia' && paese !== 'it')) {
    return 'estero';
  }
  return 'italiano';
}

/** Identifica il contesto di valutazione conservando date e dati di sistema. */
export function identificaContesto(
  parametri: ParametriIdentificazione,
): ContestoIdentificazione {
  const dateRilevanza: DateRilevanza = parametri.dateRilevanza ?? {};
  const titolo = parametri.titolo ?? null;
  const datiMancanti: string[] = [];

  if (!parametri.classeCodice || parametri.classeCodice.trim().length === 0) {
    datiMancanti.push('classe di concorso obiettivo');
  }
  if (!titolo) {
    datiMancanti.push('titolo accademico');
  } else {
    const classe = titolo.classe ?? titolo.classeLegacy ?? null;
    if (!classe) datiMancanti.push('classe di laurea del titolo');
    if (!titolo.denominazione || titolo.denominazione.trim().length === 0) {
      datiMancanti.push('denominazione del titolo');
    }
  }
  const procedura = dateRilevanza.procedureDate ?? dateRilevanza.dataDomanda ?? null;
  if (!procedura) datiMancanti.push('data della procedura');

  return {
    classeCodice: parametri.classeCodice.trim(),
    denominazioneClasse: parametri.denominazioneClasse ?? null,
    titolo,
    dateRilevanza,
    sistemaAccademico: sistemaAccademicoDaTitolo(titolo),
    datiMancanti,
  };
}
