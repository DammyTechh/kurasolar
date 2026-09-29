import { admin } from './db.ts';
import type { SizingResult } from './engine/index.ts';

export interface RecommendedItem {
  product_id: string;
  slug: string;
  name: string;
  role: string;
  quantity: number;
  unit_price: number;
  reason: string;
}

export interface Recommendation {
  items: RecommendedItem[];
  package_slug: string | null;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  price: number;
  product_role: string | null;
  capacity_value: number | null;
  capacity_unit: string | null;
  is_featured: boolean;
}

const item = (p: ProductRow, quantity: number, reason: string): RecommendedItem => ({
  product_id: p.id,
  slug: p.slug,
  name: p.name,
  role: p.product_role ?? 'accessory',
  quantity,
  unit_price: Number(p.price),
  reason,
});

/** Picks in-stock catalogue products that fit the calculated system. */
export async function recommendProducts(result: SizingResult, powerFactor: number): Promise<Recommendation> {
  const { data } = await admin()
    .from('products')
    .select('id, slug, name, price, product_role, capacity_value, capacity_unit, is_featured')
    .eq('is_active', true)
    .not('product_role', 'is', null);
  const products = (data ?? []) as ProductRow[];
  const byRole = (role: string) => products.filter((p) => p.product_role === role);
  const items: RecommendedItem[] = [];

  // Inverter: smallest unit that covers the recommendation; otherwise parallel units of the largest.
  const invKw = result.inverter.recommendedKw;
  const inverters = byRole('inverter')
    .filter((p) => p.capacity_value)
    .map((p) => ({ p, kw: p.capacity_unit === 'kVA' ? Number(p.capacity_value) * powerFactor : Number(p.capacity_value) }))
    .sort((a, b) => a.kw - b.kw);
  if (invKw > 0 && inverters.length) {
    const fit = inverters.find((i) => i.kw >= invKw);
    const pick = fit ?? inverters[inverters.length - 1];
    const qty = fit ? 1 : Math.ceil(invKw / pick.kw);
    items.push(item(pick.p, qty, `Covers a ${invKw} kW requirement${qty > 1 ? ' in parallel' : ''}`));
  }

  // Battery: the combination with the least spare capacity, then the fewest units.
  const target = result.battery.tiers.find((t) => t.key === 'standard')?.nominalKwh ?? 0;
  const batteries = byRole('battery').filter((p) => p.capacity_value && p.capacity_unit === 'kWh');
  if (target > 0 && batteries.length) {
    const best = batteries
      .map((p) => {
        const qty = Math.ceil(target / Number(p.capacity_value));
        return { p, qty, total: qty * Number(p.capacity_value) };
      })
      .sort((a, b) => a.total - b.total || a.qty - b.qty)[0];
    items.push(item(best.p, best.qty, `${best.total.toFixed(1)} kWh against a ${target} kWh target`));
  }

  // Panels: prefer the reference wattage, otherwise the largest available.
  const panels = byRole('panel').filter((p) => p.capacity_value && p.capacity_unit === 'W');
  if (result.pv.arrayKwp > 0 && panels.length) {
    const panel = panels.find((p) => Number(p.capacity_value) === result.pv.panelWattage) ??
      panels.sort((a, b) => Number(b.capacity_value) - Number(a.capacity_value))[0];
    const qty = Math.ceil((result.pv.recommendedKwp * 1000) / Number(panel.capacity_value));
    items.push(item(panel, qty, `${((qty * Number(panel.capacity_value)) / 1000).toFixed(2)} kWp array`));

    const mount = byRole('mounting').find((p) => p.capacity_unit === 'pcs' && p.capacity_value);
    if (mount) items.push(item(mount, Math.ceil(qty / Number(mount.capacity_value)), `Mounting for ${qty} panels`));
  }

  for (const p of byRole('protection').slice(0, 2)) items.push(item(p, 1, 'Required protection'));
  for (const p of byRole('cable').slice(0, 2)) items.push(item(p, 1, 'Interconnection'));

  // Closest package that meets both inverter and battery needs.
  const { data: pkgs } = await admin()
    .from('packages')
    .select('slug, inverter_kw, battery_kwh')
    .eq('is_active', true)
    .order('inverter_kw');
  const pkg = (pkgs ?? []).find((k) => Number(k.inverter_kw) >= invKw && Number(k.battery_kwh) >= target * 0.8);

  return { items, package_slug: pkg?.slug ?? null };
}
