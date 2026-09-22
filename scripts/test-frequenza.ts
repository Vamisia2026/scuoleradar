/**
 * TEST — FREQUENCY CAP delle notifiche personali.
 * ---------------------------------------------------------------------------
 * Regole verificate (checklist Dipartimento Comunicazione):
 *   1. la stessa opportunità (stessa **scuola + classi + impronta del contenuto**)
 *      può essere inviata AL MASSIMO 2 volte, in 2 GIORNI DIVERSI;
 *   2. **mai due volte nello stesso giorno**;
 *   3. dopo 2 giorni diversi l'invio è soppresso (`limite-raggiunto`);
 *   4. un aggiornamento con contenuto NUOVO riparte come nuova opportunità;
 *   5. i marcatori STORICI (pre-frequency-cap) valgono come 1 invio già avvenuto
 *      e NON riaprono un budget infinito.
 *
 * Tutto con `client = null` e ledger su FILE isolato: nessuna rete, nessun DB.
 *
 * Esecuzione: npm run test:frequenza
 */

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MAX_INVII_OPPORTUNITA,
  giornoFrequenza,
  identitaFrequenza,
  valutaFrequenza,
} from '../src/lib/frequenzaNotifiche.ts';
import { chiaveLedger, ledgerLocaleRegistra, ledgerLocaleSalva } from '../src/lib/ledgerLocale.ts';
import { avvisoGiaInviato, registraInvioAvviso, type AvvisoDedup } from '../src/lib/notifier.ts';

