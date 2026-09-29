import { escapeHtml as e } from '../validate.ts';
import { codeBlock, detailTable, type EmailBrand, p, renderLayout } from './layout.ts';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const humanStatus = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ Auth */

export type AuthAction = 'signup' | 'magiclink' | 'recovery' | 'email_change' | 'invite' | 'reauthentication';

export function authEmail(b: EmailBrand, d: { action: AuthAction; code: string; link: string; name?: string | null }): RenderedEmail {
  const copy: Record<AuthAction, { subject: string; heading: string; intro: string; cta: string }> = {
    signup: {
      subject: `Your ${b.companyName} sign-up code: ${d.code}`,
      heading: 'Confirm your email',
      intro: `Welcome${d.name ? `, ${e(d.name)}` : ''}. Enter this code to finish creating your account.`,
      cta: 'Confirm and continue',
    },
    magiclink: {
      subject: `Your ${b.companyName} sign-in code: ${d.code}`,
      heading: 'Your sign-in code',
      intro: 'Enter this code on the sign-in screen. It expires in 1 hour and can be used once.',
      cta: 'Sign in instead',
    },
    recovery: {
      subject: `Reset your ${b.companyName} password`,
      heading: 'Reset your password',
      intro: 'Use this code or the button below to choose a new password.',
      cta: 'Reset password',
    },
    email_change: {
      subject: `Confirm your new email for ${b.companyName}`,
      heading: 'Confirm your new email',
      intro: 'Enter this code to confirm the change to your account email.',
      cta: 'Confirm email change',
    },
    invite: {
      subject: `You have been invited to ${b.companyName}`,
      heading: 'Accept your invitation',
      intro: 'Use this code or the button below to set up your account.',
      cta: 'Accept invitation',
    },
    reauthentication: {
      subject: `Your ${b.companyName} confirmation code: ${d.code}`,
      heading: 'Confirm it is you',
      intro: 'Enter this code to confirm the action you started.',
      cta: 'Open ' + b.companyName,
    },
  };
  const c = copy[d.action];
  const html = renderLayout(b, {
    preheader: `${d.code} is your code. It expires in 1 hour.`,
    heading: c.heading,
    body: p(c.intro) + codeBlock(b, d.code),
    cta: d.action === 'reauthentication' ? undefined : { label: c.cta, url: d.link },
    note: 'If you did not request this, you can ignore this email. Nobody can access your account without the code.',
  });
  return { subject: c.subject, html, text: `${c.heading}\n\nYour code: ${d.code}\n\nOr open: ${d.link}\n` };
}

/* ------------------------------------------------------------ Payments */

export function consultationReceipt(
  b: EmailBrand,
  d: { name: string; code: string; amount: number; currency: string; reference: string; paidAt: string; reportUrl: string },
): RenderedEmail {
  const html = renderLayout(b, {
    preheader: `Payment received. Your load assessment ${d.code} is ready to download.`,
    heading: 'Your solar assessment is ready',
    body:
      p(`Hi ${e(d.name)}, thank you for your payment. We have confirmed it with Paystack and unlocked your full engineering report.`) +
      detailTable(b, [
        ['Assessment', d.code],
        ['Amount paid', money(d.amount, d.currency)],
        ['Reference', d.reference],
        ['Date', new Date(d.paidAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })],
      ]) +
      p('Your report includes PV, inverter and battery sizing, three battery options with backup times, and matched equipment.'),
    cta: { label: 'View and download report', url: d.reportUrl },
    note: 'Keep this email as your receipt. Final sizing should be confirmed by an on-site engineering assessment before you buy equipment.',
  });
  return {
    subject: `Receipt and report for ${d.code}`,
    html,
    text: `Payment received for ${d.code}: ${money(d.amount, d.currency)} (ref ${d.reference}). View your report: ${d.reportUrl}`,
  };
}

