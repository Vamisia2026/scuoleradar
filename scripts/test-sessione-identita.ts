/**
 * Verifica SESSIONE & IDENTITÀ (login/Google, nessun secondo click su «Accedi»).
 *
 * Contesto: al ritorno da Google OAuth (o all'avvio con un token valido) lo stato
 * utente deve aggiornarsi IMMEDIATAMENTE. Questa verifica copre:
 *  1. la funzione PURA `identitaDaSessione` (nome/cognome da `full_name` o dai campi
 *     espliciti, mai sovrascritture dei dati dell'utente, genere/età/provincia);
 *  2. il cablaggio: il bootstrap sincronizza l'identità con la sessione trovata, il
 *     listener copre anche TOKEN_REFRESHED/USER_UPDATED, la rotta di ritorno OAuth
 *     ATTENDE la sessione (niente rimbalzo), il wizard rilegge il piano appena
 *     arriva l'identità (PRO riconosciuto senza reload).
 *
 * Uso: npm run test:sessione
 */
import { readFileSync } from 'node:fs';
import { identitaDaSessione } from '@/contexts/app/helpers';
import type { User } from '@/contexts/app/types';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (percorso: string): string => readFileSync(percorso, 'utf8');

const utente = (patch: Partial<User> = {}): User => ({
  nome: '',
  cognome: '',
  email: 'docente@example.it',
  password: '',
  genere: null,
  eta: null,
  provincia: null,
  ...patch,
});

console.log('— Identità dalla sessione: nome/cognome —');
const google = identitaDaSessione(
  { email: 'mario.rossi@gmail.com', user_metadata: { full_name: 'Mario Rossi' } },
  null,
);
check('Google: nome e cognome da full_name', ['Mario', 'Rossi'], [google.nome, google.cognome]);
const azienda = identitaDaSessione(
  { email: 'info@bison.it', user_metadata: { full_name: 'Bison Productions' } },
  null,
);
check('full_name su due parole: nome/cognome dal primo spazio', ['Bison', 'Productions'], [azienda.nome, azienda.cognome]);
const mononimo = identitaDaSessione(
  { email: 'info@bison.it', user_metadata: { full_name: 'Bison' } },
  null,
);
check('full_name monolocuto: resta intero nel nome', ['Bison', ''], [mononimo.nome, mononimo.cognome]);
const esplicito = identitaDaSessione(
  {
    email: 'maria@example.it',
    user_metadata: { nome: 'Maria', cognome: 'Bianchi', full_name: 'qualcosa di strano' },
  },
  null,
);
check('campi espliciti vincono su full_name', ['Maria', 'Bianchi'], [esplicito.nome, esplicito.cognome]);
check(
  'identità nuova: email e password vuota',
  ['maria@example.it', ''],
  [esplicito.email, esplicito.password],
);
check(
  'nessun nome disponibile: fallback «Docente»',
  'Docente',
  identitaDaSessione({ email: 'x@y.it', user_metadata: {} }, null).nome,
);

console.log('\n— Identità dalla sessione: mai sovrascrivere i dati già inseriti —');
const esistente = utente({ nome: 'Giuseppe', cognome: 'Verdi', eta: 45, genere: 'M' });
const aggiornato = identitaDaSessione(
  {
    email: 'DOCENTE@example.it',
    user_metadata: { full_name: 'Altro Nome', eta: 30, genere: 'F', provincia: 'RM' },
  },
  esistente,
);
check('stesso utente (email case-insensitive): nome conservato', 'Giuseppe', aggiornato.nome);
check('cognome conservato', 'Verdi', aggiornato.cognome);
check('età NON sovrascritta', 45, aggiornato.eta);
check('genere NON sovrascritto', 'M', aggiornato.genere);
check('provincia compilata dal metadata quando mancava', 'RM', aggiornato.provincia);

console.log('\n— Identità dalla sessione: utente diverso —');
const altro = identitaDaSessione(
  { email: 'nuovo@example.it', user_metadata: { full_name: 'Nuovo Utente' } },
  esistente,
);
check('cambio utente: nuova identità', ['Nuovo', 'Utente', 'nuovo@example.it'], [altro.nome, altro.cognome, altro.email]);

console.log('\n— Cablaggio: sessione valida → stato utente SUBITO —');
const bootstrap = leggi('src/contexts/app/useProfileBootstrap.ts');
const authSync = leggi('src/contexts/app/useAuthSync.ts');
const facadeBootstrap = leggi('src/contexts/app/useBootstrapProfilo.ts');
const callback = leggi('src/pages/AuthCallback.tsx');
const wizard = leggi('src/departments/radar/RadarWizardModal.tsx');
const helpers = leggi('src/contexts/app/helpers.ts');

