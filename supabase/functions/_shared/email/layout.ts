import { escapeHtml } from '../validate.ts';

export interface EmailBrand {
  companyName: string;
  logoUrl: string;
  siteUrl: string;
  address: string;
  supportEmail: string;
  primary: string;
  primaryDark: string;
  accent: string;
  surface: string;
  ink: string;
}

export interface LayoutInput {
  preheader: string;
  heading: string;
  /** Pre-rendered, already-escaped HTML blocks. */
  body: string;
  cta?: { label: string; url: string };
  /** Small print under the button. */
  note?: string;
}

const FONT = `Ubuntu, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

/**
 * Table-based layout that renders consistently in Gmail, Outlook and Apple Mail.
 * Ubuntu loads where the client allows web fonts and falls back cleanly elsewhere.
 */
export function renderLayout(b: EmailBrand, input: LayoutInput): string {
  const year = new Date().getFullYear();
  const cta = input.cta
    ? `
      <tr><td style="padding:8px 40px 8px 40px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
          <td style="border-radius:10px;background:${b.primary};">
            <a href="${escapeHtml(input.cta.url)}" target="_blank"
               style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
              ${escapeHtml(input.cta.label)}
            </a>
          </td>
        </tr></table>
      </td></tr>`
    : '';
  const note = input.note
    ? `<tr><td style="padding:14px 40px 0 40px;font-family:${FONT};font-size:13px;line-height:20px;color:#6B5E78;">${input.note}</td></tr>`
    : '';

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <title>${escapeHtml(input.heading)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    body { margin:0; padding:0; }
    a { color:${b.primary}; }
    @media (max-width: 620px) {
      .container { width:100% !important; border-radius:0 !important; }
      .px { padding-left:24px !important; padding-right:24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${b.surface};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}&#8203;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${b.surface};">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0"
             style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #E7DEF0;">
        <tr><td class="px" style="padding:28px 40px 22px 40px;">
          <a href="${escapeHtml(b.siteUrl)}" target="_blank" style="text-decoration:none;">
            <img src="${escapeHtml(b.logoUrl)}" width="148" alt="${escapeHtml(b.companyName)}" style="display:block;border:0;height:auto;width:148px;">
          </a>
        </td></tr>
        <tr><td style="height:4px;line-height:4px;font-size:0;background:${b.accent};">&nbsp;</td></tr>
        <tr><td class="px" style="padding:36px 40px 8px 40px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;color:${b.primaryDark};">
          ${escapeHtml(input.heading)}
        </td></tr>
        <tr><td class="px" style="padding:4px 40px 16px 40px;font-family:${FONT};font-size:15px;line-height:24px;color:${b.ink};">
          ${input.body}
        </td></tr>
        ${cta}
        ${note}
        <tr><td style="height:36px;line-height:36px;font-size:0;">&nbsp;</td></tr>
        <tr><td class="px" style="padding:24px 40px;background:${b.primaryDark};font-family:${FONT};font-size:12px;line-height:19px;color:#D9CCE6;">
          <strong style="color:#ffffff;">${escapeHtml(b.companyName)}</strong><br>
          ${escapeHtml(b.address)}<br>
          Questions? Reply to this email or write to
          <a href="mailto:${escapeHtml(b.supportEmail)}" style="color:${b.accent};text-decoration:none;">${escapeHtml(b.supportEmail)}</a>.<br>
          <span style="color:#A996BD;">&copy; ${year} ${escapeHtml(b.companyName)}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ---------- Reusable content blocks ---------- */

export const p = (html: string) => `<p style="margin:0 0 16px 0;">${html}</p>`;

/** A two-column key/value summary box. Values are escaped. */
export function detailTable(b: EmailBrand, rows: [string, string | number | null | undefined][]): string {
  const cells = rows
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(
      ([k, v], i) => `
      <tr>
        <td style="padding:10px 16px;font-family:${FONT};font-size:13px;color:#6B5E78;${i ? 'border-top:1px solid #EFE7F6;' : ''}">${escapeHtml(k)}</td>
        <td align="right" style="padding:10px 16px;font-family:${FONT};font-size:14px;font-weight:500;color:${b.primaryDark};${i ? 'border-top:1px solid #EFE7F6;' : ''}">${escapeHtml(String(v))}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
            style="margin:4px 0 20px 0;background:${b.surface};border-radius:12px;">${cells}</table>`;
}

/** Big, spaced one-time code. */
export function codeBlock(b: EmailBrand, code: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 22px 0;"><tr>
    <td style="padding:16px 28px;background:${b.surface};border:1px dashed ${b.accent};border-radius:12px;
               font-family:${FONT};font-size:32px;font-weight:700;letter-spacing:10px;color:${b.primaryDark};">
      ${escapeHtml(code)}
    </td></tr></table>`;
}
