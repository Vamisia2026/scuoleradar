/**
 * ScuoleRadar.it — Dipartimento CFU · calcolatore/esitoUtente.
 *
 * ADAPTER PURO motore → lingua dell'utente (nessun React, nessuna UI).
 *
 * AUTORITÀ DEL VERDETTO (V1): `esitoMotore` — il verdetto emesso dalla
 * superficie di routing/bridge (`EsitoClasseConRouting.esitoMotore`).
 * Lo stato interno della pipeline (`pipeline.stato`) NON viene mai letto qui e
 * non diventa un secondo verdetto: resta dato tecnico di audit.
 *
 * Regole di contenuto:
 *  - nessun totale di CFU mancanti se il deficit non è pubblicabile
 *    (`deficit.calcolabile === false`) → si mostrano i problemi per requisito;
 *  - `null` non diventa mai `0`;
 *  - nessun percorso di integrazione inventato: si mostra solo ciò che la fonte
 *    dichiara (integrabilità del requisito / passi forniti dal motore);
 *  - MANUAL_VERIFICATION_REQUIRED non è un "no": è un punto da verificare.
 */
import {
  creaVoceRequisito,
  etichettaIntegrabilita,
  type EsitoValutazioneMotore,
  type RequisitoMotore,
  type VoceRequisitoUtente,
} from './requisitoUtente';
import {
  creaDatoMancante,
  eRequisitoDiAccesso,
  fraseBaseSpiegazione,
  frasiCosaVerificare,
  requisitoBloccante,
  titoloPerStato,
  type DatoMancanteUtente,
  type StatoEsitoUtente,
} from './esitoUtenteTesti';

export type { DatoMancanteUtente, StatoEsitoUtente };

/** Analisi del deficit prodotta dal motore (mai ricalcolata qui). */
export interface AnalisiDeficitMotore {
  readonly calcolabile: boolean;
  readonly cfuMancantiTotali: number | null;
  readonly causaDeterminante: 'cfu' | 'titolo' | 'nessuna';
  readonly motivo: string;
  readonly perRequisito: readonly { readonly requisitoId: string; readonly cfuMancanti: number }[];
}

/** Fonte autorevole applicata (con esito del Source Gate). */
export interface FonteMotore {
  readonly fonte: string;
  readonly riferimento: string | null;
  readonly verificata: boolean;
}

/** Tutto ciò che l'adapter riceve dal motore: nient'altro viene letto. */
export interface IngressoEsitoUtente {
  readonly classeCodice: string;
  readonly classeDenominazione: string;
  /** Verdetto autorevole per la V1; `null` = il motore non ha emesso un verdetto. */
  readonly esitoMotore: StatoEsitoUtente | null;
  readonly motivazione: string;
  /** Motivo per cui non esiste un verdetto motore (usato solo se `esitoMotore === null`). */
  readonly motivoNonValutato?: string | null;
  readonly esamiConsiderati: number;
  readonly cfuConteggiati: number;
  readonly requisiti: readonly RequisitoMotore[];
  readonly valutazioni: readonly EsitoValutazioneMotore[];
  readonly deficit: AnalisiDeficitMotore | null;
  readonly fonti: readonly FonteMotore[];
  readonly conflitti: number;
  readonly datiMancanti: readonly string[];
  readonly codiciMancanti: boolean;
  readonly cfuNonValidi: boolean;
  readonly riferimentoNormativo: string | null;
  /** Passi di integrazione forniti dal motore: vuoto = nessun percorso dichiarato. */
  readonly percorsi?: readonly string[];
}

/** Risultato pronto per la UI: nessun termine tecnico del motore. */
export interface EsitoUtenteV1 {
  readonly classeCodice: string;
  readonly classeDenominazione: string;
  readonly stato: StatoEsitoUtente;
  readonly titolo: string;
  readonly sintesi: string;
  readonly spiegazioneStato: readonly string[];
  readonly requisiti: readonly VoceRequisitoUtente[];
  readonly requisitiSoddisfatti: readonly VoceRequisitoUtente[];
  readonly requisitiMancanti: readonly VoceRequisitoUtente[];
  readonly requisitiDaVerificare: readonly VoceRequisitoUtente[];
  /** true solo quando il motore pubblica un deficit aggregato. */
  readonly deficitPubblicabile: boolean;
  /** Valorizzato SOLO se `deficitPubblicabile` (mai 0 di comodo). */
  readonly cfuMancantiTotali: number | null;
  readonly cfuMancantiPerRequisito: readonly {
    readonly etichetta: string;
    readonly cfuMancanti: number;
  }[];
  readonly motivoDeficit: string | null;
  readonly datiMancanti: readonly DatoMancanteUtente[];
  readonly cosaVerificare: readonly string[];
  readonly datiUsati: readonly string[];
  readonly riferimentoNormativo: string | null;
  readonly fonti: readonly FonteMotore[];
  readonly percorsi: readonly string[];
  /** Stato tecnico del motore: mostrato solo come nota di audit. */
  readonly esitoTecnico: string;
}

/* ------------------------------ Adapter ------------------------------ */

