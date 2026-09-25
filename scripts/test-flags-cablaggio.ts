/**
 * Test — CABLAGGIO delle FEATURE FLAGS nei punti reali dell'app (UI, rotte, pannelli).
 *
 * Estratto da `test-feature-flags.ts` (che resta la guardia COMPORTAMENTALE su
 * store, visibilità e gate notifiche): qui si verifica che i file che decidono
 * cosa vede l'utente usino DAVVERO le flag — navbar desktop e mobile, tab della
 * dashboard, menu utente, superfici pubbliche (landing, servizi, footer, vetrina,
 * profilo, schede avviso), redirect post-login/onboarding, guardie di rotta e
 * pannelli Admin/DEV.
 *
 * Invariante di produzione: con i default del codice e senza override, queste
 * superfici non mostrano NESSUN dipartimento chiuso a un utente non admin
 * (`test-feature-flags.ts` verifica anche la superficie pubblica esatta).
 *
 * Uso: `npm run test:flags` (e la catena `npm test`)
 */
import { readFileSync } from 'node:fs';

/** Interfaccia minima per l'ambiente (come gli altri script di test). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Contenuto di un file del repo (invarianti di cablaggio). */
const leggi = (percorso: string): string => readFileSync(percorso, 'utf8');

console.log('— Cablaggio di UI, rotte e pannelli —');
/** [file, nome del controllo, frammenti che DEVONO comparire nel sorgente]. */
const soggetti: [string, string, string[]][] = [
  ['src/lib/resend.ts', 'gate email nei 3 invii automatici', ['recapitoEmailAmmesso', 'gateEmail']],
  ['src/lib/telegram.ts', 'gate Telegram nel punto unico di invio', ['gateTelegram', "gateTelegram('radar'"]],
  ['supabase/functions/send-notification/index.ts', 'gate nella Edge Function', ['recapitoAmmesso', 'FEATURE_RADAR']],
  ['src/components/FeatureGate.tsx', 'guardia di rotta', ['ModuloInManutenzione', 'useFeatureFlags']],
  ['src/components/header/BarraStrumenti.tsx', 'navbar desktop filtrata', ['useFeatureFlags', 'visibile(l.modulo)']],
  ['src/components/header/MenuMobile.tsx', 'menu mobile filtrato', ['useFeatureFlags', 'visibile(l.modulo)']],
  ['src/components/header/MenuUtente.tsx', 'menu utente: nessun link a un modulo chiuso', ['useFeatureFlags', "visibile('modulistica')"]],
  ['src/hooks/useFeatureFlags.ts', 'visibilità reattiva allo snapshot sottoscritto', ['override,', 'dipartimentoVisibile(id, {']],
  ['src/pages/dashboard/components/DashboardLayout.tsx', 'tab dashboard filtrate', ['visibile(t.modulo)', 'modulo:']],
  ['src/config/features.ts', 'persistenza degli override in localStorage', ['STORAGE_KEY_FLAG_DIPARTIMENTI', 'setItem(STORAGE_KEY_FLAG_DIPARTIMENTI']],
  ['src/components/DevToolbar.tsx', 'toggle OFF | TEST | ON dentro la DEV Toolbar', ['FlagDipartimentiPanel', 'variante="lista"', 'FlagDipartimentiProva', 'impostaStato']],
  ['src/components/FlagDipartimentiPanel.tsx', 'selettore riusabile (Admin card + DEV lista)', ['SelettoreStati', 'aria-pressed', "variante === 'lista'"]],
  ['src/components/FlagDipartimentiProva.tsx', 'prova live: navbar + chiave localStorage', ['visibile(d.id)', 'leggiSalvato', 'verificaScrittura']],
  ['src/departments/admin/components/TabDipartimenti.tsx', 'tab Admin dei dipartimenti', ['FlagDipartimentiPanel', 'FEATURE_']],
  // Superfici PUBBLICHE: un modulo `off` non deve restare «in chiaro» sul sito.
  ['src/components/landing/LandingStrumenti.tsx', 'landing: griglia strumenti filtrata', ['useFeatureFlags', 'visibile(s.modulo)']],
  ['src/pages/LandingPage.tsx', 'landing: bacheca radar e CTA finali sotto flag', ['<LandingStrumenti', "visibile('radar') && <FlightBoardInterpelli"]],
  ['src/data/servizi.ts', 'catalogo servizi con modulo di riferimento', ["modulo: 'radar'", 'serviziVisibili']],
  ['src/pages/ServiziPage.tsx', 'griglia servizi filtrata', ['serviziVisibili(visibile)']],
  ['src/components/Footer.tsx', 'footer pubblico filtrato', ['serviziVisibili(visibile)']],
  ['src/pages/ServizioPage.tsx', 'pagina servizio non raggiungibile se OFF', ['servizio.modulo && !visibile(servizio.modulo)']],
  ['src/components/VetrinaModal.tsx', 'vetrina freemium: scheda solo se visibile', ["modulo: 'modulistica'", 'visibile(selezionato.modulo)']],
  ['src/components/profile/ModuliScaricati.tsx', 'profilo/Documenti: nessun rimando a Modulistica spenta', ["visibile('modulistica')"]],
  ['src/pages/interpello/components/AvvisoAssente.tsx', 'scheda avviso: CTA radar filtrata', ["visibile('radar')"]],
  ['src/pages/interpello/components/SchedaAvviso.tsx', 'avviso: ritorno al radar filtrato', ["visibile('radar')"]],
  ['src/pages/CheckoutRedirectPage.tsx', 'checkout: ritorno alla prima sezione disponibile', ['primaRottaVisibile()']],
  ['src/components/AuthModal.tsx', 'post-login: prima sezione disponibile', ['primaRottaVisibile()']],
  ['src/pages/onboarding/OnboardingPage.tsx', 'post-onboarding: prima sezione disponibile', ['primaRottaVisibile()']],
  ['src/pages/dashboard/components/ReindirizzaDipartimentoPrincipale.tsx', 'atterraggio dashboard dall\'hook (fonte unica)', ['primaRottaVisibile()']],
  ['src/config/features.ts', 'sincronizzazione TRA SCHEDE (evento storage)', ["addEventListener('storage'", 'attivaAscoltoStorage']],
];
for (const [file, nome, attesi] of soggetti) {
  const sorgente = leggi(file);
  check(nome, true, attesi.every((frammento) => sorgente.includes(frammento)));
}
const app = leggi('src/App.tsx');
// 7 guardie: cfu (pagina pubblica + sezione dashboard), radar, cv, moduli, purefocus, invita.
check('App.tsx: FeatureGate su ogni dipartimento', 7, app.split('<FeatureGate modulo=').length - 1);
check('App.tsx: atterraggio dinamico della dashboard', true, app.includes('ReindirizzaDipartimentoPrincipale'));

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ Cablaggio feature flags: tutti i controlli superati.'
    : `\n❌ ${errori} controllo/i fallito/i.`,
);
