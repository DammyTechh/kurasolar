-- =============================================================================
-- KuraSolar platform — initial schema
-- One migration for the whole system: types, tables, functions, row level
-- security, storage buckets, reference data and the seeded administrator.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enumerated types
-- -----------------------------------------------------------------------------
create type public.user_role         as enum ('customer', 'admin');
create type public.load_priority     as enum ('essential', 'important', 'heavy');
create type public.grid_availability as enum ('reliable', 'intermittent', 'poor', 'none');
create type public.assessment_status as enum ('calculated', 'paid');
create type public.payment_status    as enum ('pending', 'success', 'failed', 'abandoned', 'refunded');
create type public.payment_purpose   as enum ('consultation', 'order');
create type public.order_status      as enum ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
create type public.installer_status  as enum ('pending', 'verified', 'suspended');
create type public.request_status    as enum ('new', 'matched', 'contacted', 'scheduled', 'completed', 'cancelled');
create type public.enquiry_type      as enum ('custom_installation', 'quote', 'contact', 'commercial');
create type public.enquiry_status    as enum ('new', 'in_progress', 'closed');

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
create sequence public.assessment_code_seq;
create sequence public.order_code_seq;
create sequence public.request_code_seq;

-- Human-readable codes such as SOL-2026-000001.
create function public.next_code(prefix text, seq regclass)
returns text
language sql
volatile
set search_path = public
as $$
  select prefix || '-' || to_char(now() at time zone 'Africa/Lagos', 'YYYY') || '-' || lpad(nextval(seq)::text, 6, '0');
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles (one per auth user)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text,
  username        text unique,
  full_name       text,
  phone           text,
  avatar_url      text,
  country         text default 'Nigeria',
  state           text,
  city            text,
  address         text,
  property_type   text,
  marketing_opt_in boolean not null default false,
  role            public.user_role not null default 'customer',
  onboarded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-z0-9_.]{3,32}$')
);
create index profiles_role_idx on public.profiles (role);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Service role, direct database sessions (migrations, SQL editor) and admins.
create function public.is_trusted()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), 'service_role') = 'service_role' or public.is_admin();
$$;

