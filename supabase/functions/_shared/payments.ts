import { admin, logActivity } from './db.ts';
import { sendEmail, emailBrand, adminRecipients } from './email/send.ts';
import * as T from './email/templates.ts';
import { appUrl } from './env.ts';
import { type PaystackTransaction, toSubunit } from './paystack.ts';

export interface PaymentRow {
  id: string;
  reference: string;
  purpose: 'consultation' | 'order';
  assessment_id: string | null;
  order_id: string | null;
  user_id: string | null;
  email: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'abandoned' | 'refunded';
}

export interface SettlementOutcome {
  status: PaymentRow['status'];
  purpose: PaymentRow['purpose'];
  assessment_id: string | null;
  order_id: string | null;
  message: string;
}

const outcome = (p: PaymentRow, status: PaymentRow['status'], message: string): SettlementOutcome => ({
  status,
  purpose: p.purpose,
  assessment_id: p.assessment_id,
  order_id: p.order_id,
  message,
});

/**
 * Reconciles our payment record with a transaction fetched from Paystack's
 * verify endpoint. Safe to call any number of times, from the browser
 * callback and from the webhook: side effects run only on the first
 * transition to success.
 */
export async function settlePayment(payment: PaymentRow, tx: PaystackTransaction): Promise<SettlementOutcome> {
  if (payment.status === 'success') return outcome(payment, 'success', 'Payment already confirmed.');
  if (payment.status === 'refunded') return outcome(payment, 'refunded', 'Payment was refunded.');

  if (tx.status === 'failed' || tx.status === 'abandoned' || tx.status === 'reversed') {
    const status = tx.status === 'abandoned' ? 'abandoned' : 'failed';
    await admin()
      .from('payments')
      .update({ status, gateway_response: tx.gateway_response, verified_at: new Date().toISOString() })
      .eq('id', payment.id)
      .eq('status', 'pending');
    return outcome(payment, status, tx.gateway_response ?? 'Payment was not completed.');
  }

  if (tx.status !== 'success') return outcome(payment, 'pending', 'Payment is still processing.');

  // Independent checks: never trust the redirect, only what Paystack reports.
  const problems: string[] = [];
  if (tx.reference !== payment.reference) problems.push('reference');
  if (tx.amount !== toSubunit(Number(payment.amount))) problems.push('amount');
  if (tx.currency?.toUpperCase() !== payment.currency.toUpperCase()) problems.push('currency');
  if (tx.customer?.email?.toLowerCase() !== payment.email.toLowerCase()) problems.push('email');

  if (problems.length) {
    await admin()
      .from('payments')
      .update({ status: 'failed', gateway_response: `Verification mismatch: ${problems.join(', ')}`, verified_at: new Date().toISOString() })
      .eq('id', payment.id);
    await logActivity('payment.mismatch', 'payment', payment.id, { reference: payment.reference, problems, paystack_amount: tx.amount, paystack_currency: tx.currency });
    return outcome(payment, 'failed', 'Payment details did not match. Contact support with your reference.');
  }

  const paidAt = tx.paid_at ?? new Date().toISOString();
  // Conditional update is the idempotency guard: only one caller wins the transition.
  const { data: won } = await admin()
    .from('payments')
    .update({
      status: 'success',
      channel: tx.channel,
      gateway_response: tx.gateway_response,
      paystack_transaction_id: tx.id,
      paid_at: paidAt,
      verified_at: new Date().toISOString(),
    })
    .eq('id', payment.id)
    .neq('status', 'success')
    .select('id')
    .maybeSingle();

  if (!won) return outcome(payment, 'success', 'Payment already confirmed.');

  if (payment.purpose === 'consultation') await unlockAssessment(payment, paidAt);
  else await markOrderPaid(payment, paidAt);

  await logActivity('payment.success', 'payment', payment.id, { reference: payment.reference, purpose: payment.purpose });
  return outcome(payment, 'success', 'Payment confirmed.');
}

async function unlockAssessment(payment: PaymentRow, paidAt: string) {
  const db = admin();
  const { data: unlocked } = await db
    .from('assessments')
    .update({ status: 'paid', paid_at: paidAt })
    .eq('id', payment.assessment_id!)
    .neq('status', 'paid')
    .select('id, code, customer_name, customer_email')
    .maybeSingle();

  const brand = await emailBrand();

  if (!unlocked) {
    // The assessment was already paid through another transaction.
    await db.from('payments').update({ is_duplicate: true }).eq('id', payment.id);
    const { data: a } = await db.from('assessments').select('code').eq('id', payment.assessment_id!).maybeSingle();
    await sendEmail(await adminRecipients(), 'duplicate_payment_admin', T.duplicatePaymentAdmin(brand, {
      reference: payment.reference, code: a?.code ?? '', amount: Number(payment.amount), currency: payment.currency, email: payment.email,
    }));
    return;
  }

  await sendEmail(unlocked.customer_email ?? payment.email, 'consultation_receipt', T.consultationReceipt(brand, {
    name: unlocked.customer_name ?? 'there',
    code: unlocked.code,
    amount: Number(payment.amount),
    currency: payment.currency,
    reference: payment.reference,
    paidAt,
    reportUrl: `${appUrl()}/assessments/${unlocked.id}`,
  }));
}

async function markOrderPaid(payment: PaymentRow, paidAt: string) {
  const db = admin();
  const { data: order } = await db
    .from('orders')
    .update({ status: 'paid', paid_at: paidAt })
    .eq('id', payment.order_id!)
    .eq('status', 'pending_payment')
    .select('*, order_items(product_name, quantity, line_total)')
    .maybeSingle();
  if (!order) return;

  await db.rpc('apply_order_stock', { p_order: order.id });

  const brand = await emailBrand();
  const data: T.OrderEmailData = {
    name: order.full_name,
    code: order.code,
    items: (order.order_items ?? []).map((i: { product_name: string; quantity: number; line_total: number }) => ({
      name: i.product_name, quantity: i.quantity, lineTotal: Number(i.line_total),
    })),
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.delivery_fee),
    total: Number(order.total),
    currency: order.currency,
    address: [order.address, order.city, order.state, order.country].filter(Boolean).join(', '),
    orderUrl: `${appUrl()}/account/orders`,
  };
  await sendEmail(order.email, 'order_confirmation', T.orderConfirmation(brand, data));
  await sendEmail(await adminRecipients(), 'admin_new_order', T.adminNewOrder(brand, {
    ...data, email: order.email, phone: order.phone, adminUrl: `${appUrl()}/admin/orders`,
  }));
}

/** Marks a payment refunded and reverses what it unlocked. */
export async function refundPayment(reference: string) {
  const db = admin();
  const { data: payment } = await db
    .from('payments')
    .update({ status: 'refunded' })
    .eq('reference', reference)
    .eq('status', 'success')
    .select('*')
    .maybeSingle();
  if (!payment) return;

  if (payment.purpose === 'consultation' && !payment.is_duplicate) {
    await db.from('assessments').update({ status: 'calculated', paid_at: null }).eq('id', payment.assessment_id);
  } else if (payment.purpose === 'order') {
    await db.from('orders').update({ status: 'refunded' }).eq('id', payment.order_id);
  }
  await logActivity('payment.refunded', 'payment', payment.id, { reference });
}
