# Deployment

## 1. Supabase

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-ref>
supabase db push                       # applies supabase/migrations/20260929000000_init.sql
```

The migration creates:

- the schema and all RLS policies;
- the `media` bucket (public images) and the `reports` bucket (private PDFs);
- all seed data;
- the admin user.

### Secrets

```bash
supabase secrets set \
  PAYSTACK_SECRET_KEY=sk_live_xxx \
  RESEND_API_KEY=re_xxx \
  EMAIL_FROM="KuraSolar <hello@kurasolar.ng>" \
  EMAIL_REPLY_TO=hello@kurasolar.ng \
  APP_URL=https://kurasolar.ng \
  ALLOWED_ORIGINS=https://kurasolar.ng,https://www.kurasolar.ng \
  SEND_EMAIL_HOOK_SECRET="v1,whsec_xxx"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### Functions

```bash
supabase functions deploy
```

`supabase/config.toml` disables JWT verification on four groups of functions:

- `paystack-webhook`, which checks the Paystack signature instead;
- `auth-email-hook`, which checks the Standard Webhooks signature instead;
- `admin-login`;
- the public forms `installer-request` and `enquiry-submit`.

The public forms validate input and are rate-limited.

### Auth settings (dashboard)

- **Authentication → Providers → Email:** enable. Set OTP length 6 and expiry 900 s. Keep "Confirm email" off, because the code itself confirms.
- **URL configuration:** set the Site URL to `https://kurasolar.ng`, and add redirect URLs `https://kurasolar.ng/**` and your preview domains.
- **Auth Hooks → Send Email:** use the HTTPS hook `https://<ref>.supabase.co/functions/v1/auth-email-hook`. Generate the secret and store it as `SEND_EMAIL_HOOK_SECRET`.

## 2. Resend

Add and verify your domain, including the SPF and DKIM DNS records. `EMAIL_FROM` must use that domain. Every send is recorded in the `email_log` table, visible at Admin → Email log.

## 3. Paystack

- **Settings → API keys & webhooks:** set the webhook URL to `https://<ref>.supabase.co/functions/v1/paystack-webhook`.
- The callback URL is set per transaction to `${APP_URL}/payment/callback`. Nothing needs configuring for it.
- Use test keys first; see the checklist in HANDOVER.md.

## 4. Frontend

Deploy to Vercel or Netlify:

- **Build command:** `npm run build`.
- **Output directory:** `dist`.
- **Environment variables:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

SPA routing and security headers are handled by `vercel.json`, or by `public/_redirects` on Netlify.

## 5. Backups and logs

- Enable **Point-in-Time Recovery** on the Supabase project (Pro plan), or at least rely on the daily backups.
- Audit trails inside the database:
  - `activity_log`: admin actions and logins;
  - `webhook_events`: every Paystack webhook, with signature validity;
  - `email_log`: every email sent;
  - `payments`: the full payment history.
- Edge function logs are available in the Supabase dashboard under **Functions → Logs**.
