/**
 * ScuoleRadar.it — INDICATORI DI RECLUTAMENTO DEL PERSONALE ATA (§26.126).
 *
 * Modulo sorello di `noiseFilter.ts` (come `noiseFilterSindacale.ts`): le regex
 * del personale ATA vivono qui per tenere il filtro principale sotto la soglia di
 * attenzione dei 250 righe. Sono INDICATORI POSITIVI: servono a salvare una voce
 * che porta un segnale di rumore soft (una circolare, un orario) e che parla di
 * un reclutamento ATA. Un bando per collaboratori scolastici o assistenti
 * amministrativi è un'opportunità come un interpello docente, ma non contiene
 * nessuna delle parole storiche del reclutamento.
 *
 * PURO: nessuna dipendenza, nessun I/O. Guardia: `npm run test:profili-ata`.
 */
export const INDICATORI_ATA: readonly RegExp[] = [
  /\bpersonale\s+ata\b/i,
  /\bcollaborator[ei]\s+scolastic/i,
  /\bassistent[ei]\s+(?:amministrativ|tecnic)/i,
  /\bbidell/i,
  /\bdsga\b/i,
];
