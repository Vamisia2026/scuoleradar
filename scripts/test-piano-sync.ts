/**
 * Guardia PIANO PRO, FUNNEL DI REGISTRAZIONE e sincronizzazione della navbar.
 *
 * Nasce dai disallineamenti emersi in produzione:
 *  1. un PRO concesso dal BACKEND (promo, omaggio, Beta Tester, pannello admin) letto
 *     come «Base» dal frontend → limiti province, «Opportunità mappate» bloccate,
 *     badge errati;
 *  2. i dati del wizard (nome/cognome/genere/età/provincia) PERSI o richiesti due
 *     volte alla registrazione, con l'email da reinserire;
 *  3. dipartimenti spenti dalla DEV Bar che restavano visibili «in chiaro» nel sito.
 *
 * Metà dei controlli esegue le funzioni VERE (`pianoDaProfilo`, `provaProScaduta`,
 * `pianoLimits`, la bozza di registrazione) con uno stub di `localStorage`; l'altra
 * metà verifica gli invarianti di cablaggio nei file di UI/edge (dove un test
 * funzionale richiederebbe un browser).
 *
 * Uso: npm run test:piano
 */
import { readFileSync } from 'node:fs';
import { pianoLimits } from '@/lib/planLimits';
import { pianoDaProfilo, provaProScaduta } from '@/contexts/app/helpers';
import {
  aggiornaBozzaRegistrazione,
  bozzaHaDati,
  leggiBozzaRegistrazione,
  salvaBozzaRegistrazione,
  svuotaBozzaRegistrazione,
  STORAGE_KEY_BOZZA_REGISTRAZIONE,
} from '@/lib/bozzaRegistrazione';

/* ----------------------------- Stub localStorage ----------------------------- */

/** Stub di `localStorage`: la bozza di registrazione vive lì e in Node non esiste. */
const fintoStorage = {
  dati: new Map<string, string>(),
  getItem(chiave: string): string | null {
    return this.dati.has(chiave) ? (this.dati.get(chiave) as string) : null;
  },
  setItem(chiave: string, valore: string): void {
    this.dati.set(chiave, valore);
  },
  removeItem(chiave: string): void {
    this.dati.delete(chiave);
  },
};
Object.defineProperty(globalThis, 'localStorage', { value: fintoStorage, configurable: true });

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Contenuto di un file del repo (invarianti di cablaggio). */
const leggi = (percorso: string): string => readFileSync(percorso, 'utf8');

/* --------------------------- 1. Piano effettivo dal DB --------------------------- */

console.log('— 1. Piano effettivo (PRO concesso dal backend) —');
check("tier 'pro_annuale' + piano base ⇒ PRO", 'pro', pianoDaProfilo({ piano: 'base', subscription_tier: 'pro_annuale' }));
check('tier pro_mensile ⇒ PRO', 'pro', pianoDaProfilo({ piano: null, subscription_tier: 'pro_mensile' }));
check('Beta Tester ⇒ PRO (omaggio)', 'pro', pianoDaProfilo({ piano: 'base', is_beta_tester: true }));
check('piano pro ⇒ PRO', 'pro', pianoDaProfilo({ piano: 'pro' }));
check('Free Forever prioritario', 'free_forever', pianoDaProfilo({ is_free_forever: true, piano: 'pro' }));
check('tier free_forever ⇒ Free Forever', 'free_forever', pianoDaProfilo({ piano: 'base', subscription_tier: 'free_forever' }));
check('nessuna concessione ⇒ Base', 'base', pianoDaProfilo({ piano: 'base' }));

console.log('\n— 2. Prova PRO scaduta (i Beta Tester non si retrocedono) —');
const ieri = new Date(Date.now() - 86_400_000).toISOString();
const domani = new Date(Date.now() + 86_400_000).toISOString();
check('trial scaduto ⇒ true', true, provaProScaduta({ piano: 'pro', subscription_status: 'trialing', abbonamento_scade_il: ieri }));
check('trial ancora valido ⇒ false', false, provaProScaduta({ piano: 'pro', subscription_status: 'trialing', abbonamento_scade_il: domani }));
check('trial scaduto ma BETA ⇒ false', false, provaProScaduta({ piano: 'pro', subscription_status: 'trialing', abbonamento_scade_il: ieri, is_beta_tester: true }));
check('abbonamento attivo ⇒ false', false, provaProScaduta({ piano: 'pro', subscription_status: 'active', abbonamento_scade_il: ieri }));

console.log('\n— 3. Tetti Radar: mai troncare mentre il piano è in lettura —');
check('piano non confermato ⇒ tetti PRO (4 province)', 4, pianoLimits('base', false, false).maxProvince);
check('piano non confermato ⇒ 4 classi', 4, pianoLimits('base', false, false).maxClassiConcorso);
check('Base confermato ⇒ 1 provincia', 1, pianoLimits('base', false, true).maxProvince);
check('Base confermato ⇒ 2 classi', 2, pianoLimits('base', false, true).maxClassiConcorso);
check('PRO ⇒ 4/4', [4, 4], [pianoLimits('pro').maxProvince, pianoLimits('pro').maxClassiConcorso]);

/* --------------------- 4. Bozza di registrazione (dati del wizard) --------------------- */

