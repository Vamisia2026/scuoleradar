/**
 * ScuoleRadar.it — Notifier (FASE 4)
 * Riceve i nuovi interpelli, trova gli utenti compatibili e invia le
 * notifiche su entrambi i canali (Resend email + Telegram) in parallelo.
 * Non lancia eccezioni: ogni errore viene loggato e conteggiato.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { InterpelloParsato } from '../scraper/parser.ts';
import {
  getResendClient,
  inviaDigestEmail,
  inviaNotificaEmail,
  inviaPromemoriaEmail,
  type DettagliNotifica,
  type DestinatarioNotifica,
  type TipoMessaggio,
} from './resend.ts';
import { inviaDigestTelegram, inviaNotificaTelegram } from './telegram.ts';
import {
  chiaveLedger,
  ledgerLocaleChiaviConPrefisso,
  ledgerLocaleGia,
  ledgerLocaleRegistra,
  ledgerLocaleSalva,
} from './ledgerLocale.ts';
import {
  avvisoCompatibileConProfilo,
  elencaUtentiNotificabili,
  findUtentiCompatibili,
  searchInterpelli,
  type InterpelloDB,
  type UtenteCompatibile,
} from './matchingEngine.ts';
import { emailAvviso, motivoAvvisoNonInviabile } from './alertInterpello.ts';
import { improntaAvviso } from './dedupAvvisi.ts';
import { risolviEmailUfficialeScuola } from './emailScuola.ts';
import {
  chiaveDigestGiorno,
  dataLocaleItalia,
  descrizioneFinestraDigest,
  etichettaDataItalia,
  ordinaVociDigest,
} from './digest.ts';
import {
  CANALE_PROMEMORIA,
  GIORNI_URGENZA_PROMEMORIA,
  ORE_PROMEMORIA,
  chiavePromemoria,
  motivoPromemoria,
  oreTrascorse,
} from './promemoria.ts';
import {
  identitaFrequenza,
  giornoFrequenza,
  valutaFrequenza,
  type MotivoFrequenza,
} from './frequenzaNotifiche.ts';
import { oggettoConsentito, statoAutomazioneEmail } from './automazioniEmailDb.ts';

/**
 * Recapito di CANDIDATURA da mettere nella notifica: se la pipeline ha già
 * estratto un'email la usa così com'è (normalizzata); altrimenti ricostruisce la
 * PEO ufficiale dal codice meccanografico (convenzione MIM). Così il contatto —
 * asset del piano PRO — c'è anche quando l'unico link raggiungibile è una pagina
 * di riepilogo/"Stampa" senza descrizione. Non inventa nulla: senza email né
 * codice resta `null` e la riga viene omessa dal messaggio.
 */
function recapitoNotifica(
  email?: string | null,
  schoolCode?: string | null,
  testo?: string | null,
): string | null {
  return (
    emailAvviso(email) ??
    risolviEmailUfficialeScuola({ schoolCode: schoolCode ?? null, testo: testo ?? null })?.email ??
    null
  );
}

/**
 * Motivi del GATE di qualità già loggati nel run: evita di ripetere lo stesso
 * avviso per ogni utente (il digest gira su tutti i profili).
 */
const gateQualitaLoggati = new Set<string>();

/**
 * GATE DI QUALITÀ STRICT — un avviso si invia SOLO se ha un LINK DIRETTO
 * all'avviso ufficiale (non la home né una pagina di elenco/ricerca) e un
 * RECAPITO di candidatura valido (email/PEC della scuola). Gli avvisi
 * incompleti vengono scartati dal dispatch: un alert senza fonte o senza
 * contatto danneggia l'affidabilità del servizio.
 *
 * Ritorna `true` quando l'avviso può partire.
 */
function superaGateQualita(dettagli: DettagliNotifica, contesto: string): boolean {
  const motivo = motivoAvvisoNonInviabile({
    link: dettagli.link,
    email: dettagli.contactEmail,
  });
  if (!motivo) return true;
  const chiave = `${motivo}|${dettagli.link ?? ''}|${dettagli.id ?? ''}`;
  if (!gateQualitaLoggati.has(chiave)) {
    gateQualitaLoggati.add(chiave);
    console.warn(
      `  ⛔ Avviso escluso dall'invio (${motivo}) — ${contesto}: ` +
        `${String(dettagli.title ?? '').slice(0, 60)}`,
    );
  }
  return false;
}

export interface NotificheOptions {
  /** Logga le notifiche senza inviarle (per test). */
  dryRun?: boolean;
  /** URL della dashboard per il pulsante CTA (default da env). */
  dashboardUrl?: string;
}

export interface EsitoNotifiche {
  inviate: number;
  fallite: number;
  telegramInviate: number;
  telegramFallite: number;
}

type EsitoJob = { ok: boolean };

/** Piani con notifiche illimitate (PRO a pagamento + PRO Free Forever). */
function pianoIllimitato(piano?: string): boolean {
  return piano === 'pro' || piano === 'free_forever';
}

/**
 * Deduplica per (utente, interpello): usa la tabella `notifications_log`
 * (migrazione `20260914010000_notifications_log.sql`). Se la tabella non esiste
 * ancora le letture/scritture sono best-effort (nessun blocco dell'invio).
 */
/** Avviso una-tantum quando il ledger non è disponibile (tabella non creata). */
let ledgerNotificheAvvisato = false;

/** Canali di notifica (allineati a `notifications_log.canale`). */
export type CanaleNotifica = 'email' | 'telegram';

/**
 * Canali TRACCIATI nel ledger: `email`, `telegram` e `promemoria`.
 * Il promemoria è un canale a sé: la sua chiave è per coppia
 * (utente, interpello) e blocca il secondo invio sullo stesso avviso.
 */
export type CanaleLedger = CanaleNotifica | typeof CANALE_PROMEMORIA;

/** Canale LEGACY agnostico: una chiave con questo valore vale per TUTTI i canali. */
const CANALE_LEGACY = 'notifica';

/* ============ REGISTRO INVII per utente — FREQUENCY CAP STRICT ============
 *
 * ROOT CAUSE del bug "lo stesso alert (es. Liceo Monti) arriva più volte":
 * il guard per utente usava SOLO l'`hash_id`, ma l'hash NON è stabile:
 * `generaHashId(provincia, titolo, data)` include titolo e data, quindi la stessa
 * opportunità ripubblicata (o ri-scrapata con rumore: data, protocollo
 * "n. 1234", classe `A-22` invece di `A-022`) riceve un hash NUOVO → nuovo invio.
 *
 * REGOLA DI SERVIZIO (Dipartimento Comunicazione — checklist immutabili):
 *   · un'opportunità IDENTICA (stessa **scuola + classi + impronta del
 *     contenuto**, vedi `frequenzaNotifiche.ts`) può essere inviata a un utente
 *     **al massimo 2 volte, in 2 giorni diversi**;
 *   · **mai due volte nello stesso giorno** (alert PRO in tempo reale, digest
 *     delle 17:00 e promemoria condividono lo stesso conteggio per canale);
 *   · se la scuola **aggiorna/ripubblica** l'avviso con un contenuto NUOVO
 *     (impronta diversa) riparte come aggiornamento, con contatore azzerato.
 *
 * Il registro resta ancorato a TRE identificatori stabili, usati anche dal
 * promemoria 24h e per la compatibilità con i dati storici:
 *   1. `hash`     → l'`hash_id` dell'interpello;
 *   2. `impronta` → `improntaAvviso` (titolo normalizzato + scuola + provincia + classi);
 *   3. `url`      → URL ufficiale della fonte (normalizzato, senza frammento).
 *
 * MARCATORI STORICI (pre-frequency-cap): le chiavi scritte dal vecchio codice
 * SU FILE (`utente|<id>:<hash>|<canale>`, `i:`/`u:` e la chiave agnostica
 * `|notifica`) valgono come **1 invio già avvenuto** (giorno non noto). Da questa
 * versione il codice NON scrive più quelle chiavi su file (restano su
 * `notifications_log` per lo storico del promemoria), così i giorni restano esatti.
 */

/** Identificatori stabili usati dal registro invii. */
export type IdentificatoreAvviso = 'hash' | 'impronta' | 'url';

/** Dati minimi dell'avviso per costruire gli identificatori di deduplica. */
export interface AvvisoDedup {
  /** `hash_id` dell'interpello (identificatore principale). */
  hashId?: string | null;
  title?: string | null;
  schoolName?: string | null;
  province?: string | null;
  classi?: readonly string[] | null;
  link?: string | null;
}

/**
 * URL normalizzato per il registro: solo http(s), host in minuscolo, senza
 * frammento (`#…`) — che non identifica la risorsa. `null` se non valido.
 */
