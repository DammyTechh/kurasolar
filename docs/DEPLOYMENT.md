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

## 4. Frontend on Vercel

`vercel.json` already pins the framework, build command, output directory, SPA
rewrites, security headers and cache policy, so there is nothing to configure in
the Vercel UI beyond the two environment variables below. (For Netlify instead,
`public/_redirects` covers routing; set the same two variables there.)

### 4.1 Import the repository

1. Vercel → **Add New → Project** → import the GitHub repo.
2. Framework preset should read **Vite**, build command `npm run build`, output
   directory `dist`. Leave them as detected — `vercel.json` sets them anyway.
3. Node version: **20.x or later**. `package.json` declares `engines.node`, so
   Vercel picks a compatible runtime automatically.

### 4.2 Environment variables

Add both for **Production, Preview and Development**:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's anon/publishable key |

Only these two. The service-role key, Paystack secret and Resend key are edge
function secrets and must never be added here — anything prefixed `VITE_` is
compiled into the JavaScript bundle and is public.

Vite reads these at **build** time, so after changing either one you must
redeploy; restarting is not enough.

### 4.3 Point the rest of the stack at the deployed URL

Once the first deploy succeeds and you know the domain:

1. **Supabase function secret:** `supabase secrets set APP_URL=https://kurasolar.com`.
   This is what payment callbacks, receipt links and the PDF report logo use, so
   a stale value breaks the post-payment redirect.
2. **Supabase Auth → URL Configuration:** set the Site URL to the same domain and
   add `https://kurasolar.com/**` to the redirect allow-list. Add your Vercel
   preview domain too if you test sign-in on previews.
3. **`ALLOWED_ORIGINS`** function secret: include the production domain, and the
   `*.vercel.app` preview domain if you want previews to call the functions.

### 4.4 Custom domain

Vercel → **Settings → Domains** → add `kurasolar.com` and `www.kurasolar.com`,
then point DNS at Vercel (A record `76.76.21.21`, or the CNAME Vercel shows).
Redirect `www` to the apex. HSTS is already sent by `vercel.json`, so only add
the domain once you are certain every subdomain can serve HTTPS.

### 4.5 Checks after deploying

- Open `/solar-calculator`, pick a country and confirm the region list loads.
- Deep-link straight to `/shop` and reload — a 404 means the rewrite is not applied.
- Confirm fonts load (the page should be Archivo, not a system serif).
- Run a Paystack test payment end to end and check the callback lands on
  `/payment/callback` on the deployed domain, not on localhost.

## 5. Backups and logs

- Enable **Point-in-Time Recovery** on the Supabase project (Pro plan), or at least rely on the daily backups.
- Audit trails inside the database:
  - `activity_log`: admin actions and logins;
  - `webhook_events`: every Paystack webhook, with signature validity;
  - `email_log`: every email sent;
  - `payments`: the full payment history.
- Edge function logs are available in the Supabase dashboard under **Functions → Logs**.
