/**
 * ScuoleRadar.it — Dipartimento Radar Scuole (interpelli).
 *
 * Punto di ingresso pubblico del dipartimento: il resto dell'app (router,
 * pagine, modali globali) importa SOLO da qui, mai dai file interni.
 *
 * Superficie esposta:
 *  - `RadarWizardModal`         → wizard di configurazione a 4 passi (modale globale)
 *  - `PreferenzeRadar`          → bacheca preferenze (dashboard)
 *  - `RadarStatusToggle`        → stato/pausa del Radar + CTA PRO
 *  - `FlightBoardInterpelli`    → «Radar Live» della homepage (tavola aeroporto)
 *  - `SimulatorRadar`           → simulatore pubblico provincia + classe
 *  - `BenvenutoProRadar`        → benvenuto/congratulazioni al primo accesso PRO
 *
 * La logica interna (etichette di riga, valutazione della configurazione,
 * costanti del wizard) resta incapsulata nelle sottocartelle del dipartimento.
 */
export { RadarWizardModal } from './RadarWizardModal';
export { PreferenzeRadar } from './PreferenzeRadar';
export { RadarStatusToggle } from './RadarStatusToggle';
export { FlightBoardInterpelli } from './FlightBoardInterpelli';
export { SimulatorRadar } from './SimulatorRadar';
export { BenvenutoProRadar } from './components/BenvenutoProRadar';
