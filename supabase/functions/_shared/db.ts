import { createClient, type SupabaseClient, type User } from './deps.ts';
import { env } from './env.ts';
import { HttpError } from './http.ts';

let adminClient: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS — use only after checking permissions. */
export function admin(): SupabaseClient {
  adminClient ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

/** Anonymous client (used for password sign-in on behalf of the admin login form). */
export function anon(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface Caller {
  user: User;
  role: 'customer' | 'admin';
  profile: { full_name: string | null; phone: string | null; email: string | null };
}

/** Resolves the signed-in caller from the Authorization header, or null. */
export async function getCaller(req: Request): Promise<Caller | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await admin()
    .from('profiles')
    .select('role, full_name, phone, email')
    .eq('id', data.user.id)
    .maybeSingle();
  return {
    user: data.user,
    role: profile?.role === 'admin' ? 'admin' : 'customer',
    profile: {
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? data.user.email ?? null,
    },
  };
}

export async function requireCaller(req: Request): Promise<Caller> {
  const caller = await getCaller(req);
  if (!caller) throw new HttpError(401, 'Please sign in to continue.');
  return caller;
}

export async function requireAdmin(req: Request): Promise<Caller> {
  const caller = await requireCaller(req);
  if (caller.role !== 'admin') throw new HttpError(403, 'Administrator access is required.');
  return caller;
}

/** Throws 429 when the key is over its limit. */
export async function rateLimit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await admin().rpc('hit_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('rate limit check failed', error);
    return; // fail open rather than blocking customers
  }
  if (data === false) throw new HttpError(429, 'Too many requests. Please wait a few minutes and try again.');
}

export async function logActivity(action: string, entity: string, entityId: string | null, meta?: unknown, actorId?: string | null) {
  await admin().from('activity_log').insert({ action, entity, entity_id: entityId, meta: meta ?? null, actor_id: actorId ?? null });
}