check(
  'bootstrap: identità sincronizzata dalla sessione trovata',
  true,
  /setUser\(\(prev\) => identitaDaSessione\(au, prev\)\)/.test(bootstrap) &&
    /setSupabaseUserId\(au\.id\)/.test(bootstrap),
);
check(
  'bootstrap: piano confermato dal DB (niente «Base» per errore)',
  true,
  bootstrap.includes("setPianoStato('pronto')"),
);
check(
  'bootstrap: i setter di identità sono passati (facade)',
  true,
  /useProfileBootstrap\(\{[\s\S]{0,400}setUser,[\s\S]{0,120}setSupabaseUserId,/.test(facadeBootstrap),
);
check(
  'listener: identità dal medesimo helper (nessuna divergenza)',
  true,
  authSync.includes('identitaDaSessione') && helpers.includes('export function identitaDaSessione'),
);
check(
  'listener: copre anche TOKEN_REFRESHED e USER_UPDATED',
  true,
  authSync.includes("'TOKEN_REFRESHED'") && authSync.includes("'USER_UPDATED'"),
);
check(
  'listener: funnel signup solo al primo accesso (mai sui refresh)',
  true,
  /if \(event === 'SIGNED_IN' \|\| event === 'INITIAL_SESSION'\) \{\s*\n\s*const appMeta/.test(authSync),
);
check(
  'ritorno OAuth: si ATTENDE la sessione (getSession) prima di rimbalzare',
  true,
  callback.includes('getSession') && callback.includes('ATTESA_SESSIONE_MS') && callback.includes('senzaSessione'),
);
check(
  'ritorno OAuth: nessun rimbalzo immediato a home',
  true,
  !/else if \(!loading && !user\) \{\s*navigate\('\/'/.test(callback),
);
check(
  'wizard: piano riletto appena arriva l’identità (PRO senza reload)',
  true,
  /const identitaPrecedente = useRef[\s\S]{0,700}refreshProfilo\(\)/.test(wizard),
);
check(
  'wizard: registrazione Google → bozza salvata e avviso di attesa',
  true,
  /salvaBozzaRegistrazione\(bozzaCompleta\(\)\);[\s\S]{0,300}STORAGE_KEY_RADAR_WIZARD_PENDING/.test(wizard),
);

console.log('\n— Cambio account Google (Bartolo → Pralino) —');
const azioni = leggi('src/contexts/app/useAzioniAccount.ts');
check(
  'login Google: la sessione precedente viene CHIUSA prima dell’OAuth',
  true,
  /getSession\(\)[\s\S]{0,400}?data\.session[\s\S]{0,300}?signOut\(\{ scope: 'local' \}\)[\s\S]{0,900}?signInWithOAuth/.test(
    azioni,
  ),
);
check(
  'chiusura sessione in LOCALE (le altre sessioni restano valide)',
  true,
  /signOut\(\{ scope: 'local' \}\)/.test(azioni),
);
check(
  'cambio account: stato locale azzerato (stessa pulizia del logout)',
  true,
  /const azzeraStatoUtente = useCallback[\s\S]{0,1200}?localStorage\.removeItem\('sr_user'\)/.test(azioni) &&
    /const logout = useCallback\(\(\) => \{\s*\n\s*void supabase\?\.auth\.signOut\(\);\s*\n\s*azzeraStatoUtente\(\);/.test(
      azioni,
    ),
);
check(
  'cambio account: preferenze (genere/età/provincia) azzerate, non ereditate',
  true,
  /if \(idPrecedente\) \{\s*\n\s*setPref\(\(prev\) => \(\{ \.\.\.prev, genere: null, eta: null, provincia: null \}\)\);/.test(
    authSync,
  ),
);
check(
  'anagrafica azzerata SOLO su uno switch reale (prima registrazione intatta)',
  true,
  /const idPrecedente = pianoSessionUserIdRef\.current;\s*\n\s*if \(idPrecedente !== idSessione\)/.test(authSync),
);
check(
  'setPref passato al listener (facade)',
  true,
  /useAuthSync\(\{[\s\S]{0,400}setPref,/.test(facadeBootstrap),
);

console.log(errori === 0 ? '\n✅ SESSIONE & IDENTITÀ: nessun problema' : `\n❌ SESSIONE & IDENTITÀ: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;
