/**
 * POST /functions/v1/admin-login   { identifier, password }
 * Password sign-in for administrators only. Accepts an email address or the
 * admin username. Returns a Supabase session for the browser to adopt.
 */
import { admin, anon, logActivity, rateLimit } from '../_shared/db.ts';
import { clientIp, handler, HttpError, json, readJson } from '../_shared/http.ts';

const GENERIC = 'Incorrect email/username or password.';

Deno.serve(handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const { identifier: rawId, password } = await readJson<{ identifier?: string; password?: string }>(req);
  const identifier = String(rawId ?? '').trim().toLowerCase().slice(0, 254);
  if (!identifier || !password) throw new HttpError(422, 'Enter your email or username and password.');

  await rateLimit(`admin-login:ip:${clientIp(req)}`, 10, 900);
  await rateLimit(`admin-login:id:${identifier}`, 5, 900);

  const db = admin();
  let email = identifier;
  if (!identifier.includes('@')) {
    const { data } = await db.from('profiles').select('email').eq('username', identifier).eq('role', 'admin').maybeSingle();
    if (!data?.email) throw new HttpError(401, GENERIC);
    email = data.email;
  }

  const { data, error } = await anon().auth.signInWithPassword({ email, password: String(password) });
  if (error || !data.session) throw new HttpError(401, GENERIC);

  const { data: profile } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    await db.auth.admin.signOut(data.session.access_token).catch(() => undefined);
    throw new HttpError(401, GENERIC);
  }

  await logActivity('admin.login', 'profile', data.user.id, { ip: clientIp(req) }, data.user.id);
  return json(req, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
}));
