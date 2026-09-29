import type { EngineeringSettings } from './types.ts';

/**
 * Fallback engineering assumptions. The live values are stored in
 * `site_settings.engineering` and edited from Admin → Engineering.
 * Keep this object in sync with the seed in the migration.
 */
export const DEFAULT_ENGINEERING: EngineeringSettings = {
  batteryDoD: 0.9,
  batteryEfficiency: 0.95,
  inverterEfficiency: 0.93,
  batteryReserveMargin: 1.1,
  batteryModuleKwh: 5.12,
  batteryExtendedMultiplier: 1.5,

  pvDerating: 0.9,
  temperatureLoss: 0.08,
  temperatureCoefficient: 0.0035,
  cellTempRise: 25,
  wiringLoss: 0.03,
  mpptEfficiency: 0.98,
  pvDesignMargin: 1.15,
  panelWattage: 550,

  inverterExpansionMargin: 0.25,
  inverterSurgeRatio: 2,
  powerFactor: 0.8,
  inverterSizesKw: [1, 1.5, 3, 3.6, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 80, 100],

  coincidence: { essential: 0.9, important: 0.7, heavy: 0.5 },
  nightFraction: { day: 0.1, evening: 0.7, night: 1, anytime: 0.55 },
  nightHours: 13,
  backupHoursByGrid: { reliable: 6, intermittent: 10, poor: 14, none: 18 },

  generatorLitresPerKwh: 0.4,
  fuelPricePerLitre: 1150,
  co2KgPerKwh: 0.8,
};

/** Merge a partial settings object (e.g. from the database) over the defaults, ignoring invalid values. */
export function resolveSettings(partial?: Partial<EngineeringSettings> | null): EngineeringSettings {
  const merged: EngineeringSettings = {
    ...DEFAULT_ENGINEERING,
    coincidence: { ...DEFAULT_ENGINEERING.coincidence },
    nightFraction: { ...DEFAULT_ENGINEERING.nightFraction },
    backupHoursByGrid: { ...DEFAULT_ENGINEERING.backupHoursByGrid },
  };
  if (!partial) return merged;

  for (const [key, value] of Object.entries(partial)) {
    const k = key as keyof EngineeringSettings;
    if (!(k in DEFAULT_ENGINEERING)) continue;
    const base = DEFAULT_ENGINEERING[k];
    if (typeof base === 'number' && typeof value === 'number' && Number.isFinite(value)) {
      (merged as unknown as Record<string, unknown>)[k] = value;
    } else if (Array.isArray(base) && Array.isArray(value)) {
      const sizes = value.map(Number).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
      if (sizes.length) (merged as unknown as Record<string, unknown>)[k] = sizes;
    } else if (base && typeof base === 'object' && value && typeof value === 'object') {
      const target = merged[k] as unknown as Record<string, number>;
      for (const [sub, n] of Object.entries(value as Record<string, unknown>)) {
        if (sub in target && typeof n === 'number' && Number.isFinite(n)) target[sub] = n;
      }
    }
  }
  return merged;
}
