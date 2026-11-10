/**
 * ScuoleRadar.it — COME SI DICONO I NUMERI DEL BANNER (§26.149 · §26.150 · §26.151).
 *
 * Scrittura orientata alla serenità dell'utente: zero gergo da sistemista, zero allarmismi
 * inutili e frasi chiare che spiegano il valore del lavoro svolto dal radar.
 */
import { TITOLO_STANDBY, fraseStandby } from './finestraScansione';

export interface MisuraScansione {
  etichetta: string;
  valore: string;
}

export function migliaia(valore: number): string {
  return String(valore).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function almenoCentinaia(valore: number): string {
  if (!Number.isFinite(valore) || valore < 200) return migliaia(valore);
  return `${migliaia(Math.floor(valore / 100) * 100)}+`;
}

export function fraseBacheche(n: number | null): string | null {
  if (n === null || n === 0) return null;
  return n === 1
    ? '1 bacheca scolastica analizzata nelle ultime 24 ore'
    : `${migliaia(n)} bacheche scolastiche analizzate nelle ultime 24 ore`;
}

export function fraseScartati(n: number | null): string | null {
  if (n === null || n === 0) return null;
  return n === 1
    ? '1 avviso scartato perché non pertinente'
    : `${migliaia(n)} avvisi scartati perché non pertinenti`;
}

export function frasePosizioni(n: number | null): string | null {
  if (n === null || n === 0) return null;
  return n === 1 ? '1 posizione selezionata' : `${almenoCentinaia(n)} posizioni selezionate`;
}

export interface DatiBanner {
  controllo: string | null;
  trascorso: string | null;
  bacheche: number | null;
  scartati: number | null;
  posizioni: number | null;
  province: number | null;
  adesso: Date;
}

export interface TestiBanner {
  badge: string;
  titolo: string;
  dettaglio: string;
}

function dettaglioLavoro(d: DatiBanner): string {
  const parti = [fraseBacheche(d.bacheche), fraseScartati(d.scartati)].filter(
    (p): p is string => Boolean(p),
  );
  const ultimo = d.controllo ? `Ultimo controllo: ${d.controllo}.` : '';
  const corpo = parti.length > 0 ? `${maiuscola(parti.join(' · '))}.` : '';
  return (
    [ultimo, corpo].filter(Boolean).join(' ') ||
    'Il radar è attivo e pronto a catturare le nuove opportunità pubblicate.'
  );
}

export function compilaMisure(d: DatiBanner): readonly MisuraScansione[] {
  const misure: MisuraScansione[] = [];
  if (d.bacheche !== null && d.bacheche > 0) {
    misure.push({ etichetta: 'Bacheche controllate', valore: migliaia(d.bacheche) });
  }
  if (d.scartati !== null && d.scartati > 0) {
    misure.push({ etichetta: 'Avvisi scartati per te', valore: migliaia(d.scartati) });
  }
  if (d.posizioni !== null && d.posizioni > 0) {
    misure.push({ etichetta: 'Posizioni selezionate', valore: almenoCentinaia(d.posizioni) });
  }
  return misure;
}

export function testiInDiretta(d: DatiBanner): TestiBanner {
  const posizioni = frasePosizioni(d.posizioni);
  return {
    badge: 'IN DIRETTA',
    titolo: posizioni
      ? `Scansione completata · ${posizioni} pronte per te`
      : 'Scansione completata in questo momento',
    dettaglio: dettaglioLavoro(d),
  };
}

export function testiOperativo(d: DatiBanner): TestiBanner {
  return {
    badge: 'OPERATIVO',
    titolo:
      d.province === null
        ? 'Radar in ascolto sulle bacheche ufficiali'
        : `Radar in ascolto attivo su ${d.province} province`,
    dettaglio: dettaglioLavoro(d),
  };
}

export function testiInAttesa(d: DatiBanner): TestiBanner {
  return {
    badge: 'IN ASCOLTO',
    titolo: d.controllo ? `Ultimo controllo: ${d.controllo}` : 'Radar pronto per il prossimo ciclo',
    dettaglio: 'Monitoriamo costantemente i portali delle scuole negli orari di pubblicazione dei bandi.',
  };
}

export function testiAvvio(): TestiBanner {
  return {
    badge: 'IN INIZIALIZZAZIONE',
    titolo: 'Radar in avvio',
    dettaglio:
      'Il sistema sta allineando i dati della tua zona. Di seguito trovi le opportunità già disponibili in archivio.',
  };
}

export function testiStandby(d: DatiBanner): TestiBanner {
  const ultimo = d.controllo ? `Ultimo controllo: ${d.controllo}.` : '';
  return {
    badge: 'IN STANDBY',
    titolo: TITOLO_STANDBY,
    dettaglio: [
      fraseStandby(d.adesso) ?? 'Prossimo controllo automatico alla riapertura delle bacheche scolastiche.',
      ultimo,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

export const maiuscola = (testo: string): string => testo.charAt(0).toUpperCase() + testo.slice(1);
