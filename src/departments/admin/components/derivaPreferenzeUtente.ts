/**
 * Dipartimento Admin · PREFERENZE dell'utente, derivate in CHIARO (funzione pura).
 *
 * Una sola derivazione per tutte le superfici Admin che mostrano le regole del
 * Radar (scheda di dettaglio del tab «Utenti» e card del tab «Radar»): gli ORDINI
 * di scuola si risolvono nel nome leggibile (`ordiniScuola`), le COMPETENZE di
 * catalogo (`materie_id`) nel nome della materia — la stessa risoluzione della
 * vista utente e del motore (`etichetteCompetenzeProfilo`) — e i TAG personalizzati
 * (`materie_custom`) restano il testo scritto dall'utente.
 *
 * NB: il nome del file NON può differire dal componente `PreferenzeUtente.tsx`
 * solo per il maiuscolo (Windows non distingue il casing): da qui `deriva…`.
 */
import { ordiniScuola } from '@/data/ordiniMaterie';
import { etichetteCompetenzeProfilo } from '@/lib/matchingEngine';
import { materieDelleClassi } from '@/lib/materieClassi';
import type { AdminUtente } from '../types';

/** Preferenze Radar di un utente, già risolte in etichette leggibili. */
export interface PreferenzeUtenteAdmin {
  /** Nomi leggibili degli ordini di scuola scelti. */
  ordini: string[];
  /** Classi di concorso (codici: `A-22`, `ADEE`, …). */
  classi: string[];
  /**
   * DISCIPLINE coperte dalle classi di concorso scelte (derivate: A-22 → Italiano,
   * Latino, …). Non sono un dato del profilo ma una lettura del catalogo.
   */
  materieClassi: string[];
  /** Materie/competenze di catalogo, risolte nel nome della materia. */
  materie: string[];
  /** Tag personalizzati: il testo digitato dall'utente. */
  tag: string[];
  /** Province di interesse (o `province_attive` come ripiego storico). */
  province: string[];
  scuolePreferite: string[];
  scuoleEscluse: string[];
}

export function preferenzeUtenteAdmin(u: AdminUtente): PreferenzeUtenteAdmin {
  return {
    ordini: (u.ordini_scuola ?? []).map((id) => ordiniScuola.find((o) => o.id === id)?.nome ?? id),
    classi: u.classi_concorso ?? [],
    materieClassi: materieDelleClassi(u.classi_concorso),
    materie: etichetteCompetenzeProfilo({ materieId: u.materie_id }),
    tag: u.materie_custom ?? [],
    province: u.province_interesse ?? u.province_attive ?? [],
    scuolePreferite: u.favorite_schools ?? [],
    scuoleEscluse: u.ignored_schools ?? [],
  };
}