-- Customers can edit their own profile but never their role, username or email.
create function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trusted() then
    new.role     := old.role;
    new.username := old.username;
    new.email    := old.email;
  end if;
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- Create a profile whenever an auth user is created (email OTP sign-up passes metadata).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, full_name, phone, country, state, city)
  values (
    new.id,
    new.email,
    nullif(trim(meta ->> 'full_name'), ''),
    nullif(trim(meta ->> 'phone'), ''),
    coalesce(nullif(trim(meta ->> 'country'), ''), 'Nigeria'),
    nullif(trim(meta ->> 'state'), ''),
    nullif(trim(meta ->> 'city'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Configuration and editable content
-- -----------------------------------------------------------------------------
create table public.site_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

create table public.site_content (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create trigger site_content_updated_at before update on public.site_content
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Regional solar resource
-- -----------------------------------------------------------------------------
create table public.countries (
  code                   char(2) primary key,
  name                   text not null unique,
  currency               text not null,
  default_peak_sun_hours numeric(4,2) not null check (default_peak_sun_hours > 0 and default_peak_sun_hours < 12),
  default_ambient_temp_c numeric(4,1),
  is_active              boolean not null default true,
  sort_order             int not null default 0
);

create table public.regions (
  id              uuid primary key default gen_random_uuid(),
  country_code    char(2) not null references public.countries (code) on delete cascade,
  name            text not null,
  zone            text,
  peak_sun_hours  numeric(4,2) not null check (peak_sun_hours > 0 and peak_sun_hours < 12),
  ambient_temp_c  numeric(4,1),
  is_active       boolean not null default true,
  unique (country_code, name)
);

-- -----------------------------------------------------------------------------
-- Appliance database (quick-add presets and default assumptions)
-- -----------------------------------------------------------------------------
create table public.appliance_catalog (
  id                  uuid primary key default gen_random_uuid(),
  category            text not null check (category in (
                        'television','refrigerator','freezer','air_conditioner','audio','washing_machine',
                        'lighting','plug_load','electric_iron','water_heater','pump','custom')),
  name                text not null,
  description         text,
  default_watts       numeric(10,1) not null check (default_watts > 0),
  default_hours       numeric(5,2) not null check (default_hours between 0 and 24),
  duty_cycle          numeric(4,3) not null default 1 check (duty_cycle > 0 and duty_cycle <= 1),
  surge_factor        numeric(4,2) not null default 1 check (surge_factor >= 1),
  priority            public.load_priority not null default 'important',
  usage_window        text not null default 'anytime' check (usage_window in ('day','evening','night','anytime')),
  inverter_technology boolean not null default false,
  horsepower          numeric(5,2),
  is_active           boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index appliance_catalog_category_idx on public.appliance_catalog (category, sort_order);
create trigger appliance_catalog_updated_at before update on public.appliance_catalog
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Assessments
-- -----------------------------------------------------------------------------
create table public.assessments (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique default public.next_code('SOL', 'public.assessment_code_seq'),
  user_id             uuid references public.profiles (id) on delete set null,
  customer_name       text,
  customer_email      text,
  customer_phone      text,
  country             text not null default 'Nigeria',
  state               text,
  city                text,
  postcode            text,
  grid_availability   public.grid_availability not null default 'intermittent',
  backup_hours        numeric(5,1),
  currency            text not null default 'NGN',
  property_type       text,
  is_diaspora         boolean not null default false,
  recipient           jsonb,
  status              public.assessment_status not null default 'calculated',
  appliance_count     int not null default 0,
  connected_load_kw   numeric(10,2),
  peak_load_kw        numeric(10,2),
  surge_peak_kw       numeric(10,2),
  daily_energy_kwh    numeric(10,2),
  essential_load_kw   numeric(10,2),
  heavy_load_kw       numeric(10,2),
  system_class        text,
  inverter_class_kva  numeric(8,1),
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index assessments_user_idx on public.assessments (user_id, created_at desc);
create index assessments_status_idx on public.assessments (status, created_at desc);
create trigger assessments_updated_at before update on public.assessments
  for each row execute function public.set_updated_at();

create table public.assessment_appliances (
  id                  uuid primary key default gen_random_uuid(),
  assessment_id       uuid not null references public.assessments (id) on delete cascade,
  position            int not null default 0,
  category            text not null,
  name                text not null,
  quantity            int not null check (quantity > 0),
  rated_watts         numeric(10,1) not null,
  horsepower          numeric(5,2),
  hours_per_day       numeric(5,2) not null,
  days_per_week       int not null default 7,
  cycles_per_day      numeric(4,1) not null default 1,
  duty_cycle          numeric(4,3) not null,
  surge_factor        numeric(4,2) not null,
  priority            public.load_priority not null,
  usage_window        text not null,
  inverter_technology boolean not null default false,
  attributes          jsonb,
  daily_kwh           numeric(10,3) not null
);
create index assessment_appliances_assessment_idx on public.assessment_appliances (assessment_id, position);

-- Full engineering result. Readable by the owner only once the assessment is paid.
create table public.assessment_results (
  assessment_id            uuid primary key references public.assessments (id) on delete cascade,
  result                   jsonb not null,
  recommended_pv_kwp       numeric(10,2),
  recommended_inverter_kw  numeric(10,2),
  recommended_inverter_kva numeric(10,1),
  recommended_battery_kwh  numeric(10,2),
  recommended_products     jsonb not null default '[]'::jsonb,
  engine_version           text not null,
  report_path              text,
  report_generated_at      timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger assessment_results_updated_at before update on public.assessment_results
  for each row execute function public.set_updated_at();

create table public.saved_appliance_sets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  appliances jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_appliance_sets_user_idx on public.saved_appliance_sets (user_id);
create trigger saved_appliance_sets_updated_at before update on public.saved_appliance_sets
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Catalogue
-- -----------------------------------------------------------------------------
create table public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  image_url   text,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  category_id       uuid references public.product_categories (id) on delete set null,
  brand             text,
  sku               text unique,
  short_description text,
  description       text,
  price             numeric(14,2) not null check (price >= 0),
  compare_at_price  numeric(14,2),
  currency          text not null default 'NGN',
  stock_quantity    int not null default 0,
  images            text[] not null default '{}',
  specs             jsonb not null default '{}'::jsonb,
  product_role      text check (product_role in ('inverter','battery','panel','protection','cable','mounting','accessory')),
  capacity_value    numeric(12,2),
  capacity_unit     text check (capacity_unit in ('W','kW','kVA','kWh','A','mm2','m','pcs')),
  is_featured       boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index products_category_idx on public.products (category_id) where is_active;
create index products_role_capacity_idx on public.products (product_role, capacity_value) where is_active;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.packages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  tagline     text,
  inverter_kw numeric(8,2) not null,
  battery_kwh numeric(8,2) not null,
  pv_kwp_min  numeric(8,2) not null,
  pv_kwp_max  numeric(8,2) not null,
  price       numeric(14,2),
  ideal_for   text,
  features    text[] not null default '{}',
  image_url   text,
  is_popular  boolean not null default false,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger packages_updated_at before update on public.packages
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default public.next_code('ORD', 'public.order_code_seq'),
  user_id      uuid references public.profiles (id) on delete set null,
  email        text not null,
  full_name    text not null,
  phone        text not null,
  address      text not null,
  city         text not null,
  state        text not null,
  country      text not null default 'Nigeria',
  notes        text,
  subtotal     numeric(14,2) not null,
  delivery_fee numeric(14,2) not null default 0,
  total        numeric(14,2) not null,
  currency     text not null default 'NGN',
  status       public.order_status not null default 'pending_payment',
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  product_name text not null,
  sku          text,
  unit_price   numeric(14,2) not null,
  quantity     int not null check (quantity > 0),
  line_total   numeric(14,2) not null
);
create index order_items_order_idx on public.order_items (order_id);

-- -----------------------------------------------------------------------------
-- Payments (Paystack). No card data is stored.
-- -----------------------------------------------------------------------------
create table public.payments (
  id                      uuid primary key default gen_random_uuid(),
  reference               text not null unique,
  purpose                 public.payment_purpose not null,
  assessment_id           uuid references public.assessments (id) on delete set null,
  order_id                uuid references public.orders (id) on delete set null,
  user_id                 uuid references public.profiles (id) on delete set null,
  email                   text not null,
  amount                  numeric(14,2) not null check (amount > 0),
  currency                text not null,
  status                  public.payment_status not null default 'pending',
  channel                 text,
  gateway_response        text,
  paystack_transaction_id bigint,
  is_duplicate            boolean not null default false,
  paid_at                 timestamptz,
  verified_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint payment_target check (
    (purpose = 'consultation' and assessment_id is not null) or
    (purpose = 'order' and order_id is not null)
  )
);
create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_assessment_idx on public.payments (assessment_id);
create index payments_order_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status, created_at desc);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.webhook_events (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null default 'paystack',
  event           text,
  reference       text,
  signature_valid boolean not null,
  processed       boolean not null default false,
  error           text,
  summary         jsonb,
  created_at      timestamptz not null default now()
);
create index webhook_events_reference_idx on public.webhook_events (reference);

-- -----------------------------------------------------------------------------
-- Installer network
-- -----------------------------------------------------------------------------
create table public.installers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles (id) on delete set null,
  slug                text not null unique,
  company_name        text not null,
  contact_person      text,
  email               text,
  phone               text,
  whatsapp            text,
  website             text,
  logo_url            text,
  photo_url           text,
  state               text not null,
  city                text,
  address             text,
  states_covered      text[] not null default '{}',
  services            text[] not null default '{}',
  certifications      text[] not null default '{}',
  years_experience    int not null default 0,
  completed_projects  int not null default 0,
  bio                 text,
  portfolio           jsonb not null default '[]'::jsonb,
  verification_status public.installer_status not null default 'pending',
  is_featured         boolean not null default false,
  internal_notes      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index installers_status_state_idx on public.installers (verification_status, state);
create index installers_states_covered_idx on public.installers using gin (states_covered);
create index installers_services_idx on public.installers using gin (services);
create trigger installers_updated_at before update on public.installers
  for each row execute function public.set_updated_at();

-- Public directory: verified installers, business details only.
create view public.public_installers
with (security_invoker = false) as
  select id, slug, company_name, logo_url, photo_url, state, city, states_covered, services,
         certifications, years_experience, completed_projects, bio, portfolio, phone, whatsapp,
         email, website, is_featured, verification_status
  from public.installers
  where verification_status = 'verified';

create table public.installer_requests (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique default public.next_code('REQ', 'public.request_code_seq'),
  assessment_id  uuid references public.assessments (id) on delete set null,
  user_id        uuid references public.profiles (id) on delete set null,
  full_name      text not null,
  email          text not null,
  phone          text not null,
  country        text not null default 'Nigeria',
  state          text not null,
  city           text,
  address        text,
  property_type  text,
  system_size    text,
  preferred_date date,
  message        text,
  status         public.request_status not null default 'new',
  admin_notes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index installer_requests_user_idx on public.installer_requests (user_id, created_at desc);
create index installer_requests_status_idx on public.installer_requests (status, created_at desc);
create trigger installer_requests_updated_at before update on public.installer_requests
  for each row execute function public.set_updated_at();

create table public.installer_request_matches (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.installer_requests (id) on delete cascade,
  installer_id uuid not null references public.installers (id) on delete cascade,
  status       text not null default 'suggested' check (status in ('suggested','notified','accepted','declined')),
  notified_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (request_id, installer_id)
);

-- -----------------------------------------------------------------------------
-- Enquiries (custom installations, quotes, contact form)
-- -----------------------------------------------------------------------------
create table public.enquiries (
  id          uuid primary key default gen_random_uuid(),
  type        public.enquiry_type not null,
  user_id     uuid references public.profiles (id) on delete set null,
  full_name   text not null,
  email       text not null,
  phone       text,
  company     text,
  location    text,
  message     text,
  items       jsonb,
  status      public.enquiry_status not null default 'new',
  admin_notes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index enquiries_status_idx on public.enquiries (status, created_at desc);
create trigger enquiries_updated_at before update on public.enquiries
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Knowledge centre
-- -----------------------------------------------------------------------------
create table public.posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  excerpt         text,
  body            text not null default '',
  cover_url       text,
  tags            text[] not null default '{}',
  is_published    boolean not null default false,
  published_at    timestamptz,
  author_id       uuid references public.profiles (id) on delete set null,
  seo_title       text,
  seo_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index posts_published_idx on public.posts (is_published, published_at desc);
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Operational logs and rate limiting
-- -----------------------------------------------------------------------------
create table public.email_log (
  id          uuid primary key default gen_random_uuid(),
  recipient   text not null,
  template    text not null,
  subject     text,
  status      text not null check (status in ('sent','failed')),
  provider_id text,
  error       text,
  created_at  timestamptz not null default now()
);
create index email_log_created_idx on public.email_log (created_at desc);

create table public.activity_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);

create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         int not null default 0
);

-- Returns true while the caller is within the limit. Used by edge functions only.
create function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into current_hits;
  return current_hits <= p_max;
end;
$$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- Deducts stock for a paid order exactly once (called by the payment settlement).
create function public.apply_order_stock(p_order uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
     set stock_quantity = greatest(0, p.stock_quantity - i.quantity)
    from public.order_items i
   where i.order_id = p_order and i.product_id = p.id;
$$;
revoke all on function public.apply_order_stock(uuid) from public, anon, authenticated;
grant execute on function public.apply_order_stock(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Admin dashboard statistics
-- -----------------------------------------------------------------------------
create function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'assessments_total',      (select count(*) from assessments),
    'assessments_paid',       (select count(*) from assessments where status = 'paid'),
    'consultation_revenue',   coalesce((select jsonb_object_agg(currency, total) from (
                                select currency, sum(amount) as total from payments
                                where purpose = 'consultation' and status = 'success' group by currency) t), '{}'::jsonb),
    'orders_paid',            (select count(*) from orders where status in ('paid','processing','shipped','delivered')),
    'product_sales',          coalesce((select sum(total) from orders where status in ('paid','processing','shipped','delivered')), 0),
    'requests_pending',       (select count(*) from installer_requests where status in ('new','matched','contacted','scheduled')),
    'installations_completed',(select count(*) from installer_requests where status = 'completed'),
    'installers_pending',     (select count(*) from installers where verification_status = 'pending'),
    'enquiries_open',         (select count(*) from enquiries where status <> 'closed'),
    'customers',              (select count(*) from profiles where role = 'customer'),
    'top_system_sizes',       coalesce((select jsonb_agg(t) from (
                                select inverter_class_kva as kva, count(*) as total from assessments
                                where inverter_class_kva is not null
                                group by inverter_class_kva order by count(*) desc limit 6) t), '[]'::jsonb),
    'assessments_by_day',     coalesce((select jsonb_agg(t order by t.day) from (
                                select to_char(d::date, 'YYYY-MM-DD') as day,
                                       (select count(*) from assessments a where a.created_at::date = d::date) as total,
                                       (select count(*) from assessments a where a.paid_at::date = d::date) as paid
                                from generate_series(current_date - 29, current_date, interval '1 day') d) t), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- =============================================================================
-- Row level security
-- Writes to assessments, results, payments, orders, requests and enquiries go
-- through edge functions using the service role, so customers only get read
-- access to their own rows.
-- =============================================================================
alter table public.profiles                  enable row level security;
alter table public.site_settings             enable row level security;
alter table public.site_content              enable row level security;
alter table public.countries                 enable row level security;
alter table public.regions                   enable row level security;
alter table public.appliance_catalog         enable row level security;
alter table public.assessments               enable row level security;
alter table public.assessment_appliances     enable row level security;
alter table public.assessment_results        enable row level security;
alter table public.saved_appliance_sets      enable row level security;
alter table public.product_categories        enable row level security;
alter table public.products                  enable row level security;
alter table public.packages                  enable row level security;
alter table public.orders                    enable row level security;
alter table public.order_items               enable row level security;
alter table public.payments                  enable row level security;
alter table public.webhook_events            enable row level security;
alter table public.installers                enable row level security;
alter table public.installer_requests        enable row level security;
alter table public.installer_request_matches enable row level security;
alter table public.enquiries                 enable row level security;
alter table public.posts                     enable row level security;
alter table public.email_log                 enable row level security;
alter table public.activity_log              enable row level security;
alter table public.rate_limits               enable row level security;

-- Profiles
create policy "profiles: read own"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Public reference data: anyone reads, admins write
create policy "site_settings: read"  on public.site_settings for select using (true);
create policy "site_settings: admin" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "site_content: read"   on public.site_content  for select using (true);
create policy "site_content: admin"  on public.site_content  for all using (public.is_admin()) with check (public.is_admin());
create policy "countries: read"      on public.countries     for select using (is_active or public.is_admin());
create policy "countries: admin"     on public.countries     for all using (public.is_admin()) with check (public.is_admin());
create policy "regions: read"        on public.regions       for select using (is_active or public.is_admin());
create policy "regions: admin"       on public.regions       for all using (public.is_admin()) with check (public.is_admin());
create policy "appliances: read"     on public.appliance_catalog for select using (is_active or public.is_admin());
create policy "appliances: admin"    on public.appliance_catalog for all using (public.is_admin()) with check (public.is_admin());
create policy "categories: read"     on public.product_categories for select using (is_active or public.is_admin());
create policy "categories: admin"    on public.product_categories for all using (public.is_admin()) with check (public.is_admin());
create policy "products: read"       on public.products for select using (is_active or public.is_admin());
create policy "products: admin"      on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "packages: read"       on public.packages for select using (is_active or public.is_admin());
create policy "packages: admin"      on public.packages for all using (public.is_admin()) with check (public.is_admin());
create policy "posts: read"          on public.posts for select using (is_published or public.is_admin());
create policy "posts: admin"         on public.posts for all using (public.is_admin()) with check (public.is_admin());

-- Assessments: owners read their own; the full result only after payment
create policy "assessments: read own" on public.assessments for select
  using (user_id = auth.uid() or public.is_admin());
create policy "assessments: admin"    on public.assessments for update using (public.is_admin()) with check (public.is_admin());
create policy "assessment_appliances: read own" on public.assessment_appliances for select
  using (public.is_admin() or exists (
    select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));
create policy "assessment_results: read when paid" on public.assessment_results for select
  using (public.is_admin() or exists (
    select 1 from public.assessments a
    where a.id = assessment_id and a.user_id = auth.uid() and a.status = 'paid'));

create policy "saved_sets: own" on public.saved_appliance_sets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Orders and payments
create policy "orders: read own"      on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "orders: admin update"  on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "order_items: read own" on public.order_items for select
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "payments: read own"    on public.payments for select using (user_id = auth.uid() or public.is_admin());
create policy "webhook_events: admin" on public.webhook_events for select using (public.is_admin());

-- Installers (public directory goes through the public_installers view)
create policy "installers: admin" on public.installers for all using (public.is_admin()) with check (public.is_admin());
create policy "installer_requests: read own" on public.installer_requests for select
  using (user_id = auth.uid() or public.is_admin());
create policy "installer_requests: admin"    on public.installer_requests for update
  using (public.is_admin()) with check (public.is_admin());
create policy "installer_matches: admin"     on public.installer_request_matches for all
  using (public.is_admin()) with check (public.is_admin());

create policy "enquiries: admin"     on public.enquiries    for all using (public.is_admin()) with check (public.is_admin());
create policy "email_log: admin"     on public.email_log    for select using (public.is_admin());
create policy "activity_log: admin"  on public.activity_log for select using (public.is_admin());
-- rate_limits: no policies; service role only.

grant select on public.public_installers to anon, authenticated;

-- =============================================================================
-- Storage
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media',   'media',   true,  5242880,  array['image/png','image/jpeg','image/webp','image/gif']),
  ('reports', 'reports', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "media: admin manage" on storage.objects for all
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

create policy "media: own avatar read" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'avatars'
         and (storage.foldername(name))[2] = auth.uid()::text);
create policy "media: own avatar insert" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'avatars'
              and (storage.foldername(name))[2] = auth.uid()::text);
create policy "media: own avatar update" on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'avatars'
         and (storage.foldername(name))[2] = auth.uid()::text);
create policy "media: own avatar delete" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'avatars'
         and (storage.foldername(name))[2] = auth.uid()::text);
-- The reports bucket has no policies: only edge functions (service role) read or write it.

-- =============================================================================
-- Seed: configuration
-- =============================================================================
insert into public.site_settings (key, value, description) values
('brand', '{
  "primary": "#5B2A86", "primaryDark": "#34184A", "accent": "#C8973F",
  "ink": "#1E1428", "surface": "#F6F2FA",
  "success": "#15803D", "warning": "#B45309", "danger": "#B91C1C"
}', 'Colour tokens applied across the site and admin'),

('company', '{
  "name": "KuraSolar",
  "legalName": "KuraSolar Energy Systems Ltd.",
  "email": "hello@kurasolar.ng",
  "phone": "+234 800 000 0000",
  "address": "Lagos, Nigeria",
  "logoUrl": "/logo.png",
  "reportSignatory": "KuraSolar Engineering Team"
}', 'Company details used on pages, emails and PDF reports'),

('consultation', '{
  "defaultCurrency": "NGN",
  "fees": { "NGN": 20000, "GHS": 250, "KES": 3000, "ZAR": 400, "USD": 25, "GBP": 20, "EUR": 23 },
  "paymentCurrencies": ["NGN", "USD"],
  "fallbackCurrency": "NGN"
}', 'Consultation (inspection) fee per currency and currencies enabled on Paystack'),

('engineering', '{
  "batteryDoD": 0.9, "batteryEfficiency": 0.95, "inverterEfficiency": 0.93,
  "batteryReserveMargin": 1.1, "batteryModuleKwh": 5.12, "batteryExtendedMultiplier": 1.5,
  "pvDerating": 0.9, "temperatureLoss": 0.08, "temperatureCoefficient": 0.0035, "cellTempRise": 25,
  "wiringLoss": 0.03, "mpptEfficiency": 0.98, "pvDesignMargin": 1.15, "panelWattage": 550,
  "inverterExpansionMargin": 0.25, "inverterSurgeRatio": 2, "powerFactor": 0.8,
  "inverterSizesKw": [1, 1.5, 3, 3.6, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 80, 100],
  "coincidence": { "essential": 0.9, "important": 0.7, "heavy": 0.5 },
  "nightFraction": { "day": 0.1, "evening": 0.7, "night": 1, "anytime": 0.55 },
  "nightHours": 13,
  "backupHoursByGrid": { "reliable": 6, "intermittent": 10, "poor": 14, "none": 18 },
  "generatorLitresPerKwh": 0.4, "fuelPricePerLitre": 1150, "co2KgPerKwh": 0.8
}', 'Engineering assumptions used by the calculation engine'),

('appliance_lookups', '{
  "tvWattsBySize": { "24\"": 35, "32\"": 50, "40\"": 70, "43\"": 85, "50\"": 110, "55\"": 130, "65\"": 170, "75\"": 220 },
  "acWattsByHp": {
    "1":   { "standard": 950,  "inverter": 800 },
    "1.5": { "standard": 1450, "inverter": 1150 },
    "2":   { "standard": 1900, "inverter": 1650 },
    "2.5": { "standard": 2450, "inverter": 2100 },
    "3":   { "standard": 2950, "inverter": 2550 }
  },
  "compressorDutyCycle": { "refrigerator": 0.4, "freezer": 0.45, "air_conditioner": 0.7 },
  "compressorSurge": { "standard": 3, "inverter": 1.3 }
}', 'Default wattages by TV size and AC horsepower, and compressor assumptions'),

('commerce', '{
  "currency": "NGN", "deliveryFee": 15000, "freeDeliveryThreshold": 1500000,
  "deliveryNote": "Delivery within Lagos in 2–4 working days. Other states are quoted after checkout."
}', 'Shop delivery rules'),

('notifications', '{
  "adminEmails": ["nnamaniafamefuna@gmail.com"],
  "replyTo": "hello@kurasolar.ng"
}', 'Where system notifications are sent'),

('matching', '{ "maxInstallersPerRequest": 3, "notifyInstallers": true }', 'Installer matching rules'),

('whatsapp', '{
  "number": "2348000000000",
  "defaultMessage": "Hello KuraSolar, I would like to speak with a solar engineer.",
  "enabled": true
}', 'Floating WhatsApp button'),

('seo', '{
  "title": "KuraSolar — Solar system calculator and equipment for Nigerian homes",
  "description": "Work out the solar, inverter and battery size your home needs, get a professional load assessment and connect with a qualified installer in Nigeria.",
  "keywords": ["solar system calculator Nigeria", "solar inverter calculator Nigeria", "solar battery calculator", "how many solar panels do I need", "solar installation Nigeria", "LiFePO4 battery Nigeria", "BESS Nigeria"]
}', 'Default search metadata');

-- =============================================================================
-- Seed: landing page content (edited from Admin → Site content)
-- =============================================================================
insert into public.site_content (key, value) values
('hero', '{
  "headline": "Know exactly what solar system your home needs.",
  "subheadline": "Calculate your household energy use, see the right solar and battery setup, and connect with a qualified installer.",
  "primaryCta": "Calculate my solar system",
  "secondaryCta": "Shop solar equipment",
  "imageUrl": ""
}'),
('trust', '{ "items": [
  { "title": "Engineered sizing", "text": "Duty cycles, motor surges and regional sun hours are all accounted for." },
  { "title": "Paystack secure", "text": "Payments are verified by our server before anything unlocks." },
  { "title": "Qualified installers", "text": "Vetted engineers across Nigeria." },
  { "title": "Nationwide support", "text": "From Lagos to Kano, and for families abroad." }
]}'),
('how_it_works', '{
  "title": "From appliances to a signed-off design in four steps",
  "steps": [
    { "title": "Enter your appliances", "text": "Pick from common Nigerian household appliances or add your own." },
    { "title": "See your energy requirement", "text": "Your load, daily consumption and peak demand update as you go." },
    { "title": "Pay the consultation fee", "text": "Pay securely with card, transfer or USSD through Paystack." },
    { "title": "Download your assessment", "text": "Get a professional PDF with PV, inverter and battery sizing." }
  ],
  "footnote": "Need installation? We will connect you with a qualified engineer near you."
}'),
('why_us', '{
  "title": "Built by engineers, not guesswork",
  "items": [
    { "title": "Honest numbers", "text": "A refrigerator is not counted as running flat out for 24 hours. Compressors cycle, and our engine knows it." },
    { "title": "Local sun data", "text": "Kano gets more sun than Port Harcourt. Your PV size reflects the state you live in." },
    { "title": "Motor starts handled", "text": "Pumps and non-inverter ACs draw a surge when they start. Your inverter is sized for it." },
    { "title": "Equipment that matches", "text": "Recommended products are picked from stock to fit your calculated system." }
  ]
}'),
('installation', '{
  "title": "Professional installation, nationwide",
  "text": "Once your system is sized, request an installer. We match you with verified engineers who cover your state and the type of system you need.",
  "cta": "Find an installer"
}'),
('testimonials', '{ "title": "What customers say", "items": [] }'),
('faq', '{
  "title": "Frequently asked questions",
  "items": [
    { "q": "How accurate is the calculator?", "a": "It applies the same method an engineer uses for a preliminary design: duty cycles, simultaneous use, motor surge and regional sun hours. A site visit is still needed before you buy, because cable runs, roof space and shading affect the final design." },
    { "q": "What do I get for the consultation fee?", "a": "A professional PDF assessment with your full appliance inventory, load summary, PV, inverter and battery sizing, three battery options with backup times, and a matched equipment list." },
    { "q": "How do I pay?", "a": "Through Paystack by card, bank transfer or USSD. Your report unlocks once our server has confirmed the payment with Paystack." },
    { "q": "Can I size a system for my parents in Nigeria from abroad?", "a": "Yes. Choose the option for someone else during the calculation and add the recipient''s details. You can pay from abroad." },
    { "q": "Why LiFePO4 batteries?", "a": "They last several thousand cycles, can be discharged deeply and cope with heat far better than lead-acid batteries." }
  ]
}'),
('cta', '{
  "title": "Ready to size your system?",
  "text": "It takes about five minutes. You only pay if you want the full engineering report.",
  "button": "Start the calculator"
}'),
('disclaimer', '{
  "text": "This calculator provides an automated preliminary energy assessment based on information supplied by the customer and configured engineering assumptions. Actual system design may vary based on site conditions, equipment specifications, cable lengths, installation conditions, solar resource, battery operating strategy and applicable electrical standards. Final system sizing should be validated by a qualified solar/electrical engineer before procurement or installation."
}'),
('about', '{
  "title": "About KuraSolar",
  "body": "KuraSolar helps Nigerian households and businesses buy the right solar system the first time. We combine an engineering-grade sizing tool with vetted equipment and a network of qualified installers, so customers stop overpaying for systems that are too big, or suffering with systems that are too small.\n\nOur calculator is built on the methods engineers use for preliminary design, and every assumption in it can be reviewed and updated by our engineering team as equipment and conditions change."
}'),
('contact', '{
  "title": "Talk to us",
  "text": "Questions about a system, an order or an installation? Send a message and an engineer will reply within one working day.",
  "hours": "Monday to Saturday, 8am to 6pm WAT"
}');

-- =============================================================================
-- Seed: countries and regional solar resource
-- Peak sun hours are long-term annual averages (kWh/m²/day) and can be tuned
-- from Admin → Regions.
-- =============================================================================
insert into public.countries (code, name, currency, default_peak_sun_hours, default_ambient_temp_c, sort_order) values
  ('NG', 'Nigeria',      'NGN', 5.0, 28, 1),
  ('GH', 'Ghana',        'GHS', 4.9, 27, 2),
  ('KE', 'Kenya',        'KES', 5.5, 22, 3),
  ('ZA', 'South Africa', 'ZAR', 5.4, 19, 4),
  ('RW', 'Rwanda',       'USD', 5.0, 21, 5),
  ('UG', 'Uganda',       'USD', 5.2, 23, 6),
  ('TZ', 'Tanzania',     'USD', 5.3, 25, 7);

insert into public.regions (country_code, name, zone, peak_sun_hours, ambient_temp_c) values
  ('NG','Abia','South East',4.5,28), ('NG','Adamawa','North East',5.9,32), ('NG','Akwa Ibom','South South',4.2,27),
  ('NG','Anambra','South East',4.6,28), ('NG','Bauchi','North East',6.0,31), ('NG','Bayelsa','South South',4.1,27),
  ('NG','Benue','North Central',5.2,29), ('NG','Borno','North East',6.4,34), ('NG','Cross River','South South',4.3,27),
  ('NG','Delta','South South',4.3,28), ('NG','Ebonyi','South East',4.6,28), ('NG','Edo','South South',4.5,28),
  ('NG','Ekiti','South West',4.7,27), ('NG','Enugu','South East',4.7,28), ('NG','FCT Abuja','North Central',5.4,29),
  ('NG','Gombe','North East',6.1,32), ('NG','Imo','South East',4.5,28), ('NG','Jigawa','North West',6.3,33),
  ('NG','Kaduna','North West',5.7,30), ('NG','Kano','North West',6.2,33), ('NG','Katsina','North West',6.3,33),
  ('NG','Kebbi','North West',6.1,33), ('NG','Kogi','North Central',5.1,29), ('NG','Kwara','North Central',5.0,29),
  ('NG','Lagos','South West',4.4,28), ('NG','Nasarawa','North Central',5.3,29), ('NG','Niger','North Central',5.5,30),
  ('NG','Ogun','South West',4.5,28), ('NG','Ondo','South West',4.6,27), ('NG','Osun','South West',4.7,27),
  ('NG','Oyo','South West',4.8,28), ('NG','Plateau','North Central',5.6,24), ('NG','Rivers','South South',4.2,27),
  ('NG','Sokoto','North West',6.4,34), ('NG','Taraba','North East',5.8,31), ('NG','Yobe','North East',6.3,33),
  ('NG','Zamfara','North West',6.2,33),
  ('GH','Greater Accra','Coastal',4.9,27), ('GH','Ashanti','Middle',4.7,26), ('GH','Northern','Savannah',5.6,29),
  ('KE','Nairobi','Central',5.5,19), ('KE','Mombasa','Coast',5.6,27), ('KE','Kisumu','Western',5.4,24),
  ('ZA','Gauteng','Highveld',5.5,17), ('ZA','Western Cape','Coastal',5.2,18), ('ZA','KwaZulu-Natal','Coastal',4.9,21),
  ('RW','Kigali','Central',5.0,21), ('UG','Kampala','Central',5.2,23), ('TZ','Dar es Salaam','Coastal',5.3,27);

-- =============================================================================
-- Seed: appliance database
-- =============================================================================
insert into public.appliance_catalog
  (category, name, description, default_watts, default_hours, duty_cycle, surge_factor, priority, usage_window, inverter_technology, horsepower, sort_order)
values
  ('lighting','LED bulb','Energy-saving indoor lamp',12,8,1,1,'essential','night',false,null,10),
  ('lighting','LED security floodlight','Outdoor perimeter light',50,11,1,1,'essential','night',false,null,11),
  ('lighting','Fluorescent / conventional bulb','Older tube or incandescent lamp',40,6,1,1,'essential','night',false,null,12),
  ('television','LED TV 43"','Living room smart TV',85,6,1,1.1,'essential','evening',false,null,20),
  ('television','LED TV 55"','Large smart TV',130,6,1,1.1,'essential','evening',false,null,21),
  ('refrigerator','Refrigerator, double door (inverter)','Inverter compressor',150,24,0.35,1.3,'essential','anytime',true,null,30),
  ('refrigerator','Refrigerator, double door (standard)','Conventional compressor',220,24,0.45,3,'essential','anytime',false,null,31),
  ('refrigerator','Refrigerator, single door','Small fridge',120,24,0.4,3,'essential','anytime',false,null,32),
  ('freezer','Chest freezer (inverter)','Inverter compressor',140,24,0.4,1.4,'essential','anytime',true,null,40),
  ('freezer','Chest freezer (standard)','Conventional compressor',220,24,0.5,3.2,'essential','anytime',false,null,41),
  ('air_conditioner','Split AC 1 HP (inverter)','Bedroom inverter AC',800,8,0.65,1.3,'important','night',true,1,50),
  ('air_conditioner','Split AC 1.5 HP (inverter)','Master bedroom inverter AC',1150,8,0.7,1.3,'important','night',true,1.5,51),
  ('air_conditioner','Split AC 1.5 HP (standard)','Non-inverter AC with high start current',1450,6,0.85,3.2,'heavy','night',false,1.5,52),
  ('air_conditioner','Standing AC 2 HP (inverter)','Living room AC',1650,6,0.7,1.35,'heavy','evening',true,2,53),
  ('audio','Home theatre / soundbar','Audio system',120,4,1,1.2,'important','evening',false,null,60),
  ('washing_machine','Washing machine, automatic','Front or top loader',500,1,0.7,2,'important','day',false,null,70),
  ('washing_machine','Washing machine, semi-automatic','Twin tub',350,1,0.7,2,'important','day',false,null,71),
  ('plug_load','Standing / ceiling fan','Residential fan',65,10,1,1.4,'essential','anytime',false,null,80),
  ('plug_load','Wi-Fi router','Internet router',15,24,1,1,'essential','anytime',false,null,81),
  ('plug_load','Starlink terminal','Satellite internet',60,24,1,1,'essential','anytime',false,null,82),
  ('plug_load','Satellite decoder','DStv / GOtv decoder',25,6,1,1,'essential','evening',false,null,83),
  ('plug_load','Laptop','Laptop and charger',65,8,0.85,1,'important','day',false,null,84),
  ('plug_load','Desktop computer','Tower and monitor',250,6,0.8,1.2,'important','day',false,null,85),
  ('plug_load','Phone chargers','Phones and tablets',20,4,0.9,1,'essential','evening',false,null,86),
  ('plug_load','CCTV system','Cameras and recorder',60,24,1,1,'essential','anytime',false,null,87),
  ('plug_load','Microwave oven','Kitchen microwave',1200,0.3,1,1.5,'heavy','anytime',false,null,88),
  ('plug_load','Gaming console','Console',150,3,1,1,'important','evening',false,null,89),
  ('plug_load','Printer','Laser or inkjet printer',300,0.5,0.5,1.5,'important','day',false,null,90),
  ('electric_iron','Electric iron','Dry or steam iron',1200,1,0.6,1,'heavy','day',false,null,100),
  ('water_heater','Water heater 30–50 L','Storage water heater',2000,1.5,0.8,1,'heavy','anytime',false,null,110),
  ('pump','Borehole pump 1 HP','Submersible pump',750,1.5,1,3,'heavy','day',false,1,120),
  ('pump','Surface pumping machine 1 HP','Surface water pump',750,1,1,3,'heavy','day',false,1,121);

-- =============================================================================
-- Seed: catalogue structure and starter products (prices are editable samples)
-- =============================================================================
insert into public.product_categories (slug, name, description, sort_order) values
  ('inverters',         'Inverters',         'Hybrid and off-grid inverters from 1 kVA to 100 kVA+', 1),
  ('batteries',         'Batteries',         'LiFePO4 wall-mount, rack and stackable storage',        2),
  ('solar-panels',      'Solar panels',      'Mono PERC and N-type panels from 450 W',                  3),
  ('protection',        'Protection',        'Breakers, surge protection, isolators and fuses',         4),
  ('cables',            'Cables',            'PV, battery, AC and earthing cables',                     5),
  ('balance-of-system', 'Balance of system', 'Mounting, connectors, changeovers and monitoring',       6);

insert into public.products
  (slug, name, category_id, brand, sku, short_description, price, stock_quantity, product_role, capacity_value, capacity_unit, is_featured, specs)
select v.slug, v.name, c.id, v.brand, v.sku, v.short_description, v.price, v.stock, v.role, v.cap, v.unit, v.featured, v.specs::jsonb
from (values
  ('hybrid-inverter-3-6kw','3.6 kW hybrid inverter, 24 V','inverters','KuraPower','INV-3K6-24','Pure sine wave hybrid inverter with built-in MPPT.',650000,10,'inverter',3.6,'kW',false,'{"Output":"3,600 W","Battery":"24 V","MPPT":"1 tracker"}'),
  ('hybrid-inverter-5kw','5 kW hybrid inverter, 48 V','inverters','KuraPower','INV-5K-48','Single-phase hybrid inverter for 2–3 bedroom homes.',1100000,10,'inverter',5,'kW',true,'{"Output":"5,000 W","Surge":"10,000 W","Battery":"48 V","MPPT":"2 trackers"}'),
  ('hybrid-inverter-8kw','8 kW hybrid inverter, 48 V','inverters','KuraPower','INV-8K-48','Hybrid inverter with generator input and Wi-Fi monitoring.',1850000,8,'inverter',8,'kW',false,'{"Output":"8,000 W","Surge":"16,000 W","Battery":"48 V","MPPT":"2 trackers"}'),
  ('hybrid-inverter-10kw','10 kW hybrid inverter, 48 V','inverters','KuraPower','INV-10K-48','Parallel-capable hybrid inverter for large homes.',2400000,6,'inverter',10,'kW',true,'{"Output":"10,000 W","Surge":"20,000 W","Battery":"48 V","Parallel":"Up to 6 units"}'),
  ('hybrid-inverter-15kw','15 kW hybrid inverter, 48 V','inverters','KuraPower','INV-15K-48','Split-phase hybrid inverter for duplexes and clinics.',3600000,4,'inverter',15,'kW',false,'{"Output":"15,000 W","Battery":"48 V","MPPT":"3 trackers"}'),
  ('lifepo4-5kwh','LiFePO4 battery 5.12 kWh, 48 V','batteries','KuraCell','BAT-5K-48','Wall-mount lithium iron phosphate battery with BMS.',1250000,20,'battery',5.12,'kWh',true,'{"Capacity":"5.12 kWh","Voltage":"51.2 V","Cycles":"6,000 at 90% DoD"}'),
  ('lifepo4-10kwh','LiFePO4 battery 10.24 kWh, 48 V','batteries','KuraCell','BAT-10K-48','Floor-standing lithium battery for whole-home backup.',2350000,10,'battery',10.24,'kWh',false,'{"Capacity":"10.24 kWh","Voltage":"51.2 V","Cycles":"6,000 at 90% DoD"}'),
  ('lifepo4-15kwh','LiFePO4 battery 15 kWh, 48 V','batteries','KuraCell','BAT-15K-48','High-capacity stackable lithium battery.',3400000,6,'battery',15,'kWh',false,'{"Capacity":"15 kWh","Voltage":"51.2 V","Stackable":"Yes"}'),
  ('panel-550w-mono','550 W mono PERC solar panel','solar-panels','KuraSun','PV-550-MONO','Half-cut mono PERC module, 21% efficient.',145000,200,'panel',550,'W',true,'{"Power":"550 W","Efficiency":"21.3%","Warranty":"25-year output"}'),
  ('panel-600w-ntype','600 W N-type solar panel','solar-panels','KuraSun','PV-600-NTYPE','N-type TOPCon module with low degradation.',168000,150,'panel',600,'W',false,'{"Power":"600 W","Efficiency":"22.1%","Warranty":"30-year output"}'),
  ('pv-protection-kit','PV protection kit','protection','KuraSafe','PROT-PV-KIT','DC breakers, SPD and isolator in an IP65 combiner.',185000,30,'protection',null,null,false,'{"Includes":"DC MCB, DC SPD, DC isolator, enclosure"}'),
  ('ac-protection-kit','AC protection kit','protection','KuraSafe','PROT-AC-KIT','AC breakers, SPD and changeover for inverter output.',145000,30,'protection',null,null,false,'{"Includes":"AC MCB, AC SPD, changeover"}'),
  ('pv-cable-6mm','PV cable 6 mm², 100 m','cables','KuraWire','CAB-PV-6-100','UV-resistant twin PV cable.',120000,40,'cable',100,'m',false,'{"Size":"6 mm²","Length":"100 m"}'),
  ('battery-cable-35mm','Battery cable set, 35 mm²','cables','KuraWire','CAB-BAT-35','Pre-crimped battery interconnect cables.',45000,40,'cable',null,null,false,'{"Size":"35 mm²"}'),
  ('roof-mounting-kit-4','Roof mounting kit, 4 panels','balance-of-system','KuraMount','MNT-ROOF-4','Aluminium rails, clamps and hooks for 4 panels.',95000,60,'mounting',4,'pcs',false,'{"Panels":"4","Material":"Anodised aluminium"}')
) as v(slug, name, cat, brand, sku, short_description, price, stock, role, cap, unit, featured, specs)
join public.product_categories c on c.slug = v.cat;

insert into public.packages (slug, name, tagline, inverter_kw, battery_kwh, pv_kwp_min, pv_kwp_max, ideal_for, features, is_popular, sort_order) values
  ('essential-home', 'Essential home', 'Lights, fans, TV and a fridge through every outage', 5, 10, 4, 5,
   '2–3 bedroom flat', array['5 kW hybrid inverter','10 kWh LiFePO4 battery','4–5 kWp solar array','Protection and installation'], false, 1),
  ('family-home', 'Family home', 'Run a household with inverter ACs through the night', 10, 20, 8, 10,
   '3–4 bedroom house', array['10 kW hybrid inverter','20 kWh LiFePO4 battery','8–10 kWp solar array','Protection and installation'], true, 2),
  ('premium-home', 'Premium home', 'Whole-home power for larger duplexes', 15, 30, 10, 15,
   '5+ bedroom duplex', array['15 kW hybrid inverter','30 kWh LiFePO4 battery','10–15 kWp solar array','Protection and installation'], false, 3);

-- =============================================================================
-- Seed: knowledge centre
-- =============================================================================
insert into public.posts (slug, title, excerpt, body, tags, is_published, published_at) values
('why-your-fridge-does-not-run-24-hours',
 'Why your fridge does not use power 24 hours a day',
 'Compressors switch on and off. Counting them as always on can double the battery you are sold.',
 E'A refrigerator is plugged in all day, but its compressor is not running all day. It switches on until the cabinet is cold, then rests. The share of time it actually runs is called the **duty cycle**.\n\nA typical double-door fridge in a Lagos kitchen runs 35–45% of the time. If an installer sizes your battery as if it ran 100% of the time, the battery comes out more than twice as big as it needs to be.\n\n## What we do instead\n\nOur calculator multiplies rated power by hours and by the duty cycle for every compressor appliance. The default duty cycles are reviewed by our engineers, and you can adjust them if you know your appliance well.\n\n## One thing duty cycle does not change\n\nWhen a conventional compressor starts, it briefly draws around three times its running power. Your inverter still has to handle that, which is why a non-inverter fridge can push you to a bigger inverter even when it uses little energy.',
 array['sizing','appliances'], true, now()),
('lifepo4-vs-lead-acid',
 'LiFePO4 or lead-acid: which battery should you buy?',
 'Lithium iron phosphate costs more upfront and much less over the life of the system.',
 E'Lead-acid batteries are cheaper to buy, but you can only safely use about half of their capacity, and heat shortens their life. Many Nigerian homes replace them every one to two years.\n\n**LiFePO4** (lithium iron phosphate) batteries let you use 80–90% of their capacity and last several thousand cycles. They are also far more tolerant of high temperatures.\n\n## The real comparison\n\n- Usable capacity: about 50% for lead-acid, about 90% for LiFePO4\n- Cycle life: 500–1,200 for lead-acid, 4,000–6,000 for LiFePO4\n- Maintenance: regular for flooded lead-acid, none for LiFePO4\n\nOver ten years, a LiFePO4 bank almost always costs less per kWh delivered. That is why our calculator sizes every system for LiFePO4.',
 array['batteries'], true, now()),
('how-many-solar-panels-do-i-need',
 'How many solar panels do I need?',
 'It depends on your daily energy, where you live and how much of it you use at night.',
 E'The short answer is: daily energy divided by the sun your roof gets, adjusted for losses.\n\n1. **Daily energy.** Add up what your appliances use in kWh per day.\n2. **Peak sun hours.** Kano averages above 6 hours a day, Port Harcourt closer to 4. The same home needs a bigger array in the south.\n3. **Losses.** Heat, dust, wiring and conversion typically take 20–25% of what the panels produce.\n4. **Night-time use.** Energy stored in a battery and used later loses a little more on the way.\n\nDivide the kWp you need by your panel size (for example 550 W) and round up. Our calculator does all of this for your state automatically.',
 array['sizing','solar panels'], true, now());

-- =============================================================================
-- Seed: administrator
-- Email: nnamaniafamefuna@gmail.com. The password is stored only as a bcrypt
-- hash. Change it from Admin → Settings → Account after the first sign-in.
-- =============================================================================
do $$
declare
  admin_id    constant uuid := 'a0000000-0000-4000-8000-000000000001';
  admin_email constant text := 'nnamaniafamefuna@gmail.com';
begin
  if not exists (select 1 from auth.users where email = admin_email) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', admin_email,
      '$2a$10$ikouNbI1WS2fphxKwWSDJOXSyt5Esyy4/8YTdj4DR5UMrM1TOdX8K', now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Platform Administrator"}', now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), admin_id, admin_id::text,
      jsonb_build_object('sub', admin_id::text, 'email', admin_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  update public.profiles
     set role = 'admin', username = 'admin', full_name = coalesce(full_name, 'Platform Administrator'), onboarded_at = now()
   where email = admin_email;
end;
$$;
