/**
 * POST /functions/v1/payment-initialize
 *   { purpose: "consultation", assessment_id, currency? }
 *   { purpose: "order", items: [{ product_id, quantity }], shipping: {...} }
 *
 * Amounts are always computed here from the database, never taken from the browser.
 */
import { admin, rateLimit, requireCaller } from '../_shared/db.ts';
import { appUrl } from '../_shared/env.ts';
import { handler, HttpError, json, readJson } from '../_shared/http.ts';
import { initializeTransaction } from '../_shared/paystack.ts';
import { getSettings } from '../_shared/settings.ts';
import { phone, randomToken, str } from '../_shared/validate.ts';

Deno.serve(handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const caller = await requireCaller(req);
  await rateLimit(`pay:${caller.user.id}`, 20, 3600);
  const email = caller.user.email;
  if (!email) throw new HttpError(422, 'Your account needs an email address to pay.');

  const body = await readJson<Record<string, unknown>>(req);
  const db = admin();

  if (body.purpose === 'consultation') {
    const { data: a } = await db.from('assessments').select('id, code, user_id, status, currency')
      .eq('id', String(body.assessment_id ?? '')).maybeSingle();
    if (!a || a.user_id !== caller.user.id) throw new HttpError(404, 'Assessment not found.');
    if (a.status === 'paid') throw new HttpError(409, 'This assessment is already unlocked.');

    const { consultation } = await getSettings('consultation');
    const wanted = String(body.currency ?? a.currency ?? consultation.defaultCurrency).toUpperCase();
    const currency = consultation.paymentCurrencies.includes(wanted) ? wanted : consultation.fallbackCurrency;
    const amount = Number(consultation.fees[currency]);
    if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(500, `No consultation fee is configured for ${currency}.`);

    const reference = `KS-${a.code.replace(/[^A-Z0-9]/gi, '')}-${randomToken(5)}`;
    const { error } = await db.from('payments').insert({
      reference, purpose: 'consultation', assessment_id: a.id, user_id: caller.user.id, email, amount, currency,
    });
    if (error) throw error;

    const init = await initializeTransaction({
      email, amount, currency, reference,
      callbackUrl: `${appUrl()}/payment/callback`,
      metadata: { purpose: 'consultation', assessment_id: a.id, assessment_code: a.code, user_id: caller.user.id, cancel_action: `${appUrl()}/assessments/${a.id}` },
    });
    return json(req, { authorization_url: init.authorization_url, reference });
  }

  if (body.purpose === 'order') {
    const items = Array.isArray(body.items) ? body.items as { product_id: string; quantity: number }[] : [];
    if (!items.length || items.length > 50) throw new HttpError(422, 'Your cart is empty.');
    const shipping = (body.shipping ?? {}) as Record<string, unknown>;
    const ship = {
      full_name: str(shipping, 'full_name', { required: true, max: 120, label: 'Full name' })!,
      phone: phone(shipping, 'phone')!,
      address: str(shipping, 'address', { required: true, max: 300, label: 'Delivery address' })!,
      city: str(shipping, 'city', { required: true, max: 80, label: 'City' })!,
      state: str(shipping, 'state', { required: true, max: 80, label: 'State' })!,
      country: str(shipping, 'country', { max: 80 }) ?? 'Nigeria',
      notes: str(shipping, 'notes', { max: 500 }),
    };

    const ids = [...new Set(items.map((i) => String(i.product_id)))];
    const { data: products } = await db.from('products').select('id, name, sku, price, stock_quantity, is_active').in('id', ids);
    const lines = items.map((i) => {
      const p = products?.find((x) => x.id === i.product_id && x.is_active);
      if (!p) throw new HttpError(409, 'An item in your cart is no longer available. Please refresh your cart.');
      const quantity = Math.max(1, Math.min(999, Math.round(Number(i.quantity) || 1)));
      if (p.stock_quantity < quantity) throw new HttpError(409, `Only ${p.stock_quantity} of "${p.name}" left in stock.`);
      return { product_id: p.id, product_name: p.name, sku: p.sku, unit_price: Number(p.price), quantity, line_total: Number(p.price) * quantity };
    });

    const { commerce } = await getSettings('commerce');
    const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
    const deliveryFee = subtotal >= Number(commerce.freeDeliveryThreshold ?? Infinity) ? 0 : Number(commerce.deliveryFee ?? 0);
    const total = subtotal + deliveryFee;
    const currency = commerce.currency ?? 'NGN';

    const { data: order, error } = await db.from('orders').insert({
      user_id: caller.user.id, email, ...ship, subtotal, delivery_fee: deliveryFee, total, currency,
    }).select('id, code').single();
    if (error) throw error;
    const { error: itemsErr } = await db.from('order_items').insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (itemsErr) throw itemsErr;

    const reference = `KS-${order.code.replace(/[^A-Z0-9]/gi, '')}-${randomToken(5)}`;
    await db.from('payments').insert({ reference, purpose: 'order', order_id: order.id, user_id: caller.user.id, email, amount: total, currency });

    const init = await initializeTransaction({
      email, amount: total, currency, reference,
      callbackUrl: `${appUrl()}/payment/callback`,
      metadata: { purpose: 'order', order_id: order.id, order_code: order.code, user_id: caller.user.id, cancel_action: `${appUrl()}/checkout` },
    });
    return json(req, { authorization_url: init.authorization_url, reference, order_id: order.id });
  }

  throw new HttpError(422, 'Unknown payment purpose.');
}));
