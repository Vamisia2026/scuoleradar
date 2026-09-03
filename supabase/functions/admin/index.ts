import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SEND_SECRET = Deno.env.get('SEND_NOTIFICATION_SECRET') ?? '';
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') ?? 'bartoloansaldi@gmail.com,myvamisia@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase());

/**
 * Password PROVVISORIA di default per gli utenti beta tester / pre-approvati.
 * Al primo accesso l'utente è obbligato a impostarne una nuova personale
 * (flag `force_password_change` su user_metadata → ForcePasswordModal).
 */
const PASSWORD_PROVVISORIA = 'Scuoleradar2026';

/**
 * Email PRE-APPROVATE (accesso beta automatico). L'azione `ensure_beta_users`
 * verifica ogni indirizzo su auth.users, lo crea se manca e imposta/riallinea
 * la password provvisoria + il flag di cambio obbligatorio al primo accesso.
 */
const EMAIL_PRE_APPROVATI = [
  'piergiacomodileonardo@yahoo.it',
  // Beta tester già presenti su profiles.is_beta_tester = true (rilevati sul DB):
  'valentina.salla@gmail.com',
  'valentina.salla@icsandamiano.edu.it',
  'g.pampanaro@gmail.com',
  'pampanaro.giuseppe@itisartom.edu.it',
  'dineh3@gmail.com',
  'fasogliomarco@gmail.com',
  'bisonproductions@gmail.com',
  'bartoloansaldi@gmail.com',
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function risposta(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Colonne effettive presenti su profiles (feature-detect senza migrazioni). */
async function colonneProfiles(sb: ReturnType<typeof createClient>) {
  const { data } = await sb.from('profiles').select('*').limit(1);
  if (!data || data.length === 0) return null;
  return Object.keys(data[0]);
}

/** Conserva solo i campi la cui colonna esiste davvero nel database. */
function soloColonneEsistenti(payload: Record<string, unknown>, chiavi: string[] | null): Record<string, unknown> {
  if (!chiavi) return payload;
  const filtrato: Record<string, unknown> = {};
  for (const k of Object.keys(payload)) if (chiavi.includes(k)) filtrato[k] = payload[k];
  return filtrato;
}

/** Riga profilo "sicura": filtra i campi opzionali rispetto allo schema reale. */
async function rigaProfiles(sb: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  return soloColonneEsistenti(payload, await colonneProfiles(sb));
}

async function verificaAdmin(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return { ok: false, status: 401, motivo: 'token mancante' };
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data.user) return { ok: false, status: 401, motivo: 'token non valido' };
  const { data: prof } = await sb.from('profiles').select('email').eq('id', data.user.id).single();
  const email = String(prof?.email ?? data.user.email ?? '').toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) return { ok: false, status: 403, motivo: `non admin: ${email}` };
  return { ok: true, email, jwt };
}

/**
 * Cerca un utente in auth.users per EMAIL esatta (case-insensitive).
 * GoTrue non espone "getUserByEmail": si pagina `listUsers` fino a trovarlo.
 */
async function trovaUtenteAuthByEmail(sb: ReturnType<typeof createClient>, email: string) {
  const target = String(email ?? '').trim().toLowerCase();
  if (!target) return null;
  let pagina = 1;
  while (pagina <= 50) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    const lista = data?.users ?? [];
    const trovato = lista.find((u) => String(u.email ?? '').trim().toLowerCase() === target);
    if (trovato) return trovato;
    if (lista.length < 200) return null;
    pagina += 1;
  }
  return null;
}

/**
 * Provisioning idempotente di un utente beta / pre-approvato:
 *  - assente su auth.users  → lo CREA con password provvisoria + force_password_change;
 *  - presente senza accessi → riallinea password provvisoria + force_password_change;
 *  - presente GIÀ attivo    → marca solo il profilo is_beta_tester (mai sovrascrivere
 *    una password personale già in uso, a meno di `force` esplicito).
 * Ritorna sempre un report strutturato (stato per email), MAI errori silenziosi.
 */