declare const process: { exitCode?: number; env: Record<string, string | undefined>; pid: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

// LEDGER ISOLATO: il test non tocca il ledger reale del workspace.
const percorsoLedger = join(tmpdir(), `scuoleradar-frequenza-test-${process.pid}.json`);
process.env.SCUOLERADAR_LEDGER_PATH = percorsoLedger;
writeFileSync(percorsoLedger, JSON.stringify({ aggiornato: new Date().toISOString(), chiavi: [] }), 'utf8');

const USER = 'aaaaaaaa-1111-2222-3333-444444444444';
const OGGI = giornoFrequenza();
/** Giorno `n` giorni fa (aritmetica sul calendario UTC: sono chiavi, non date reali). */
function giorniFa(n: number): string {
  const d = new Date(`${OGGI}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
/** Chiave di frequenza (stesso formato usato da `notifier.ts`). */
function chiaveFreq(ident: string, giorno: string, canale: string): string {
  return `utente|freq|${USER}|${ident}|${giorno}|${canale}`;
}

/* ------------------------- 1) DECISIONE PURA ------------------------- */

console.log('— Decisione pura: cap a 2 invii in 2 giorni diversi —');
check('cap di prodotto = 2', 2, MAX_INVII_OPPORTUNITA);
check(
  'nessun invio precedente → ok',
  { inviato: false, motivo: 'ok', inviiRegistrati: 0 },
  valutaFrequenza({ giorniInviati: [], oggi: OGGI }),
);
check(
  'già inviata OGGI → stesso-giorno (mai due volte al giorno)',
  { inviato: true, motivo: 'stesso-giorno', inviiRegistrati: 1 },
  valutaFrequenza({ giorniInviati: [OGGI], oggi: OGGI }),
);
check(
  '1 invio in un giorno precedente → ok (2° giorno consentito)',
  { inviato: false, motivo: 'ok', inviiRegistrati: 1 },
  valutaFrequenza({ giorniInviati: [giorniFa(1)], oggi: OGGI }),
);
check(
  '2 giorni diversi già usati → limite-raggiunto',
  { inviato: true, motivo: 'limite-raggiunto', inviiRegistrati: 2 },
  valutaFrequenza({ giorniInviati: [giorniFa(2), giorniFa(1)], oggi: OGGI }),
);
check(
  'consegna storica adottata (1 invio) + oggi già inviata → stesso-giorno',
  { inviato: true, motivo: 'stesso-giorno', inviiRegistrati: 2 },
  valutaFrequenza({ giorniInviati: [OGGI], oggi: OGGI, legacyAdottato: true }),
);
check(
  'consegna storica adottata da sola → ok (resta 1 invio di budget)',
  { inviato: false, motivo: 'ok', inviiRegistrati: 1 },
  valutaFrequenza({ giorniInviati: [], oggi: OGGI, legacyAdottato: true }),
);

/* ------------------------- 2) IDENTITÀ STABILE ------------------------- */

console.log('\n— Identità: scuola + classi + impronta del contenuto —');
const avviso: AvvisoDedup = {
  hashId: 'hash-1',
  title: 'Interpello supplenza Matematica — Liceo Augusto Monti',
  schoolName: 'Liceo Augusto Monti',
  classi: ['A-022'],
};
const avvisoStessoContenuto: AvvisoDedup = {
  ...avviso,
  hashId: 'hash-2',
  title: 'Interpello supplenza Matematica — Liceo Augusto Monti (prot. n. 999 del 17/09/2026)',
  classi: ['A-22'],
};
const avvisoAggiornato: AvvisoDedup = {
  ...avviso,
  hashId: 'hash-3',
  title: 'Interpello supplenza Matematica e Fisica — Liceo Augusto Monti (nuovo orario)',
};
const avvisoAltraScuola: AvvisoDedup = {
  ...avviso,
  hashId: 'hash-4',
  schoolName: 'ITIS A. Artom',
};
const ident = identitaFrequenza(avviso);
check('identità calcolabile', true, typeof ident === 'string' && ident.length > 0);
check(
  'codice classe normalizzato: A-022 ≡ A-22 (stessa identità)',
  true,
  ident === identitaFrequenza(avvisoStessoContenuto),
);
check(
  'protocollo/data nel titolo NON cambiano l’identità',
  ident,
  identitaFrequenza({
    ...avvisoStessoContenuto,
    title: 'Interpello supplenza Matematica — Liceo Augusto Monti (prot. 1234 del 01/01/2030)',
  }),
);
check('contenuto NUOVO → identità diversa', true, ident !== identitaFrequenza(avvisoAggiornato));
check('scuola diversa → identità diversa', true, ident !== identitaFrequenza(avvisoAltraScuola));

/* ------------------------- 3) GUARD SUL LEDGER SU FILE ------------------------- */

console.log('\n— Guard (client null, ledger su file): cap 2 giorni —');
const nuovo: AvvisoDedup = { ...avviso, hashId: 'h-fresh', schoolName: 'Scuola Fresca' };
const nuovoIdent = identitaFrequenza(nuovo) as string;
check(
  '1° invio (mai inviata) → consentito',
  { inviato: false },
  await avvisoGiaInviato(null, USER, nuovo, 'email'),
);
check(
  'registrazione (hash + impronta; l’avviso non ha URL)',
  2,
  await registraInvioAvviso(null, USER, nuovo, 'email'),
);
check(
  'stessa opportunità, stesso giorno → soppressa (mai 2 volte al giorno)',
  { inviato: true, per: 'stesso-giorno' },
  await avvisoGiaInviato(null, USER, { ...nuovo, hashId: 'h-fresh-2' }, 'email'),
);

// 2° GIORNO: identità "nuova-2" con UNA sola consegna (ieri) → consentita.
const nuovo2: AvvisoDedup = { ...avviso, hashId: 'h-day2', schoolName: 'Scuola Seconda' };
ledgerLocaleRegistra(chiaveFreq(identitaFrequenza(nuovo2) as string, giorniFa(1), 'email'));
check(
  'stessa opportunità, giorno DIVERSO → consentita (2ª volta)',
  { inviato: false },
  await avvisoGiaInviato(null, USER, { ...nuovo2, hashId: 'h-day2-bis' }, 'email'),
);

// CAP RAGGIUNTO: identità "nuova-3" con DUE giorni diversi già usati.
const nuovo3: AvvisoDedup = { ...avviso, hashId: 'h-capped', schoolName: 'Scuola Terza' };
const nuovo3Ident = identitaFrequenza(nuovo3) as string;
ledgerLocaleRegistra(chiaveFreq(nuovo3Ident, giorniFa(2), 'email'));
ledgerLocaleRegistra(chiaveFreq(nuovo3Ident, giorniFa(1), 'email'));
check(
  'dopo 2 giorni diversi → limite-raggiunto',
  { inviato: true, per: 'limite-raggiunto' },
  await avvisoGiaInviato(null, USER, { ...nuovo3, hashId: 'h-capped-2' }, 'email'),
);

/* ------------------- 4) AGGIORNAMENTO CON CONTENUTO NUOVO ------------------- */

console.log('\n— Aggiornamento con contenuto NUOVO → riparte —');
check(
  'contenuto aggiornato (stessa scuola/classi) → consentito in un NUOVO giorno',
  { inviato: false },
  await avvisoGiaInviato(
    null,
    USER,
    {
      ...nuovo,
      hashId: 'h-upd',
      title: 'Interpello supplenza Matematica e Fisica — Scuola Fresca (orario aggiornato)',
    },
    'email',
  ),
);

/* --------------- 5) MARCATORI STORICI (PRE-CAP): CONSERVATIVI --------------- */

console.log('\n— Marcatori STORICI (pre-frequency-cap): politica conservativa —');
const legacy: AvvisoDedup = { ...avviso, hashId: 'h-legacy', schoolName: 'Scuola Storica' };
// Chiave scritta dal codice PRECEDENTE al frequency cap (identità senza giorno).
ledgerLocaleRegistra(chiaveLedger('utente', `${USER}:h-legacy`, 'email'));
check(
  'marcatore storico su file → soppresso (mai re-inviare avvisi pre-cap)',
  { inviato: true, per: 'legacy' },
  await avvisoGiaInviato(null, USER, legacy, 'email'),
);
check(
  'marcatore storico NON blocca l’ALTRO canale (guard per canale)',
  { inviato: false },
  await avvisoGiaInviato(null, USER, legacy, 'telegram'),
);

console.log('\n— Canali separati: email ≠ telegram —');
const separato: AvvisoDedup = { ...avviso, hashId: 'h-sep', schoolName: 'Scuola Separata' };
await registraInvioAvviso(null, USER, separato, 'email');
check(
  'l’invio su Telegram non è bloccato da quello email',
  { inviato: false },
  await avvisoGiaInviato(null, USER, separato, 'telegram'),
);

ledgerLocaleSalva();
if (existsSync(percorsoLedger)) rmSync(percorsoLedger, { force: true });

console.log(
  errori === 0 ? '\n✅ FREQUENCY CAP: nessun problema' : `\n❌ FREQUENCY CAP: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;
