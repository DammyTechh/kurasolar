import type { ApplianceCategory, ApplianceInput, GridAvailability, LoadPriority, UsageWindow } from '@engine';
import { AirVent, Droplets, Flame, Heater, Lightbulb, Plug, Refrigerator, Shirt, Snowflake, Speaker, SquarePlus, Tv, type LucideIcon } from 'lucide-react';
import type { ApplianceLookups } from '@/lib/settings';
import type { CatalogAppliance } from '@/lib/types';

export interface TypeOption {
  value: string;
  label: string;
  watts: number;
  hours?: number;
}

export interface CategoryMeta {
  label: string;
  plural: string;
  icon: LucideIcon;
  priority: LoadPriority;
  window: UsageWindow;
  hours: number;
  watts: number;
  duty: number;
  surge: number;
  /** Optional "type" dropdown with its own default wattage. */
  types?: TypeOption[];
  typeLabel?: string;
  /** Show an inverter-compressor toggle. */
  inverterToggle?: boolean;
  /** Show horsepower selector. */
  horsepower?: number[];
  /** Show days per week. */
  days?: boolean;
  /** Washing machines: cycles per day instead of plain hours. */
  cycles?: boolean;
  capacity?: string;
  hint?: string;
}

export const CATEGORIES: Record<ApplianceCategory, CategoryMeta> = {
  lighting: {
    label: 'Lighting', plural: 'Lights', icon: Lightbulb, priority: 'essential', window: 'night', hours: 8, watts: 12, duty: 1, surge: 1,
    typeLabel: 'Bulb type',
    types: [
      { value: 'led', label: 'LED bulb', watts: 12 },
      { value: 'led_flood', label: 'LED floodlight', watts: 50, hours: 11 },
      { value: 'fluorescent', label: 'Fluorescent tube', watts: 36 },
      { value: 'incandescent', label: 'Incandescent bulb', watts: 60 },
    ],
  },
  television: {
    label: 'Television', plural: 'Televisions', icon: Tv, priority: 'essential', window: 'evening', hours: 6, watts: 85, duty: 1, surge: 1.1,
    typeLabel: 'Screen size',
  },
  refrigerator: {
    label: 'Refrigerator', plural: 'Refrigerators', icon: Refrigerator, priority: 'essential', window: 'anytime', hours: 24, watts: 150, duty: 0.4, surge: 3,
    typeLabel: 'Type', inverterToggle: true, horsepower: [0.25, 0.33, 0.5, 0.75, 1],
    types: [
      { value: 'single_door', label: 'Single door', watts: 120 },
      { value: 'double_door', label: 'Double door', watts: 180 },
      { value: 'side_by_side', label: 'Side-by-side', watts: 250 },
      { value: 'commercial', label: 'Commercial / display', watts: 450 },
    ],
    hint: 'Compressors cycle on and off, so energy uses the duty cycle rather than 24 hours of full power.',
  },
  freezer: {
    label: 'Freezer', plural: 'Freezers', icon: Snowflake, priority: 'essential', window: 'anytime', hours: 24, watts: 180, duty: 0.45, surge: 3,
    typeLabel: 'Type', inverterToggle: true, horsepower: [0.25, 0.33, 0.5, 0.75, 1],
    types: [
      { value: 'chest', label: 'Chest freezer', watts: 180 },
      { value: 'upright', label: 'Upright freezer', watts: 200 },
      { value: 'commercial', label: 'Commercial freezer', watts: 500 },
    ],
  },
  air_conditioner: {
    label: 'Air conditioner', plural: 'Air conditioners', icon: AirVent, priority: 'important', window: 'night', hours: 8, watts: 1150, duty: 0.7, surge: 1.3,
    typeLabel: 'AC type', inverterToggle: true,
    types: [
      { value: 'split', label: 'Split', watts: 0 },
      { value: 'window', label: 'Window', watts: 0 },
      { value: 'standing', label: 'Standing', watts: 0 },
      { value: 'cassette', label: 'Cassette', watts: 0 },
    ],
    hint: 'Non-inverter ACs draw a large surge on start-up. The inverter is sized for the largest single start.',
  },
  audio: { label: 'Audio system', plural: 'Audio', icon: Speaker, priority: 'important', window: 'evening', hours: 4, watts: 120, duty: 1, surge: 1.2 },
  washing_machine: {
    label: 'Washing machine', plural: 'Washing machines', icon: Shirt, priority: 'important', window: 'day', hours: 1, watts: 500, duty: 0.7, surge: 2,
    typeLabel: 'Type', cycles: true, days: true,
    types: [
      { value: 'automatic', label: 'Automatic', watts: 500 },
      { value: 'semi_automatic', label: 'Semi-automatic', watts: 350 },
      { value: 'washer_dryer', label: 'Washer / dryer', watts: 2000 },
    ],
  },
  plug_load: {
    label: 'Sockets & devices', plural: 'Devices', icon: Plug, priority: 'essential', window: 'anytime', hours: 6, watts: 65, duty: 1, surge: 1,
    typeLabel: 'Device',
    types: [
      { value: 'laptop', label: 'Laptop', watts: 65, hours: 8 },
      { value: 'phone_charger', label: 'Phone charger', watts: 10, hours: 3 },
      { value: 'decoder', label: 'Decoder', watts: 25, hours: 6 },
      { value: 'router', label: 'Wi-Fi router', watts: 12, hours: 24 },
      { value: 'fan', label: 'Standing / ceiling fan', watts: 60, hours: 10 },
      { value: 'console', label: 'Gaming console', watts: 150, hours: 3 },
      { value: 'desktop', label: 'Desktop computer', watts: 250, hours: 6 },
      { value: 'printer', label: 'Printer', watts: 50, hours: 1 },
      { value: 'cctv', label: 'CCTV system', watts: 40, hours: 24 },
      { value: 'other', label: 'Other device', watts: 50 },
    ],
  },
  electric_iron: { label: 'Electric iron', plural: 'Irons', icon: Flame, priority: 'heavy', window: 'day', hours: 1, watts: 1000, duty: 0.6, surge: 1, days: true },
  water_heater: {
    label: 'Water heater', plural: 'Water heaters', icon: Heater, priority: 'heavy', window: 'day', hours: 1.5, watts: 2000, duty: 0.8, surge: 1,
    capacity: 'Capacity (litres)', hint: 'Water heaters are high-power loads. Scheduling them in daylight keeps the battery smaller.',
  },
  pump: {
    label: 'Water pump', plural: 'Pumps', icon: Droplets, priority: 'heavy', window: 'day', hours: 1, watts: 750, duty: 1, surge: 3,
    horsepower: [0.5, 0.75, 1, 1.5, 2],
  },
  custom: { label: 'Custom appliance', plural: 'Custom', icon: SquarePlus, priority: 'important', window: 'anytime', hours: 2, watts: 100, duty: 1, surge: 1, days: true },
};