/** Trasforma il risultato del motore nel risultato mostrato all'utente. */
export function creaEsitoUtente(input: IngressoEsitoUtente): EsitoUtenteV1 {
  const stato: StatoEsitoUtente = input.esitoMotore ?? 'MANUAL_VERIFICATION_REQUIRED';
  const valutazioni = new Map(input.valutazioni.map((voce) => [voce.requisitoId, voce]));
  const requisiti = input.requisiti.map((requisito) =>
    creaVoceRequisito(requisito, valutazioni.get(requisito.id)),
  );
  const mancanti = requisiti.filter((voce) => voce.esito === 'non-soddisfatto');
  const daVerificare = requisiti.filter((voce) => voce.esito === 'da-verificare');

  // Deficit: pubblicato SOLO quando il motore lo dichiara calcolabile. `null` resta `null`.
  const deficitPubblicabile = input.deficit?.calcolabile === true;
  const cfuMancantiTotali = deficitPubblicabile ? (input.deficit?.cfuMancantiTotali ?? null) : null;
  const etichettePerId = new Map(requisiti.map((voce) => [voce.id, voce.etichetta]));
  const cfuMancantiPerRequisito = (input.deficit?.perRequisito ?? [])
    .filter((voce) => voce.cfuMancanti > 0)
    .map((voce) => ({
      etichetta: etichettePerId.get(voce.requisitoId) ?? voce.requisitoId,
      cfuMancanti: voce.cfuMancanti,
    }));

  const titolo = titoloPerStato(stato, input.classeCodice);
  const spiegazioneStato: string[] = [];
  if (input.esitoMotore === null) {
    spiegazioneStato.push(
      fraseBaseSpiegazione(
        {
          classeCodice: input.classeCodice,
          motivazione: input.motivazione,
          haVerdettoMotore: false,
          motivoNonValutato: input.motivoNonValutato ?? null,
          percorsiDisponibili: false,
        },
        stato,
      ),
    );
  } else {
    // La frase del motore è la prima spiegazione mostrata: nessuna riformulazione.
    spiegazioneStato.push(input.motivazione);
    spiegazioneStato.push(
      fraseBaseSpiegazione(
        {
          classeCodice: input.classeCodice,
          motivazione: input.motivazione,
          haVerdettoMotore: true,
          motivoNonValutato: null,
          percorsiDisponibili: (input.percorsi ?? []).length > 0,
        },
        stato,
      ),
    );
  }

  if (stato === 'NOT_ELIGIBLE') {
    const bloccante = requisitoBloccante(mancanti);
    if (bloccante) {
      spiegazioneStato.push(`Requisito decisivo: ${bloccante.etichetta} — ${bloccante.dettaglio}`);
      if (eRequisitoDiAccesso(bloccante.tipo)) {
        spiegazioneStato.push(
          'Il blocco dipende dal titolo di studio o dal requisito di accesso: non si colma con crediti aggiuntivi.',
        );
      }
    }
  }
  // Nessun totale pubblicato dal motore: dichiararlo invece di mostrare un numero.
  if (!deficitPubblicabile && mancanti.length > 0) {
    spiegazioneStato.push(
      'Il motore non pubblica un totale di CFU mancanti per questa classe: le carenze sono elencate requisito per requisito.',
    );
  }
  if (stato === 'CONDITIONALLY_ELIGIBLE') {
    for (const voce of mancanti.filter((item) => item.integrabilita === 'integrabile')) {
      const dettaglioCfu = voce.cfuMancanti === null ? '' : ` (${voce.cfuMancanti} CFU)`;
      spiegazioneStato.push(`Da integrare: ${voce.etichetta}${dettaglioCfu}.`);
    }
  }
  if (stato === 'ELIGIBLE') {
    spiegazioneStato.push(
      `Dati usati: ${input.esamiConsiderati} esami, ${input.cfuConteggiati} CFU conteggiati · fonti verificate: ${input.fonti.filter((fonte) => fonte.verificata).length}.`,
    );
  }
  for (const voce of mancanti) {
    const nota = etichettaIntegrabilita(voce);
    if (nota && voce.integrabilita !== 'integrabile') {
      spiegazioneStato.push(`${voce.etichetta}: ${nota}`);
    }
  }

  return {
    classeCodice: input.classeCodice,
    classeDenominazione: input.classeDenominazione,
    stato,
    titolo,
    sintesi: `${titolo}: ${spiegazioneStato[0] ?? ''}`.trim(),
    spiegazioneStato,
    requisiti,
    requisitiSoddisfatti: requisiti.filter((voce) => voce.esito === 'soddisfatto'),
    requisitiMancanti: mancanti,
    requisitiDaVerificare: daVerificare,
    deficitPubblicabile,
    cfuMancantiTotali,
    cfuMancantiPerRequisito,
    motivoDeficit: input.deficit?.motivo ?? null,
    datiMancanti: input.datiMancanti.map(creaDatoMancante),
    cosaVerificare: frasiCosaVerificare(
      {
        codiciMancanti: input.codiciMancanti,
        cfuNonValidi: input.cfuNonValidi,
        conflitti: input.conflitti,
        verdettoPositivo: stato === 'ELIGIBLE',
      },
      daVerificare,
    ),
    datiUsati: [
      `${input.esamiConsiderati} esami inseriti`,
      `${input.cfuConteggiati} CFU conteggiati`,
      `${input.fonti.filter((fonte) => fonte.verificata).length} fonti normative verificate`,
    ],
    riferimentoNormativo: input.riferimentoNormativo,
    fonti: input.fonti,
    percorsi: [...(input.percorsi ?? [])],
    esitoTecnico: input.esitoMotore ?? 'nessun verdetto emesso',
  };
}