async function preparaAccessoBeta(
  sb: ReturnType<typeof createClient>,
  email: string,
  opts: { force?: boolean; nome?: string; cognome?: string },
): Promise<Record<string, unknown>> {
  const em = String(email ?? '').trim().toLowerCase();
  try {
    const esistente = await trovaUtenteAuthByEmail(sb, em);

    // ---- 1. Account assente → creazione automatica (invito al primo accesso).
    if (!esistente) {
      const nome = String(opts.nome ?? '').trim();
      const cognome = String(opts.cognome ?? '').trim();
      const { data: creato, error: errCreate } = await sb.auth.admin.createUser({
        email: em,
        password: PASSWORD_PROVVISORIA,
        email_confirm: true,
        user_metadata: { nome, cognome, force_password_change: true },
      });
      if (errCreate || !creato?.user) {
        return { email: em, stato: 'errore', errore: errCreate?.message ?? 'creazione account non riuscita' };
      }
      const id = String(creato.user.id);
      const { error: errProfilo } = await sb.from('profiles').upsert(
        await rigaProfiles(sb, { id, email: em, nome, cognome, is_beta_tester: true, onboarded: false }),
        { onConflict: 'id' },
      );
      return {
        email: em,
        stato: 'creato',
        id,
        ...(errProfilo ? { profilo: `profilo non salvato: ${errProfilo.message}` } : {}),
      };
    }

    // ---- 2. Account esistente → marca il profilo come beta (piano intatto).
    const id = String(esistente.id);
    const meta = (esistente.user_metadata ?? {}) as Record<string, unknown>;
    const giaAcceduto = Boolean(esistente.last_sign_in_at);
    await sb.from('profiles').upsert(
      await rigaProfiles(sb, { id, email: em, is_beta_tester: true }),
      { onConflict: 'id' },
    );

    // ---- 3. Primo accesso (mai effettuato) o reset FORZATO esplicito:
    //        password provvisoria + cambio obbligatorio al prossimo login.
    if (!giaAcceduto || opts.force === true) {
      const { error: errReset } = await sb.auth.admin.updateUserById(id, {
        password: PASSWORD_PROVVISORIA,
        user_metadata: { ...meta, force_password_change: true },
      });
      if (errReset) return { email: em, stato: 'errore', id, errore: errReset.message };
      return { email: em, stato: giaAcceduto ? 'reset' : 'preparato', id };
    }

    // ---- 4. Account già attivo e nessun reset richiesto: password preservata.
    return { email: em, stato: 'attivo', id, nota: 'password personale preservata' };
  } catch (err) {
    return { email: em, stato: 'errore', errore: (err as Error).message };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return risposta({ error: 'Metodo non consentito' }, 405);

  const admin = await verificaAdmin(req);
  if (!admin.ok) return risposta({ error: admin.motivo }, admin.status);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return risposta({ error: 'Bad Request' }, 400); }
  const action = String(body.action ?? '');
  const payload = (body.payload ?? {}) as Record<string, any>;

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    if (action === 'list_users') {
      const { data, error } = await sb.from('profiles')
        .select('id,email,nome,cognome,piano,abbonamento_scade_il,crediti,province_interesse,classi_concorso,ordini_scuola,telegram_chat_id,notifiche_usate,notifiche_anno,notifiche_blocco_inviato,notifiche_recap_inviato,step4_inviata_at,step5_inviata,referral_code,onboarded,created_at')
        .order('created_at', { ascending: false });
      if (error) return risposta({ error: error.message }, 500);
      return risposta({ ok: true, utenti: data ?? [] });
    }

    if (action === 'update_user') {
      const id = String(payload.id ?? '');
      const updates = (payload.updates ?? {}) as Record<string, unknown>;
      if (!id || Object.keys(updates).length === 0) return risposta({ error: 'id/updates mancanti' }, 400);

      // Normalizzazione/arricchimento Free Forever: 'ffe'/'free forever' convergono su
      // 'free_forever'; scadenza ancorata a 1 anno se assente; stato subscription 'active'.
      const updatesNormalizzati: Record<string, unknown> = { ...updates };
      const rawPiano = String(updates.piano ?? '').trim().toLowerCase();
      if (rawPiano === 'free_forever' || rawPiano === 'ffe' || rawPiano === 'free forever') {
        updatesNormalizzati.piano = 'free_forever';
        if (!updatesNormalizzati.abbonamento_scade_il) {
          updatesNormalizzati.abbonamento_scade_il = new Date(Date.now() + 365 * 86_400_000).toISOString();
        }
        // Colonne Account Bridge (feature-detect: rigaProfiles le scarta se assenti in DB).
        updatesNormalizzati.subscription_tier = 'free_forever';
        updatesNormalizzati.subscription_status = 'active';
      }

      const { error } = await sb
        .from('profiles')
        .update(await rigaProfiles(sb, updatesNormalizzati))
        .eq('id', id);
      if (error) return risposta({ error: error.message }, 500);
      return risposta({ ok: true });
    }

    if (action === 'list_opportunities') {
      const { data, error } = await sb.from('interpelli')
        .select('id,title,province,class_codes,school_name,school_code,source_url,expiration_date,hash_id,created_at')
        .order('created_at', { ascending: false });
      if (error) return risposta({ error: error.message }, 500);
      return risposta({ ok: true, opportunita: data ?? [] });
    }

    if (action === 'update_opportunity') {
      const id = String(payload.id ?? '');
      const updates = (payload.updates ?? {}) as Record<string, unknown>;
      if (!id || Object.keys(updates).length === 0) return risposta({ error: 'id/updates mancanti' }, 400);
      const { error } = await sb.from('interpelli').update(updates).eq('id', id);
      if (error) return risposta({ error: error.message }, 500);
      return risposta({ ok: true });
    }

    if (action === 'delete_opportunity') {
      const id = String(payload.id ?? '');
      if (!id) return risposta({ error: 'id mancante' }, 400);
      const { error } = await sb.from('interpelli').delete().eq('id', id);
      if (error) return risposta({ error: error.message }, 500);
      return risposta({ ok: true });
    }

    if (action === 'dispatch_opportunity') {
      const id = String(payload.id ?? '');
      const { data: opp } = await sb.from('interpelli').select('*').eq('id', id).single();
      if (!opp) return risposta({ error: 'opportunità non trovata' }, 404);
      const { data: profili } = await sb.from('profiles').select('id,email,email_notifica,telegram_chat_id,province_interesse,classi_concorso');
      const classi = opp.class_codes ?? [];
      const compatibili = (profili ?? []).filter((p) => {
        const prov = p.province_interesse ?? [];
        const cls = p.classi_concorso ?? [];
        const matchProv = prov.length === 0 || prov.includes(opp.province);
        const matchCls = cls.length === 0 || classi.some((c: string) => cls.includes(c));
        const canale = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email_notifica || p.email || '')) || Boolean(p.telegram_chat_id);
        return matchProv && matchCls && canale;
      });
      const urlFn = `${SUPABASE_URL}/functions/v1/send-notification`;
      let inviati = 0; let falliti = 0;
      for (const u of compatibili) {
        const res = await fetch(urlFn, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-send-secret': SEND_SECRET },
          body: JSON.stringify({
            tipo: 'notifica_pro',
            userId: u.id,
            titolo: opp.title, scuola: opp.school_name, provincia: opp.province,
            classe: (classi[0] ?? ''), scadenza: opp.expiration_date, link: opp.source_url,
          }),
        }).catch(() => null);
        if (res && res.ok) inviati++; else falliti++;
      }
      return risposta({ ok: true, destinatariCompatibili: compatibili.length, inviati, falliti });
    }

    if (action === 'list_referrals') {
      const { data: profili, error } = await sb.from('profiles').select('id,email,nome,cognome,referral_code,created_at');
      if (error) return risposta({ error: error.message }, 500);
      const { data: refs } = await sb.from('referrals').select('referrer_id,reward_amount,status');
      const perReferrer = new Map<string, { inviti: number; completati: number; premio: number }>();
      for (const r of refs ?? []) {
        const k = String(r.referrer_id ?? '');
        if (!k) continue;
        const agg = perReferrer.get(k) ?? { inviti: 0, completati: 0, premio: 0 };
        agg.inviti++;
        if (r.status === 'completed') { agg.completati++; agg.premio += Number(r.reward_amount ?? 0); }
        perReferrer.set(k, agg);
      }
      const lista = (profili ?? []).map((p) => ({
        id: p.id, email: p.email, nome: p.nome, cognome: p.cognome, referral_code: p.referral_code, creato: p.created_at,
        ...(perReferrer.get(String(p.id)) ?? { inviti: 0, completati: 0, premio: 0 }),
      }));
      return risposta({ ok: true, referrals: lista });
    }

    if (action === 'list_users_full') {
      const { data: profili, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) return risposta({ error: error.message }, 500);

      // JOIN logico con auth.users: i profili restano la fonte autorevole dei dettagli,
      // ma vengono aggiunti gli utenti auth senza riga profiles (es. mai on-boardizzati).
      const elenco: Array<Record<string, unknown>> = [...(profili ?? [])];
      const visti = new Set(elenco.map((u) => String(u.id)));
      try {
        let pagina = 1;
        while (pagina <= 20) {
          const { data: authPage } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
          const lista = authPage?.users ?? [];
          if (lista.length === 0) break;
          for (const au of lista) {
            const id = String(au.id);
            if (visti.has(id)) continue;
            visti.add(id);
            const meta = (au.user_metadata ?? {}) as Record<string, unknown>;
            elenco.push({
              id,
              email: String(au.email ?? ''),
              nome: typeof meta.nome === 'string' ? meta.nome : (typeof meta.full_name === 'string' ? String(meta.full_name).split(' ')[0] : null),
              cognome: typeof meta.cognome === 'string' ? meta.cognome : null,
              created_at: au.created_at ?? null,
              onboarded: false,
              auth_senza_profilo: true,
            });
          }
          if (lista.length < 200) break;
          pagina++;
        }
      } catch {
        // listUsers non disponibile: si procede con i soli profili.
      }

      const { data: codici, error: errCodici } = await sb.from('promo_codes').select('codice,tipo,usato_da,usato_il');
      const { data: refs, error: errRefs } = await sb
        .from('referrals')
        .select('referrer_id,referred_user_id,reward_amount,status,created_at');

      const couponById = new Map<string, { coupon_codice: string; coupon_tipo: string; coupon_usato_il: string | null }>();
      for (const c of codici ?? []) {
        if (c.usato_da) {
          couponById.set(String(c.usato_da), {
            coupon_codice: String(c.codice ?? ''),
            coupon_tipo: String(c.tipo ?? ''),
            coupon_usato_il: c.usato_il ?? null,
          });
        }
      }
      const emailById = new Map<string, string>();
      for (const u of elenco) emailById.set(String(u.id), String(u.email ?? ''));
      const referrerByUser = new Map<string, { referrer_id: string; referrer_email: string; referral_status: string }>();
      for (const r of refs ?? []) {
        if (r.referred_user_id) {
          const referrerId = String(r.referrer_id ?? '');
          referrerByUser.set(String(r.referred_user_id), {
            referrer_id: referrerId,
            referrer_email: emailById.get(referrerId) ?? '',
            referral_status: String(r.status ?? ''),
          });
        }
      }

      const lista = (elenco ?? []).map((u) => ({
        ...u,
        ...(couponById.get(String(u.id)) ?? {}),
        ...(referrerByUser.get(String(u.id)) ?? {}),
      }));
      return risposta({ ok: true, utenti: lista });
    }

    // ============================================================
    // ACCESSO BETA / UTENTI PRE-APPROVATI
    // ============================================================
    if (action === 'ensure_beta_users') {
      const listaEmail =
        Array.isArray(payload.emails) && payload.emails.length > 0
          ? (payload.emails as unknown[]).map((e) => String(e ?? '').trim().toLowerCase()).filter(Boolean)
          : EMAIL_PRE_APPROVATI;
      if (listaEmail.length === 0) {
        return risposta({ error: 'Nessuna email da processare.' }, 400);
      }
      const risultati: Array<Record<string, unknown>> = [];
      for (const email of listaEmail) {
        const esito = await preparaAccessoBeta(sb, email, {
          force: payload.force === true,
          nome: typeof payload.nome === 'string' ? payload.nome : undefined,
          cognome: typeof payload.cognome === 'string' ? payload.cognome : undefined,
        });
        risultati.push(esito);
      }
      return risposta({ ok: true, password_provvisoria: PASSWORD_PROVVISORIA, risultati });
    }

    if (action === 'set_temp_password') {
      const email = String(payload.email ?? '').trim().toLowerCase();
      if (!email) return risposta({ error: 'email mancante' }, 400);
      const esistente = await trovaUtenteAuthByEmail(sb, email);
      if (!esistente) {
        return risposta(
          {
            error:
              `Nessun utente auth con email "${email}". ` +
              'Per crearlo automaticamente usa l\'azione "ensure_beta_users".',
          },
          404,
        );
      }
      const id = String(esistente.id);
      const meta = (esistente.user_metadata ?? {}) as Record<string, unknown>;
      const { error: errAggiorna } = await sb.auth.admin.updateUserById(id, {
        password: PASSWORD_PROVVISORIA,
        user_metadata: { ...meta, force_password_change: true },
      });
      if (errAggiorna) return risposta({ error: errAggiorna.message }, 500);
      return risposta({
        ok: true,
        id,
        email,
        password_provvisoria: PASSWORD_PROVVISORIA,
        force_password_change: true,
      });
    }

    if (action === 'create_user') {
      const email = String(payload.email ?? '').trim().toLowerCase();
      const password = String(payload.password ?? '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return risposta({ error: 'Indirizzo email non valido' }, 400);
      }
      if (password.length < 6) {
        return risposta({ error: 'Password troppo corta: servono almeno 6 caratteri' }, 400);
      }
      const nome = String(payload.nome ?? '').trim();
      const cognome = String(payload.cognome ?? '').trim();
      const telefono = String(payload.telefono ?? '').trim();
      const isBeta = payload.isBetaTester === true;
      const pianoScelto = String(payload.piano ?? '').trim().toLowerCase();
      const proTipo =
        pianoScelto === 'pro_mensile' || pianoScelto === 'pro_mese'
          ? 'mensile'
          : pianoScelto === 'pro_annuale' || pianoScelto === 'pro_anno'
            ? 'annuale'
            : null;
      const piano =
        pianoScelto === 'pro' || proTipo !== null
          ? 'pro'
          : pianoScelto === 'free_forever' || pianoScelto === 'free forever' || pianoScelto === 'ffe'
            ? 'free_forever'
            : 'base';

      const { data: creato, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, cognome, force_password_change: true },
      });
      if (error) {
        return risposta({ error: `Creazione account non riuscita: ${error.message}` }, 500);
      }
      if (!creato?.user) {
        return risposta({ error: 'Creazione account non riuscita: nessun utente restituito dall\'API Auth' }, 500);
      }

      const { error: errProfilo } = await sb.from('profiles').upsert(
        await rigaProfiles(sb, {
          id: creato.user.id,
          email,
          nome,
          cognome,
          telefono,
          piano,
          pro_tipo: proTipo,
          is_beta_tester: isBeta,
          onboarded: false,
        }),
        { onConflict: 'id' },
      );
      if (errProfilo) {
        return risposta(
          { error: `Account creato ma profilo non salvato: ${errProfilo.message}`, id: creato.user.id },
          500,
        );
      }
      return risposta({ ok: true, id: creato.user.id, piano, pro_tipo: proTipo });
    }

    if (action === 'delete_user') {
      const id = String(payload.id ?? '');
      if (!id) return risposta({ error: 'id mancante' }, 400);
      const { error } = await sb.auth.admin.deleteUser(id);
      if (error) return risposta({ error: error.message }, 500);
      return risposta({ ok: true });
    }

    if (action === 'reset_password') {
      const email = String(payload.email ?? '').trim();
      if (!email) return risposta({ error: 'email mancante' }, 400);
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://scuoleradar.it/auth/callback',
      });
      if (error) return risposta({ error: error.message }, 500);
      return risposta({ ok: true });
    }

    return risposta({ error: `azione sconosciuta: ${action}` }, 400);
  } catch (err) {
    return risposta({ error: (err as Error).message }, 500);
  }
});