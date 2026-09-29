/**
 * POST /functions/v1/installer-request
 * Records a "connect me with an installer" request, auto-matches verified
 * installers covering the customer's state, and sends notifications.
 */
import { admin, getCaller, logActivity, rateLimit } from '../_shared/db.ts';
import { adminRecipients, emailBrand, sendEmail } from '../_shared/email/send.ts';
import * as T from '../_shared/email/templates.ts';
import { appUrl } from '../_shared/env.ts';
import { clientIp, handler, HttpError, json, readJson } from '../_shared/http.ts';
import { getSettings } from '../_shared/settings.ts';
import { email, phone, str } from '../_shared/validate.ts';

const SERVICE_FOR_PROPERTY: Record<string, string> = {
  residential: 'residential', apartment: 'residential', estate: 'residential',
  office: 'commercial', commercial: 'commercial', school: 'commercial', hospital: 'commercial', church: 'commercial',
  industrial: 'industrial', farm: 'off_grid',
};

Deno.serve(handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const caller = await getCaller(req);
  await rateLimit(`installer-request:${caller?.user.id ?? clientIp(req)}`, 5, 3600);

  const b = await readJson<Record<string, unknown>>(req);
  const db = admin();
  const request = {
    full_name: str(b, 'full_name', { required: true, max: 120, label: 'Full name' })!,
    email: email(b)!,
    phone: phone(b)!,
    country: str(b, 'country', { max: 80 }) ?? 'Nigeria',
    state: str(b, 'state', { required: true, max: 80, label: 'State' })!,
    city: str(b, 'city', { max: 80 }),
    address: str(b, 'address', { max: 300 }),
    property_type: str(b, 'property_type', { max: 40 }),
    system_size: str(b, 'system_size', { max: 120 }),
    preferred_date: /^\d{4}-\d{2}-\d{2}$/.test(String(b.preferred_date ?? '')) ? String(b.preferred_date) : null,
    message: str(b, 'message', { max: 2000 }),
    user_id: caller?.user.id ?? null,
    assessment_id: null as string | null,
  };

  // Only link an assessment the caller owns, and use its sizing as the system description.
  if (caller && b.assessment_id) {
    const { data: a } = await db.from('assessments').select('id, user_id, system_class, inverter_class_kva, daily_energy_kwh')
      .eq('id', String(b.assessment_id)).maybeSingle();
    if (a?.user_id === caller.user.id) {
      request.assessment_id = a.id;
      request.system_size ??= `${a.system_class} (~${a.inverter_class_kva} kVA, ${a.daily_energy_kwh} kWh/day)`;
    }
  }

  const { data: saved, error } = await db.from('installer_requests').insert(request).select('id, code').single();
  if (error) throw error;

  // Matching: verified installers covering the state, preferring those offering the right service.
  const { matching } = await getSettings('matching');
  const service = SERVICE_FOR_PROPERTY[request.property_type ?? 'residential'] ?? 'residential';
  const { data: installers } = await db.from('installers')
    .select('id, company_name, email, state, states_covered, services, is_featured, years_experience')
    .eq('verification_status', 'verified');
  const covering = (installers ?? []).filter((i) => i.state === request.state || (i.states_covered ?? []).includes(request.state));
  const ranked = covering
    .map((i) => ({ ...i, fit: (i.services ?? []).includes(service) ? 1 : 0 }))
    .sort((x, y) => y.fit - x.fit || Number(y.is_featured) - Number(x.is_featured) || y.years_experience - x.years_experience)
    .slice(0, Math.max(0, matching.maxInstallersPerRequest ?? 3));

  const brand = await emailBrand();
  const location = [request.city, request.state].filter(Boolean).join(', ');
  const base: T.RequestEmailData = {
    code: saved.code, name: request.full_name, email: request.email, phone: request.phone, location,
    propertyType: request.property_type, systemSize: request.system_size, preferredDate: request.preferred_date, message: request.message,
  };

  if (ranked.length) {
    const notify = matching.notifyInstallers !== false;
    await db.from('installer_request_matches').insert(ranked.map((i) => ({
      request_id: saved.id, installer_id: i.id, status: notify ? 'notified' : 'suggested', notified_at: notify ? new Date().toISOString() : null,
    })));
    await db.from('installer_requests').update({ status: 'matched' }).eq('id', saved.id);
    if (notify) {
      await Promise.all(ranked.filter((i) => i.email).map((i) =>
        sendEmail(i.email!, 'installer_lead', T.installerLead(brand, { ...base, installerName: i.company_name }))
      ));
    }
  }

  await Promise.all([
    sendEmail(request.email, 'request_received', T.requestReceived(brand, { ...base, matched: ranked.length, dashboardUrl: `${appUrl()}/account/requests` })),
    sendEmail(await adminRecipients(), 'admin_new_request', T.adminNewRequest(brand, { ...base, matched: ranked.length, adminUrl: `${appUrl()}/admin/requests` })),
  ]);
  await logActivity('installer_request.created', 'installer_request', saved.id, { matched: ranked.length }, caller?.user.id);

  return json(req, { id: saved.id, code: saved.code, matched: ranked.length }, 201);
}));
