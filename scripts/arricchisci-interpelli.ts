/**
 * ScuoleRadar.it — Manutenzione DATI: arricchisce gli interpelli esistenti.
 *
 * Colma i buchi che rendono una riga inutilizzabile in vetrina e nelle notifiche
 * (nome scuola, codice, email di candidatura, PEC), dalla fonte più autorevole
 * alla meno: le successive coprono solo ciò che resta vuoto.
 *   0. ANAGRAFICA NAZIONALE (SCUANAGRAFE, `lib/anagraficaScuole.ts`): dal CODICE
 *      della riga, o dal NOME se univoco → denominazione reale + PEO + PEC;
 *   1. codice dal titolo/nome · 2. PEO dalla convenzione MIM · 2-bis. TAILORING
 *      (§26.68): recapito OSSERVATO della stessa scuola (storico interno) ·
 *   3. nome reale dal registro minimo. Non sovrascrive MAI un dato presente e non
 *      inventa nulla: senza appiglio reale la riga resta com'è.
 *
 * Uso:
 *   npm run dati:arricchisci                     # dry-run (mostra cosa cambierebbe)
 *   npm run dati:arricchisci -- --apply          # applica le modifiche (service role)
 *   npm run dati:arricchisci -- --no-anagrafica  # solo inferenze dal testo
 *
 * Cartella dei file SCUANAGRAFE: `SCUOLERADAR_ANAGRAFICA_DIR` (default `~/Downloads`).
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import {
  arricchisciDaAnagrafica,
  caricaAnagrafica,
  type IndiceAnagrafica,
} from '../src/lib/anagraficaScuole.ts';
import {
  estraiCodiceMeccanograficoDaTesto,
  risolviEmailUfficialeScuola,
} from '../src/lib/emailScuola.ts';
import { nomeScuolaDaCodice } from '../src/lib/school-lookup.ts';
import { indiceStoricoContatti, patchDaStorico } from '../src/scraper/storicoContatti.ts';
import { statoArricchimento } from '../src/lib/statoArricchimento.ts';
import {
  aggiornaInterpello,
  leggiTutteInterpelli,
} from './lib/interpelliManutenzione.ts';

process.loadEnvFile?.();

const apply = process.argv.includes('--apply');
/** Salta l'anagrafica nazionale (solo inferenze dal testo/convenzione MIM). */
const senzaAnagrafica = process.argv.includes('--no-anagrafica');
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('✗ Mancano SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nel file .env');
  process.exitCode = 1;
} else {
  const client = createClient(url, key, { auth: { persistSession: false } });

  // ANAGRAFICA NAZIONALE: caricata una volta sola (file SCUANAGRAFE locali).
  const anagrafica: IndiceAnagrafica | null = senzaAnagrafica ? null : caricaAnagrafica();
  if (anagrafica) {
    console.log(
      anagrafica.disponibile
        ? `• Anagrafica scuole: ${anagrafica.totale} codici meccanografici da ${anagrafica.fileLetti.length} file.`
        : '• Anagrafica scuole NON disponibile: imposta SCUOLERADAR_ANAGRAFICA_DIR (o scarica i file SCUANAGRAFE).',
    );
  }

  /**
   * Lettura TOLLERANTE (`lib/interpelliManutenzione.ts`): una colonna "recente"
   * assente (migrazione non applicata) viene tolta dall'elenco e la lettura
   * riprova — l'arricchimento non si interrompe mai. Le colonne mancanti dicono
   * quali campi NON vanno scritti nel patch.
   */
  const lettura = await leggiTutteInterpelli(client).catch((err: Error) => {
    console.error(`✗ Lettura interpelli non riuscita: ${err.message}`);
    process.exitCode = 1;
    return null;
  });
  if (lettura) {
    const righe = lettura.righe;
    /** True finché la colonna `school_pec` è disponibile (migrazione applicata). */
    const pecDisponibile = !lettura.assenti.has('school_pec');
    /** True finché la colonna `school_site` è disponibile (migrazione applicata). */
    const sitoDisponibile = !lettura.assenti.has('school_site');
    /** True finché la colonna `stato_arricchimento` è disponibile (migrazione applicata). */
    const statoDisponibile = !lettura.assenti.has('stato_arricchimento');

    // TAILORING (§26.68): indice dello STORICO interno dalle righe GIÀ lette (zero query).
    const storico = indiceStoricoContatti(righe);
    let daCodice = 0;
    let daEmail = 0;
    let daNome = 0;
    let daPec = 0;
    let daSito = 0;
    let daAnagraficaCodice = 0;
    let daAnagraficaNome = 0;
    let daStorico = 0;
    let daStato = 0;
    let scritti = 0;

    for (const r of righe) {
      const patch: Record<string, string> = {};
      const testo = `${r.title ?? ''} ${r.school_name ?? ''}`;

      // 0) ANAGRAFICA NAZIONALE: codice → nome/PEO/PEC, oppure nome univoco → codice/recapiti.
      let viaAnagrafica: 'codice' | 'nome' | 'nessuna' = 'nessuna';
      if (anagrafica?.disponibile) {
        const esito = arricchisciDaAnagrafica(anagrafica, {
          school_code: r.school_code,
          school_name: r.school_name,
          contact_email: r.contact_email,
          school_pec: r.school_pec,
          school_site: r.school_site,
          title: r.title,
          province: r.province,
        });
        Object.assign(patch, esito.patch);
        viaAnagrafica = esito.via;
      }

      // Senza la colonna `school_pec` (migrazione non applicata) la PEC non va scritta.
      if (!pecDisponibile) delete patch.school_pec;
      // Stesso criterio per `school_site` (`SITOWEBSCUOLA`, migrazione §26.77).
      if (!sitoDisponibile) delete patch.school_site;

      // 1) Codice meccanografico dal testo (se né la riga né l'anagrafica lo danno).
      const codice =
        patch.school_code ?? r.school_code?.trim() ?? estraiCodiceMeccanograficoDaTesto(testo) ?? null;
      if (codice && !patch.school_code && !r.school_code?.trim()) {
        patch.school_code = codice;
        daCodice += 1;
      }
      // 2) Email ufficiale (PEO) dalla convenzione MIM sul codice.
      if (!patch.contact_email && !r.contact_email?.trim()) {
        const email = risolviEmailUfficialeScuola({ schoolCode: codice, testo })?.email;
        if (email) {
          patch.contact_email = email;
          daEmail += 1;
        }
      }
      // 2-bis) TAILORING (§26.68): recapito OSSERVATO per la stessa scuola (storico interno).
      const cucito = patchDaStorico(storico, { ...r, ...patch });
      if (cucito) { Object.assign(patch, cucito); daStorico += 1; }
      if (!pecDisponibile) delete patch.school_pec;
      if (!sitoDisponibile) delete patch.school_site;
      // 3) Nome reale dal registro minimo per codice.
      if (!patch.school_name && !r.school_name?.trim()) {
        const nomeRegistro = nomeScuolaDaCodice(codice);
        if (nomeRegistro) {
          patch.school_name = nomeRegistro;
          daNome += 1;
        }
      }

      // 4) STATO dell'anagrafica (`completo`/`parziale`): SEMPRE riconsiderato, mai un motivo di scarto.
      if (statoDisponibile) {
        const stato = statoArricchimento({
          school_name: patch.school_name ?? r.school_name,
          school_code: patch.school_code ?? r.school_code,
          contact_email: patch.contact_email ?? r.contact_email,
          school_pec: pecDisponibile ? patch.school_pec ?? r.school_pec : null,
        });
        if (stato !== r.stato_arricchimento) {
          patch.stato_arricchimento = stato;
          daStato += 1;
        }
      }

      if (viaAnagrafica === 'codice') daAnagraficaCodice += 1;
      if (viaAnagrafica === 'nome') daAnagraficaNome += 1;
      if (patch.school_pec) daPec += 1;
      if (patch.school_site) daSito += 1;

      if (Object.keys(patch).length === 0) continue;
      if (apply) {
        const errore = await aggiornaInterpello(client, r.id, patch);
        if (errore) {
          console.warn(`  ✗ ${r.id.slice(0, 8)}… ${errore}`);
          continue;
        }
      }
      scritti += 1;
    }

    console.log(`— Interpelli esaminati: ${righe.length} —`);
    console.log(
      `  · anagrafica: codice ${daAnagraficaCodice} · nome ${daAnagraficaNome} · PEC ${daPec}` +
        ` · sito istituzionale ${daSito} · storico interno ${daStorico} · codice dal testo ${daCodice}` +
        ` · PEO da convenzione MIM ${daEmail} · nome dal registro ${daNome} · stato ${daStato}`,
    );
    console.log(apply ? `✓ Righe aggiornate: ${scritti}` : `(dry-run) righe da aggiornare: ${scritti} — usa -- --apply per applicare`);
  }
}
