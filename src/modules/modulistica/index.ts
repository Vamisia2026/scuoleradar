/**
 * ScuoleRadar.it — Modulo Modulistica (architettura isolata).
 *
 * Punto di ingresso pubblico del modulo:
 *  - `ModuliModule` è il contenitore che combina l'archivio (`components/`)
 *    e il creatore dinamico (`creator/`, protetto da Error Boundary).
 *
 * La logica interna (cache, pdfGenerator, engine) resta incapsulata nel modulo
 * e non è esposta all'esterno.
 */
export { ModuliModule } from './ModuliModule';
export type { ModuloSalvatoDB, VistaModulistica, VoceModulo } from './types';
