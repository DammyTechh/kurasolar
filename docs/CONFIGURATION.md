# Configuration

Everything below lives in the database and is edited in the admin. No redeploy is needed.

| Admin page | Stored in | Controls |
|---|---|---|
| Fees & currencies | `site_settings.consultation`, `.commerce` | Consultation fee per currency, currencies accepted at checkout, delivery fee, free-delivery threshold |
| Engineering | `site_settings.engineering`, `.appliance_lookups` | Every sizing assumption (DoD, efficiencies, margins, panel wattage, inverter sizes, coincidence, night fractions, backup hours by grid), TV/AC default wattages |
| Regions & sun hours | `regions`, `countries` | Peak sun hours and temperature per state/country, default currency per country |
| Appliance database | `appliance_catalog` | "Quick add" presets in the calculator |
| Site content | `site_content.*` | Hero, trust points, how it works, why us, installation band, testimonials, FAQ (also FAQ schema), CTA, about, contact, disclaimer |
| Brand & settings | `site_settings.brand`, `.company`, `.whatsapp`, `.seo`, `.notifications`, `.matching` | Colours (applied live as CSS variables), company details used on emails and PDFs, WhatsApp button, SEO defaults, admin notification emails, installers per request |

Changes to engineering settings affect **new** calculations only. Paid reports keep the assumptions they were calculated with, which are stored in `assessment_results.result.assumptions`.

## Environment variables

- **Frontend (`.env`):** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only. Never put secrets here.
- **Edge functions:** see `docs/DEPLOYMENT.md`. For local serving, put them in `supabase/functions/.env`, which is gitignored.
