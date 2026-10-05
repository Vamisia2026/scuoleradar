/**
 * ScuoleRadar — COORDINATE dei capoluoghi di provincia (dati, una sola fonte).
 *
 * Servono a UNA regola di prodotto (`Modalità 4 — Provincia`): la bacheca cerca
 * anche le province entro il raggio di 60 km e le mostra con una **grossa
 * penalità**; oltre il raggio l'avviso è **escluso d'ufficio**.
 *
 * Precisione: coordinate del CAPOLUOGO arrotondate a 2 decimali (≈ 1 km), tratte
 * dalle coordinate pubbliche delle voci di Wikipedia dei comuni capoluogo. La
 * soglia dei 60 km fra capoluoghi è la lettura convenzionale di «province nel
 * raggio»: la distanza è in linea d'aria (Haversine), non un percorso stradale e
 * non la geometria del confine amministrativo. Se in futuro arriverà un dataset
 * ISTAT/IGM più preciso, si sostituiscono SOLO i valori di questo file.
 *
 * La mappa pubblica `coordinateProvince`, i codici sono quelli di
 * `src/data/province.ts` (2 lettere, maiuscole).
 */
export interface CoordinataProvincia {
  /** Latitudine in gradi decimali (WGS84). */
  lat: number;
  /** Longitudine in gradi decimali (WGS84). */
  lng: number;
}

export const coordinateProvince: Readonly<Record<string, CoordinataProvincia>> = {
  AG: { lat: 37.31, lng: 13.58 },
  AL: { lat: 44.91, lng: 8.62 },
  AN: { lat: 43.62, lng: 13.52 },
  AO: { lat: 45.74, lng: 7.32 },
  AP: { lat: 42.85, lng: 13.58 },
  AQ: { lat: 42.35, lng: 13.39 },
  AR: { lat: 43.46, lng: 11.88 },
  AT: { lat: 44.9, lng: 8.21 },
  AV: { lat: 40.92, lng: 14.79 },
  BA: { lat: 41.13, lng: 16.87 },
  BG: { lat: 45.7, lng: 9.67 },
  BI: { lat: 45.57, lng: 8.05 },
  BL: { lat: 46.14, lng: 12.22 },
  BN: { lat: 41.13, lng: 14.78 },
  BO: { lat: 44.49, lng: 11.34 },
  BR: { lat: 40.64, lng: 17.95 },
  BS: { lat: 45.54, lng: 10.22 },
  BT: { lat: 41.23, lng: 16.31 },
  BZ: { lat: 46.5, lng: 11.35 },
  CA: { lat: 39.22, lng: 9.12 },
  CB: { lat: 41.56, lng: 14.67 },
  CE: { lat: 41.07, lng: 14.33 },
  CH: { lat: 42.35, lng: 14.17 },
  CL: { lat: 37.49, lng: 14.06 },
  CN: { lat: 44.38, lng: 7.55 },
  CO: { lat: 45.81, lng: 9.09 },
  CR: { lat: 45.13, lng: 10.02 },
  CS: { lat: 39.3, lng: 16.25 },
  CT: { lat: 37.5, lng: 15.09 },
  CZ: { lat: 38.91, lng: 16.59 },
  EN: { lat: 37.57, lng: 14.27 },
  FC: { lat: 44.22, lng: 12.04 },
  FE: { lat: 44.84, lng: 11.62 },
  FG: { lat: 41.46, lng: 15.55 },
  FI: { lat: 43.77, lng: 11.25 },
  FM: { lat: 43.16, lng: 13.72 },
  FR: { lat: 41.63, lng: 13.35 },
  GE: { lat: 44.41, lng: 8.93 },
  GO: { lat: 45.94, lng: 13.62 },
  GR: { lat: 42.77, lng: 11.11 },
  IM: { lat: 43.89, lng: 8.03 },
  IS: { lat: 41.6, lng: 14.24 },
  KR: { lat: 39.08, lng: 17.12 },
  LC: { lat: 45.85, lng: 9.39 },
  LE: { lat: 40.35, lng: 18.17 },
  LI: { lat: 43.55, lng: 10.32 },
  LO: { lat: 45.32, lng: 9.5 },
  LT: { lat: 41.47, lng: 12.9 },
  LU: { lat: 43.85, lng: 10.52 },
  MB: { lat: 45.58, lng: 9.27 },
  MC: { lat: 43.3, lng: 13.45 },
  ME: { lat: 38.19, lng: 15.55 },
  MI: { lat: 45.47, lng: 9.19 },
  MN: { lat: 45.16, lng: 10.79 },
  MO: { lat: 44.65, lng: 10.93 },
  MS: { lat: 44.03, lng: 10.14 },
  MT: { lat: 40.67, lng: 16.6 },
  NA: { lat: 40.84, lng: 14.25 },
  NO: { lat: 45.45, lng: 8.62 },
  NU: { lat: 40.32, lng: 9.33 },
  OR: { lat: 39.91, lng: 8.59 },
  PA: { lat: 38.12, lng: 13.36 },
  PC: { lat: 45.05, lng: 9.7 },
  PD: { lat: 45.41, lng: 11.87 },
  PE: { lat: 42.46, lng: 14.21 },
  PG: { lat: 43.11, lng: 12.39 },
  PI: { lat: 43.72, lng: 10.4 },
  PN: { lat: 45.96, lng: 12.66 },
  PR: { lat: 44.8, lng: 10.33 },
  PT: { lat: 43.93, lng: 10.92 },
  PU: { lat: 43.91, lng: 12.91 },
  PV: { lat: 45.19, lng: 9.15 },
  PO: { lat: 43.88, lng: 11.1 },
  RG: { lat: 36.93, lng: 14.73 },
  RA: { lat: 44.42, lng: 12.2 },
  RC: { lat: 38.11, lng: 15.65 },
  RE: { lat: 44.7, lng: 10.63 },
  RI: { lat: 42.4, lng: 12.86 },
  RN: { lat: 44.06, lng: 12.57 },
  RM: { lat: 41.89, lng: 12.48 },
  RO: { lat: 45.08, lng: 11.79 },
  SA: { lat: 40.68, lng: 14.76 },
  SI: { lat: 43.32, lng: 11.33 },
  SO: { lat: 46.17, lng: 9.87 },
  SP: { lat: 44.11, lng: 9.83 },
  SR: { lat: 37.07, lng: 15.29 },
  SS: { lat: 40.73, lng: 8.56 },
  SU: { lat: 39.17, lng: 8.52 },
  SV: { lat: 44.31, lng: 8.48 },
  TA: { lat: 40.47, lng: 17.24 },
  TE: { lat: 42.66, lng: 13.7 },
  TN: { lat: 46.07, lng: 11.12 },
  TO: { lat: 45.08, lng: 7.68 },
  TP: { lat: 38.02, lng: 12.52 },
  TR: { lat: 42.56, lng: 12.65 },
  TS: { lat: 45.65, lng: 13.77 },
  TV: { lat: 45.67, lng: 12.25 },
  UD: { lat: 46.07, lng: 13.23 },
  VA: { lat: 45.82, lng: 8.83 },
  VB: { lat: 45.92, lng: 8.55 },
  VC: { lat: 45.33, lng: 8.42 },
  VE: { lat: 45.44, lng: 12.33 },
  VI: { lat: 45.55, lng: 11.55 },
  VR: { lat: 45.44, lng: 10.99 },
  VT: { lat: 42.42, lng: 12.1 },
  VV: { lat: 38.68, lng: 16.1 },
};
