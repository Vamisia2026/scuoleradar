/**
 * ScuoleRadar.it — FAQ PUBBLICHE: elenco unico delle voci (una sola fonte di verità).
 *
 * Le DOMANDE e le RISPOSTE non vivono qui: stanno nel registro modificabile
 * `src/data/editableTexts.ts` (chiavi `faq.<slug>.domanda` / `faq.<slug>.risposta`),
 * così il VISUAL EDITOR della DEV Toolbar (solo sviluppo, §26.37) le cambia al volo.
 * Qui c'è l'ELENCO: quale voce, con quale ancora HTML, in quale ordine.
 *
 * Superfici cablate — STESSO elenco, STESSO testo, zero doppioni:
 *   · `src/pages/FAQPage.tsx`   → pagina pubblica `/faq`;
 *   · `src/pages/PrezziPage.tsx` → sezione «Domande frequenti» di `/prezzi` (modulo 🔒:
 *     il cablaggio della sola sezione FAQ è stato autorizzato il 2026-09-29).
 *
 * L'ancora `#animatore-digitale` è PUBBLICA e linkata da fuori (`AuthModal` →
 * `NotaAccessoScolastico`, `OAuthBounceModal`): NON va rinominata. Le altre ancore sono
 * di comodo, ma restano stabili perché `/prezzi#<slug>` ci punta come `/faq#<slug>`.
 *
 * Modulo PURO: nessun import di React, nessun accesso a storage, nessuna copy.
 */
import type { ChiaveTesto } from './editableTexts';

export interface VoceFaq {
  /** Ancora HTML della voce (`#animatore-digitale` è pubblica). */
  id: string;
  /** Chiave della domanda nel registro testi. */
  q: ChiaveTesto;
  /** Chiave della risposta nel registro testi. */
  a: ChiaveTesto;
}

/**
 * Ordine di lettura (8 voci): prima il posizionamento (cosa fa il Radar, come si attiva
 * nella scuola, cosa fare con l'email scolastica), poi l'offerta (passaparola «Invita un
 * Collega», pagamento, piano, regalo), infine lo strumento incluso (PureFocus).
 *
 * VOCE EDITORIALE (29/09/2026): restano solo domande pratiche con risposta positiva. Uscite
 * le voci difensive (disdette, sicurezza dei pagamenti) e i rimandi a funzioni non attive
 * (generatore CV, Archivista AI, Tabelle A/B del D.P.R. 19/2016): con esse sono uscite le
 * ancore `#cv-non-pronto`, `#classi-di-concorso`, `#modulo-introvabile`, `#dubbio-norma`,
 * che non erano linkate da nessuna parte. L'unica ancora PUBBLICA resta `#animatore-digitale`.
 */
export const FAQ_PUBBLICHE: readonly VoceFaq[] = [
  { id: 'radar-personalizzati', q: 'faq.radar-personalizzati.domanda', a: 'faq.radar-personalizzati.risposta' },
  { id: 'animatore-digitale', q: 'faq.animatore-digitale.domanda', a: 'faq.animatore-digitale.risposta' },
  { id: 'accesso-google-edu', q: 'faq.accesso-google-edu.domanda', a: 'faq.accesso-google-edu.risposta' },
  { id: 'invita-un-collega', q: 'faq.invita-un-collega.domanda', a: 'faq.invita-un-collega.risposta' },
  { id: 'carta-docente', q: 'faq.carta-docente.domanda', a: 'faq.carta-docente.risposta' },
  { id: 'piano-conveniente', q: 'faq.piano-conveniente.domanda', a: 'faq.piano-conveniente.risposta' },
  { id: 'regala-pro-collega', q: 'faq.regala-pro-collega.domanda', a: 'faq.regala-pro-collega.risposta' },
  { id: 'purefocus-gmail', q: 'faq.purefocus-gmail.domanda', a: 'faq.purefocus-gmail.risposta' },
];
