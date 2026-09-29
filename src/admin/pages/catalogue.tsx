import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Misc';
import { errorMessage, invoke } from '@/lib/api';
import { date, money, num, sentence, slugify } from '@/lib/format';
import { mediaUrl, supabase } from '@/lib/supabase';
import { INSTALLER_SERVICES } from '@/lib/types';
import { useToast } from '@/providers/ToastProvider';
import { CATEGORIES } from '@/features/calculator/config';
import { Resource, type FieldDef } from '../components/Resource';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const withSlug = (from: string) => (v: Row, isNew: boolean): Row => ({ ...v, slug: v.slug || (isNew ? slugify(String(v[from] ?? '')) : v.slug) });
const opts = (list: readonly string[]) => list.map((v) => ({ value: v, label: sentence(v) }));

function useCategoryOptions() {
  return useQuery({ queryKey: ['admin', 'product_categories', 'options'], queryFn: async () => ((await supabase.from('product_categories').select('id, name').order('sort_order')).data ?? []).map((c) => ({ value: c.id as string, label: c.name as string })) }).data ?? [];
}

export function Products() {
  const cats = useCategoryOptions();
  const fields: FieldDef[] = [
    { key: 'name', label: 'Name', type: 'text', required: true, full: true },
    { key: 'slug', label: 'URL slug', type: 'text', hint: 'Leave blank to generate from the name.' },
    { key: 'category_id', label: 'Category', type: 'select', options: cats, nullable: true },
    { key: 'brand', label: 'Brand', type: 'text' },
    { key: 'sku', label: 'SKU', type: 'text' },
    { key: 'price', label: 'Price', type: 'number', required: true },
    { key: 'compare_at_price', label: 'Compare-at price', type: 'number', nullable: true, hint: 'Shown struck through when higher than price.' },
    { key: 'stock_quantity', label: 'Stock quantity', type: 'number', step: 1 },
    { key: 'currency', label: 'Currency', type: 'select', options: [{ value: 'NGN', label: 'NGN' }, { value: 'USD', label: 'USD' }] },
    { key: 'product_role', label: 'Role in a system', type: 'select', nullable: true, options: opts(['inverter', 'battery', 'panel', 'protection', 'cable', 'mounting', 'accessory']), hint: 'Used by the recommendation engine.' },
    { key: 'capacity_value', label: 'Capacity value', type: 'number', nullable: true, hint: 'e.g. 5 for a 5 kW inverter, 5.12 for a battery, 550 for a panel.' },
    { key: 'capacity_unit', label: 'Capacity unit', type: 'select', nullable: true, options: ['W', 'kW', 'kVA', 'kWh', 'A', 'mm2', 'm', 'pcs'].map((v) => ({ value: v, label: v })) },
    { key: 'is_featured', label: 'Featured on home page', type: 'boolean' },
    { key: 'is_active', label: 'Visible in shop', type: 'boolean' },
    { key: 'short_description', label: 'Short description', type: 'textarea' },
    { key: 'description', label: 'Full description', type: 'markdown' },
    { key: 'specs', label: 'Specifications', type: 'keyvalue' },
    { key: 'images', label: 'Images', type: 'images', folder: 'products', hint: 'The first image is the main one. Square or 5:4 images on a plain background work best.' },
  ];
  return (
    <Resource config={{
      table: 'products', title: 'Products', select: '*, product_categories(name)', order: { column: 'name' }, search: ['name', 'sku', 'brand'],
      filters: [{ key: 'product_role', label: 'Role', options: opts(['inverter', 'battery', 'panel', 'protection', 'cable', 'mounting', 'accessory']) }],
      defaults: { currency: 'NGN', is_active: true, is_featured: false, stock_quantity: 0, images: [], specs: {} },
      beforeSave: (v, isNew) => { const out = withSlug('name')(v, isNew); delete out.product_categories; return out; },
      columns: [
        { key: 'name', label: 'Product', render: (r) => (
          <div className="flex items-center gap-3">
            <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-tint">{r.images?.[0] && <img src={mediaUrl(r.images[0])} alt="" className="size-full object-cover" />}</div>
            <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.sku}</p></div>
          </div>
        ) },
        { key: 'category', label: 'Category', render: (r) => r.product_categories?.name ?? '—' },
        { key: 'price', label: 'Price', className: 'num text-right', render: (r) => money(r.price, r.currency) },
        { key: 'stock_quantity', label: 'Stock', className: 'num text-right', render: (r) => <span className={r.stock_quantity <= 0 ? 'text-danger' : r.stock_quantity < 5 ? 'text-warning' : ''}>{r.stock_quantity}</span> },
        { key: 'is_active', label: 'Status', render: (r) => <span className="flex gap-1">{r.is_active ? <Badge tone="success">Live</Badge> : <Badge>Hidden</Badge>}{r.is_featured && <Badge tone="accent">Featured</Badge>}</span> },
      ],
      fields,
    }} />
  );
}

