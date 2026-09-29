# Handover: status and next steps

_Last updated 29 September 2026._

## 1. Where the project is

All planned features are built. The frontend type-checks and builds cleanly. The database migration applies cleanly and its security rules pass tests. All 10 edge functions pass `deno check`.

**Nothing has yet run against a real Supabase project, Paystack account or Resend account.** Live integration testing (section 3) is the main remaining work.

### Built and verified locally

| Area | Status | How it was verified |
|---|---|---|
| Single migration (schema, RLS, storage buckets, seed, admin user) | Done | Applied to local Postgres 16 with auth/storage stubs |
| RLS: paywall, no self-promotion to admin, public installer view, admin-only stats, rate limits, service-role-only stock function | Done | SQL test script |
| Calculation engine (duty cycles, coincidence, surge, regional sun hours and temperature, battery tiers) | Done | Hand-checked sample homes; frontend flow numbers match hand calculation |
| Edge functions (10) | Done | `deno check` only, not executed live |
| PDF report | Done | Generated and visually reviewed (4 pages) |
| Email templates (auth codes, receipts, orders, installers, admin alerts) | Done | Code only, not sent live |
| Public site: home with 3D hero, calculator, assessment paywall, shop, product, packages, cart, checkout, quote, installers directory, request, join, blog, about, contact, 404 | Done | Build + headless-browser screenshots; calculator flow clicked through end-to-end |
| Customer account: email-code sign-in/up, onboarding, profile with avatar, assessments, orders, payments, requests, saved appliance lists | Done | Build + type-check (needs live auth to test) |
| Admin: overview, assessments, payments, orders, installer requests, enquiries, customers, products, categories, packages, installers, appliance DB, regions and countries, engineering, fees, site content, articles, brand and settings, email log, account | Done | Build + type-check (needs live data to test) |

### Deliberate decisions worth knowing

- **Recommended system values are stored in `assessment_results`, not `assessments`.** The spec put them on the assessment row. They were moved so RLS can hide them until payment. `assessments` only holds pre-payment data (load, system class).
- **Calculator has 4 steps** (Location, Appliances, Priorities, Review) rather than one step per appliance category. The appliance step is organised by category tiles. This is faster on mobile.
- **3D hero loads only on desktop** with WebGL and no data-saver or reduced-motion setting. Phones get a matching SVG drawing, which keeps mobile data light.
- **Testimonials are empty** in the seed. The section stays hidden until real quotes are added in Admin → Site content.
- **Seed products have no photos.** Clean drawn placeholders show per product type until images are uploaded.

## 2. Go-live checklist (do in order)

Full commands are in `docs/DEPLOYMENT.md`.

1. **Create a Supabase project**, then run `supabase link` and `supabase db push`.
2. **Set function secrets:** `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `SEND_EMAIL_HOOK_SECRET`, `ALLOWED_ORIGINS`.
3. **Deploy functions:** `supabase functions deploy`. `config.toml` sets `verify_jwt` per function.
4. **Supabase Auth dashboard:**
   - Enable Email OTP.
   - Set Site URL and redirect URLs.
   - Enable the **Send Email Hook** pointing to `/functions/v1/auth-email-hook` and copy its secret into `SEND_EMAIL_HOOK_SECRET`.
5. **Resend:** verify the sending domain (SPF/DKIM) and set `EMAIL_FROM` on that domain.
6. **Paystack:**
   - Set the webhook URL to `https://<ref>.supabase.co/functions/v1/paystack-webhook`.
   - Enable USD on the account if you keep USD in Admin → Fees and currencies. Otherwise remove USD from the accepted currencies.
7. **Frontend:** deploy to Vercel or Netlify with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
8. **Sign in at `/admin/login` and change the admin password.**
9. **Replace placeholder content in the admin:**
   - company phone and email;
   - WhatsApp number, then enable the button;
   - product prices, stock and photos;
   - package prices;
   - real installers.

## 3. Next steps (priority order)

### Must do before launch
1. **End-to-end test on Paystack test keys.**
   - Calculate, pay, get redirected to the callback, see the report unlock, download the PDF, and receive the receipt email.
   - Repeat for a shop order and check stock decreases.
   - Replay the webhook to confirm nothing happens twice.
   - Pay twice for one assessment to confirm the duplicate alert.
2. **Test auth emails live.** Check sign-up and sign-in codes arrive through Resend with branding, and that onboarding appears once.
3. **Test the report logo.** The PDF fetches the logo from `APP_URL + company.logoUrl`, so `APP_URL` must point at the deployed frontend.
4. **Test every admin page with real data.** Check edit and save on each section, image uploads, and that installer verification sends its email.
5. **Engineering review of seed assumptions** in Admin → Engineering: derating, margins, backup hours, regional sun hours and appliance presets. They are sensible defaults, but a KuraSolar engineer should sign them off.

### Should do soon after
6. **Sitemap.** `robots.txt` references `/sitemap.xml`, which doesn't exist yet. Add a small build script or edge function that lists products, posts and static pages.
7. **Prerendering or SSR for SEO.** The site is a SPA. Meta tags and JSON-LD are set client-side, which Google handles but social previews don't. Consider prerendering public routes, e.g. with `vite-plugin-prerender` or by moving to a framework with SSR.
8. **Refunds.** `refundPayment()` exists in `_shared/payments.ts` and re-locks an assessment, but no webhook event or admin button calls it yet.
9. **Automated tests.** There are none in the repo. Suggested:
   - unit tests for `supabase/functions/_shared/engine`, which is pure TS and easy to test;
   - a Playwright smoke test for calculator to sign-in;
   - the RLS SQL checks turned into a pgTAP suite.
10. **Error monitoring,** such as Sentry for the frontend plus log drains for edge functions.

### Nice to have
11. Installer self-service portal, so installers can log in, see leads and accept or decline. The `installer_request_matches.status` field is ready for this.
12. Multi-currency shop prices. The shop is NGN-only today; the consultation fee is already multi-currency.
13. Downloadable CSV exports in the admin, such as payments and orders for accounting.
14. Shipping cost rules per state. Delivery is currently one flat fee plus a free-delivery threshold.

## 4. Known limitations

- The admin chart and stats rely on the `admin_stats()` SQL function, which computes counts live. That is fine at thousands of rows; add caching if volumes grow a lot.
- The main JS bundle is about 135 KB gzipped. The three.js chunk (about 240 KB gzipped) loads only on desktop for the hero.
- Installer directory filtering by "states covered" relies on exact state names. Keep installer states consistent with the Regions list.