function urlRegistro(url?: string | null): string | null {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    const p = new URL(u);
    return `${p.protocol}//${p.host.toLowerCase()}${p.pathname}${p.search}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Valore del registro per un identificatore. L'`hash` resta NON prefissato: è il
 * formato storico delle righe di `notifications_log` (e il promemoria 24h legge
 * proprio quei valori per risalire all'interpello). Gli altri identificatori sono
 * prefissati (`i:`/`u:`) per non confondersi con un hash.
 */
export function valoreRegistro(tipo: IdentificatoreAvviso, valore: string): string {
  if (tipo === 'hash') return valore;
  return tipo === 'impronta' ? `i:${valore}` : `u:${valore}`;
}

/** Identificatori (tipo → valore del registro) di un avviso. */
export function identificatoriAvviso(avviso: AvvisoDedup): Array<[IdentificatoreAvviso, string]> {
  const out: Array<[IdentificatoreAvviso, string]> = [];
  const hash = (avviso.hashId ?? '').trim();
  if (hash) out.push(['hash', hash]);
  const impronta = improntaAvviso({
    titolo: avviso.title,
    scuola: avviso.schoolName,
    provincia: avviso.province,
    classi: avviso.classi ? [...avviso.classi] : [],
  });
  if (impronta) out.push(['impronta', impronta]);
  const url = urlRegistro(avviso.link);
  if (url) out.push(['url', url]);
  return out;
}

/** Chiave del ledger locale per un identificatore (utente × avviso × canale). */
function chiaveRegistro(
  userId: string,
  tipo: IdentificatoreAvviso,
  valore: string,
  canale: CanaleLedger,
): string {
  return chiaveLedger('utente', `${userId}:${valoreRegistro(tipo, valore)}`, canale);
}

/* ------------------- FREQUENCY CAP: chiavi, letture, decisione ------------------- */

/** Motivo del blocco: marcatore storico oppure regola di frequenza. */
export type MotivoDedup = IdentificatoreAvviso | MotivoFrequenza | 'legacy';

/** Canali di CONSEGNA sottoposti al frequency cap (notifiche personali). */
type CanaleFrequenza = 'email' | 'telegram';

/** Abilita il cap solo per i canali di consegna personali. */
function canaleFrequenzaDi(canale: CanaleLedger): CanaleFrequenza | null {
  return canale === 'email' || canale === 'telegram' ? canale : null;
}

/** Prefisso delle chiavi del ledger dedicate alla frequenza (giorni di invio). */
const PREFISSO_FREQ = 'utente|freq|';

/** Chiave ledger dell'invio (giorno) di un'identità su un canale. */
function chiaveFrequenzaGiorno(
  userId: string,
  ident: string,
  giorno: string,
  canale: CanaleFrequenza,
): string {
  return `${PREFISSO_FREQ}${userId}|${ident}|${giorno}|${canale}`;
}

/**
 * Chiave ledger "URL già inviato OGGI": anti-spam giornaliero per PAGINA DI
 * FONTE. Serve perché una ripubblicazione con il titolo riscritto cambia
 * l'impronta del contenuto (es. "suppl." vs "supplenza") pur restando la stessa
 * opportunità: senza questa chiave l'utente potrebbe ricevere 2 comunicazioni
 * nello stesso giorno. Non blocca gli aggiornamenti nei giorni successivi.
 */
const PREFISSO_FREQ_URL = 'utente|frequrl|';

function chiaveFrequenzaUrl(
  userId: string,
  url: string,
  giorno: string,
  canale: CanaleFrequenza,
): string {
  return `${PREFISSO_FREQ_URL}${userId}|${url}|${giorno}|${canale}`;
}

/** Estrae i giorni (`YYYY-MM-DD`) dalle chiavi di frequenza di un'identità. */
function giorniDaChiavi(chiavi: string[], prefisso: string, canale: CanaleFrequenza): string[] {
  const suffisso = `|${canale}`;
  const giorni: string[] = [];
  for (const chiave of chiavi) {
    if (!chiave.startsWith(prefisso) || !chiave.endsWith(suffisso)) continue;
    const giorno = chiave.slice(prefisso.length, chiave.length - suffisso.length);
    if (/^\d{4}-\d{2}-\d{2}$/.test(giorno)) giorni.push(giorno);
  }
  return [...new Set(giorni)];
}

/**
 * Marcatori STORICI su file (scritti prima del frequency cap) per questa
 * opportunità. L'URL è volutamente ESCLUSO: identifica la pagina di fonte, non
 * il contenuto — una ripubblicazione con contenuto nuovo sullo stesso URL deve
 * poter ripartire come aggiornamento. Per il contenuto invariato basta
 * l'impronta (`i:`) a riconoscere la consegna precedente.
 */
function legacyStoricoSuFile(userId: string, avviso: AvvisoDedup, canale: CanaleLedger): boolean {
  for (const [tipo, valore] of identificatoriAvviso(avviso)) {
    if (tipo === 'url') continue;
    if (ledgerLocaleGia(chiaveRegistro(userId, tipo, valore, canale))) return true;
  }
  const hash = (avviso.hashId ?? '').trim();
  if (hash && ledgerLocaleGia(chiaveLedger('utente', `${userId}:${hash}`, CANALE_LEGACY))) {
    return true;
  }
  return false;
}

/**
 * Storico di frequenza su `notifications_log`: giorni già inviati per
 * l'identità sul canale. Best-effort: se la tabella (o il filtro) non è
 * disponibile resta il ledger su FILE, che i workflow committano a ogni run.
 */
async function frequenzaDaDB(
  client: SupabaseClient,
  userId: string,
  ident: string,
  canale: CanaleFrequenza,
): Promise<string[]> {
  const giorni: string[] = [];
  try {
    const { data, error } = await client
      .from('notifications_log')
      .select('interpello_hash')
      .eq('user_id', userId)
      .eq('canale', `freq_${canale}`)
      .like('interpello_hash', `freq:${ident}|%`);
    if (error) return giorni;
    for (const r of data ?? []) {
      const valore = String((r as { interpello_hash?: unknown }).interpello_hash ?? '');
      const giorno = valore.slice(`freq:${ident}|`.length);
      if (/^\d{4}-\d{2}-\d{2}$/.test(giorno)) giorni.push(giorno);
    }
  } catch {
    /* tabella assente / filtro non supportato: resta il ledger su file */
  }
  return [...new Set(giorni)];
}

/** Riga del ledger DB per un valore del registro su un canale. */
async function rigaRegistroEsiste(
  client: SupabaseClient,
  userId: string,
  valore: string,
  canale: CanaleLedger,
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from('notifications_log')
      .select('canale')
      .eq('user_id', userId)
      .eq('interpello_hash', valore)
      .eq('canale', canale)
      .limit(1);
    if (error) {
      // Diagnostica esplicita: senza tabella il ledger DB non protegge e la
      // deduplica resta affidata al file `.scuoleradar/notifiche-ledger.json`.
      if (!ledgerNotificheAvvisato) {
        ledgerNotificheAvvisato = true;
        console.warn(
          `⚠ Ledger notifiche NON disponibile (${error.message}): deduplica affidata al file ` +
            '`.scuoleradar/notifiche-ledger.json`; applica la migrazione ' +
            '`20260914030000_repair_notifications_log_e_rpc_quota.sql` (`npm run db:verifica`).',
        );
      }
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Esito del guard anti-duplicato (con il motivo, per log e diagnostica). */
export interface EsitoDedup {
  inviato: boolean;
  /** Motivo che ha bloccato l'invio (`stesso-giorno`/`limite-raggiunto`/marcatore storico). */
  per?: MotivoDedup;
}

/** Adatta i dettagli di notifica al formato del registro deduplica. */
export function avvisoDaDettagli(v: DettagliNotifica): AvvisoDedup {
  return {
    hashId: v.id,
    title: v.title,
    schoolName: v.schoolName,
    province: v.province,
    classi: v.classi,
    link: v.link,
  };
}

/**
 * ATTESA STORICA (fallback conservativo) — comportamento precedente al frequency
 * cap: se una qualsiasi chiave stabile (hash/impronta/URL) o la chiave LEGACY
 * agnostica `notifica` risulta già registrata per quell'utente su quel canale,
 * l'invio è soppresso. Usata quando l'identità di frequenza non è calcolabile
 * (titolo troppo generico) o per canali non sottoposti al cap (es. `promemoria`).
 */
async function attesaDedupStorica(
  client: SupabaseClient | null,
  userId: string,
  avviso: AvvisoDedup,
  canale: CanaleLedger,
): Promise<EsitoDedup> {
  const identificatori = identificatoriAvviso(avviso);
  if (identificatori.length === 0) return { inviato: false };
  const hash = identificatori.find(([tipo]) => tipo === 'hash')?.[1] ?? '';

  // 1) Ledger su FILE (disponibile anche senza migrazioni).
  for (const [tipo, valore] of identificatori) {
    if (ledgerLocaleGia(chiaveRegistro(userId, tipo, valore, canale))) {
      return { inviato: true, per: tipo };
    }
  }
  // Compatibilità col passato: la chiave LEGACY agnostica vale per ogni canale.
  if (hash && ledgerLocaleGia(chiaveLedger('utente', `${userId}:${hash}`, CANALE_LEGACY))) {
    return { inviato: true, per: 'hash' };
  }
  if (!client) return { inviato: false };

  // 2) Ledger DB `notifications_log` (fonte durabile), SEMPRE per canale.
  for (const [tipo, valore] of identificatori) {
    if (await rigaRegistroEsiste(client, userId, valoreRegistro(tipo, valore), canale)) {
      return { inviato: true, per: tipo };
    }
  }
  return { inviato: false };
}

/**
 * GUARD DELLE NOTIFICHE PERSONALI (frequency cap) — da chiamare SEMPRE prima di
 * inviare un alert Telegram o una email di opportunità.
 *
 * `inviato: true` quando:
 *   · l'opportunità è già stata inviata a QUEL utente su QUEL canale **oggi**
 *     (`per: 'stesso-giorno'`) — mai due volte al giorno; oppure
 *   · gli invii hanno già raggiunto il cap (`per: 'limite-raggiunto'`): **max 2
 *     invii su 2 giorni diversi**; oppure
 *   · esistono marcatori STORICI pre-cap che valgono come 1 invio già avvenuto.
 *
 * L'identità confrontata è **scuola + classi + impronta del contenuto**: un
 * avviso ripubblicato con lo stesso contenuto (ma hash/data diversi) resta la
 * STESSA opportunità; un contenuto NUOVO riparte come aggiornamento.
 *
 * Fail-safe: se il ledger DB non è disponibile resta il ledger su FILE
 * (committato dai workflow).
 */
export async function avvisoGiaInviato(
  client: SupabaseClient | null,
  userId: string,
  avviso: AvvisoDedup,
  canale: CanaleLedger,
): Promise<EsitoDedup> {
  const canaleFreq = canaleFrequenzaDi(canale);
  const ident = identitaFrequenza(avviso);
  // Identità non calcolabile / canale fuori dal cap → comportamento storico.
  if (!canaleFreq || !ident) return attesaDedupStorica(client, userId, avviso, canale);

  const oggi = giornoFrequenza();
  const prefisso = `${PREFISSO_FREQ}${userId}|${ident}|`;

  // ANTI-SPAM GIORNALIERO per URL: la STESSA pagina di fonte non può generare
  // due comunicazioni nello stesso giorno, nemmeno se il titolo è stato riscritto
  // (l'impronta del contenuto cambierebbe, la pagina di fonte no).
  const url = urlRegistro(avviso.link);
  if (url && ledgerLocaleGia(chiaveFrequenzaUrl(userId, url, oggi, canaleFreq))) {
    return { inviato: true, per: 'stesso-giorno' };
  }

  const giorniFile = giorniDaChiavi(
    ledgerLocaleChiaviConPrefisso(prefisso),
    prefisso,
    canaleFreq,
  );
  const giorni = [...new Set([...giorniFile, ...(client ? await frequenzaDaDB(client, userId, ident, canaleFreq) : [])])];

  // MARCATORI STORICI (pre-frequency-cap): consegne fatte dal vecchio codice,
  // senza un giorno noto. Politica CONSERVATIVA (la più restrittiva vince):
  // l'opportunità risulta già consegnata e NON si rimanda — così nessun avviso
  // gestito dal vecchio sistema viene re-inviato. Il budget di 2 giorni resta
  // pieno solo per le opportunità NUOVE.
  if (giorni.length === 0 && legacyStoricoSuFile(userId, avviso, canaleFreq)) {
    return { inviato: true, per: 'legacy' };
  }

  const decisione = valutaFrequenza({ giorniInviati: giorni, oggi });
  if (!decisione.inviato) return { inviato: false };
  return { inviato: true, per: decisione.motivo };
}

/**
 * REGISTRA l'invio RIUSCITO. Due cose:
 *   1. gli identificatori stabili su `notifications_log` (hash/impronta/URL) —
 *      servono allo storico del promemoria 24h e ai flussi legacy; **non** si
 *      scrivono più su file, perché le chiavi su file restano il marcatore delle
 *      consegne PRE-frequency-cap (1 invio già avvenuto);
 *   2. il **GIORNO** dell'invio per l'identità di frequenza (file + DB): è questa
 *      marcatura che implementa il cap "max 2 invii in 2 giorni diversi" e
 *      impedisce i doppi invii nello stesso giorno.
 *
 * Da chiamare SUBITO dopo un esito positivo. Ritorna il numero di identificatori
 * stabili registrati (diagnostica/test).
 */
export async function registraInvioAvviso(
  client: SupabaseClient | null,
  userId: string,
  avviso: AvvisoDedup,
  canale: CanaleLedger,
): Promise<number> {
  const identificatori = identificatoriAvviso(avviso);
  let registrati = 0;
  for (const [tipo, valore] of identificatori) {
    if (client) await registraNotifica(client, userId, valoreRegistro(tipo, valore), canale);
    registrati += 1;
  }
  const canaleFreq = canaleFrequenzaDi(canale);
  if (canaleFreq) {
    const oggi = giornoFrequenza();
    const ident = identitaFrequenza(avviso);
    if (ident) {
      ledgerLocaleRegistra(chiaveFrequenzaGiorno(userId, ident, oggi, canaleFreq));
      if (client) {
        await registraNotifica(client, userId, `freq:${ident}|${oggi}`, `freq_${canaleFreq}`);
      }
    }
    // Anti-spam giornaliero per PAGINA DI FONTE (vale anche senza identità).
    const url = urlRegistro(avviso.link);
    if (url) ledgerLocaleRegistra(chiaveFrequenzaUrl(userId, url, oggi, canaleFreq));
  }
  return registrati;
}

/**
 * PROMEMORIA già inviato per questa opportunità? Marcatore PERMANENTE (una sola
 * volta per opportunità) su canale `promemoria`: chiave storica
 * `chiavePromemoria` + identificatori stabili (file e DB).
 */
async function promemoriaGiaInviato(
  client: SupabaseClient | null,
  userId: string,
  avviso: AvvisoDedup,
): Promise<boolean> {
  const hash = (avviso.hashId ?? '').trim();
  if (hash && ledgerLocaleGia(chiavePromemoria(userId, hash))) return true;
  for (const [tipo, valore] of identificatoriAvviso(avviso)) {
    if (ledgerLocaleGia(chiaveRegistro(userId, tipo, valore, CANALE_PROMEMORIA))) return true;
    if (
      client &&
      (await rigaRegistroEsiste(client, userId, valoreRegistro(tipo, valore), CANALE_PROMEMORIA))
    ) {
      return true;
    }
  }
  return false;
}

/** Registra il promemoria inviato (permanente): una sola volta per opportunità. */
async function registraPromemoria(
  client: SupabaseClient | null,
  userId: string,
  avviso: AvvisoDedup,
): Promise<void> {
  const hash = (avviso.hashId ?? '').trim();
  if (hash) ledgerLocaleRegistra(chiavePromemoria(userId, hash));
  if (!client) return;
  for (const [tipo, valore] of identificatoriAvviso(avviso)) {
    await registraNotifica(client, userId, valoreRegistro(tipo, valore), CANALE_PROMEMORIA);
  }
}

/**
 * Deduplica UNIFICATA AGNOSTICA: ledger locale su file (funziona SEMPRE, anche
 * senza migrazioni) + ledger DB `notifications_log`. True se la coppia
 * (utente, interpello) è già stata consegnata su QUALSIASI canale.
 * Usata dai flussi legacy e dal recupero.
 */
async function giaNotificatoL(
  client: SupabaseClient | null,
  userId: string,
  hash: string,
): Promise<boolean> {
  if (ledgerLocaleGia(chiaveLedger('utente', `${userId}:${hash}`, CANALE_LEGACY))) return true;
  if (client && (await giaNotificato(client, userId, hash))) return true;
  return false;
}

/** Registra la consegna come AGGANCIATA a tutti i canali (semantica legacy). */
function registraNotificaLocale(userId: string, hash: string): void {
  ledgerLocaleRegistra(chiaveLedger('utente', `${userId}:${hash}`, CANALE_LEGACY));
}

async function giaNotificato(
  client: SupabaseClient,
  userId: string,
  hash: string,
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from('notifications_log')
      .select('interpello_hash')
      .eq('user_id', userId)
      .eq('interpello_hash', hash)
      .limit(1);
    if (error) {
      // Diagnostica esplicita: senza tabella il ledger non protegge → spam possibile.
      if (!ledgerNotificheAvvisato) {
        ledgerNotificheAvvisato = true;
        console.warn(
          `⚠ Ledger notifiche NON disponibile (${error.message}): applicare la migrazione ` +
            '`20260914010000_notifications_log.sql` per garantire zero duplicati.',
        );
      }
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Scrive una riga nel ledger DB `notifications_log`.
 *
 * Ritorna `false` (senza bloccare l'invio) quando la tabella non è disponibile:
 * in quel caso l'unica protezione resta il ledger su FILE, quindi lo segnaliamo
 * UNA volta con un warning operativo che nomina la migrazione da applicare.
 * NB: supabase-js NON lancia nei casi di errore DB (ritorna `{ error }`): senza
 * questo controllo un ledger assente passerebbe completamente inosservato.
 */
async function registraNotifica(
  client: SupabaseClient,
  userId: string,
  hash: string,
  canale: string,
): Promise<boolean> {
  try {
    const { error } = await client
      .from('notifications_log')
      .upsert(
        { user_id: userId, interpello_hash: hash, canale },
        { onConflict: 'user_id,interpello_hash,canale' },
      );
    if (error) {
      if (!ledgerNotificheAvvisato) {
        ledgerNotificheAvvisato = true;
        console.warn(
          `⚠ Ledger DB non aggiornabile (${error.message}): la deduplica resta affidata al ` +
            'ledger su file (.scuoleradar/notifiche-ledger.json). Applica la migrazione ' +
            '`20260914030000_repair_notifications_log_e_rpc_quota.sql` e verifica con `npm run db:verifica`.',
        );
      }
      return false;
    }
    return true;
  } catch {
    /* rete/tabella assente: il ledger su file copre comunque */
    return false;
  }
}

/**
 * LEGACY (non più usata dalla pipeline): notifica IMMEDIATA per singolo
 * interpello. La pipeline di ingestione non invia più N email al giorno: accumula
 * le opportunità e le consegna con UN SOLO digest alle 18:00
 * (`inviaDigestGiornaliero`). La funzione resta per test/dry-run e per i
 * backfill manuali.
 */
export async function notificaNuoviInterpelli(
  client: SupabaseClient | null,
  nuovi: InterpelloParsato[],
  opts: NotificheOptions = {},
): Promise<EsitoNotifiche> {
  const esito: EsitoNotifiche = { inviate: 0, fallite: 0, telegramInviate: 0, telegramFallite: 0 };
  const resend = getResendClient();
  if (!resend) {
    console.log('ℹ Notifiche email disattivate: RESEND_API_KEY non configurata o placeholder.');
  }
  if (nuovi.length === 0) {
    console.log('ℹ Nessun interpello nuovo: nessuna notifica da inviare.');
    return esito;
  }

  const { dryRun = false, dashboardUrl } = opts;

  // Stato PER-RUN. La lista utenti è uno snapshot letto dal DB una volta per
  // interpello: senza questi set, quando in un solo run arrivano PIÙ interpelli
  // nuovi, lo stesso utente verrebbe riprocessato e riceverebbe più volte
  // l'avviso "periodo di prova terminato" (extra) perché il flag letto in
  // memoria resta `false` anche dopo l'update su DB → loop sullo stesso record.
  const utentiBloccoGiaAvvisati = new Set<string>();
  const utentiEsauriti = new Set<string>();

  for (const interpello of nuovi) {
    const dettagli: DettagliNotifica = {
      id: interpello.hashId,
      title: interpello.title,
      schoolName: interpello.schoolName,
      province: interpello.province,
      classi: interpello.classCodes,
      materia: interpello.materia,
      scadenza: interpello.expirationDate,
      link: interpello.link,
      // Email di candidatura: se la pipeline non l'ha trovata, si ricostruisce
      // dal codice meccanografico (ultima ratio, convenzione MIM).
      contactEmail: recapitoNotifica(
        interpello.contactEmail,
        interpello.schoolCode,
        interpello.title,
      ),
    };

    // GATE DI QUALITÀ STRICT (PRIMA del matching): senza link diretto all'avviso
    // o senza recapito di candidatura l'opportunità NON viene notificata a
    // nessuno — inutile calcolare gli utenti compatibili.
    if (!superaGateQualita(dettagli, 'notifica nuovi')) continue;

    // Matching Engine: utenti con provincia e almeno una classe in comune
    // (titolo + materia servono alla guardia SOSTEGNO: si veda `sostegnoAmmesso`).
    const utenti = await findUtentiCompatibili(client, {
      province: interpello.province,
      classi: interpello.classCodes,
      titolo: interpello.title,
      materia: interpello.materia,
    });

    if (utenti.length === 0) {
      console.log(`  ℹ Nessun utente compatibile per [${interpello.province}] ${interpello.title.slice(0, 60)}`);
      continue;
    }

    const risultati = await Promise.all(
      utenti.map(async (utente) => {
        // Utente già saturato in questo run (BASE oltre il limite): nessun
        // ulteriore processamento, il cron `step5-notifiche` gestirà il recap.
        if (utentiEsauriti.has(utente.id)) return [];

        // ANTI-SPAM / IDEMPOTENZA (bug "notifiche ripetute"): se l'opportunità è
        // già stata consegnata a questo utente (su qualsiasi canale), la notifica
        // NON si rimanda — per QUALUNQUE piano. Il guard usa hash + impronta
        // stabile + URL: un avviso ri-rilevato come "nuovo" (upsert ignorato, hash
        // variato, run ripetuti) NON genera più loop di messaggi identici.
        const avvisoLegacy = avvisoDaDettagli(dettagli);
        if (
          (await giaNotificatoL(client, utente.id, interpello.hashId)) ||
          (await avvisoGiaInviato(client, utente.id, avvisoLegacy, 'email')).inviato ||
          (await avvisoGiaInviato(client, utente.id, avvisoLegacy, 'telegram')).inviato
        ) {
          return [];
        }

        // FASE 6 — guardia server-side: RPC atomica del contatore notifiche.
        // base → max 3 per ANNO SCOLASTICO (reset automatico a settembre);
        // pro → sempre consentito.
        // Sequenza BASE: Email 1 (welcome) dal trigger su auth.users;
        // Email 2-4 (prova1/prova2/prova3) ed Email 5 (extra = avviso) da qui;
        // Email 6 (recap = avviso finale) dal cron `step5-notifiche` 2 ore
        // dopo la consegna dell'avviso (extra).
        let tipo: TipoMessaggio = 'notifica_pro';
        let skip = false;
        const chatId = utente.telegramChatId;

        if (client) {
          const { data: rpcData, error: rpcError } = await client.rpc('incrementa_notifiche_utente', {
            p_user_id: utente.id,
          });
          if (rpcError) {
            console.warn(
              `  ⚠ RPC contatore notifiche fallita per ${utente.id.slice(0, 8)}… (${rpcError.message}) — invio comunque.`,
            );
            if (!pianoIllimitato(utente.piano)) tipo = 'prova1';
          } else if (rpcData?.[0]) {
            if (rpcData[0].consentito === false) {
              // Ciclo BASE completato (3 notifiche/anno scolastico inviate):
              // Email 5 (extra = avviso) una sola volta, poi si salta.
              // Email 6 (recap = avviso finale) è schedulata dal cron
              // `step5-notifiche` (Edge Function, 2 ore dopo l'avviso).
              if (pianoIllimitato(utente.piano)) {
                tipo = 'notifica_pro';
              } else if (!utente.notificheBloccoInviato && !utentiBloccoGiaAvvisati.has(utente.id)) {
                // Email 5 — warning "periodo di prova terminato": UNA SOLA VOLTA.
                // Il set per-run evita di ripeterlo per ogni altro interpello del
                // batch (il flag `notifiche_blocco_inviato` in memoria è ancora false).
                tipo = 'extra';
                utentiBloccoGiaAvvisati.add(utente.id);
              } else {
                skip = true;
                utentiEsauriti.add(utente.id);
              }
            } else {
              const usate = Number(rpcData[0].notifiche_usate);
              tipo =
                pianoIllimitato(utente.piano)
                  ? 'notifica_pro'
                  : usate === 1
                    ? 'prova1'
                    : usate === 2
                      ? 'prova2'
                      : 'prova3';
            }
          }
        }

        if (skip) return [];

        const jobs: Array<{ tipo: 'email' | 'telegram'; promessa: Promise<EsitoJob> }> = [];

        // Canale EMAIL (Resend): tentato per OGNI notifica; l'errore API esatto
        // viene loggato integralmente.
        if (utente.email && resend) {
          const destinatario: DestinatarioNotifica = {
            email: utente.email,
            nome: utente.nome,
            province: utente.province,
            classi: utente.classi,
          };
          jobs.push({
            tipo: 'email',
            promessa: inviaNotificaEmail(resend, dettagli, destinatario, {
              dryRun,
              dashboardUrl,
              tipo,
            }).then((e) => {
              if (!e.inviata) {
                console.warn(`  ✗ Email a ${utente.email} fallita: ${e.error ?? 'errore sconosciuto'}`);
              }
              return { ok: e.inviata };
            }),
          });
        }

        // Canale TELEGRAM: tentato per OGNI notifica se il bot è collegato.
        if (chatId) {
          jobs.push({
            tipo: 'telegram',
            promessa: (async () => {
              if (dryRun) {
                console.log(`  ✈ [DRY-RUN] → Telegram ${chatId}`);
                return { ok: true };
              }
              const r = await inviaNotificaTelegram(chatId, dettagli, {
                classiUtente: utente.classi,
                dashboardUrl,
                tipo,
              });
              if (r.ok) console.log(`  ✓ Telegram inviato a chat ${chatId}`);
              else console.warn(`  ✗ Telegram a ${chatId} fallito: ${r.error ?? 'errore'}`);
              return { ok: r.ok };
            })(),
          });
        }

        const completati = await Promise.all(
          jobs.map((j) =>
            j.promessa
              .then((valore) => ({ tipo: j.tipo, valore }))
              .catch(() => ({ tipo: j.tipo, valore: { ok: false } })),
          ),
        );

        // Email 5 (extra) consegnata su almeno un canale: segna l'istante di
        // invio e il flag una tantum. Il cron `step5-notifiche` invierà poi
        // Email 6 (recap = avviso finale) 2 ore dopo via Edge Function.
        if (client && tipo === 'extra' && completati.some((c) => c.valore.ok)) {
          const { error: errFlag } = await client
            .from('profiles')
            .update({ notifiche_blocco_inviato: true, step4_inviata_at: new Date().toISOString() })
            .eq('id', utente.id);
          if (errFlag) {
            console.warn(`  ⚠ flag sequenza post-prova non aggiornato per ${utente.id.slice(0, 8)}… (${errFlag.message})`);
          }
        }
        // REGISTRO INVII: chiave LEGACY agnostica (compatibilità) + registro
        // completo (hash + impronta + URL) per ogni canale andato a buon fine.
        if (completati.some((c) => c.valore.ok)) {
          registraNotificaLocale(utente.id, interpello.hashId);
          for (const c of completati) {
            if (c.valore.ok) {
              await registraInvioAvviso(client, utente.id, avvisoLegacy, c.tipo);
            }
          }
        }
        return completati;
      }),
    );

    for (const gruppo of risultati) {
      for (const r of gruppo) {
        if (r.valore.ok) {
          if (r.tipo === 'email') esito.inviate += 1;
          else esito.telegramInviate += 1;
        } else if (r.tipo === 'email') {
          esito.fallite += 1;
        } else {
          esito.telegramFallite += 1;
        }
      }
    }
  }

  console.log(
    `✓ Notifiche elaborate: ${esito.inviate} email inviate · ${esito.fallite} email fallite · ` +
      `${esito.telegramInviate} Telegram inviati · ${esito.telegramFallite} Telegram falliti.`,
  );
  return esito;
}

/* -------------------- Dispatch immediato per singolo utente -------------------- */

export interface EsitoDispatchUtente extends EsitoNotifiche {
  /** Interpelli ATTIVI compatibili con il profilo. */
  interpelli: number;
  /** Interpelli saltati perché già notificati (ledger). */
  saltati: number;
}

/**
 * DISPATCH IMMEDIATO per un utente: notifica OGNI interpello ATTIVO compatibile
 * con il suo profilo (province + classi), anche se già presente in DB — colma il
 * caso in cui un'opportunità è in bacheca ma non è mai stata notificata (perché
 * l'utente non era matchato al momento dell'inserimento, o il matching era
 * disallineato). Ogni notifica include l'EMAIL DI CANDIDATURA dell'avviso.
 *
 * Dedupe tramite `notifications_log` (best-effort se la tabella non esiste):
 * una seconda esecuzione NON rispedisce gli stessi interpelli.
 * Non lancia eccezioni: ogni errore è loggato e conteggiato.
 */
export async function notificaInterpelliPerUtente(
  client: SupabaseClient | null,
  target: { userId?: string; email?: string },
  opts: NotificheOptions = {},
): Promise<EsitoDispatchUtente> {
  const esito: EsitoDispatchUtente = {
    inviate: 0,
    fallite: 0,
    telegramInviate: 0,
    telegramFallite: 0,
    interpelli: 0,
    saltati: 0,
  };
  if (!client) {
    console.warn('⚠ dispatch: client Supabase mancante.');
    return esito;
  }

  // 1. Profilo (per id o per email, case-insensitive).
  let q = client
    .from('profiles')
    .select(
      'id,email,email_notifica,nome,province_interesse,province_attive,classi_concorso,telegram_chat_id,piano,is_free_forever,radar_attivo',
    );
  q = target.userId
    ? q.eq('id', target.userId)
    : q.eq('email', String(target.email ?? '').trim().toLowerCase());
  const { data: prof, error } = await q.maybeSingle();
  if (error || !prof) {
    console.warn(`⚠ dispatch: profilo non trovato (${error?.message ?? 'nessuna riga'}).`);
    return esito;
  }
  if (prof.radar_attivo === false) {
    console.warn(`⚠ dispatch: Radar in PAUSA per ${prof.email} — nessun invio.`);
    return esito;
  }

  const email = String(prof.email_notifica || prof.email || '').trim();
  const chatId = prof.telegram_chat_id ? String(prof.telegram_chat_id).trim() : '';
  const province = (prof.province_interesse ?? prof.province_attive ?? []) as string[];
  const classiProfilo = (prof.classi_concorso ?? []) as string[];
  const piano = prof.is_free_forever === true ? 'free_forever' : String(prof.piano ?? 'base');
  const resend = getResendClient();

  if (!email && !chatId) {
    console.warn(`⚠ dispatch: nessun canale (email/Telegram) per ${prof.email}.`);
    return esito;
  }

  // 2. Interpelli ATTIVI nelle province del profilo (nessun filtro classe qui):
  //    ogni riga passa poi dalla REGOLA UNICA profilo ↔ opportunità, così non
  //    partono né avvisi di altre province né opportunità di classi non seguite.
  const righe = (await searchInterpelli(client, { province })) ?? [];
  const oggi = Date.now();

  for (const r of righe) {
    if (r.expiration_date && new Date(r.expiration_date).getTime() < oggi) continue;
    const classiInterpello = (r.class_codes ?? []).filter(Boolean);
    if (
      !avvisoCompatibileConProfilo(
        { province, classi: classiProfilo },
        { province: r.province, classi: classiInterpello, materia: r.materia, titolo: r.title },
      ).ok
    ) {
      continue;
    }
    esito.interpelli += 1;

    const dettagli: DettagliNotifica = {
      id: r.hash_id,
      title: r.title,
      schoolName: r.school_name,
      province: r.province,
      classi: classiInterpello,
      materia: r.materia,
      scadenza: r.expiration_date,
      link: r.source_url,
      // Email di candidatura: eventuale fallback dalla convenzione MIM sul
      // codice meccanografico (le righe storiche possono averlo senza email).
      contactEmail: recapitoNotifica(
        r.contact_email,
        r.school_code,
        `${r.title} ${r.school_name ?? ''}`,
      ),
    };
    const tipo: TipoMessaggio = pianoIllimitato(piano) ? 'notifica_pro' : 'prova1';

    // GATE DI QUALITÀ STRICT: nessun dispatch di avvisi incompleti (link diretto
    // all'avviso + recapito di candidatura obbligatori).
    if (!superaGateQualita(dettagli, 'dispatch utente')) continue;

    const avvisoDispatch = avvisoDaDettagli(dettagli);
    // FREQUENCY CAP (scuola + classi + impronta del contenuto) su entrambi i
    // canali: max 2 invii in 2 giorni diversi, mai due volte nello stesso giorno.
    // Riconosce l'opportunità anche quando torna con un `hash_id` diverso.
    if (
      (await avvisoGiaInviato(client, String(prof.id), avvisoDispatch, 'email')).inviato ||
      (await avvisoGiaInviato(client, String(prof.id), avvisoDispatch, 'telegram')).inviato
    ) {
      esito.saltati += 1;
      continue;
    }

    let okAny = false;
    if (email && resend) {
      const destinatario: DestinatarioNotifica = {
        email,
        nome: prof.nome ? String(prof.nome) : undefined,
        province,
        classi: classiProfilo,
      };
      const e = await inviaNotificaEmail(resend, dettagli, destinatario, {
        dryRun: opts.dryRun,
        dashboardUrl: opts.dashboardUrl,
        tipo,
      });
      if (e.inviata) {
        esito.inviate += 1;
        okAny = true;
        if (!opts.dryRun) await registraNotifica(client, String(prof.id), r.hash_id, 'email');
      } else {
        esito.fallite += 1;
        console.warn(`  ✗ Email a ${email} fallita: ${e.error ?? 'errore sconosciuto'}`);
      }
    }

    if (chatId) {
      if (opts.dryRun) {
        console.log(`  ✈ [DRY-RUN] Telegram ${chatId} ← ${r.title.slice(0, 60)}`);
        esito.telegramInviate += 1;
        okAny = true;
      } else {
        const t = await inviaNotificaTelegram(chatId, dettagli, {
          classiUtente: classiProfilo,
          dashboardUrl: opts.dashboardUrl,
          tipo,
        });
        if (t.ok) {
          esito.telegramInviate += 1;
          okAny = true;
          await registraNotifica(client, String(prof.id), r.hash_id, 'telegram');
        } else {
          esito.telegramFallite += 1;
          console.warn(`  ✗ Telegram a ${chatId} fallito: ${t.error ?? 'errore'}`);
        }
      }
    }

    if (!okAny) console.warn(`  ⚠ Nessun canale disponibile per "${r.title.slice(0, 60)}".`);
    else {
      // Il frequency cap conta i GIORNI per identità: nessuna chiave legacy su
      // file (sarebbe un blocco permanente e romperebbe il cap a 2 giorni).
      await registraInvioAvviso(client, String(prof.id), avvisoDispatch, 'email');
      await registraInvioAvviso(client, String(prof.id), avvisoDispatch, 'telegram');
    }
  }

  console.log(
    `✓ Dispatch ${prof.email}: ${esito.interpelli} interpelli compatibili · ${esito.saltati} già notificati · ` +
      `${esito.inviate} email · ${esito.telegramInviate} Telegram.`,
  );
  return esito;
}


/* ======================= DIGEST GIORNALIERO (18:00 italiane) ======================= */

export interface EsitoDigest extends EsitoNotifiche {
  /** Profili notificabili esaminati. */
  utenti: number;
  /** Digest realmente inviati (almeno un canale consegnato). */
  digest: number;
  /** Opportunità incluse nei digest inviati. */
  voci: number;
  /** Utenti saltati (nessuna novità, quota esaurita, nessun canale). */
  saltati: number;
  /** Opportunità marcate come consegnate SENZA invio (modalità recupero). */
  registrate: number;
}

/** Esito vuoto (nessun invio). */
function esitoDigestVuoto(): EsitoDigest {
  return {
    inviate: 0,
    fallite: 0,
    telegramInviate: 0,
    telegramFallite: 0,
    utenti: 0,
    digest: 0,
    voci: 0,
    saltati: 0,
    registrate: 0,
  };
}

/** Profilo singolo (admin): riusa la validazione di eleggibilità del matching. */
async function utentiSingoli(
  client: SupabaseClient,
  target: { userId?: string; email?: string },
): Promise<UtenteCompatibile[]> {
  const tutti = await elencaUtentiNotificabili(client);
  const email = String(target.email ?? '').trim().toLowerCase();
  const trovati = tutti.filter((u) =>
    target.userId ? u.id === target.userId : String(u.email).toLowerCase() === email,
  );
  if (trovati.length === 0) {
    console.warn(`⚠ digest: profilo non trovato o non notificabile (${target.userId ?? target.email}).`);
  }
  return trovati;
}

/**
 * Opportunità ATTIVE compatibili con il profilo e NON ancora consegnate SU QUEL
 * CANALE (ledger per canale).
 *
 * STRICT: ogni avviso passa dalla REGOLA UNICA `avvisoCompatibileConProfilo`
 * (provincia del profilo + classe/materia in comune + guardia sostegno) — così
 * nel riepilogo non entrano MAI avvisi di un'altra provincia o di classi che
 * l'utente non ha scelto. Il match classe usa la normalizzazione A-26 ≡ A-026.
 */
async function raccogliVociCanale(
  client: SupabaseClient,
  utente: UtenteCompatibile,
  canale: CanaleNotifica,
  finoA?: string | null,
): Promise<DettagliNotifica[]> {
  const righe = (await searchInterpelli(client, { province: utente.province })) ?? [];
  const oggi = Date.now();
  const tetto = finoA ? new Date(finoA).getTime() : null;
  const voci: DettagliNotifica[] = [];
  for (const r of righe) {
    if (r.expiration_date && new Date(r.expiration_date).getTime() < oggi) continue;
    // Tetto temporale opzionale (recupero/marcatura di invii già avvenuti):
    // si escludono le opportunità inserite DOPO l'istante indicato, così non
    // vengono mai "marcate come inviate" segnalazioni nuove.
    if (tetto !== null && r.created_at) {
      const creato = new Date(r.created_at).getTime();
      if (!Number.isNaN(creato) && creato > tetto) continue;
    }
    const classiInterpello = (r.class_codes ?? []).filter(Boolean);
    // REGOLA UNICA profilo ↔ opportunità (provincia + classe, guardia sostegno):
    // esclude gli avvisi di un'altra provincia e quelli senza classe/materia in
    // comune. Il match usa la normalizzazione A-26 ≡ A-026.
    if (
      !avvisoCompatibileConProfilo(
        { province: utente.province, classi: utente.classi, sostegno: utente.sostegno },
        {
          province: r.province,
          classi: classiInterpello,
          materia: r.materia,
          titolo: r.title,
        },
      ).ok
    ) {
      continue;
    }
    // DEDUPLICA STRICT (prima dell'invio): l'avviso è già stato consegnato a
    // questo utente su questo canale? Il guard riconosce l'opportunità da hash,
    // impronta (stabile) o URL ufficiale — così un avviso tornato con un `hash_id`
    // diverso (ripubblicato/ri-scrapato) NON viene rispedito.
    const dedup = await avvisoGiaInviato(
      client,
      utente.id,
      {
        hashId: r.hash_id,
        title: r.title,
        schoolName: r.school_name,
        province: r.province,
        classi: classiInterpello,
        link: r.source_url,
      },
      canale,
    );
    if (dedup.inviato) continue;
    const voce: DettagliNotifica = {
      id: r.hash_id,
      title: r.title,
      schoolName: r.school_name,
      province: r.province,
      classi: classiInterpello,
      materia: r.materia,
      scadenza: r.expiration_date,
      link: r.source_url,
      contactEmail: recapitoNotifica(
        r.contact_email,
        r.school_code,
        `${r.title} ${r.school_name ?? ''}`,
      ),
    };
    // GATE DI QUALITÀ STRICT: la voce entra nel digest/riepilogo solo con link
    // diretto all'avviso e recapito di candidatura validi.
    if (!superaGateQualita(voce, `digest ${canale}`)) continue;
    voci.push(voce);
  }
  return ordinaVociDigest(voci);
}

/** Unione delle voci dei canali (dedup per id, ordine per scadenza). */
function unisciVoci(...liste: DettagliNotifica[][]): DettagliNotifica[] {
  const visti = new Set<string>();
  const out: DettagliNotifica[] = [];
  for (const lista of liste) {
    for (const v of lista) {
      const chiave = v.id ?? `${v.title}|${v.scadenza ?? ''}`;
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      out.push(v);
    }
  }
  return ordinaVociDigest(out);
}

/**
 * Esegue il DIGEST GIORNALIERO: per ogni profilo notificabile raccoglie TUTTE le
 * opportunità attive compatibili non ancora notificate (ledger) e invia UNA SOLA
 * email + UN SOLO messaggio Telegram con il riepilogo, ordinato per scadenza.
 *
 * Sostituisce l'invio in tempo reale (`notificaNuoviInterpelli`): niente più N
 * email al giorno. Va eseguito una volta al giorno alla chiusura delle scuole
 * (18:00 italiane — vedi `eOraDelDigest` e il workflow `digest.yml`).
 *
 * Consumo quota: UN credito per digest (il digest È la notifica del giorno), con
 * la stessa sequenza prova1 → prova2 → prova3 → extra del piano BASE; dopo il
 * digest `extra` il cron DB `step5-notifiche` invia l'avviso finale (recap).
 *
 * Dedupe: ledger locale + `notifications_log` (tutte le voci incluse vengono
 * marcate, così il digest di domani non le ripete). Non lancia eccezioni.
 */
export async function inviaDigestGiornaliero(
  client: SupabaseClient | null,
  opts: NotificheOptions & {
    /** Ignora la finestra oraria (lancio manuale / admin). */
    forzato?: boolean;
    /** Limita il digest a un solo profilo (per id o email). */
    soloUtente?: { userId?: string; email?: string };
    /**
     * MODALITÀ RECUPERO: marca le opportunità come CONSEGNATE senza inviare nulla.
     * Serve a registrare invii realmente avvenuti quando il ledger DB non era
     * disponibile (es. digest spedito prima di applicare le migrazioni): senza
     * questa marcatura il digest successivo rimanderebbe le stesse voci.
     * Non consuma quota e non tocca i canali.
     */
    soloRegistrare?: boolean;
    /**
     * Tetto temporale (ISO) per `soloRegistrare`: marca SOLO le opportunità
     * inserite entro quell'istante, così le segnalazioni più recenti (non ancora
     * inviate) mantengono il diritto al digest.
     */
    finoA?: string | null;
    /**
     * Seam di invio EMAIL (test e canali alternativi): default
     * `inviaDigestEmail` (Resend). Permette di verificare la deduplica
     * end-to-end senza rete.
     */
    inviaEmail?: (
      voci: DettagliNotifica[],
      destinatario: DestinatarioNotifica,
    ) => Promise<{ inviata: boolean; error?: string }>;
    /** Seam di invio TELEGRAM (batch BASE): default `inviaDigestTelegram`. */
    inviaTelegram?: (
      chatId: string,
      voci: DettagliNotifica[],
    ) => Promise<{ ok: boolean; error?: string }>;
  } = {},
): Promise<EsitoDigest> {
  const esito = esitoDigestVuoto();
  if (!client) {
    console.warn('⚠ digest: client Supabase mancante.');
    return esito;
  }

  // AUTOMAZIONE «Riepilogo giornaliero» (pannello Admin → `app_settings`):
  // disattivata = nessun digest su email e Telegram. In `soloRegistrare` non si
  // invia nulla (solo marcatura), quindi il gate non si applica.
  const automazioneDigest = await statoAutomazioneEmail(client, 'digest_giornaliero');
  if (!opts.soloRegistrare && !automazioneDigest.abilitata) {
    console.log('⏸ digest: automazione disattivata dal pannello Admin (nessun invio).');
    return esito;
  }

  const resend = getResendClient();
  const { dryRun = false, dashboardUrl } = opts;
  const data = etichettaDataItalia();
  // Seam di invio (default: Resend/Telegram veri). Servono a verificare la
  // deduplica end-to-end senza rete (`npm run test:dedup:utente`).
  const inviaEmail =
    opts.inviaEmail ??
    ((voci: DettagliNotifica[], dest: DestinatarioNotifica) =>
      inviaDigestEmail(resend, voci, dest, {
        dryRun,
        dashboardUrl,
        data,
        oggetto: oggettoConsentito('digest_giornaliero', automazioneDigest),
      }));
  const inviaTelegramBatch =
    opts.inviaTelegram ??
    ((chatId: string, voci: DettagliNotifica[], classiUtente: string[]) =>
      inviaDigestTelegram(chatId, voci, { dashboardUrl, data, classiUtente }));
  const emailDisponibile = Boolean(resend) || Boolean(opts.inviaEmail);
  // Guardia "UNA sola email al giorno per utente": il cron può girare più volte
  // (due orari UTC per coprire estate/inverno, retry del runner, lancio manuale
  // senza `--force`). La chiave è registrata SOLO dopo un invio reale, quindi
  // un DRY-RUN non la "brucia" e un dispatch admin (`forzato`) la ignora.
  const giornoItalia = dataLocaleItalia();

  const utenti = opts.soloUtente
    ? await utentiSingoli(client, opts.soloUtente)
    : await elencaUtentiNotificabili(client);
  esito.utenti = utenti.length;
  if (utenti.length === 0) {
    console.log('ℹ digest: nessun profilo notificabile.');
    return esito;
  }
  console.log(
    `• Digest giornaliero (${descrizioneFinestraDigest()}): ${utenti.length} profili notificabili${
      dryRun ? ' [DRY-RUN]' : ''
    }.`,
  );

  // Stato PER-RUN: il flag in memoria `notifiche_blocco_inviato` resta `false`
  // dopo l'update su DB → senza questo set l'avviso "extra" potrebbe ripetersi
  // per lo stesso utente nello stesso run.
  const bloccoGiaAvvisati = new Set<string>();

  for (const utente of utenti) {
    const pro = pianoIllimitato(utente.piano);

    // GUARDIA GIORNALIERA: nessuna seconda email nello stesso giorno (ora
    // italiana) per lo stesso utente. Ignorata dai lanci forzati (admin) e
    // quando non c'è ancora una registrazione (dry-run / primo invio).
    if (
      !opts.soloRegistrare &&
      opts.forzato !== true &&
      ledgerLocaleGia(chiaveDigestGiorno(utente.id, giornoItalia))
    ) {
      esito.saltati += 1;
      console.log(
        `  – ${utente.email || utente.id.slice(0, 8)}: digest già inviato oggi (${giornoItalia}), nessun secondo invio.`,
      );
      continue;
    }

    // EMAIL → riepilogo quotidiano per ENTRAMBI i tier (una sola email al giorno).
    const vociEmail =
      utente.email && emailDisponibile
        ? await raccogliVociCanale(client, utente, 'email', opts.finoA)
        : [];
    // TELEGRAM → batch serale SOLO per BASE: i PRO ricevono gli alert in TEMPO
    // REALE appena scrapati (`inviaAlertTelegramTempoReale`), quindi il batch
    // Telegram ripeterebbe gli stessi avvisi.
    const vociTelegram =
      utente.telegramChatId && !pro
        ? await raccogliVociCanale(client, utente, 'telegram', opts.finoA)
        : [];
    const voci = unisciVoci(vociEmail, vociTelegram);
    if (voci.length === 0) {
      esito.saltati += 1;
      continue;
    }

    // MODALITÀ RECUPERO (nessun invio): marca le voci come consegnate su TUTTI i
    // canali (chiave legacy agnostica): registra invii realmente avvenuti quando
    // il ledger non era disponibile.
    if (opts.soloRegistrare) {
      let marcate = 0;
      for (const v of voci) {
        if (!v.id) continue;
        // Chiave LEGACY agnostica + registro completo (hash/impronta/URL) su
        // entrambi i canali: il recupero deve lasciare lo stesso stato di un invio.
        registraNotificaLocale(utente.id, v.id);
        await registraInvioAvviso(client, utente.id, avvisoDaDettagli(v), 'email');
        await registraInvioAvviso(client, utente.id, avvisoDaDettagli(v), 'telegram');
        marcate += 1;
      }
      ledgerLocaleSalva();
      esito.registrate += marcate;
      console.log(
        `  ✎ ${utente.email || utente.id.slice(0, 8)}: ${marcate} opportunità marcate come consegnate (nessun invio).`,
      );
      continue;
    }

    // Quota: UN solo incremento al giorno e SOLO per BASE (PRO è illimitato:
    // nessuna chiamata RPC). `tipo` resta per la diagnostica e per il flag della
    // sequenza post-quota.
    let tipo: TipoMessaggio = 'notifica_pro';
    let skip = false;
    const rpc = pro
      ? { data: [] as Array<{ consentito?: boolean; notifiche_usate?: number }>, error: null }
      : await client.rpc('incrementa_notifiche_utente', { p_user_id: utente.id });
    if (rpc.error) {
      console.warn(
        `  ⚠ RPC contatore notifiche fallita per ${utente.id.slice(0, 8)}… (${rpc.error.message}) — invio comunque.`,
      );
      tipo = 'prova1';
    } else if (rpc.data?.[0]) {
      if (rpc.data[0].consentito === false) {
        // Ciclo BASE completato (3 notifiche/anno scolastico): avviso "extra" UNA
        // volta, poi si salta (il recap finale arriva dal cron `step5-notifiche`).
        if (!utente.notificheBloccoInviato && !bloccoGiaAvvisati.has(utente.id)) {
          tipo = 'extra';
          bloccoGiaAvvisati.add(utente.id);
        } else {
          skip = true;
        }
      } else {
        const usate = Number(rpc.data[0].notifiche_usate);
        tipo = usate === 1 ? 'prova1' : usate === 2 ? 'prova2' : 'prova3';
      }
    }
    if (skip) {
      esito.saltati += 1;
      console.log(`  – ${utente.email || utente.telegramChatId}: quota BASE esaurita, nessun digest.`);
      continue;
    }

    const destinatario: DestinatarioNotifica = {
      email: utente.email,
      nome: utente.nome,
      province: utente.province,
      classi: utente.classi,
    };

    const canaliOk: CanaleNotifica[] = [];

    // EMAIL: riepilogo delle voci non ancora inviate per email (entrambi i tier).
    if (vociEmail.length > 0 && utente.email && emailDisponibile) {
      const e = await inviaEmail(vociEmail, destinatario);
      if (e.inviata) {
        esito.inviate += 1;
        canaliOk.push('email');
      } else {
        esito.fallite += 1;
        console.warn(`  ✗ Riepilogo email a ${utente.email}: ${e.error ?? 'errore sconosciuto'}`);
      }
    }

    // TELEGRAM: UN SOLO batch e SOLO per BASE (i PRO sono già stati avvisati in
    // tempo reale). Resta un messaggio di testo: il batch è lungo.
    if (vociTelegram.length > 0 && utente.telegramChatId) {
      if (dryRun && !opts.inviaTelegram) {
        console.log(
          `  ✈ [DRY-RUN] Batch Telegram BASE → ${utente.telegramChatId} (${vociTelegram.length} voci)`,
        );
        esito.telegramInviate += 1;
        canaliOk.push('telegram');
      } else {
        const t = await inviaTelegramBatch(utente.telegramChatId, vociTelegram, utente.classi);
        if (t.ok) {
          esito.telegramInviate += 1;
          canaliOk.push('telegram');
        } else {
          esito.telegramFallite += 1;
          console.warn(`  ✗ Batch Telegram a ${utente.telegramChatId}: ${t.error ?? 'errore'}`);
        }
      }
    }

    if (canaliOk.length === 0) {
      console.warn(
        `  ⚠ Riepilogo non consegnato a ${utente.email || utente.id.slice(0, 8)} (nessun canale riuscito).`,
      );
      esito.saltati += 1;
      continue;
    }

    // REGISTRO INVII (frequency cap): ogni voce consegnata registra il GIORNO
    // dell'invio per la sua identità (scuola + classi + impronta del contenuto)
    // sul canale usato — ledger su file + `notifications_log`. Così la stessa
    // opportunità può tornare AL MASSIMO 2 volte in 2 giorni diversi e mai due
    // volte nello stesso giorno; un contenuto NUOVO riparte da capo.
    // In DRY-RUN non si registra NULLA: un test non deve "bruciare" le voci.
    if (!dryRun) {
      for (const v of vociEmail) {
        if (!v.id) continue;
        await registraInvioAvviso(client, utente.id, avvisoDaDettagli(v), 'email');
      }
      for (const v of vociTelegram) {
        if (!v.id) continue;
        await registraInvioAvviso(client, utente.id, avvisoDaDettagli(v), 'telegram');
      }
      // GUARDIA GIORNALIERA: un solo riepilogo al giorno per utente. Si registra
      // QUI (dopo una consegna riuscita) così il secondo run della giornata non
      // manda un'altra email con eventuali voci nuove.
      ledgerLocaleRegistra(chiaveDigestGiorno(utente.id, giornoItalia));
      // Persistenza INCREMENTALE: se il run si interrompe (rete/DB caduti a metà
      // loop) quanto già consegnato è comunque su disco e non verrà rimandato.
      ledgerLocaleSalva();
    }

    // Quota BASE esaurita (avviso "extra") consegnata: flag una tantum + istante.
    // Il cron DB `step5-notifiche` invierà poi l'avviso finale (recap).
    if (tipo === 'extra') {
      const { error: errFlag } = await client
        .from('profiles')
        .update({ notifiche_blocco_inviato: true, step4_inviata_at: new Date().toISOString() })
        .eq('id', utente.id);
      if (errFlag) {
        console.warn(`  ⚠ flag post-quota non aggiornato per ${utente.id.slice(0, 8)}… (${errFlag.message})`);
      }
    }

    esito.digest += 1;
    esito.voci += voci.length;
    console.log(
      `  ✓ Riepilogo ${tipo} (${pro ? 'PRO' : 'BASE'}) a ${utente.email || utente.telegramChatId}: ` +
        `${voci.length} opportunità (${canaliOk.join('+')})`,
    );
  }

  // PERSISTENZA DEL LEDGER: `registraNotificaLocale` scrive in memoria, il file
  // va salvato a fine run. Senza questa chiamata il ledger locale andrebbe perso
  // a fine processo e — se la tabella `notifications_log` non è ancora applicata —
  // il digest successivo rimanderebbe le stesse opportunità (bug "notifiche
  // ripetute"). `ledgerLocaleSalva` è best-effort e non lancia mai.
  ledgerLocaleSalva();

  console.log(
    `✓ Digest giornaliero: ${esito.digest} inviati · ${esito.voci} opportunità · ${esito.registrate} marcate (recupero) · ` +
      `${esito.saltati} saltati · ${esito.inviate} email · ${esito.telegramInviate} Telegram · ` +
      `${esito.fallite + esito.telegramFallite} errori.`,
  );
  return esito;
}



/* ==================== PROMEMORIA 24h (scadenza vicina) — EMAIL ==================== */
/**
 * PROMEMORIA 24h — UN SOLO promemoria per interpello, UN'UNICA email per utente.
 *
 * Perché: il digest consegna TUTTE le opportunità del giorno; se una di queste
 * ha la scadenza VICINA (alta priorità) e sono passate ≥ 24 ore dalla consegna,
 * un solo promemoria aiuta chi non l'ha ancora aperta — senza spammare:
 *   · UNA email per utente (mai una email per avviso);
 *   · guardia anti-duplicato per coppia (utente, interpello) su ledger DB
 *     (`notifications_log.canale = 'promemoria'`) + ledger su file;
 *   · nessun consumo di quota (il promemoria non è una notifica nuova);
 *   · niente promemoria per opportunità scadute, non urgenti o già ricordate.
 *
 * Dipendenza dai timestamp: le 24 ore si misurano su `notifications_log.sent_at`
 * del canale `email`. Se il ledger DB non è disponibile non ci sono timestamp
 * affidabili → NESSUN promemoria (mai un doppio invio "a caso").
 *
 * Non lancia MAI eccezioni: ogni errore è loggato e contato.
 */
export interface EsitoPromemoria extends EsitoNotifiche {
  /** Profili notificabili esaminati. */
  utenti: number;
  /** Opportunità incluse nei promemoria inviati. */
  voci: number;
  /** Utenti senza voci idonee in questo giro. */
  saltati: number;
  /** Utenti senza storico di invio (ledger DB assente): 24h non calcolabili. */
  senzaStorico: number;
}

export interface OpzioniPromemoria24h extends NotificheOptions {
  /** Limita il giro a un solo profilo (per id o email). */
  soloUtente?: { userId?: string; email?: string };
  /** Istantaneo di riferimento (default: adesso). Utile ai test. */
  adesso?: Date;
  /** Ore minime dalla consegna (default 24). */
  oreMinime?: number;
  /** Giorni di alta priorità (default 3). */
  giorniUrgenza?: number;
  /**
   * Seam di invio (test e canali alternativi): default `inviaPromemoriaEmail`.
   * Permette di verificare l'anti-duplicato senza rete.
   */
  inviaEmail?: (
    voci: DettagliNotifica[],
    destinatario: DestinatarioNotifica,
  ) => Promise<{ inviata: boolean; error?: string }>;
}

/** Esito vuoto (nessun invio). */
function esitoPromemoriaVuoto(): EsitoPromemoria {
  return {
    inviate: 0,
    fallite: 0,
    telegramInviate: 0,
    telegramFallite: 0,
    utenti: 0,
    voci: 0,
    saltati: 0,
    senzaStorico: 0,
  };
}

/**
 * Storico degli invii EMAIL di un utente: `hash → sent_at` (il più recente).
 * `null` se il ledger DB non è disponibile (nessun timestamp affidabile).
 */
async function storicoInviiEmail(
  client: SupabaseClient,
  userId: string,
  limite = 50,
): Promise<Map<string, string> | null> {
  try {
    const { data, error } = await client
      .from('notifications_log')
      .select('interpello_hash, sent_at')
      .eq('user_id', userId)
      .eq('canale', 'email')
      .order('sent_at', { ascending: false })
      .limit(limite);
    if (error) {
      if (!ledgerNotificheAvvisato) {
        ledgerNotificheAvvisato = true;
        console.warn(
          `⚠ Promemoria: ledger notifiche NON disponibile (${error.message}): nessun timestamp di invio, ` +
            'nessun promemoria (applicare `20260914030000_repair_notifications_log_e_rpc_quota.sql`).',
        );
      }
      return null;
    }
    const mappa = new Map<string, string>();
    for (const r of data ?? []) {
      const hash = String(r.interpello_hash ?? '').trim();
      const sent = String(r.sent_at ?? '').trim();
      if (!hash || !sent) continue;
      // L'ordine è decrescente: la PRIMA occorrenza è l'invio più recente.
      if (!mappa.has(hash)) mappa.set(hash, sent);
    }
    return mappa;
  } catch {
    return null;
  }
}

/** Righe `interpelli` per un elenco di hash (una sola query, nessun duplicato). */
async function righeInterpelliPerHash(
  client: SupabaseClient,
  hashIds: string[],
): Promise<InterpelloDB[]> {
  const hash = [...new Set(hashIds.map((h) => h.trim()).filter(Boolean))];
  if (hash.length === 0) return [];
  try {
    const { data, error } = await client.from('interpelli').select('*').in('hash_id', hash);
    if (error) {
      console.warn(`⚠ Promemoria: lettura interpelli fallita (${error.message}).`);
      return [];
    }
    return (data ?? []) as InterpelloDB[];
  } catch {
    return [];
  }
}

/**
 * Esegue il giro di PROMEMORIA: per ogni profilo notificabile trova le
 * opportunità consegnate da ≥ 24 ore, ancora attive e in scadenza vicina, e
 * invia UNA sola email con tutte (guardia: una volta per interpello).
 */
export async function inviaPromemoria24h(
  client: SupabaseClient | null,
  opts: OpzioniPromemoria24h = {},
): Promise<EsitoPromemoria> {
  const esito = esitoPromemoriaVuoto();
  if (!client) {
    console.warn('⚠ promemoria: client Supabase mancante.');
    return esito;
  }

  // AUTOMAZIONE «Promemoria scadenza (24h)» (pannello Admin → `app_settings`):
  // disattivata = nessun promemoria (nessun invio, nessuna eccezione).
  const automazionePromemoria = await statoAutomazioneEmail(client, 'promemoria_scadenza');
  if (!automazionePromemoria.abilitata) {
    console.log('⏸ promemoria: automazione disattivata dal pannello Admin (nessun invio).');
    return esito;
  }

  const resend = getResendClient();
  const { dryRun = false, dashboardUrl } = opts;
  const adesso = opts.adesso ?? new Date();
  const oreMinime = opts.oreMinime ?? ORE_PROMEMORIA;
  const giorniUrgenza = opts.giorniUrgenza ?? GIORNI_URGENZA_PROMEMORIA;
  const invia =
    opts.inviaEmail ??
    ((voci: DettagliNotifica[], destinatario: DestinatarioNotifica) =>
      inviaPromemoriaEmail(resend, voci, destinatario, {
        dryRun,
        dashboardUrl,
        giorni: giorniUrgenza,
        oggetto: oggettoConsentito('promemoria_scadenza', automazionePromemoria),
      }));

  const utenti = opts.soloUtente
    ? await utentiSingoli(client, opts.soloUtente)
    : await elencaUtentiNotificabili(client);
  esito.utenti = utenti.length;
  if (utenti.length === 0) {
    console.log('ℹ promemoria: nessun profilo notificabile.');
    return esito;
  }
  console.log(
    `• Promemoria 24h (consegna ≥ ${oreMinime}h, scadenza entro ${giorniUrgenza} gg): ` +
      `${utenti.length} profili notificabili${dryRun ? ' [DRY-RUN]' : ''}.`,
  );

  const motivi = new Map<string, number>();

  for (const utente of utenti) {
    if (!utente.email) continue;

    const storico = await storicoInviiEmail(client, utente.id);
    if (!storico) {
      esito.senzaStorico += 1;
      continue;
    }

    // Pre-filtro PURO sui timestamp: voci consegnate da almeno `oreMinime`.
    const daValutare = [...storico.entries()].filter(([, inviataIl]) => {
      const ore = oreTrascorse(inviataIl, adesso);
      return ore !== null && ore >= oreMinime;
    });
    if (daValutare.length === 0) {
      esito.saltati += 1;
      continue;
    }

    const righe = await righeInterpelliPerHash(
      client,
      daValutare.map(([hash]) => hash),
    );
    const voci: DettagliNotifica[] = [];
    for (const r of righe) {
      const classiInterpello = (r.class_codes ?? []).filter(Boolean);
      // REGOLA UNICA profilo ↔ opportunità (provincia/classe/sostegno): mai un
      // promemoria su un avviso che non riguarda l'utente.
      if (
        !avvisoCompatibileConProfilo(
          { province: utente.province, classi: utente.classi, sostegno: utente.sostegno },
          {
            province: r.province,
            classi: classiInterpello,
            materia: r.materia,
            titolo: r.title,
          },
        ).ok
      ) {
        continue;
      }

      const voce = {
        id: r.hash_id,
        title: r.title,
        province: r.province,
        scadenza: r.expiration_date,
      };
      // 1) controlli PURI (identità, 24h, scadenza/urgenza): nessuna query inutile.
      const motivo = motivoPromemoria(voce, storico.get(r.hash_id), {
        adesso,
        oreMinime,
        giorniUrgenza,
      });
      if (motivo !== 'ok') {
        motivi.set(motivo, (motivi.get(motivo) ?? 0) + 1);
        continue;
      }
      // 2) ANTI-DUPLICATO: UN SOLO promemoria per opportunità (marcatore
      //    PERMANENTE sul canale `promemoria`) E frequenza EMAIL non esaurita:
      //    il promemoria è una comunicazione sulla STESSA opportunità, quindi
      //    entra nel frequency cap (mai 2 email nello stesso giorno, max 2 giorni).
      const avvisoPromemoria: AvvisoDedup = {
        hashId: r.hash_id,
        title: r.title,
        schoolName: r.school_name,
        province: r.province,
        classi: classiInterpello,
        link: r.source_url,
      };
      const giaPromemoria = await promemoriaGiaInviato(client, utente.id, avvisoPromemoria);
      const freqEmail = giaPromemoria
        ? { inviato: true }
        : await avvisoGiaInviato(client, utente.id, avvisoPromemoria, 'email');
      if (giaPromemoria || freqEmail.inviato) {
        motivi.set('gia-promemoria', (motivi.get('gia-promemoria') ?? 0) + 1);
        continue;
      }

      const vocePromemoria: DettagliNotifica = {
        id: r.hash_id,
        title: r.title,
        schoolName: r.school_name,
        province: r.province,
        classi: classiInterpello,
        materia: r.materia,
        scadenza: r.expiration_date,
        link: r.source_url,
        contactEmail: recapitoNotifica(
          r.contact_email,
          r.school_code,
          `${r.title} ${r.school_name ?? ''}`,
        ),
      };
      // GATE DI QUALITÀ STRICT: nessun promemoria su un avviso incompleto
      // (link diretto + recapito obbligatori), come per ogni altra notifica.
      const motivoGate = motivoAvvisoNonInviabile({
        link: vocePromemoria.link,
        email: vocePromemoria.contactEmail,
      });
      if (motivoGate) {
        motivi.set(`gate:${motivoGate}`, (motivi.get(`gate:${motivoGate}`) ?? 0) + 1);
        continue;
      }
      voci.push(vocePromemoria);
    }

    if (voci.length === 0) {
      esito.saltati += 1;
      continue;
    }

    const destinatario: DestinatarioNotifica = {
      email: utente.email,
      nome: utente.nome,
      province: utente.province,
      classi: utente.classi,
    };
    const esitoInvio = await invia(voci, destinatario);
    if (!esitoInvio.inviata) {
      esito.fallite += 1;
      console.warn(`  ✗ Promemoria a ${utente.email}: ${esitoInvio.error ?? 'errore sconosciuto'}`);
      continue;
    }

    esito.inviate += 1;
    esito.voci += voci.length;
    if (!dryRun) {
      for (const v of voci) {
        if (!v.id) continue;
        const avvisoVoce = avvisoDaDettagli(v);
        // Marcatore PERMANENTE del promemoria (una volta per opportunità)...
        await registraPromemoria(client, utente.id, avvisoVoce);
        // ...e consumo del giorno EMAIL: il promemoria entra nel frequency cap.
        await registraInvioAvviso(client, utente.id, avvisoVoce, 'email');
      }
      ledgerLocaleSalva();
    }
    console.log(
      `  ✓ Promemoria a ${utente.email}: ${voci.length} opportunità in scadenza (una sola email).`,
    );
  }

  ledgerLocaleSalva();
  const dettaglioMotivi = [...motivi.entries()].map(([m, n]) => `${m}=${n}`).join(' · ');
  console.log(
    `✓ Promemoria 24h: ${esito.inviate} email · ${esito.voci} voci · ${esito.saltati} utenti senza voci idonee · ` +
      `${esito.senzaStorico} senza storico · ${esito.fallite} errori.${dettaglioMotivi ? ` [${dettaglioMotivi}]` : ''}`,
  );
  return esito;
}

/* =============== ALERT IN TEMPO REALE (solo PRO) — TELEGRAM =============== */

/**
 * DISPATCH IN TEMPO REALE su TELEGRAM — riservato al piano PRO.
 *
 * Split per tier:
 *   · **PRO** → alert INDIVIDUALI appena l'avviso viene scrapato (questo flusso):
 *     il vantaggio concreto del piano a pagamento;
 *   · **BASE** → NESSUN alert in tempo reale: un solo batch alle 17:00
 *     (`inviaDigestGiornaliero`).
 *
 * Note di servizio:
 *   · non consuma quota (PRO è illimitato by design) e non invia email (il
 *     riepilogo email resta quotidiano per entrambi i tier);
 *   · marca il canale `telegram` nel ledger → il batch serale (BASE) e il tempo
 *     reale non ripetono mai lo stesso avviso sullo stesso canale;
 *   · non lancia MAI eccezioni: ogni errore è loggato e contato.
 */
export async function inviaAlertTelegramTempoReale(
  client: SupabaseClient | null,
  nuovi: InterpelloParsato[],
  opts: NotificheOptions = {},
): Promise<EsitoNotifiche> {
  const esito: EsitoNotifiche = { inviate: 0, fallite: 0, telegramInviate: 0, telegramFallite: 0 };
  if (!client || nuovi.length === 0) return esito;

  // AUTOMAZIONE «Alert PRO in tempo reale» (pannello Admin → `app_settings`):
  // disattivata = nessun alert immediato (il digest serale resta invariato).
  const automazioneAlert = await statoAutomazioneEmail(client, 'alert_pro_tempo_reale');
  if (!automazioneAlert.abilitata) {
    console.log('⏸ alert PRO: automazione disattivata dal pannello Admin (nessun invio).');
    return esito;
  }

  const { dryRun = false, dashboardUrl } = opts;

  for (const interpello of nuovi) {
    // try/catch PER AVVISO: un errore su un avviso (dati sporchi, rete) non deve
    // interrompere il run e — soprattutto — non deve far perdere le marcature di
    // deduplica già registrate sugli avvisi precedenti.
    try {
      const dettagli: DettagliNotifica = {
        id: interpello.hashId,
        title: interpello.title,
        schoolName: interpello.schoolName,
        province: interpello.province,
        classi: interpello.classCodes,
        materia: interpello.materia,
        scadenza: interpello.expirationDate,
        link: interpello.link,
        contactEmail: recapitoNotifica(
          interpello.contactEmail,
          interpello.schoolCode,
          interpello.title,
        ),
      };

      // GATE DI QUALITÀ STRICT: l'alert PRO parte solo con link diretto
      // all'avviso e recapito di candidatura validi (una sola volta per avviso,
      // prima di calcolare gli utenti compatibili).
      if (!superaGateQualita(dettagli, 'alert PRO')) continue;

      const utenti = await findUtentiCompatibili(client, {
        province: interpello.province,
        classi: interpello.classCodes,
        titolo: interpello.title,
        materia: interpello.materia,
      });

      for (const utente of utenti) {
        // BASE → nessun tempo reale: riceverà il batch serale.
        if (!pianoIllimitato(utente.piano)) continue;
        const chatId = utente.telegramChatId;
        if (!chatId) continue;

        // FREQUENCY CAP (prima dell'invio): la stessa opportunità può arrivare
        // AL MASSIMO 2 volte in 2 giorni diversi e MAI due volte nello stesso
        // giorno; un contenuto aggiornato (nuova impronta) riparte da capo.
        const dedup = await avvisoGiaInviato(client, utente.id, avvisoDaDettagli(dettagli), 'telegram');
        if (dedup.inviato) {
          console.log(
            `  ↩ Alert PRO a ${chatId} saltato: ${dedup.per ?? 'frequenza'} · ${interpello.title.slice(0, 50)}`,
          );
          continue;
        }

        if (dryRun) {
          console.log(
            `  ✈ [DRY-RUN] Alert PRO → ${chatId} · ${interpello.title.slice(0, 60)}`,
          );
          esito.telegramInviate += 1;
          continue;
        }

        const r = await inviaNotificaTelegram(chatId, dettagli, {
          classiUtente: utente.classi,
          dashboardUrl,
          tipo: 'notifica_pro',
        });
        if (r.ok) {
          esito.telegramInviate += 1;
          // Registro completo (hash + impronta + URL) sul canale `telegram`.
          await registraInvioAvviso(client, utente.id, avvisoDaDettagli(dettagli), 'telegram');
          // PERSISTENZA IMMEDIATA della marcatura: se il run muore a metà (timeout
          // del workflow, kill del processo, errore su un avviso successivo) gli
          // alert GIÀ consegnati restano registrati e non vengono rimandati domani.
          ledgerLocaleSalva();
        } else {
          esito.telegramFallite += 1;
          console.warn(`  ✗ Alert PRO a ${chatId} fallito: ${r.error ?? 'errore'}`);
        }
      }
    } catch (err) {
      esito.fallite += 1;
      console.warn(
        `  ✗ Alert PRO non calcolabili per «${interpello.title.slice(0, 60)}»: ${(err as Error).message}`,
      );
    }
  }

  // Persistenza del ledger: gli alert consegnati non devono tornare nel batch.
  ledgerLocaleSalva();

  if (esito.telegramInviate + esito.telegramFallite > 0) {
    console.log(
      `• Alert PRO in tempo reale: ${esito.telegramInviate} inviati · ${esito.telegramFallite} falliti ` +
        `(${nuovi.length} avvisi esaminati).`,
    );
  }
  return esito;
}

