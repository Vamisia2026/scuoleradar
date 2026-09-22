/**
 * ScuoleRadar.it — Dipartimento CFU · Presentazione "tutor universitario".
 *
 * Testi condivisi tra l'entry page del calcolatore e la landing pubblica:
 * cosa fa lo strumento e quali informazioni servono (nessun documento da
 * caricare: gli esami si inseriscono o si incollano).
 */

/** Apertura del Tutor del Dipartimento CFU (solo prima persona, testo esatto). */
export const APERTURA_TUTOR_CFU =
  "Sono il Tutor del Dipartimento CFU: prendo la tua carriera universitaria e verifico, requisito per requisito, se puoi accedere alla classe di concorso che ti interessa. Ti dico quali requisiti risultano soddisfatti, quali no, cosa resta da verificare e su quale norma si basa il calcolo: nessun numero inventato e nessun CFU stimato a occhio. Se un punto non è decidibile con i dati che hai, te lo dico invece di indovinare.";

/** Informazioni necessarie per il calcolo (dati, non documenti). */
export const DOCUMENTI_RICHIESTI_CFU = [
  'Classe di laurea del tuo titolo (es. LM-14), se la conosci',
  'Elenco degli esami sostenuti con CFU/ECTS e settore SSD (es. L-FIL-LET/04)',
];

/** Nota realistica sul settore degli esami: mai dedotto. */
export const NOTA_SSD_CFU =
  'Se un esame non ha un settore SSD, scegli «Non lo so»: non lo inventiamo noi. In quel caso, se serve una soglia precisa, il calcolo ti chiederà una verifica invece di stimare.';
