/**
 * ScuoleRadar.it — Dipartimento CFU · Dossier Requisiti ScuoleRadar.
 *
 * Trasforma la Diagnosi (Step D) nel Dossier ufficiale per la scuola (Step E):
 * oggetto `DossierCFU`, testo pronto da consegnare e download .txt.
 * (In produzione il Dossier verrà esportato anche in PDF firmato.)
 */

import type { DossierCFU, DiagnosiCFU, EsitoClasse } from '../shared/types';
import { ETICHETTE_AMBITI } from '../shared/types';
import { NOTA_LEGALE_DOSSIER } from '../shared/normativa';

let idDossierProgressivo = 0;

/** Costruisce il Dossier a partire dalla diagnosi del calcolatore. */
export function creaDossier(diagnosi: DiagnosiCFU): DossierCFU {
  idDossierProgressivo += 1;
  const oggi = new Date();
  return {
    id: `DOSSIER-${oggi.getFullYear()}-${String(idDossierProgressivo).padStart(4, '0')}`,
    generatoIl: oggi.toISOString(),
    esami: diagnosi.esamiAnalizzati,
    cfuTotali: diagnosi.cfuTotali,
    cfuPerAmbito: diagnosi.cfuPerAmbito,
    puntiDiForza: diagnosi.puntiDiForza,
    classiAccessibili: diagnosi.classiAccessibili,
    classiSecondarie: diagnosi.classiSecondarie,
    notaMetodologica: diagnosi.notaMetodologica,
  };
}

/** Formatta una data ISO in italiano leggibile (gg mese anno). */
function dataLeggibile(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function sezioneClassi(classi: EsitoClasse[]): string {
  if (classi.length === 0) return '  — nessuna classe in questa sezione —';
  return classi
    .map((esito) => {
      const coperture = esito.coperture
        .map(
          (c) =>
            `     • ${ETICHETTE_AMBITI[c.ambito]}: ${c.cfuPosseduti} CFU posseduti`,
        )
        .join('\n');
      const stato = esito.accessibile ? '✓ AMMISSIBILE' : `✗ da integrare (mancano ${esito.cfuMancanti} CFU)`;
      return `  [${esito.classe.codice}] ${esito.classe.denominazione} — ${stato}\n${coperture}`;
    })
    .join('\n\n');
}

/** Testo del Dossier pronto per la consegna alla segreteria (formato .txt). */
export function testoDossier(dossier: DossierCFU): string {
  const righe: string[] = [
    'DOSSIER REQUISITI SCUOLERADAR',
    '==================================================',
    `Codice dossier: ${dossier.id}`,
    `Data di generazione: ${dataLeggibile(dossier.generatoIl)}`,
    '',
    '1. PERCORSO DI STUDI CONSIDERATO',
    '--------------------------------------------------',
    `Esami considerati: ${dossier.esami.length}`,
    `CFU/ECTS totali: ${dossier.cfuTotali}`,
    dossier.cfuPerAmbito
      .map((c) => `  ${ETICHETTE_AMBITI[c.ambito]}: ${c.cfuPosseduti} CFU`)
      .join('\n'),
    '',
    '2. PUNTI DI FORZA',
    '--------------------------------------------------',
    dossier.puntiDiForza.map((p) => `  • ${p}`).join('\n'),
    '',
    '3. CLASSI DI CONCORSO ACCESSIBILI',
    '--------------------------------------------------',
    sezioneClassi(dossier.classiAccessibili),
    '',
    '4. OBIETTIVI SECONDARI (CFU DA INTEGRARE)',
    '--------------------------------------------------',
    sezioneClassi(dossier.classiSecondarie),
    '',
    '5. NOTE E METODOLOGIA',
    '--------------------------------------------------',
    `  ${dossier.notaMetodologica}`,
    '',
    NOTA_LEGALE_DOSSIER,
    '— Generato con il Calcolatore CFU di ScuoleRadar.it —',
  ];
  return righe.join('\n');
}

/** Scarica il Dossier come file .txt (foundation; il PDF arriverà dopo). */
export function scaricaDossier(dossier: DossierCFU): void {
  const contenuto = testoDossier(dossier);
  const blob = new Blob([contenuto], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement('a');
  ancora.href = url;
  ancora.download = `${dossier.id}-Requisiti-Classi.txt`;
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  URL.revokeObjectURL(url);
}