console.log('\n— 4. Bozza di registrazione: nessun dato perso o spezzato —');
svuotaBozzaRegistrazione();
check('bozza assente ⇒ null', null, leggiBozzaRegistrazione());
aggiornaBozzaRegistrazione({ nome: 'Bison Productions', cognome: 'Srl' });
check('nome COMPOSTO conservato integro', 'Bison Productions', leggiBozzaRegistrazione()?.nome);
aggiornaBozzaRegistrazione({ genere: 'F', eta: 34, provincia: 'RM', email: 'bison@scuola.it' });
const bozza = leggiBozzaRegistrazione();
check('merge senza perdere il nome', 'Bison Productions', bozza?.nome);
check('genere/età/provincia/email conservati', ['F', 34, 'RM', 'bison@scuola.it'], [bozza?.genere, bozza?.eta, bozza?.provincia, bozza?.email]);
check('bozza con dati ⇒ true', true, bozzaHaDati(bozza));
check('bozza vuota ⇒ false', false, bozzaHaDati({ nome: '', cognome: '' }));
check('chiave localStorage attesa', 'sr_registrazione_bozza', STORAGE_KEY_BOZZA_REGISTRAZIONE);
salvaBozzaRegistrazione({ nome: 'Anna', cognome: 'Bianchi', genere: 'F', eta: 41, provincia: 'TO', email: 'anna@scuola.it' });
check('salvataggio diretto rileggibile', ['Anna', 41, 'TO'], [
  leggiBozzaRegistrazione()?.nome,
  leggiBozzaRegistrazione()?.eta,
  leggiBozzaRegistrazione()?.provincia,
]);
// Robusta a valori corrotti (storage manipolato a mano / versioni precedenti).
fintoStorage.setItem(STORAGE_KEY_BOZZA_REGISTRAZIONE, '{ "nome": 42, "eta": "abc", "genere": "X" }');
check('bozza corrotta ⇒ campi tipizzati', ['', null, null], [
  leggiBozzaRegistrazione()?.nome,
  leggiBozzaRegistrazione()?.eta,
  leggiBozzaRegistrazione()?.genere,
]);
svuotaBozzaRegistrazione();
check('svuotata ⇒ null', null, leggiBozzaRegistrazione());

/* ------------------------- 5. Cablaggio (piano ⇄ UI/Edge) ------------------------- */

console.log('\n— 5. Sincronizzazione del piano nella UI —');
const authSync = leggi('src/contexts/app/useAuthSync.ts');
const dashboard = leggi('src/pages/DashboardPage.tsx');
const wizard = leggi('src/departments/radar/RadarWizardModal.tsx');
const preferenze = leggi('src/departments/radar/PreferenzeRadar.tsx');
const preferenzeUtente = leggi('src/contexts/app/usePreferenzeUtente.ts');
const anagrafica = leggi('src/contexts/app/useAnagraficaProfilo.ts');
const authModal = leggi('src/components/AuthModal.tsx');
const passoNotifica = leggi('src/departments/radar/wizard/PassoNotifica.tsx');
const migration = leggi('supabase/migrations/20260922130000_welcome_metadata_anagrafica.sql');

check('Realtime sulla riga profiles', true, /postgres_changes/.test(authSync) && /table: 'profiles'/.test(authSync));
check('nome/cognome: mai sovrascritti se già presenti', true, /prev\.nome\?\.trim\(\) \|\| nomeDaProvider/.test(authSync));
check('full_name spezzato solo se mancano i campi espliciti', true, /if \(!nomeDaProvider && nomeCompleto\)/.test(authSync));
check('badge/paywall: blocco SOLO con piano confermato', true, /pianoStato === 'pronto' && !hasAccessoPro/.test(dashboard));
check('wizard: tetti PRO finché il piano non è confermato', true, /pianoLimits\(piano, hasProAccess, pianoStato === 'pronto'\)/.test(wizard));
check('preferenze: stessi tetti condizionati', true, /pianoLimits\(piano, hasProAccess, pianoStato === 'pronto'\)/.test(preferenze));
check('riallineamento ai tetti quando il piano è confermato', true, /if \(!tetti \|\| !preferenze\.onboarded\) return;/.test(preferenzeUtente));
check('salvaProfilo scrive nome/cognome (mai azzerandoli)', true, /payload\.nome = nomeFinale/.test(anagrafica) && /payload\.cognome = cognomeFinale/.test(anagrafica));

console.log('\n— 6. Funnel Guest → registrazione (nessun dato richiesto due volte) —');
check('wizard: anagrafica salvata nella bozza', true, /aggiornaBozzaRegistrazione\(\{/.test(wizard));
check('wizard: bozza completa prima del form di registrazione', true, /salvaBozzaRegistrazione\(bozzaCompleta\(\)\);\s+try \{/.test(wizard));
check('wizard: provincia dedotta da una sola scelta', true, /provinceCodici\.length === 1 \? provinceCodici\[0\] : null/.test(wizard));
check('wizard: registrazione rapida con Google nel passo finale', true, /registraConGoogle/.test(wizard) && /ospite: !user/.test(wizard));
check('passo finale: Telegram evidenziato come canale istantaneo', true, /Telegram = avvisi ISTANTANEI/.test(passoNotifica));
check('passo finale: email descritta come riepiloghi', true, /riepiloghi, non avvisi immediati/.test(passoNotifica));
check('AuthModal: email precompilata dalla bozza', true, /setEmail\(\(prev\) => prev \|\| bozza\?\.email/.test(authModal));
check('AuthModal: nota «abbiamo già i dati del tuo Radar»', true, /Abbiamo già i dati del tuo Radar/.test(authModal));
check('AuthModal: prefill nome/cognome dalla bozza', true, /setNome\(\(prev\) => prev \|\| bozza\?\.nome/.test(authModal));
check('trigger DB: cognome/età/provincia dal metadata', true, /v_cognome/.test(migration) && /v_eta_num/.test(migration) && /v_provincia/.test(migration));

console.log(errori === 0 ? '\n✅ PIANO & FUNNEL: nessun problema' : `\n❌ PIANO & FUNNEL: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
