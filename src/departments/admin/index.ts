/**
 * ScuoleRadar.it — Dipartimento Admin (pannello operativo).
 *
 * Punto di ingresso pubblico del dipartimento: pagine e componenti dell'app
 * importano **solo** da qui, mai dai file interni.
 *
 * Contenuto:
 *  - `AdminTabs` (tab Utenti / Radar / Account) → oggi `tabs/` (un file per tab);
 *  - `AdminAccessModal`                          → accesso riservato (Google/password);
 *  - `adminService`                              → API del pannello (Edge `admin`);
 *  - `adminUi`                                   → primitive UI del pannello;
 *  - `types`                                     → contratto dati + whitelist ADMIN_EMAILS.
 *
 * Il pannello è montato dalla pagina `/admin` (`src/pages/AdminPage.tsx`), che
 * resta un wrapper sottile come per gli altri dipartimenti.
 */
export { TabUtenti } from './tabs/utenti/TabUtenti';
export { TabRadar } from './tabs/TabRadar';
export { TabAccount } from './tabs/TabAccount';
export { TabDipartimenti } from './components/TabDipartimenti';
export { TabEmailAutomazioni } from './components/TabEmailAutomazioni';
export { AdminAccessModal } from './AdminAccessModal';
export { AdminApiError, DEV, aggiornaUtente, caricaUtenti, creaUtente, eliminaUtente, inviaResetPassword, tokenAdmin } from './adminService';
export { BadgeBeta, BadgePiano, BadgePianoCompatto, Chips, ConfermaDialog, StatoRadarBadge, btnAdmin, btnDanger, btnGhost, btnPrim, inputAdmin, nomeCognome } from './adminUi';
export { ADMIN_EMAILS, STORAGE_KEY_ADMIN_REDIRECT, dataItaliana } from './types';
export type { AdminUtente, TabAdmin } from './types';
export type { ConfermaStato } from './adminUi';
