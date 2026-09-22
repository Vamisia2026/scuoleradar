/* DIAGNOSTICA TEMPORANEA (fase V1) — da eliminare. */
import { classiCoperteAttive } from './src/departments/cfu/calcolatore/classi';
import { valutaClasseV1 } from './src/departments/cfu/calcolatore/valutazioneV1';
import type { Esame } from './src/departments/cfu/shared/types';

const ESAMI: Esame[] = [
  { id: 'e1', denominazione: 'Lingua e letteratura latina', cfu: 24, ssd: 'L-FIL-LET/04', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e2', denominazione: 'Letteratura greca', cfu: 12, ssd: 'L-FIL-LET/05', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e3', denominazione: 'Letteratura italiana', cfu: 12, ssd: 'L-FIL-LET/10', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e4', denominazione: 'Storia greca', cfu: 12, ssd: 'L-ANT/02', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e5', denominazione: 'Storia medievale', cfu: 24, ssd: 'M-STO/01', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e6', denominazione: 'Glottologia', cfu: 12, ssd: 'L-LIN/01', fonte: 'manuale', affidabilita: 'alta' },
];

const classe = classiCoperteAttive().find((voce) => voce.codice === 'A-11')!;

const casi: { etichetta: string; esami: Esame[] }[] = [
  { etichetta: '1 clean', esami: ESAMI },
  {
    etichetta: '2 clean + esame senza SSD (soglie raggiunte)',
    esami: [
      ...ESAMI,
      { id: 'x1', denominazione: 'Esame senza settore', cfu: 6, ssd: null, fonte: 'manuale', affidabilita: 'media' },
    ],
  },
  {
    etichetta: '3 manca clausola L-ANT, tutti con SSD',
    esami: ESAMI.filter((esame) => esame.id !== 'e4'),
  },
  {
    etichetta: '4 manca clausola L-ANT + esame senza SSD',
    esami: [
      ...ESAMI.filter((esame) => esame.id !== 'e4'),
      { id: 'x1', denominazione: 'Esame senza settore', cfu: 6, ssd: null, fonte: 'manuale', affidabilita: 'media' },
    ],
  },
];

for (const caso of casi) {
  const { utente, tecnica } = valutaClasseV1({
    classe,
    esami: caso.esami,
    classeLaurea: 'LM-14',
    dataProcedura: '2026-03-01',
  });
  console.log(`\n[${caso.etichetta}] stato=${utente.stato} tecnica=${tecnica.esitoMotore} engine=${tecnica.engineSource}`);
  console.log(`  cfuMancantiTotali=${utente.cfuMancantiTotali} deficitPubblicabile=${utente.deficitPubblicabile}`);
  console.log(`  datiMancanti=${utente.datiMancanti.map((d) => d.etichetta).join('|') || '-'}`);
  console.log(`  cosaVerificare=${utente.cosaVerificare.length} :: ${utente.cosaVerificare[0] ?? '-'}`);
  console.log(`  motivi: ${utente.spiegazioneStato.join(' // ')}`);
  console.log(
    `  requisiti: ${utente.requisiti.map((r) => `${r.tipo}=${r.esito}:${r.cfuMancanti ?? 'null'}`).join(' | ')}`,
  );
}
