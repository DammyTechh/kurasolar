/**
 * POST /functions/v1/paystack-webhook   (JWT verification disabled; see config.toml)
 * Authenticated by the x-paystack-signature HMAC. Successful charges are
 * re-verified against the Paystack API before settlement.
 */
import { admin } from '../_shared/db.ts';
import { isValidWebhookSignature, verifyTransaction } from '../_shared/paystack.ts';
import { type PaymentRow, refundPayment, settlePayment } from '../_shared/payments.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  const valid = await isValidWebhookSignature(raw, req.headers.get('x-paystack-signature'));

  let event: { event?: string; data?: Record<string, unknown> } = {};
  try {
    event = JSON.parse(raw);
  } catch { /* logged below */ }

  const data = event.data ?? {};
  const reference = String(data.reference ?? (data.transaction as Record<string, unknown> | undefined)?.reference ?? data.transaction_reference ?? '');
  const db = admin();
  const { data: logRow } = await db.from('webhook_events').insert({
    event: event.event ?? null,
    reference: reference || null,
    signature_valid: valid,
    // Only a non-sensitive summary is stored; card and authorization data are discarded.
    summary: { status: data.status ?? null, amount: data.amount ?? null, currency: data.currency ?? null },
  }).select('id').single();

  if (!valid) return new Response('Invalid signature', { status: 401 });

  try {
    if (event.event === 'charge.success' && reference) {
      const { data: payment } = await db.from('payments').select('*').eq('reference', reference).maybeSingle();
      if (payment) await settlePayment(payment as PaymentRow, await verifyTransaction(reference));
    } else if ((event.event === 'refund.processed' || event.event === 'refund.processing') && reference) {
      if (event.event === 'refund.processed') await refundPayment(reference);
    }
    await db.from('webhook_events').update({ processed: true }).eq('id', logRow?.id);
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Webhook processing failed', err);
    await db.from('webhook_events').update({ error: err instanceof Error ? err.message : String(err) }).eq('id', logRow?.id);
    // Non-2xx makes Paystack retry later.
    return new Response('Processing error', { status: 500 });
  }
});
