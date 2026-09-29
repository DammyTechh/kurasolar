# Edge function API

Base URL: `https://<ref>.supabase.co/functions/v1/`.

The browser calls these through `supabase.functions.invoke`, which sends the user's JWT. Errors return `{ "error": "message" }` with an HTTP status code.

| Function | Auth | Body | Returns |
|---|---|---|---|
| `assessment-calculate` | user | `{ assessment_id?, location, customer, appliances[] }` | `{ id, code, status, summary, teaser }` (full result stored server-side) |
| `payment-initialize` | user | `{ purpose: "consultation", assessment_id, currency? }` or `{ purpose: "order", items[{product_id, quantity}], shipping }` | `{ authorization_url, reference }` |
| `payment-verify` | user | `{ reference }` | `{ status, purpose, assessment_id, order_id, message }` |
| `paystack-webhook` | Paystack signature | Paystack event | `200` |
| `report-download` | owner (paid) or admin | `{ assessment_id }` | `{ url, filename, expires_in: 300 }`, or `402` if unpaid |
| `installer-request` | optional | `{ full_name, email, phone, state, city?, address?, property_type?, system_size?, preferred_date?, message?, assessment_id? }` | `{ id, code, matched }` |
| `enquiry-submit` | optional | `{ type: quote \| contact \| custom_installation \| commercial, ... }` or `{ type: "installer_application", company_name, ... }` | `{ ok: true }` |
| `admin-login` | none (rate-limited) | `{ identifier, password }` | `{ access_token, refresh_token, expires_at }` |
| `admin-actions` | admin | `{ action: assign_installers \| update_order_status \| set_installer_status \| regenerate_report \| resend_receipt \| test_email, ... }` | `{ ok: true }` |
| `auth-email-hook` | Standard Webhooks signature | Supabase Auth hook payload | `200` |

**Payment settlement.** Settlement is idempotent: the callback and the webhook both call `settlePayment()`. It checks reference, amount (in subunits), currency and email against Paystack's verify endpoint. It performs a conditional update, so side effects (unlock, stock, emails) run exactly once.

**Engine.** The engine lives in `supabase/functions/_shared/engine/`:

- `client.ts` is the browser entry and exposes the load summary only;
- `index.ts` is the server entry and includes the full sizing.
