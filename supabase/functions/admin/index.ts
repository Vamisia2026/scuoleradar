import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SEND_SECRET = Deno.env.get('SEND_NOTIFICATION_SECRET') ?? '';
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') ?? 'bartoloansaldi@gmail.com,myvamisia@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase());

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function risposta(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS });
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
      const { error } = await sb.from('profiles').update(updates).eq('id', id);
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

    return risposta({ error: `azione sconosciuta: ${action}` }, 400);
  } catch (err) {
    return risposta({ error: (err as Error).message }, 500);
  }
});