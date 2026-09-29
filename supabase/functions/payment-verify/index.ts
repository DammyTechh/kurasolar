/**
 * POST /functions/v1/payment-verify   { reference }
 * GET  /functions/v1/payment-verify?reference=...
 * Called from the Paystack callback page. Verifies with Paystack server-side
 * before anything is unlocked. The webhook performs the same settlement.
 */
import { admin, requireCaller } from '../_shared/db.ts';
import { handler, HttpError, json, readJson } from '../_shared/http.ts';
import { verifyTransaction } from '../_shared/paystack.ts';
import { type PaymentRow, settlePayment } from '../_shared/payments.ts';

Deno.serve(handler(async (req) => {
  const caller = await requireCaller(req);
  const reference = req.method === 'GET'
    ? new URL(req.url).searchParams.get('reference')
    : String((await readJson<{ reference?: string }>(req)).reference ?? '');
  if (!reference) throw new HttpError(422, 'Payment reference is required.');

  const { data: payment } = await admin().from('payments').select('*').eq('reference', reference).maybeSingle();
  if (!payment || (payment.user_id !== caller.user.id && caller.role !== 'admin')) {
    throw new HttpError(404, 'Payment not found.');
  }

  const tx = await verifyTransaction(reference);
  const result = await settlePayment(payment as PaymentRow, tx);
  return json(req, result);
}));
