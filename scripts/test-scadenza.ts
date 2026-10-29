/**
 * TEST — Semaforo SCADENZA + filtro "attivo" (helper condiviso `src/lib/scadenza.ts`).
 * Esecuzione: npm run test:interpello-scadenza
 */

import {
  GIORNI_FINESTRA_SENZA_SCADENZA,
  eAvvisoVivo,
  eInterpelloAttivo,
  eScaduto,
  giorniRimanenti,
} from '../src/lib/scadenza.ts';
import { SOGLIA_ARANCIO, SOGLIA_ROSSO, eTermineProssimo, stileScadenza } from '../src/lib/scadenzaSemaforo.ts';

declare const process: { exitCode?: number };

let falliti = 0;
function check(descrizione: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) {
    falliti += 1;
    console.log(`  ✗ ${descrizione}\n      atteso: ${JSON.stringify(atteso)}\n      ottenuto: ${JSON.stringify(ottenuto)}`);
  } else {
    console.log(`  ✓ ${descrizione}`);
  }
}

// OGGI fisso per test deterministici: 2026-09-10.
const OGGI = new Date('2026-09-10T12:00:00');

console.log('──────────────────────────────────────────────────────────');
console.log('🧪 TEST SCADENZA (giorni, semaforo, filtro attivo)');
console.log('──────────────────────────────────────────────────────────');

console.log('\n— giorniRimanenti —');
check('oggi → 0', 0, giorniRimanenti('2026-09-10', OGGI));
check('domani → 1', 1, giorniRimanenti('2026-09-11', OGGI));
check('tra 10 giorni → 10', 10, giorniRimanenti('2026-09-20', OGGI));
check('ieri → -1', -1, giorniRimanenti('2026-09-09', OGGI));
check('ISO con orario', 2, giorniRimanenti('2026-09-12T23:00:00+00:00', OGGI));
check('assente → null', null, giorniRimanenti(null, OGGI));
check('invalida → null', null, giorniRimanenti('non-una-data', OGGI));

console.log('\n— eScaduto / eInterpelloAttivo —');
check('scaduto ieri → true', true, eScaduto('2026-09-09', OGGI));
check('oggi → false (non scaduto)', false, eScaduto('2026-09-10', OGGI));
check('futuro → false', false, eScaduto('2026-09-30', OGGI));
check('attivo: futuro → true', true, eInterpelloAttivo('2026-09-30', OGGI));
check('attivo: oggi → true', true, eInterpelloAttivo('2026-09-10', OGGI));
check('attivo: scaduto → false', false, eInterpelloAttivo('2026-08-01', OGGI));
check('attivo: senza data → true', true, eInterpelloAttivo(null, OGGI));

console.log('\n— eAvvisoVivo: finestra dei 60 giorni per chi non data la scadenza —');
check('finestra dichiarata: 60 giorni', 60, GIORNI_FINESTRA_SENZA_SCADENZA);
check('con scadenza futura → vivo', true, eAvvisoVivo('2026-09-30', null, OGGI));
check('con scadenza oggi → vivo', true, eAvvisoVivo('2026-09-10', null, OGGI));
check('con scadenza passata → NON vivo', false, eAvvisoVivo('2026-08-01', null, OGGI));
check(
  'con scadenza futura la pubblicazione non conta → vivo',
  true,
  eAvvisoVivo('2026-09-30', '2020-01-01', OGGI),
);
check('senza scadenza, pubblicato 10 giorni fa → vivo', true, eAvvisoVivo(null, '2026-08-31', OGGI));
check('senza scadenza, al limite (60 giorni) → vivo', true, eAvvisoVivo(null, '2026-07-12', OGGI));
check(
  'senza scadenza, 61 giorni fa → NON vivo (fuori finestra)',
  false,
  eAvvisoVivo(null, '2026-07-11', OGGI),
);
check(
  'la finestra è per GIORNO (pubblicato a fine giornata del limite → vivo)',
  true,
  eAvvisoVivo(null, '2026-07-12T23:30:00Z', OGGI),
);
check('senza scadenza né pubblicazione → NON vivo', false, eAvvisoVivo(null, null, OGGI));
check('pubblicazione illeggibile → NON vivo', false, eAvvisoVivo(null, 'non-una-data', OGGI));
check('senza scadenza e stringa vuota → NON vivo', false, eAvvisoVivo('', '', OGGI));

