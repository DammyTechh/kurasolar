/**
 * POST /functions/v1/enquiry-submit
 *   type: custom_installation | quote | contact | commercial | installer_application
 */
import { admin, getCaller, rateLimit } from '../_shared/db.ts';
import { adminRecipients, emailBrand, sendEmail } from '../_shared/email/send.ts';
import * as T from '../_shared/email/templates.ts';
import { appUrl } from '../_shared/env.ts';
import { clientIp, handler, HttpError, json, readJson } from '../_shared/http.ts';
import { email, phone, randomToken, slugify, str } from '../_shared/validate.ts';

const TYPES = ['custom_installation', 'quote', 'contact', 'commercial'] as const;
const SERVICES = ['residential', 'commercial', 'industrial', 'off_grid', 'hybrid', 'bess', 'solar_pv', 'maintenance'];

const list = (v: unknown, max = 40) =>
  (Array.isArray(v) ? v : []).map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, max);

Deno.serve(handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const caller = await getCaller(req);
  await rateLimit(`enquiry:${caller?.user.id ?? clientIp(req)}`, 8, 3600);
  const b = await readJson<Record<string, unknown>>(req);
  const db = admin();
  const brand = await emailBrand();

  if (b.type === 'installer_application') {
    const company = str(b, 'company_name', { required: true, max: 120, label: 'Company name' })!;
    const application = {
      slug: `${slugify(company)}-${randomToken(3)}`,
      company_name: company,
      contact_person: str(b, 'contact_person', { required: true, max: 120, label: 'Contact person' }),
      email: email(b)!,
      phone: phone(b)!,
      whatsapp: str(b, 'whatsapp', { max: 32 }),
      website: str(b, 'website', { max: 200 }),
      state: str(b, 'state', { required: true, max: 80, label: 'State' })!,
      city: str(b, 'city', { max: 80 }),
      states_covered: list(b.states_covered),
      services: list(b.services).filter((s) => SERVICES.includes(s)),
      certifications: list(b.certifications, 20),
      years_experience: Math.max(0, Math.min(80, Math.round(Number(b.years_experience) || 0))),
      completed_projects: Math.max(0, Math.min(100000, Math.round(Number(b.completed_projects) || 0))),
      bio: str(b, 'bio', { max: 2000 }),
      user_id: caller?.user.id ?? null,
      verification_status: 'pending',
    };
    const { error } = await db.from('installers').insert(application);
    if (error) throw error;
    await Promise.all([
      sendEmail(application.email, 'installer_application_received', T.installerApplicationReceived(brand, { company })),
      sendEmail(await adminRecipients(), 'admin_installer_application', T.adminInstallerApplication(brand, {
        company, state: application.state, email: application.email, phone: application.phone, adminUrl: `${appUrl()}/admin/installers`,
      })),
    ]);
    return json(req, { ok: true }, 201);
  }

  const type = TYPES.includes(b.type as never) ? (b.type as (typeof TYPES)[number]) : null;
  if (!type) throw new HttpError(422, 'Unknown enquiry type.');

  // Quote requests carry cart items; names are re-read from the catalogue.
  let items: { product_id: string; name: string; quantity: number }[] | null = null;
  if (type === 'quote' && Array.isArray(b.items)) {
    const raw = (b.items as { product_id: string; quantity: number }[]).slice(0, 50);
    const { data: products } = await db.from('products').select('id, name').in('id', raw.map((i) => String(i.product_id)));
    items = raw
      .map((i) => ({ product_id: i.product_id, name: products?.find((p) => p.id === i.product_id)?.name ?? '', quantity: Math.max(1, Math.round(Number(i.quantity) || 1)) }))
      .filter((i) => i.name);
  }

  const enquiry = {
    type,
    user_id: caller?.user.id ?? null,
    full_name: str(b, 'full_name', { required: true, max: 120, label: 'Full name' })!,
    email: email(b)!,
    phone: phone(b, 'phone', type !== 'contact'),
    company: str(b, 'company', { max: 120 }),
    location: str(b, 'location', { max: 200 }),
    message: str(b, 'message', { required: type !== 'quote', max: 4000, label: 'Message' }),
    items,
  };
  const { error } = await db.from('enquiries').insert(enquiry);
  if (error) throw error;

  await Promise.all([
    sendEmail(enquiry.email, 'enquiry_received', T.enquiryReceived(brand, { name: enquiry.full_name, type })),
    sendEmail(await adminRecipients(), 'admin_new_enquiry', T.adminNewEnquiry(brand, {
      type, name: enquiry.full_name, email: enquiry.email, phone: enquiry.phone, company: enquiry.company,
      location: enquiry.location, message: enquiry.message, items: items ?? undefined, adminUrl: `${appUrl()}/admin/enquiries`,
    })),
  ]);
  return json(req, { ok: true }, 201);
}));
