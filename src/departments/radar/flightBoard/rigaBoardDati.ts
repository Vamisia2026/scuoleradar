/**
 * ScuoleRadar.it — Dipartimento Radar · DATI DERIVATI di una riga del tabellone
 * «Radar Live» (`FlightBoardInterpelli`).
 *
 * Da una riga di `interpelli` alle informazioni che la tavola mostra ma il
 * database non contiene: la tipologia (classe di concorso o categoria), la
 * banda di urgenza/anzianità della scadenza e le date brevi. Nessun rendering,
 * nessuna rete, nessuno stato: il JSX sta in `components/RigaBoard.tsx`.
 *
 * Estratto da `flightBoard/rigaBoard.tsx` per il limite di 250 righe/file
 * (`.clinerules` §3): etichette, soglie e rami sono INVARIATI — nessun
 * cambiamento visibile, solo la separazione fra dati e presentazione.
 *
 * Regola di prodotto: la cella «Scadenza» mostra la scadenza vera quando c'è,
 * altrimenti la data di PUBBLICAZIONE dichiarata («Pubblicato 12 set») — mai una
 * data inventata; un avviso senza scadenza è urgente in base alla sua età.
 */
import { calcolaUrgenza } from '@/lib/urgency';
import { materiaClasse } from '@/data/classiConcorso';
import type { InterpelloLive } from './righeBoard';

/** Data breve `it-IT` («12 set») da una stringa ISO; stringa vuota se assente o non valida. */
export function dataItBreve(iso?: string | null): string {
  const s = (iso ?? '').trim();
  if (!s) return '';
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

/** Calcola l'urgenza o l'equivalente basato sull'età per gli avvisi senza scadenza esplicita. */
export function ottieniUrgenzaOAnzianita(expirationDate?: string | null, createdAt?: string | null) {
  if (expirationDate) {
    return calcolaUrgenza(expirationDate);
  }

  if (createdAt) {
    const pub = new Date(createdAt.length <= 10 ? `${createdAt}T00:00:00` : createdAt);
    if (!Number.isNaN(pub.getTime())) {
      const diffGiorni = (Date.now() - pub.getTime()) / (1000 * 60 * 60 * 24);
      if (diffGiorni <= 30) {
        return {
          label: 'In corso',
          className: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
        };
      } else if (diffGiorni <= 44) {
        return {
          label: `Scade tra ${Math.round(60 - diffGiorni)}g`,
          className: 'bg-amber-100 text-amber-800 border border-amber-200',
        };
      } else {
        return {
          label: `Scade tra ${Math.round(60 - diffGiorni)}g`,
          className: 'bg-rose-100 text-rose-800 border border-rose-200',
        };
      }
    }
  }

  return {
    label: 'In corso',
    className: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  };
}

/** Determina la tipologia o categoria dal titolo o dai codici se mancanti (es. ATA, Sostegno, Comune). */
export function inferisciTipologia(r: InterpelloLive): { codice: string; descrizione: string | null } {
  const codiceGrezzo = r.class_codes?.[0]?.trim();
  if (codiceGrezzo) {
    const desc = materiaClasse(codiceGrezzo, r.materia);
    return { codice: codiceGrezzo, descrizione: desc };
  }

  const testo = `${r.title} ${r.materia ?? ''}`.toLowerCase();
  if (testo.includes('ata') || testo.includes('collaboratore scolastico') || testo.includes('assistente amministrativo') || testo.includes('cs') || testo.includes('aa')) {
    return { codice: 'ATA', descrizione: 'Personale ATA / Servizi Generali' };
  }
  if (testo.includes('sostegno') || testo.includes('adsu') || testo.includes('adee') || testo.includes('adaa')) {
    return { codice: 'SOSTEGNO', descrizione: 'Posto di Sostegno' };
  }
  if (testo.includes('educativo') || testo.includes('educatore')) {
    return { codice: 'EDUC', descrizione: 'Personale Educativo' };
  }

  return { codice: 'INTERPELLO', descrizione: 'Avviso di Reclutamento' };
}