export function duplicatePaymentAdmin(b: EmailBrand, d: { reference: string; code: string; amount: number; currency: string; email: string }): RenderedEmail {
  const html = renderLayout(b, {
    preheader: `Second payment received for ${d.code}. Refund may be needed.`,
    heading: 'Duplicate consultation payment',
    body:
      p('A second successful payment arrived for an assessment that was already paid. The customer was not charged twice by us, but Paystack captured both. Review and refund from the Paystack dashboard if appropriate.') +
      detailTable(b, [['Assessment', d.code], ['Reference', d.reference], ['Amount', money(d.amount, d.currency)], ['Customer', d.email]]),
  });
  return { subject: `Duplicate payment on ${d.code}`, html, text: `Duplicate payment ${d.reference} on ${d.code}.` };
}

/* --------------------------------------------------------------- Orders */

export interface OrderEmailData {
  name: string;
  code: string;
  items: { name: string; quantity: number; lineTotal: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  address: string;
  orderUrl: string;
}

function itemsTable(b: EmailBrand, d: OrderEmailData) {
  const rows = d.items
    .map(
      (i) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #EFE7F6;font-size:14px;color:${b.ink};">${e(i.name)} <span style="color:#6B5E78;">&times; ${i.quantity}</span></td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #EFE7F6;font-size:14px;color:${b.primaryDark};">${e(money(i.lineTotal, d.currency))}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px 0;font-family:Ubuntu,Helvetica,Arial,sans-serif;">${rows}</table>` +
    detailTable(b, [
      ['Subtotal', money(d.subtotal, d.currency)],
      ['Delivery', d.deliveryFee ? money(d.deliveryFee, d.currency) : 'Free'],
      ['Total paid', money(d.total, d.currency)],
    ]);
}

export function orderConfirmation(b: EmailBrand, d: OrderEmailData): RenderedEmail {
  const html = renderLayout(b, {
    preheader: `Order ${d.code} confirmed. We are preparing it now.`,
    heading: `Order ${d.code} confirmed`,
    body:
      p(`Hi ${e(d.name)}, we have received your payment and are preparing your order.`) +
      itemsTable(b, d) +
      p(`<strong>Delivering to</strong><br>${e(d.address)}`),
    cta: { label: 'Track your order', url: d.orderUrl },
  });
  return { subject: `Order ${d.code} confirmed`, html, text: `Order ${d.code} confirmed. Total ${money(d.total, d.currency)}. ${d.orderUrl}` };
}

export function adminNewOrder(b: EmailBrand, d: OrderEmailData & { email: string; phone: string; adminUrl: string }): RenderedEmail {
  const html = renderLayout(b, {
    preheader: `New paid order ${d.code}: ${money(d.total, d.currency)}`,
    heading: `New order ${d.code}`,
    body: detailTable(b, [['Customer', d.name], ['Email', d.email], ['Phone', d.phone], ['Deliver to', d.address]]) + itemsTable(b, d),
    cta: { label: 'Open in admin', url: d.adminUrl },
  });
  return { subject: `New order ${d.code} — ${money(d.total, d.currency)}`, html, text: `New order ${d.code}.` };
}

export function orderStatusUpdate(b: EmailBrand, d: { name: string; code: string; status: string; orderUrl: string }): RenderedEmail {
  const lines: Record<string, string> = {
    processing: 'Your order is being packed and checked.',
    shipped: 'Your order is on its way. Our delivery partner will call before arrival.',
    delivered: 'Your order has been delivered. We hope everything arrived in perfect condition.',
    cancelled: 'Your order has been cancelled. If you paid, a refund will follow within 5–10 working days.',
    refunded: 'Your refund has been processed. Depending on your bank it can take a few days to appear.',
  };
  const html = renderLayout(b, {
    preheader: `Order ${d.code}: ${humanStatus(d.status)}`,
    heading: `Order ${d.code}: ${humanStatus(d.status)}`,
    body: p(`Hi ${e(d.name)}, ${lines[d.status] ?? `your order status is now ${e(humanStatus(d.status))}.`}`),
    cta: { label: 'View order', url: d.orderUrl },
  });
  return { subject: `Order ${d.code}: ${humanStatus(d.status)}`, html, text: `Order ${d.code} is now ${d.status}. ${d.orderUrl}` };
}

/* ----------------------------------------------------- Installer requests */

export interface RequestEmailData {
  code: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  propertyType?: string | null;
  systemSize?: string | null;
  preferredDate?: string | null;
  message?: string | null;
}

export function requestReceived(b: EmailBrand, d: RequestEmailData & { matched: number; dashboardUrl: string }): RenderedEmail {
  const next = d.matched
    ? `We have shared your request with ${d.matched} verified installer${d.matched > 1 ? 's' : ''} covering ${e(d.location)}. Expect a call within two working days.`
    : 'Our team is finding the right installer for your area and will contact you within two working days.';
  const html = renderLayout(b, {
    preheader: `Installation request ${d.code} received.`,
    heading: 'We have your installation request',
    body: p(`Hi ${e(d.name)}, thank you. ${next}`) +
      detailTable(b, [['Request', d.code], ['Location', d.location], ['System', d.systemSize], ['Preferred date', d.preferredDate]]),
    cta: { label: 'Track your request', url: d.dashboardUrl },
  });
  return { subject: `Installation request ${d.code} received`, html, text: `Request ${d.code} received.` };
}

export function adminNewRequest(b: EmailBrand, d: RequestEmailData & { matched: number; adminUrl: string }): RenderedEmail {
  const html = renderLayout(b, {
    preheader: `New installer request ${d.code} from ${d.location}`,
    heading: `New installer request ${d.code}`,
    body: detailTable(b, [
      ['Customer', d.name], ['Email', d.email], ['Phone', d.phone], ['Location', d.location],
      ['Property', d.propertyType], ['System', d.systemSize], ['Preferred date', d.preferredDate],
      ['Auto-matched installers', d.matched],
    ]) + (d.message ? p(`<strong>Message</strong><br>${e(d.message)}`) : ''),
    cta: { label: 'Review request', url: d.adminUrl },
  });
  return { subject: `New installer request ${d.code}`, html, text: `New request ${d.code} from ${d.name}.` };
}

export function installerLead(b: EmailBrand, d: RequestEmailData & { installerName: string }): RenderedEmail {
  const html = renderLayout(b, {
    preheader: `New ${d.systemSize ?? 'solar'} installation lead in ${d.location}`,
    heading: 'New installation lead',
    body:
      p(`Hello ${e(d.installerName)}, a customer in your coverage area has asked to be connected with an installer. Please contact them within two working days.`) +
      detailTable(b, [
        ['Reference', d.code], ['Customer', d.name], ['Phone', d.phone], ['Email', d.email], ['Location', d.location],
        ['Property', d.propertyType], ['System', d.systemSize], ['Preferred date', d.preferredDate],
      ]) + (d.message ? p(`<strong>Customer note</strong><br>${e(d.message)}`) : ''),
    note: 'This customer agreed to share their details with verified installers. Please treat them confidentially.',
  });
  return { subject: `New lead ${d.code}: ${d.location}`, html, text: `New lead ${d.code}: ${d.name}, ${d.phone}.` };
}

export function requestMatched(
  b: EmailBrand,
  d: { name: string; code: string; installers: { company_name: string; phone: string | null; whatsapp: string | null }[]; dashboardUrl: string },
): RenderedEmail {
  const list = d.installers
    .map((i) => `<li style="margin:0 0 8px 0;"><strong>${e(i.company_name)}</strong>${i.phone ? ` — ${e(i.phone)}` : ''}</li>`)
    .join('');
  const html = renderLayout(b, {
    preheader: `Installers assigned to request ${d.code}.`,
    heading: 'Your installers have been assigned',
    body: p(`Hi ${e(d.name)}, these verified installers will contact you about request ${e(d.code)}:`) +
      `<ul style="margin:0 0 16px 18px;padding:0;">${list}</ul>` +
      p('Ask each installer for a written quote after their site visit so you can compare like for like.'),
    cta: { label: 'View request', url: d.dashboardUrl },
  });
  return { subject: `Installers assigned to ${d.code}`, html, text: `Installers assigned to ${d.code}.` };
}

/* ------------------------------------------------------------ Enquiries */

const enquiryLabels: Record<string, string> = {
  custom_installation: 'custom installation enquiry',
  quote: 'quote request',
  contact: 'message',
  commercial: 'commercial project enquiry',
};

export function enquiryReceived(b: EmailBrand, d: { name: string; type: string }): RenderedEmail {
  const label = enquiryLabels[d.type] ?? 'enquiry';
  const html = renderLayout(b, {
    preheader: `We received your ${label}.`,
    heading: 'Thanks, we have your message',
    body: p(`Hi ${e(d.name)}, thank you for your ${label}. An engineer from our team will reply within one working day.`),
  });
  return { subject: `We received your ${label}`, html, text: `We received your ${label}.` };
}

export function adminNewEnquiry(
  b: EmailBrand,
  d: { type: string; name: string; email: string; phone?: string | null; company?: string | null; location?: string | null; message?: string | null; items?: { name: string; quantity: number }[]; adminUrl: string },
): RenderedEmail {
  const items = d.items?.length
    ? `<ul style="margin:0 0 16px 18px;padding:0;">${d.items.map((i) => `<li>${e(i.name)} &times; ${i.quantity}</li>`).join('')}</ul>`
    : '';
  const html = renderLayout(b, {
    preheader: `New ${enquiryLabels[d.type] ?? 'enquiry'} from ${d.name}`,
    heading: `New ${enquiryLabels[d.type] ?? 'enquiry'}`,
    body: detailTable(b, [['From', d.name], ['Email', d.email], ['Phone', d.phone], ['Company', d.company], ['Location', d.location]]) +
      items + (d.message ? p(e(d.message)) : ''),
    cta: { label: 'Open enquiries', url: d.adminUrl },
  });
  return { subject: `New ${enquiryLabels[d.type] ?? 'enquiry'} from ${d.name}`, html, text: `New enquiry from ${d.name}.` };
}

/* ----------------------------------------------------------- Installers */

export function installerApplicationReceived(b: EmailBrand, d: { company: string }): RenderedEmail {
  const html = renderLayout(b, {
    preheader: 'Your installer application is under review.',
    heading: 'Application received',
    body: p(`Thank you for applying to join the ${e(b.companyName)} installer network on behalf of ${e(d.company)}. Our team reviews certifications and past projects, and usually replies within five working days.`),
  });
  return { subject: 'Your installer application', html, text: 'Your installer application is under review.' };
}

export function adminInstallerApplication(b: EmailBrand, d: { company: string; state: string; email: string; phone: string; adminUrl: string }): RenderedEmail {
  const html = renderLayout(b, {
    preheader: `${d.company} applied to join the installer network.`,
    heading: 'New installer application',
    body: detailTable(b, [['Company', d.company], ['State', d.state], ['Email', d.email], ['Phone', d.phone]]),
    cta: { label: 'Review application', url: d.adminUrl },
  });
  return { subject: `Installer application: ${d.company}`, html, text: `Installer application from ${d.company}.` };
}

export function installerVerified(b: EmailBrand, d: { company: string; profileUrl: string }): RenderedEmail {
  const html = renderLayout(b, {
    preheader: 'You are now listed in our installer directory.',
    heading: 'You are verified',
    body: p(`Congratulations, ${e(d.company)} is now a verified installer. Your profile is live in our directory and you will start receiving leads in your coverage area.`),
    cta: { label: 'View your listing', url: d.profileUrl },
  });
  return { subject: `${d.company} is now verified`, html, text: `${d.company} is verified.` };
}

/* ---------------------------------------------------------------- Misc */

export function testEmail(b: EmailBrand): RenderedEmail {
  const html = renderLayout(b, {
    preheader: 'Your email settings are working.',
    heading: 'Email delivery is working',
    body: p('This is a test message from your admin dashboard. Transactional emails will look like this.') +
      detailTable(b, [['Sent at', new Date().toISOString()]]),
    cta: { label: 'Open the site', url: b.siteUrl },
  });
  return { subject: 'Test email', html, text: 'Email delivery is working.' };
}