console.log('\n— Semaforo a QUATTRO luci: rosso < 24h · arancio 24–72h · verde ≥ 3 gg · blu oltre l’orizzonte (§26.89, §26.100) —');
// Rosso = SOLO le prossime 24 ore. Arancio = azione richiesta (24–72 ore).
// Verde = c'è tempo, dentro la finestra di candidatura (3 … 15 giorni). Blu = la
// data esiste ma il termine è lungo (fine incarico, avvio progetto): è
// un'informazione ATTIVA, non un allarme. Ardesia media = scaduto o data assente,
// mai un nero (§26.100: il nero è il tono che il cliente ha chiesto di togliere).
check('soglia rossa = solo oggi', 0, SOGLIA_ROSSO);
check('soglia arancio = 2 giorni (72 ore)', 2, SOGLIA_ARANCIO);
check('in corso (10gg) → verde', 'in-corso', stileScadenza(10).livello);
check('in corso (10gg) label', 'In corso', stileScadenza(10).label);
check('in corso (3gg) → verde: dal terzo giorno c’è tempo', 'in-corso', stileScadenza(3).livello);
check('in corso (3gg) label', 'In corso', stileScadenza(3).label);
check('bordo finestra (15gg) → verde', 'in-corso', stileScadenza(15).livello);
check('oltre la finestra (16gg) → dichiarata', 'fuori-finestra', stileScadenza(16).livello);
check('oltre la finestra label', 'Scadenza lontana', stileScadenza(16).label);
check('2 giorni (48–72h) → arancio', 'urgente', stileScadenza(2).livello);
check('2 giorni (48–72h) label', 'Ultime 72h', stileScadenza(2).label);
check('domani (24–48h) → arancio', 'urgente', stileScadenza(1).livello);
check('domani (24–48h) label', 'Scade domani', stileScadenza(1).label);
check('oggi (< 24h) → ROSSO', 'critico', stileScadenza(0).livello);
check('oggi (< 24h) label', 'Scade oggi', stileScadenza(0).label);
check('scaduto → ardesia', 'scaduto', stileScadenza(-3).livello);
check('sconosciuto → n/d', 'sconosciuto', stileScadenza(null).livello);
check('verde: tinta satura emerald-700 (§26.100)', true, stileScadenza(10).className.includes('bg-emerald-700'));
check('luce media: arancio pieno orange-700 (§26.100)', true, stileScadenza(2).className.includes('bg-orange-700'));
check('rosso: tinta piena rose-600 (solo a 0 giorni)', true, stileScadenza(0).className.includes('bg-rose-600'));
check('oltre l’orizzonte: blu sky-700, mai ardesia', true, stileScadenza(30).className.includes('bg-sky-700'));
check('il rosso NON si estende a domani', false, stileScadenza(1).className === stileScadenza(0).className);
check('la luce media NON si estende al terzo giorno', false, stileScadenza(3).className === stileScadenza(2).className);
// §26.88, §26.100 — NESSUN giallo/ambra nel semaforo: a dieci pixel i gialli
// scuri sembravano torbidi e i gialli chiari non reggevano il bianco.
check(
  'nessun giallo/ambra fra le bande (la luce media è arancio)',
  [],
  [10, 5, 3, 2, 1, 0, 30, 16, -3, null]
    .map((g) => [g, stileScadenza(g as number | null).className] as const)
    .flatMap(([g, c]) => (c.match(/bg-(?:amber|yellow)-\d{3}/g) ?? []).map((t) => `${g}: ${t}`)),
);
check('nessuna banda pastello (…-100/…-200)', false, /-(?:50|100|200)\b/.test(stileScadenza(10).className + stileScadenza(2).className + stileScadenza(1).className));
check('senza scadenza → ardesia media, non un colore d’allarme', true, stileScadenza(null).className.includes('bg-slate-500'));
check('scaduto → ardesia media (mai nero)', true, stileScadenza(-3).className.includes('bg-slate-600'));
check('fuori finestra → blu, mai verde né ardesia', true, stileScadenza(30).className.includes('bg-sky-700'));
check('nessuna banda pulsa', false, [10, 2, 1, 0, -3, null].some((g) => stileScadenza(g as number | null).className.includes('animate-')));
// Etichetta BIANCA in grassetto su TUTTE le bande (§26.100): è il registro
// chiesto dal cliente e l'unico che regge AA con tinte sature (≥ 4,70:1).
check('etichetta bianca in grassetto su TUTTE le bande', true, [10, 5, 3, 2, 1, 0, 30, 16, -3, null].every((g) => {
  const c = stileScadenza(g as number | null).className;
  return c.includes('text-white') && c.includes('font-bold');
}));
// NESSUN NERO e nessuna ardesia scura sulle luci d'allarme: il tabellone non deve
// sembrare un necrologio (direttiva 28/10/2026).
check(
  'nessuna luce d’allarme su nero o ardesia scura',
  [],
  [10, 5, 3, 2, 1, 0, 30, 16]
    .map((g) => [g, stileScadenza(g).className] as const)
    .filter(([, c]) => /bg-(?:black|slate-7|slate-8|slate-9)/.test(c))
    .map(([g, c]) => `${g}: ${c}`),
);

