/**
 * POST /functions/v1/admin-actions   { action, ...params }
 * Admin operations that need the service role or send emails.
 * Plain CRUD is done from the dashboard directly under row level security.
 */
import { admin, logActivity, requireAdmin } from '../_shared/db.ts';
import { emailBrand, sendEmail } from '../_shared/email/send.ts';
import * as T from '../_shared/email/templates.ts';
import { appUrl } from '../_shared/env.ts';
import { handler, HttpError, json, readJson } from '../_shared/http.ts';

const ORDER_STATUSES = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
const INSTALLER_STATUSES = ['pending', 'verified', 'suspended'];

Deno.serve(handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const caller = await requireAdmin(req);
  const body = await readJson<Record<string, unknown>>(req);
  const db = admin();
  const brand = await emailBrand();
  const actor = caller.user.id;

  switch (body.action) {
    case 'assign_installers': {
      const requestId = String(body.request_id ?? '');
      const ids = (Array.isArray(body.installer_ids) ? body.installer_ids : []).map(String).slice(0, 10);
      if (!ids.length) throw new HttpError(422, 'Choose at least one installer.');
      const { data: r } = await db.from('installer_requests').select('*').eq('id', requestId).maybeSingle();
      if (!r) throw new HttpError(404, 'Request not found.');
      const { data: installers } = await db.from('installers').select('id, company_name, email, phone, whatsapp')
        .in('id', ids).eq('verification_status', 'verified');
      if (!installers?.length) throw new HttpError(422, 'Only verified installers can be assigned.');

      await db.from('installer_request_matches').upsert(
        installers.map((i) => ({ request_id: r.id, installer_id: i.id, status: 'notified', notified_at: new Date().toISOString() })),
        { onConflict: 'request_id,installer_id' },
      );
      await db.from('installer_requests').update({ status: 'matched' }).eq('id', r.id);

      const base: T.RequestEmailData = {
        code: r.code, name: r.full_name, email: r.email, phone: r.phone, location: [r.city, r.state].filter(Boolean).join(', '),
        propertyType: r.property_type, systemSize: r.system_size, preferredDate: r.preferred_date, message: r.message,
      };
      await Promise.all([
        ...installers.filter((i) => i.email).map((i) => sendEmail(i.email!, 'installer_lead', T.installerLead(brand, { ...base, installerName: i.company_name }))),
        sendEmail(r.email, 'request_matched', T.requestMatched(brand, { name: r.full_name, code: r.code, installers, dashboardUrl: `${appUrl()}/account/requests` })),
      ]);
      await logActivity('installer_request.assigned', 'installer_request', r.id, { installers: ids }, actor);
      return json(req, { ok: true, assigned: installers.length });
    }

    case 'update_order_status': {
      const status = String(body.status ?? '');
      if (!ORDER_STATUSES.includes(status)) throw new HttpError(422, 'Unknown order status.');
      const { data: order, error } = await db.from('orders').update({ status }).eq('id', String(body.order_id ?? ''))
        .select('id, code, full_name, email').maybeSingle();
      if (error || !order) throw new HttpError(404, 'Order not found.');
      if (body.notify !== false && ['processing', 'shipped', 'delivered', 'cancelled', 'refunded'].includes(status)) {
        await sendEmail(order.email, 'order_status', T.orderStatusUpdate(brand, { name: order.full_name, code: order.code, status, orderUrl: `${appUrl()}/account/orders` }));
      }
      await logActivity('order.status', 'order', order.id, { status }, actor);
      return json(req, { ok: true });
    }

    case 'set_installer_status': {
      const status = String(body.status ?? '');
      if (!INSTALLER_STATUSES.includes(status)) throw new HttpError(422, 'Unknown installer status.');
      const { data: before } = await db.from('installers').select('verification_status').eq('id', String(body.installer_id ?? '')).maybeSingle();
      const { data: inst } = await db.from('installers').update({ verification_status: status }).eq('id', String(body.installer_id ?? ''))
        .select('id, slug, company_name, email').maybeSingle();
      if (!inst) throw new HttpError(404, 'Installer not found.');
      if (status === 'verified' && before?.verification_status !== 'verified' && inst.email) {
        await sendEmail(inst.email, 'installer_verified', T.installerVerified(brand, { company: inst.company_name, profileUrl: `${appUrl()}/solar-installers` }));
      }
      await logActivity('installer.status', 'installer', inst.id, { status }, actor);
      return json(req, { ok: true });
    }

    case 'regenerate_report': {
      const id = String(body.assessment_id ?? '');
      const { data: res } = await db.from('assessment_results').select('report_path').eq('assessment_id', id).maybeSingle();
      if (res?.report_path) await db.storage.from('reports').remove([res.report_path]);
      await db.from('assessment_results').update({ report_path: null, report_generated_at: null }).eq('assessment_id', id);
      await logActivity('report.regenerate', 'assessment', id, null, actor);
      return json(req, { ok: true });
    }

    case 'resend_receipt': {
      const id = String(body.assessment_id ?? '');
      const { data: a } = await db.from('assessments').select('id, code, customer_name, customer_email').eq('id', id).maybeSingle();
      const { data: p } = await db.from('payments').select('*').eq('assessment_id', id).eq('status', 'success').order('paid_at').limit(1).maybeSingle();
      if (!a || !p) throw new HttpError(404, 'No successful payment found for this assessment.');
      const sent = await sendEmail(a.customer_email ?? p.email, 'consultation_receipt', T.consultationReceipt(brand, {
        name: a.customer_name ?? 'there', code: a.code, amount: Number(p.amount), currency: p.currency, reference: p.reference,
        paidAt: p.paid_at, reportUrl: `${appUrl()}/assessments/${a.id}`,
      }));
      return json(req, { ok: sent });
    }

    case 'test_email': {
      const to = String(body.to ?? caller.user.email ?? '');
      const sent = await sendEmail(to, 'test', T.testEmail(brand));
      if (!sent) throw new HttpError(502, 'Email could not be sent. Check RESEND_API_KEY and EMAIL_FROM, then look at the email log.');
      return json(req, { ok: true });
    }

    default:
      throw new HttpError(422, 'Unknown action.');
  }
}));
