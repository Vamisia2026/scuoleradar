/**
 * ScuoleRadar.it — Dipartimento CFU · Presentazione "tutor universitario".
 *
 * Testi condivisi tra l'entry page del calcolatore (Step A) e la landing
 * pubblica: cosa fa lo strumento, quali documenti servono e come comportarsi
 * con le foto a bassa risoluzione.
 */

/** Apertura del Tutor del Dipartimento CFU (solo prima persona, testo esatto). */
export const APERTURA_TUTOR_CFU =
  "Sono il Tutor del Dipartimento CFU: guardo il tuo percorso di studi e ti dico quali classi di concorso puoi insegnare oggi (o quanti CFU o settori SSD ti mancano per quelle che vuoi raggiungere). Ti aiuto a capire cosa puoi fare subito con i titoli che hai già, suggerendoti percorsi alternativi oppure opportunità (anche fuori dalla scuola pubblica) che potresti non aver considerato. Ti darò anche indicazioni utili se hai titoli di studio conseguiti all'estero.";

/** Documenti necessari per il calcolo. */
export const DOCUMENTI_RICHIESTI_CFU = [
  'Certificato di laurea con l\u2019elenco degli esami sostenuti (denominazione, CFU/ECTS e voto)',
  'Piano di studi oppure libretto universitario (se il certificato non è ancora pronto)',
];

/** Nota realistica sulla lettura automatica dei documenti. */
export const NOTA_OCR_FOTO_CFU =
  'Elaboriamo i PDF digitali in automatico. Facciamo il possibile per risparmiarti la fatica di copiare tutto a mano, ma se carichi foto col telefonino preparati a inserire i dati a mano.';