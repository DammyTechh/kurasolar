import { admin } from '../db.ts';
import { appUrl, env, optionalEnv } from '../env.ts';
import { getSettings } from '../settings.ts';
import type { EmailBrand } from './layout.ts';
import type { RenderedEmail } from './templates.ts';

/** Brand tokens for emails, read from site settings so admin colour changes apply here too. */
export async function emailBrand(): Promise<EmailBrand> {
  const { brand, company } = await getSettings('brand', 'company');
  const site = appUrl();
  const logo = company.logoUrl ?? '/logo.png';
  return {
    companyName: company.name ?? 'KuraSolar',
    logoUrl: logo.startsWith('http') ? logo : `${site}${logo.startsWith('/') ? '' : '/'}${logo}`,
    siteUrl: site,
    address: company.address ?? '',
    supportEmail: company.email ?? 'hello@kurasolar.ng',
    primary: brand.primary ?? '#5B2A86',
    primaryDark: brand.primaryDark ?? '#34184A',
    accent: brand.accent ?? '#C8973F',
    surface: brand.surface ?? '#F6F2FA',
    ink: brand.ink ?? '#1E1428',
  };
}

export async function adminRecipients(): Promise<string[]> {
  const { notifications } = await getSettings('notifications');
  return (notifications.adminEmails ?? []).filter(Boolean);
}

/**
 * Sends one email through Resend and records the outcome in email_log.
 * Never throws: a failed notification must not fail a payment or a request.
 */
export async function sendEmail(to: string | string[], template: string, email: RenderedEmail): Promise<boolean> {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return false;

  const { notifications } = await getSettings('notifications');
  let ok = false;
  let providerId: string | null = null;
  let error: string | null = null;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('EMAIL_FROM', 'KuraSolar <no-reply@kurasolar.ng>'),
        to: recipients,
        subject: email.subject,
        html: email.html,
        text: email.text,
        reply_to: notifications.replyTo ?? optionalEnv('EMAIL_REPLY_TO'),
      }),
    });
    const body = await res.json().catch(() => ({}));
    ok = res.ok;
    providerId = body?.id ?? null;
    if (!ok) error = body?.message ?? `HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  await admin().from('email_log').insert(
    recipients.map((recipient) => ({
      recipient,
      template,
      subject: email.subject,
      status: ok ? 'sent' : 'failed',
      provider_id: providerId,
      error,
    })),
  );
  if (!ok) console.error(`Email "${template}" failed:`, error);
  return ok;
}
