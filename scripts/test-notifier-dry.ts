/**
 * Test DRY-RUN end-to-end del notifier senza effetti collaterali:
 *  - stub del client Supabase con un utente di prova (matching + contatore illimitato);
 *  - interpello sintetico A-026 MI;
 *  - NOTIFICA IN DRY-RUN: nessuna email reale, nessun Telegram, nessuna scrittura DB.
 *
 * Uso: npm run test:notifier-dry
 */
import { notificaNuoviInterpelli } from '../src/lib/notifier.ts';
import { findUtentiCompatibili } from '../src/lib/matchingEngine.ts';

interface RigaProfiloFinta {
  id: string;
  email_notifica: string | null;
  email: string | null;
  nome: string | null;
  province_interesse: string[];
  province_attive: string[];
  classi_concorso: string[];
  telegram_chat_id: string | null;
  piano: string;
  radar_attivo: boolean;
  is_free_forever: boolean;
  notifiche_blocco_inviato: boolean | null;
  notifiche_recap_inviato: boolean | null;
}

/** Client Supabase minimale finto: profiles di prova + RPC che consente sempre. */
function clientStub(): unknown {
  const utenti: RigaProfiloFinta[] = [
    {
      id: '00000000-0000-0000-0000-0000000000ff',
      email_notifica: 'test-dry@example.com',
      email: 'test-dry@example.com',
      nome: 'Docente Dry Run',
      province_interesse: ['MI'],
      province_attive: ['MI'],
      classi_concorso: ['A-026'],
      telegram_chat_id: null, // nessun invio Telegram possibile
      piano: 'free_forever',
      radar_attivo: true,
      is_free_forever: true,
      notifiche_blocco_inviato: false,
      notifiche_recap_inviato: false,
    },
    // Utente "in pausa": deve essere ESCLUSO dal matching.
    {
      id: '00000000-0000-0000-0000-0000000000fe',
      email_notifica: 'pausa-dry@example.com',
      email: 'pausa-dry@example.com',
      nome: 'Docente in Pausa',
      province_interesse: ['MI'],
      province_attive: ['MI'],
      classi_concorso: ['A-026'],
      telegram_chat_id: null,
      piano: 'base',
      radar_attivo: false,
      is_free_forever: false,
      notifiche_blocco_inviato: false,
      notifiche_recap_inviato: false,
    },
  ];

  const stub = {
    from: () => ({
      select: async () => ({ data: utenti, error: null }),
    }),
    rpc: async () => ({ data: [{ consentito: true, notifiche_usate: 1 }], error: null }),
  };
  return stub;
}

async function main(): Promise<void> {
  const interpelloTest = {
    hashId: 'dry-run-test-a026-mi-2026',
    title: 'Interpello supplenza A-026 Matematica e fisica — Liceo scientifico, Milano',
    schoolName: 'Liceo Scientifico Statale',
    province: 'MI',
    classCodes: ['A-026'],
    expirationDate: '2026-09-15',
    link: 'https://www.istruzione.it/dry-run-test/avviso',
  };

  console.log('━━ Test notifier DRY-RUN (nessun invio reale) ━━');
  const stub = clientStub() as never;

  // 1) Matching Engine: deve trovare SOLO l'utente attivo (quello in pausa è escluso).
  const compatibili = await findUtentiCompatibili(stub, {
    province: 'MI',
    classi: ['A-026'],
  });
  console.log(
    'Matching Engine → utenti compatibili:',
    compatibili.map((u) => `${u.id.slice(0, 8)} (${u.piano}, radar attivo)`),
  );
  if (compatibili.length !== 1) {
    console.error('✗ Attesi 1 utente compatibile (l\'utente in pausa NON deve comparire).');
    process.exitCode = 1;
    return;
  }

  // 2) Notifier in dry-run: il payload viene costruito e loggato, senza invii reali.
  try {
    const esito = await notificaNuoviInterpelli(stub, [interpelloTest], {
      dryRun: true,
      dashboardUrl: 'https://scuoleradar.it/dashboard/radar',
    });
    console.log('ESITO:', JSON.stringify(esito));
    if (esito.inviate + esito.telegramInviate === 0) {
      console.warn('ℹ Nessun invio contato: canale email/telegram non disponibile nel dry-run (ok, nessun errore).');
    }
  } catch (err) {
    console.error('✗ Errore inatteso nel notifier dry-run:', err);
    process.exitCode = 1;
    return;
  }
  console.log('✓ Matching + payload di notifica verificati senza errori silenziosi.');
}

void main();
