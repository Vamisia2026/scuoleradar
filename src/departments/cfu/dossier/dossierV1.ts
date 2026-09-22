/**
 * ScuoleRadar.it — Dipartimento CFU · Dossier Requisiti V1 (.txt).
 *
 * Trasforma il RISULTATO V1 (`EsitoUtenteV1`) nel documento di sintesi da
 * portare in segreteria o all'USR. Nessun dato inventato: il testo riporta solo
 * ciò che il motore ha dichiarato (verdetto, requisiti, carenze, fonti).
 *
 * Il download è locale (Blob lato browser): nessuna conservazione lato server.
 */
import type { EsitoUtenteV1 } from '../calcolatore/esitoUtente';
import { NOTA_LEGALE_DOSSIER } from '../shared/normativa';

export interface ContestoDossierV1 {
  /** Classe di laurea dichiarata ('' = non dichiarata). */
  readonly classeLaurea: string;
  /** Data della procedura dichiarata ('' = non dichiarata). */
  readonly dataProcedura: string;
  readonly esamiInseriti: number;
  readonly cfuInseriti: number;
}

const ETICHETTE_ESITO: Record<EsitoUtenteV1['stato'], string> = {
  ELIGIBLE: 'REQUISITI SODDISFATTI',
  CONDITIONALLY_ELIGIBLE: 'AMMISSIBILE CON INTEGRAZIONE',
  INSUFFICIENT_DATA: 'DATI DA COMPLETARE',
  MANUAL_VERIFICATION_REQUIRED: 'VERIFICA MANUALE RICHIESTA',
  NOT_ELIGIBLE: 'ACCESSO NON CONSENTITO',
};

const ETICHETTE_REQUISITO: Record<string, string> = {
  soddisfatto: 'SODDISFATTO',
  'non-soddisfatto': 'NON SODDISFATTO',
  'da-verificare': 'DA VERIFICARE',
};

function rigaData(iso: string): string {
  if (!iso) return 'non dichiarata';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function sezioneRequisiti(esito: EsitoUtenteV1): string[] {
  return esito.requisiti.map((voce) => {
    const righe = [
      `  [${ETICHETTE_REQUISITO[voce.esito] ?? voce.esito}] ${voce.etichetta}`,
      `     ${voce.dettaglio}`,
    ];
    if (voce.esito === 'non-soddisfatto' && voce.integrabilita === 'non-dichiarata') {
      righe.push('     Integrabilità non dichiarata dalla fonte: da verificare.');
    }
    if (voce.estratto) righe.push(`     Fonte: «${voce.estratto}»`);
    return righe.join('\n');
  });
}

function sezioneDeficit(esito: EsitoUtenteV1): string[] {
  const righe: string[] = [];
  if (esito.deficitPubblicabile && esito.cfuMancantiTotali !== null) {
    righe.push(`  Crediti mancanti secondo la norma: ${esito.cfuMancantiTotali} CFU`);
  } else {
    righe.push(
      '  Totale CFU mancanti non pubblicato dal motore: carenze elencate requisito per requisito.',
    );
  }
  if (esito.motivoDeficit) righe.push(`  Nota del motore: ${esito.motivoDeficit}`);
  for (const voce of esito.cfuMancantiPerRequisito) {
    righe.push(`  - ${voce.etichetta}: ${voce.cfuMancanti} CFU`);
  }
  for (const voce of esito.requisitiMancanti) {
    righe.push(`  - ${voce.etichetta}: ${voce.dettaglio}`);
  }
  if (esito.requisitiMancanti.length === 0 && esito.cfuMancantiPerRequisito.length === 0) {
    righe.push('  Nessun requisito non soddisfatto sui dati forniti.');
  }
  return righe;
}

/** Testo completo del Dossier V1 (pronto per la consegna). */
export function creaTestoDossierV1(esito: EsitoUtenteV1, contesto: ContestoDossierV1): string {
  const righe: string[] = [
    'DOSSIER REQUISITI SCUOLERADAR',
    '==================================================',
    `Data di generazione: ${rigaData(new Date().toISOString())}`,
    `Classe di concorso: ${esito.classeCodice} — ${esito.classeDenominazione}`,
    `Verdetto ScuoleRadar: ${ETICHETTE_ESITO[esito.stato]}`,
    '',
    '1. DATI DICHIARATI DAL CANDIDATO',
    '--------------------------------------------------',
    `Esami inseriti: ${contesto.esamiInseriti} (${contesto.cfuInseriti} CFU)`,
    `Classe di laurea del titolo: ${contesto.classeLaurea || 'non dichiarata'}`,
    `Data della procedura: ${rigaData(contesto.dataProcedura)}`,
    '',
    '2. PERCHÉ QUESTO VERDETTO',
    '--------------------------------------------------',
    ...esito.spiegazioneStato.map((frase) => `  ${frase}`),
    '',
    '3. REQUISITI VERIFICATI',
    '--------------------------------------------------',
    ...sezioneRequisiti(esito),
    '',
    '4. COSA MANCA',
    '--------------------------------------------------',
    ...sezioneDeficit(esito),
    '',
    '5. COSA RESTA DA FARE',
    '--------------------------------------------------',
    ...(esito.datiMancanti.length > 0
      ? esito.datiMancanti.map((dato) => `  - Manca ${dato.etichetta}: ${dato.perche}`)
      : ['  Nessun dato mancante.']),
    ...esito.cosaVerificare.map((frase) => `  - ${frase}`),
    ...esito.percorsi.map((passo) => `  - ${passo}`),
    '',
    '6. FONTI NORMATIVE APPLICATE',
    '--------------------------------------------------',
    ...(esito.riferimentoNormativo ? [`  Norma: ${esito.riferimentoNormativo}`] : []),
    ...esito.fonti.map(
      (fonte) =>
        `  - ${fonte.fonte}${fonte.riferimento ? ` (${fonte.riferimento})` : ''} — ${
          fonte.verificata ? 'fonte verificata' : 'fonte non verificata'
        }`,
    ),
    `  Esito tecnico del motore: ${esito.esitoTecnico}`,
    '',
    '7. NOTE',
    '--------------------------------------------------',
    '  Il calcolo usa esclusivamente i dati inseriti dal candidato e le fonti',
    '  normative citate. In questa versione non vengono caricati né analizzati',
    '  documenti, e nulla viene conservato lato server.',
    '',
    NOTA_LEGALE_DOSSIER,
    '— Generato con il Calcolatore CFU di ScuoleRadar.it —',
  ];
  return righe.join('\n');
}

/** Scarica il testo del Dossier come file .txt (solo lato browser). */
export function scaricaTestoDossierV1(nomeFile: string, testo: string): void {
  const blob = new Blob([testo], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement('a');
  ancora.href = url;
  ancora.download = nomeFile;
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  URL.revokeObjectURL(url);
}