export function Categories() {
  return (
    <Resource config={{
      table: 'product_categories', title: 'Categories', order: { column: 'sort_order' },
      defaults: { is_active: true, sort_order: 0 },
      beforeSave: withSlug('name'),
      columns: [{ key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' }, { key: 'sort_order', label: 'Order', className: 'num' }, { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? <Badge tone="success">Live</Badge> : <Badge>Hidden</Badge>) }],
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true }, { key: 'slug', label: 'URL slug', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' }, { key: 'sort_order', label: 'Display order', type: 'number', step: 1 },
        { key: 'is_active', label: 'Visible', type: 'boolean' }, { key: 'image_url', label: 'Image', type: 'image', folder: 'categories' },
      ],
    }} />
  );
}

export function Packages() {
  return (
    <Resource config={{
      table: 'packages', title: 'Packages', description: 'Leave the price empty to show “Priced after a site survey”.', order: { column: 'sort_order' },
      defaults: { is_active: true, is_popular: false, features: [], sort_order: 0 },
      beforeSave: withSlug('name'),
      columns: [
        { key: 'name', label: 'Package' },
        { key: 'spec', label: 'System', render: (r) => `${num(r.inverter_kw)} kW, ${num(r.battery_kwh)} kWh, ${num(r.pv_kwp_min)}–${num(r.pv_kwp_max)} kWp` },
        { key: 'price', label: 'Price', className: 'num', render: (r) => (r.price ? money(r.price) : 'On survey') },
        { key: 'is_active', label: 'Status', render: (r) => <span className="flex gap-1">{r.is_active ? <Badge tone="success">Live</Badge> : <Badge>Hidden</Badge>}{r.is_popular && <Badge tone="accent">Popular</Badge>}</span> },
      ],
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true }, { key: 'slug', label: 'URL slug', type: 'text' },
        { key: 'tagline', label: 'Tagline', type: 'text', full: true }, { key: 'ideal_for', label: 'Ideal for', type: 'text' },
        { key: 'price', label: 'Price from', type: 'number', nullable: true },
        { key: 'inverter_kw', label: 'Inverter (kW)', type: 'number', required: true }, { key: 'battery_kwh', label: 'Battery (kWh)', type: 'number', required: true },
        { key: 'pv_kwp_min', label: 'PV minimum (kWp)', type: 'number', required: true }, { key: 'pv_kwp_max', label: 'PV maximum (kWp)', type: 'number', required: true },
        { key: 'sort_order', label: 'Display order', type: 'number', step: 1 },
        { key: 'is_popular', label: 'Highlight as most chosen', type: 'boolean' }, { key: 'is_active', label: 'Visible', type: 'boolean' },
        { key: 'features', label: 'Included items', type: 'tags' }, { key: 'image_url', label: 'Image', type: 'image', folder: 'packages' },
      ],
    }} />
  );
}