export const CATEGORY_ORDER: ApplianceCategory[] = [
  'lighting', 'plug_load', 'television', 'refrigerator', 'freezer', 'air_conditioner',
  'washing_machine', 'audio', 'electric_iron', 'water_heater', 'pump', 'custom',
];

export const PRIORITY_OPTIONS: { value: LoadPriority; label: string; hint: string }[] = [
  { value: 'essential', label: 'Essential', hint: 'Must stay on' },
  { value: 'important', label: 'Important', hint: 'Keep on if possible' },
  { value: 'heavy', label: 'Heavy / optional', hint: 'Run in sunshine' },
];

export const WINDOW_OPTIONS: { value: UsageWindow; label: string; hint: string }[] = [
  { value: 'day', label: 'Daytime', hint: 'Mostly in sunshine' },
  { value: 'evening', label: 'Evening', hint: '6pm – 11pm' },
  { value: 'night', label: 'Night', hint: 'Overnight' },
  { value: 'anytime', label: 'All day', hint: 'Spread over 24 h' },
];

export const GRID_OPTIONS: { value: GridAvailability; label: string; hint: string }[] = [
  { value: 'reliable', label: 'Reliable', hint: '18+ hours a day' },
  { value: 'intermittent', label: 'Intermittent', hint: '8–18 hours' },
  { value: 'poor', label: 'Poor', hint: 'Under 8 hours' },
  { value: 'none', label: 'No grid', hint: 'Off-grid site' },
];

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Flat / apartment' },
  { value: 'residential', label: 'Detached house' },
  { value: 'estate', label: 'Duplex / terrace' },
  { value: 'office', label: 'Office' },
  { value: 'commercial', label: 'Shop / commercial' },
  { value: 'school', label: 'School' },
  { value: 'hospital', label: 'Clinic / hospital' },
  { value: 'church', label: 'Place of worship' },
  { value: 'farm', label: 'Farm / rural site' },
];

/** Display name for a type choice, e.g. "Refrigerator, single door". */
export function typeName(category: ApplianceCategory, t: TypeOption) {
  if (category === 'refrigerator' || category === 'freezer' && !/freezer/i.test(t.label) || category === 'washing_machine') {
    return `${CATEGORIES[category].label}, ${t.label.toLowerCase()}`;
  }
  return t.label;
}

export const HP_OPTIONS = ['1', '1.5', '2', '2.5', '3'];

