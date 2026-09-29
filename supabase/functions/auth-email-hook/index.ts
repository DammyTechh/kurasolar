/**
 * Supabase Auth "Send Email" hook (JWT verification disabled; see config.toml).
 * Replaces Supabase's default emails with branded ones sent through Resend.
 * Customers sign in with a 6-digit code, so every email leads with the code.
 */
import { Webhook } from '../_shared/deps.ts';
import { emailBrand, sendEmail } from '../_shared/email/send.ts';
import { type AuthAction, authEmail } from '../_shared/email/templates.ts';
import { env } from '../_shared/env.ts';

interface HookPayload {
  user: { email: string; new_email?: string; user_metadata?: { full_name?: string } };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AuthAction;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { http_code: status, message } }), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'Method not allowed');
  const raw = await req.text();

  let payload: HookPayload;
  try {
    const secret = env('SEND_EMAIL_HOOK_SECRET').replace(/^v1,whsec_/, '');
    payload = new Webhook(secret).verify(raw, Object.fromEntries(req.headers)) as HookPayload;
  } catch (err) {
    console.error('Invalid hook signature', err);
    return fail(401, 'Invalid signature');
  }

  const { user, email_data: d } = payload;
  const base = env('SUPABASE_URL');
  const link = (hash: string) =>
    `${base}/auth/v1/verify?token=${encodeURIComponent(hash)}&type=${d.email_action_type}&redirect_to=${encodeURIComponent(d.redirect_to || d.site_url)}`;
  const brand = await emailBrand();
  const name = user.user_metadata?.full_name ?? null;

  const jobs: Promise<boolean>[] = [];
  if (d.email_action_type === 'email_change' && user.new_email) {
    // Secure email change sends a code to the new address, and to the current one when both tokens exist.
    jobs.push(sendEmail(user.new_email, 'auth_email_change', authEmail(brand, {
      action: 'email_change', code: d.token_new || d.token, link: link(d.token_hash_new || d.token_hash), name,
    })));
    if (d.token_new && d.token) {
      jobs.push(sendEmail(user.email, 'auth_email_change', authEmail(brand, { action: 'email_change', code: d.token, link: link(d.token_hash), name })));
    }
  } else {
    jobs.push(sendEmail(user.email, `auth_${d.email_action_type}`, authEmail(brand, {
      action: d.email_action_type, code: d.token, link: link(d.token_hash), name,
    })));
  }

  const results = await Promise.all(jobs);
  if (!results.every(Boolean)) return fail(500, 'Email could not be sent');
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