function InstallerStatusButtons({ row, refresh }: { row: Row; refresh: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const set = async (status: string) => {
    setBusy(true);
    try { await invoke('admin-actions', { action: 'set_installer_status', installer_id: row.id, status }); toast(`Installer ${status}`); refresh(); } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  if (row.verification_status === 'verified') return <Button size="sm" variant="ghost" disabled={busy} onClick={() => set('suspended')}>Suspend</Button>;
  return <Button size="sm" variant="secondary" disabled={busy} onClick={() => set('verified')}>Verify</Button>;
}

export function Installers() {
  return (
    <Resource config={{
      table: 'installers', title: 'Installers', description: 'Only verified installers appear in the public directory and receive leads. Verifying sends the installer a confirmation email.', order: { column: 'created_at', ascending: false }, search: ['company_name', 'email', 'state', 'city'],
      filters: [{ key: 'verification_status', label: 'Status', options: opts(['pending', 'verified', 'suspended']) }],
      defaults: { verification_status: 'pending', services: [], states_covered: [], certifications: [], years_experience: 0, completed_projects: 0, portfolio: [] },
      beforeSave: (v, isNew) => { const out = withSlug('company_name')(v, isNew); delete out.verification_status; return out; },
      rowActions: (row, refresh) => <InstallerStatusButtons row={row} refresh={refresh} />,
      columns: [
        { key: 'company_name', label: 'Company', render: (r) => <><p className="font-medium">{r.company_name}</p><p className="text-xs text-muted">{r.contact_person}, {r.phone}</p></> },
        { key: 'state', label: 'Base', render: (r) => [r.city, r.state].filter(Boolean).join(', ') },
        { key: 'services', label: 'Services', render: (r) => <span className="text-xs text-muted">{(r.services ?? []).map(sentence).join(', ')}</span> },
        { key: 'verification_status', label: 'Status', render: (r) => <StatusBadge status={r.verification_status} /> },
        { key: 'created_at', label: 'Applied', render: (r) => date(r.created_at) },
      ],
      fields: [
        { key: 'company_name', label: 'Company name', type: 'text', required: true }, { key: 'slug', label: 'URL slug', type: 'text' },
        { key: 'contact_person', label: 'Contact person', type: 'text' }, { key: 'email', label: 'Email', type: 'email' },
        { key: 'phone', label: 'Phone', type: 'text' }, { key: 'whatsapp', label: 'WhatsApp', type: 'text' },
        { key: 'website', label: 'Website', type: 'url' }, { key: 'state', label: 'Base state', type: 'text', required: true },
        { key: 'city', label: 'City', type: 'text' }, { key: 'address', label: 'Address', type: 'text' },
        { key: 'years_experience', label: 'Years of experience', type: 'number', step: 1 }, { key: 'completed_projects', label: 'Completed projects', type: 'number', step: 1 },
        { key: 'is_featured', label: 'Feature at top of directory', type: 'boolean' },
        { key: 'services', label: 'Services', type: 'tags', hint: `Use: ${INSTALLER_SERVICES.join(', ')}` },
        { key: 'states_covered', label: 'Other states covered', type: 'tags' },
        { key: 'certifications', label: 'Certifications', type: 'tags' },
        { key: 'bio', label: 'About', type: 'textarea' },
        { key: 'internal_notes', label: 'Internal notes (never shown publicly)', type: 'textarea' },
        { key: 'logo_url', label: 'Logo', type: 'image', folder: 'installers' },
        { key: 'photo_url', label: 'Photo', type: 'image', folder: 'installers' },
      ],
    }} />
  );
}

export function Appliances() {
  const catOpts = Object.entries(CATEGORIES).map(([value, m]) => ({ value, label: m.label }));
  return (
    <Resource config={{
      table: 'appliance_catalog', title: 'Appliance database', description: 'Presets offered as “Quick add” in the calculator. Duty cycle is the share of running time at full power; surge is the start-up multiple.', order: { column: 'sort_order' }, search: ['name'],
      filters: [{ key: 'category', label: 'Category', options: catOpts }],
      defaults: { duty_cycle: 1, surge_factor: 1, priority: 'important', usage_window: 'anytime', is_active: true, inverter_technology: false, sort_order: 100 },
      columns: [
        { key: 'name', label: 'Appliance', render: (r) => <><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{CATEGORIES[r.category as keyof typeof CATEGORIES]?.label}</p></> },
        { key: 'default_watts', label: 'Watts', className: 'num text-right' },
        { key: 'default_hours', label: 'Hours', className: 'num text-right' },
        { key: 'duty_cycle', label: 'Duty', className: 'num text-right', render: (r) => `${Math.round(r.duty_cycle * 100)}%` },
        { key: 'surge_factor', label: 'Surge', className: 'num text-right', render: (r) => `${r.surge_factor}×` },
        { key: 'priority', label: 'Priority', render: (r) => sentence(r.priority) },
        { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? <Badge tone="success">Active</Badge> : <Badge>Hidden</Badge>) },
      ],
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true }, { key: 'category', label: 'Category', type: 'select', options: catOpts, required: true },
        { key: 'description', label: 'Description', type: 'text', full: true },
        { key: 'default_watts', label: 'Rated watts', type: 'number', required: true }, { key: 'default_hours', label: 'Hours per day', type: 'number', required: true },
        { key: 'duty_cycle', label: 'Duty cycle (0.05–1)', type: 'number', step: 0.01 }, { key: 'surge_factor', label: 'Surge factor (≥1)', type: 'number', step: 0.1 },
        { key: 'horsepower', label: 'Horsepower', type: 'number', nullable: true },
        { key: 'priority', label: 'Default priority', type: 'select', options: opts(['essential', 'important', 'heavy']) },
        { key: 'usage_window', label: 'Usage window', type: 'select', options: opts(['day', 'evening', 'night', 'anytime']) },
        { key: 'sort_order', label: 'Display order', type: 'number', step: 1 },
        { key: 'inverter_technology', label: 'Inverter compressor', type: 'boolean' }, { key: 'is_active', label: 'Offer in calculator', type: 'boolean' },
      ],
    }} />
  );
}

