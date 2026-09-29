# KuraSolar

Solar sizing, e-commerce and installer marketplace for Nigerian homes and businesses.

**Stack:** React 19 + TypeScript + Tailwind CSS 4 (Vite) · Supabase (Postgres, Auth, Storage, Edge Functions) · Paystack · Resend.

> Start with **[HANDOVER.md](HANDOVER.md)**: current status, what has and hasn't been tested, and next steps.

## Project structure

```
kurasolar/
├── index.html                  SEO meta, Organization/WebSite JSON-LD, Ubuntu font
├── public/                     logo variants, favicon/app icons, robots.txt, manifest, _redirects
├── vercel.json                 SPA rewrites + security headers (Netlify uses public/_redirects)
├── src/
│   ├── main.tsx, App.tsx       providers and routes
│   ├── index.css               design tokens (brand colours are CSS variables set from the DB)
│   ├── lib/                    supabase client, edge-function caller, queries, types, formatting, SEO
│   ├── providers/              Auth, Site settings/brand, Cart, Toasts
│   ├── components/             ui/ primitives, layout/, shop/, three/ (3D hero + SVG fallback)
│   ├── features/calculator/    appliance categories, editor, live summary, draft storage
│   ├── pages/                  public pages, auth/ (email-code sign-in, onboarding), account/
│   └── admin/                  /admin app: generic Resource CRUD, JSON settings editor, pages
├── supabase/
│   ├── config.toml             function JWT rules, email OTP, auth email hook
│   ├── migrations/20260929000000_init.sql   the ONE migration: schema, RLS, storage, seed data, admin user
│   └── functions/
│       ├── _shared/engine/     calculation engine (framework-free TS, shared with the browser)
│       ├── _shared/            db, http/CORS, Paystack, payment settlement, emails, PDF report
│       └── <10 endpoints>/     see docs/API.md
└── docs/                       API.md, CONFIGURATION.md, DEPLOYMENT.md
```

## Quick start (local)

```bash
npm install
cp .env.example .env            # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
supabase start                  # local Supabase (Docker)
supabase db reset               # applies the single migration + seed
supabase functions serve --env-file supabase/functions/.env
npm run dev                     # http://localhost:5173
```

Useful scripts: `npm run build`, `npm run typecheck`, `npm run functions:check` (Deno type-check).

Full production setup: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Admin

- URL: `/admin` (sign-in at `/admin/login`). There is no admin registration.
- Seeded admin: `nnamaniafamefuna@gmail.com` (username `admin`). The initial password was shared privately and is stored only as a bcrypt hash. **Change it at Admin → My admin account after first sign-in.**
- Everything customer-facing is editable without code: landing-page content, FAQ, brand colours, consultation fees per currency, engineering assumptions, appliance presets, regional sun hours, products, packages, installers, articles, WhatsApp, SEO, notification emails.

## Security model (summary)

- All sizing (PV, inverter, battery) runs on the server. The browser only computes the pre-payment load summary.
- Full results sit in `assessment_results`, which RLS exposes to the owner **only after** `status = 'paid'`.
- Payment amounts come from the database, never the browser. Payments unlock only after server-side Paystack verification (callback and HMAC-verified webhook both settle idempotently). Duplicate payments alert admins.
- PDF reports live in a private bucket and are served via 5-minute signed URLs.
- Customers cannot change their own role (trigger-enforced). Admin login is rate-limited.
