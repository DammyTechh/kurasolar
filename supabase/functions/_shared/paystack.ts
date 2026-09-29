import { env } from './env.ts';
import { HttpError } from './http.ts';

const BASE = 'https://api.paystack.co';

export interface PaystackTransaction {
  id: number;
  status: 'success' | 'failed' | 'abandoned' | 'reversed' | 'ongoing' | 'pending' | 'processing' | 'queued';
  reference: string;
  amount: number; // subunits (kobo, pesewas, cents)
  currency: string;
  channel: string | null;
  gateway_response: string | null;
  paid_at: string | null;
  customer: { email: string };
  metadata?: Record<string, unknown> | string | null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status === false) {
    console.error('Paystack error', res.status, body?.message);
    throw new HttpError(502, body?.message ?? 'Payment provider is unavailable. Please try again.');
  }
  return body.data as T;
}

/** All currencies Paystack supports use two decimal subunits. */
export const toSubunit = (amount: number) => Math.round(amount * 100);

export function initializeTransaction(input: {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  return call<{ authorization_url: string; access_code: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: toSubunit(input.amount),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
}

export function verifyTransaction(reference: string) {
  return call<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/** Validates the x-paystack-signature header: HMAC-SHA512 of the raw body with the secret key. */
export async function isValidWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env('PAYSTACK_SECRET_KEY')),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
  if (expected.length !== signature.length) return false;
  // Constant-time comparison.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