console.log('\n— Contrasto MISURATO (WCAG 2.1) delle bande: nessuna tinta sotto AA 4,5:1 —');
// I valori non si copiano a mano: si calcolano dall'esadecimale del token, così
// una futura sostituzione di tinta non può passare sotto la soglia in silenzio.
// Dal §26.100 l'etichetta è SEMPRE bianca: le tinte sono scese di un gradino per
// reggere AA con il bianco, non per diventare più scure a caso.
const HEX: Record<string, string> = {
  'bg-rose-600': '#e11d48',
  'bg-orange-700': '#c2410c',
  'bg-emerald-700': '#047857',
  'bg-sky-700': '#0369a1',
  'bg-slate-500': '#64748b',
  'bg-slate-600': '#475569',
  'text-white': '#ffffff',
};
function luminanzaRelativa(hex: string): number {
  const canali = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canali.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrasto(sfondo: string, testo: string): number {
  const [a, b] = [luminanzaRelativa(sfondo), luminanzaRelativa(testo)].sort((x, y) => y - x);
  return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
}
const tonalitaBanda = (className: string): { sfondo: string; testo: string } | null => {
  const sfondo = className.match(/bg-[\w-]+/)?.[0] ?? '';
  const testo = className.match(/text-white/)?.[0] ?? '';
  return HEX[sfondo] && HEX[testo] ? { sfondo, testo } : null;
};
for (const g of [10, 5, 3, 2, 1, 0, 30, 16, -3, null]) {
  const classe = stileScadenza(g as number | null).className;
  const tinta = tonalitaBanda(classe);
  // Dalle CLASSI (bg-…/text-…) ai due esadecimali: il rapporto si misura sui colori.
  const rapporto = tinta ? contrasto(HEX[tinta.sfondo], HEX[tinta.testo]) : 0;
  check(`contrasto AA (≥ 4,5:1) — ${g ?? 'n/d'} giorni · bianco su ${tinta?.sfondo ?? 'tinta?'}`, true, rapporto >= 4.5);
}
check('«Scade oggi»: bianco su rose-600 ≥ 4,5:1 (AA)', true, contrasto('#e11d48', '#ffffff') >= 4.5);
check('«Scade domani»: bianco su orange-700 ≥ 5:1', true, contrasto('#c2410c', '#ffffff') >= 5);
check('«In corso»: bianco su emerald-700 ≥ 5:1', true, contrasto('#047857', '#ffffff') >= 5);
check('«Scadenza lontana»: bianco su sky-700 ≥ 5:1', true, contrasto('#0369a1', '#ffffff') >= 5);
// Le tinte CHIARE del §26.98 restano fuori palette: con il bianco andavano sotto
// AA (era il motivo dell'etichetta quasi nera, ritirata dal §26.100).
check('amber-400 con il bianco: sotto AA (fuori palette)', true, contrasto('#fbbf24', '#ffffff') < 4.5);
check('emerald-500 con il bianco: sotto AA (fuori palette)', true, contrasto('#10b981', '#ffffff') < 4.5);
check('rose-500 con il bianco: sotto AA (fuori palette)', true, contrasto('#f43f5e', '#ffffff') < 4.5);
check('«In scadenza» acceso per rosso/arancio/scaduto', true, [0, 1, 2, -1].every((g) => eTermineProssimo(stileScadenza(g).livello)));
check('«In scadenza» spento per verde e lontana', false, [3, 10, 30, 16].some((g) => eTermineProssimo(stileScadenza(g).livello)));

console.log('\n──────────────────────────────────────────────────────────');
if (falliti === 0) {
  console.log('✅ SCADENZA: tutti i controlli superati');
} else {
  console.log(`❌ SCADENZA: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('──────────────────────────────────────────────────────────');
