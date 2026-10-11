/**
 * ScuoleRadar.it — Dipartimento Radar · DATI DERIVATI di una riga del tabellone
 * «Radar Live» (`FlightBoardInterpelli`).
 *
 * Da una riga di `interpelli` alle informazioni che la tavola mostra ma il
 * database non contiene: la tipologia (classe di concorso o categoria), la
 * banda di urgenza basata ESCLUSIVAMENTE sulla scadenza e le date brevi.
 * Nessun rendering, nessuna rete, nessuno stato: il JSX sta in `components/RigaBoard.tsx`.
 */
import { materiaClasse } from '@/data/classiConcorso';
import { 
  type InterpelloLive, 
  livelloUrgenza, 
  coloreUrgenza, 
  etichettaUrgenza, 
  normalizzaDataScadenza,
  type Urgenza,
  type ColoreUrgenza 
} from './righeBoard';

/** Data breve `it-IT` («12 set») da una stringa ISO; stringa vuota se assente o non valida. */
export function dataItBreve(iso?: string | null): string {
  const s = (iso ?? '').trim();
  if (!s) return '';
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

/** Mappa il livello di urgenza e le classi CSS per il colour coding (Verde, Giallo, Rosso). */
export function ottieniUrgenzaOAnzianita(expirationDate?: string | null, createdAt?: string | null) {
  // Costruiamo un oggetto fittizio compatibile con le funzioni pure di righeBoard.ts
  const rigaTemp: InterpelloLive = {
    id: '',
    title: '',
    school_name: null,
    province: '',
    class_codes: null,
    materia: null,
    expiration_date: expirationDate ?? null,
    created_at: createdAt ?? null,
  };

  const livello = livelloUrgenza(rigaTemp);
  const colore = coloreUrgenza(livello);
  const etichetta = etichettaUrgenza(rigaTemp);

  let className = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';

  switch (colore) {
    case 'verde':
      className = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      break;
    case 'giallo':
      className = 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold';
      break;
    case 'rosso':
      className = 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold';
      break;
    case 'grigio':
      // Se non c'è scadenza ma abbiamo la data di creazione, mostriamo la pubblicazione in modo neutro
      if (createdAt) {
        return {
          label: `Pubblicato ${dataItBreve(createdAt)}`,
          className: 'bg-slate-800 text-slate-300 border border-slate-700',
        };
      }
      className = 'bg-slate-800 text-slate-300 border border-slate-700';
      break;
  }

  return {
    label: etichetta,
    className,
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