export function Regions() {
  const countries = useQuery({ queryKey: ['admin', 'countries', 'options'], queryFn: async () => ((await supabase.from('countries').select('code, name').order('sort_order')).data ?? []).map((c) => ({ value: c.code as string, label: c.name as string })) }).data ?? [];
  return (
    <div className="space-y-12">
      <Resource config={{
        table: 'regions', title: 'Regions and sun hours', description: 'Peak sun hours (kWh/m²/day) and mean ambient temperature per state drive PV sizing and temperature losses.', order: { column: 'name' }, search: ['name', 'zone'], pageSize: 50,
        filters: [{ key: 'country_code', label: 'Country', options: countries }],
        defaults: { country_code: 'NG', is_active: true },
        columns: [
          { key: 'name', label: 'Region' }, { key: 'country_code', label: 'Country' }, { key: 'zone', label: 'Zone', render: (r) => r.zone ?? '—' },
          { key: 'peak_sun_hours', label: 'Sun hours', className: 'num text-right' }, { key: 'ambient_temp_c', label: 'Temp °C', className: 'num text-right', render: (r) => r.ambient_temp_c ?? '—' },
          { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? <Badge tone="success">Active</Badge> : <Badge>Hidden</Badge>) },
        ],
        fields: [
          { key: 'name', label: 'Name', type: 'text', required: true }, { key: 'country_code', label: 'Country', type: 'select', options: countries, required: true },
          { key: 'zone', label: 'Zone', type: 'text' }, { key: 'peak_sun_hours', label: 'Peak sun hours', type: 'number', step: 0.1, required: true },
          { key: 'ambient_temp_c', label: 'Ambient temperature °C', type: 'number', step: 0.1, nullable: true }, { key: 'is_active', label: 'Active', type: 'boolean' },
        ],
      }} />
      <Resource config={{
        table: 'countries', title: 'Countries', idKey: 'code', description: 'Defaults used when a region is not listed. The currency sets the assessment’s default payment currency.', order: { column: 'sort_order' },
        canDelete: false,
        columns: [
          { key: 'name', label: 'Country' }, { key: 'code', label: 'Code' }, { key: 'currency', label: 'Currency' },
          { key: 'default_peak_sun_hours', label: 'Sun hours', className: 'num text-right' },
          { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? <Badge tone="success">Active</Badge> : <Badge>Hidden</Badge>) },
        ],
        fields: [
          { key: 'code', label: 'ISO code (2 letters)', type: 'text', required: true }, { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'currency', label: 'Currency', type: 'text', required: true }, { key: 'default_peak_sun_hours', label: 'Default sun hours', type: 'number', step: 0.1, required: true },
          { key: 'default_ambient_temp_c', label: 'Default temperature °C', type: 'number', nullable: true }, { key: 'sort_order', label: 'Order', type: 'number', step: 1 },
          { key: 'is_active', label: 'Active', type: 'boolean' },
        ],
      }} />
    </div>
  );
}

export function Posts() {
  return (
    <Resource config={{
      table: 'posts', title: 'Articles', order: { column: 'created_at', ascending: false }, search: ['title', 'slug'],
      defaults: { is_published: false, tags: [], body: '' },
      beforeSave: (v, isNew) => ({ ...withSlug('title')(v, isNew), published_at: v.is_published ? v.published_at || new Date().toISOString() : v.published_at }),
      columns: [
        { key: 'title', label: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
        { key: 'is_published', label: 'Status', render: (r) => (r.is_published ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>) },
        { key: 'published_at', label: 'Published', render: (r) => date(r.published_at) },
      ],
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, full: true }, { key: 'slug', label: 'URL slug', type: 'text' },
        { key: 'is_published', label: 'Published', type: 'boolean' },
        { key: 'excerpt', label: 'Excerpt', type: 'textarea' }, { key: 'body', label: 'Body', type: 'markdown' },
        { key: 'tags', label: 'Tags', type: 'tags' },
        { key: 'seo_title', label: 'Search title', type: 'text' }, { key: 'seo_description', label: 'Search description', type: 'text' },
        { key: 'cover_url', label: 'Cover image', type: 'image', folder: 'posts' },
      ],
    }} />
  );
}