/** Watts for a TV size, AC horsepower, pump rating etc. using admin lookups. */
export function lookupWatts(category: ApplianceCategory, attrs: Record<string, unknown>, inverter: boolean, lookups: ApplianceLookups): number | null {
  if (category === 'television' && typeof attrs.screenSize === 'string') {
    return lookups.tvWattsBySize[attrs.screenSize] ?? null;
  }
  if (category === 'air_conditioner' && typeof attrs.hp === 'string') {
    const row = lookups.acWattsByHp[attrs.hp];
    return row ? (inverter ? row.inverter : row.standard) : null;
  }
  if (category === 'pump' && attrs.hp != null) {
    // Input power ≈ shaft power / motor efficiency (≈ 0.75 for small pumps).
    return Math.round((Number(attrs.hp) * 746) / 0.75 / 10) * 10;
  }
  const meta = CATEGORIES[category];
  if (meta.types && typeof attrs.type === 'string') {
    const t = meta.types.find((x) => x.value === attrs.type);
    if (t && t.watts > 0) return t.watts;
  }
  return null;
}

/** Duty cycle and surge for a compressor load, from admin lookups. */
export function compressorDefaults(category: ApplianceCategory, inverter: boolean, lookups: ApplianceLookups) {
  if (category !== 'refrigerator' && category !== 'freezer' && category !== 'air_conditioner') return null;
  const duty = lookups.compressorDutyCycle[category];
  const surge = inverter ? lookups.compressorSurge.inverter : lookups.compressorSurge.standard;
  return { duty: inverter && category !== 'air_conditioner' ? Math.max(0.1, duty - 0.05) : duty, surge };
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function describe(a: ApplianceInput) {
  const attrs = a.attributes ?? {};
  const bits: string[] = [];
  if (attrs.screenSize) bits.push(String(attrs.screenSize));
  if (attrs.hp) bits.push(`${attrs.hp} HP`);
  if (a.inverterTechnology) bits.push('inverter');
  bits.push(`${a.ratedWatts} W`);
  if (a.category === 'washing_machine') bits.push(`${a.cyclesPerDay ?? 1} cycle${(a.cyclesPerDay ?? 1) > 1 ? 's' : ''}/day`);
  else bits.push(`${a.hoursPerDay} h/day`);
  if (a.daysPerWeek && a.daysPerWeek < 7) bits.push(`${a.daysPerWeek} days/wk`);
  return bits.join(', ');
}

/** A blank appliance of a category, with defaults from the admin lookups. */
export function newAppliance(category: ApplianceCategory, lookups: ApplianceLookups): ApplianceInput {
  const meta = CATEGORIES[category];
  const attributes: Record<string, string | number | boolean> = {};
  let watts = meta.watts;
  let hours = meta.hours;
  let name = meta.label;
  let inverter = false;

  if (category === 'television') {
    attributes.screenSize = '43"';
    watts = lookups.tvWattsBySize['43"'] ?? watts;
    name = 'LED TV 43"';
  } else if (category === 'air_conditioner') {
    attributes.type = 'split';
    attributes.hp = '1.5';
    inverter = true;
    watts = lookups.acWattsByHp['1.5']?.inverter ?? watts;
    name = 'Split AC 1.5 HP';
  } else if (category === 'pump') {
    attributes.hp = 1;
    watts = lookupWatts('pump', attributes, false, lookups) ?? watts;
    name = 'Water pump 1 HP';
  } else if (meta.types) {
    const t = meta.types[0]!;
    attributes.type = t.value;
    watts = t.watts || watts;
    hours = t.hours ?? hours;
    name = typeName(category, t);
  }
  if (category === 'custom') name = '';

  const comp = compressorDefaults(category, inverter, lookups);
  return {
    id: uid(),
    category,
    name,
    quantity: 1,
    ratedWatts: watts,
    hoursPerDay: hours,
    daysPerWeek: category === 'electric_iron' ? 3 : category === 'washing_machine' ? 3 : 7,
    cyclesPerDay: 1,
    dutyCycle: comp?.duty ?? meta.duty,
    surgeFactor: comp?.surge ?? meta.surge,
    priority: meta.priority,
    usageWindow: meta.window,
    inverterTechnology: inverter,
    attributes,
  };
}

/** Converts an admin appliance-catalogue preset into an appliance line. */
export function fromCatalog(row: CatalogAppliance): ApplianceInput {
  const attributes: Record<string, string | number | boolean> = { preset: row.id };
  if (row.horsepower) attributes.hp = String(Number(row.horsepower));
  return {
    id: uid(),
    category: row.category,
    name: row.name,
    quantity: 1,
    ratedWatts: Number(row.default_watts),
    hoursPerDay: Number(row.default_hours),
    daysPerWeek: row.category === 'electric_iron' || row.category === 'washing_machine' ? 3 : 7,
    cyclesPerDay: 1,
    dutyCycle: Number(row.duty_cycle),
    surgeFactor: Number(row.surge_factor),
    priority: row.priority,
    usageWindow: row.usage_window,
    inverterTechnology: row.inverter_technology,
    horsepower: row.horsepower ? Number(row.horsepower) : undefined,
    attributes,
  };
}
