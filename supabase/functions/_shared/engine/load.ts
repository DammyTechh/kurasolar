import type {
  ApplianceBreakdown,
  ApplianceCategory,
  ApplianceInput,
  EngineeringSettings,
  LoadPriority,
  LoadSummary,
  UsageWindow,
} from './types.ts';

const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;

const CATEGORIES: ApplianceCategory[] = [
  'television', 'refrigerator', 'freezer', 'air_conditioner', 'audio', 'washing_machine',
  'lighting', 'plug_load', 'electric_iron', 'water_heater', 'pump', 'custom',
];
const PRIORITIES: LoadPriority[] = ['essential', 'important', 'heavy'];
const WINDOWS: UsageWindow[] = ['day', 'evening', 'night', 'anytime'];

/** Loads that deserve a warning in the report because of their power draw. */
const HIGH_POWER_WATTS = 1500;

/** Sensible default usage window when the customer does not choose one. */
export function defaultUsageWindow(category: ApplianceCategory): UsageWindow {
  switch (category) {
    case 'lighting':
      return 'night';
    case 'television':
    case 'audio':
      return 'evening';
    case 'electric_iron':
    case 'washing_machine':
    case 'pump':
      return 'day';
    default:
      return 'anytime';
  }
}

/**
 * Clamp and normalise an appliance. The server runs every appliance through
 * this before calculating, so nothing the browser sends is trusted as-is.
 */
export function sanitizeAppliance(raw: ApplianceInput): ApplianceInput {
  const category = CATEGORIES.includes(raw.category) ? raw.category : 'custom';
  const priority = PRIORITIES.includes(raw.priority) ? raw.priority : 'important';
  const usageWindow = raw.usageWindow && WINDOWS.includes(raw.usageWindow)
    ? raw.usageWindow
    : defaultUsageWindow(category);

  return {
    id: typeof raw.id === 'string' ? raw.id.slice(0, 64) : undefined,
    category,
    name: String(raw.name ?? 'Appliance').trim().slice(0, 120) || 'Appliance',
    quantity: Math.round(clamp(Number(raw.quantity), 1, 500)),
    ratedWatts: round(clamp(Number(raw.ratedWatts), 1, 200_000), 1),
    hoursPerDay: round(clamp(Number(raw.hoursPerDay), 0, 24), 2),
    daysPerWeek: Math.round(clamp(Number(raw.daysPerWeek ?? 7), 1, 7)),
    cyclesPerDay: round(clamp(Number(raw.cyclesPerDay ?? 1), 1, 10), 1),
    dutyCycle: round(clamp(Number(raw.dutyCycle ?? 1), 0.05, 1), 3),
    surgeFactor: round(clamp(Number(raw.surgeFactor ?? 1), 1, 8), 2),
    priority,
    usageWindow,
    inverterTechnology: Boolean(raw.inverterTechnology),
    horsepower: raw.horsepower != null ? round(clamp(Number(raw.horsepower), 0, 100), 2) : undefined,
    voltage: raw.voltage != null ? Math.round(clamp(Number(raw.voltage), 12, 480)) : undefined,
    attributes: raw.attributes && typeof raw.attributes === 'object' ? raw.attributes : undefined,
  };
}

/** Effective daily operating hours, including cycles per day, capped at 24. */
export function effectiveHours(a: ApplianceInput): number {
  const cycles = a.category === 'washing_machine' ? a.cyclesPerDay ?? 1 : 1;
  return Math.min(24, a.hoursPerDay * cycles);
}

/**
 * Average daily energy for one appliance line, kWh.
 *
 *   kWh/day = (W / 1000) × hours × quantity × duty cycle × (days per week / 7)
 *
 * Duty cycle is what stops a refrigerator being counted as rated watts × 24 h.
 */
export function applianceDailyKwh(a: ApplianceInput): number {
  const days = a.daysPerWeek ?? 7;
  return round((a.ratedWatts / 1000) * effectiveHours(a) * a.quantity * a.dutyCycle * (days / 7), 3);
}

export function summarizeLoad(
  input: ApplianceInput[],
  settings: Pick<EngineeringSettings, 'coincidence' | 'nightFraction'>,
): LoadSummary {
  const appliances = input.map(sanitizeAppliance);

  let connectedW = 0;
  let dailyKwh = 0;
  let nightKwh = 0;
  let essentialNightKwh = 0;
  let essentialDailyKwh = 0;
  let largestUnitW = 0;
  let largestStartIncrementW = 0;
  const byPriorityW: Record<LoadPriority, number> = { essential: 0, important: 0, heavy: 0 };
  const breakdown: ApplianceBreakdown[] = [];
  const highPowerLoads: string[] = [];

  for (const a of appliances) {
    const lineW = a.ratedWatts * a.quantity;
    const kwh = applianceDailyKwh(a);
    const night = kwh * (settings.nightFraction[a.usageWindow ?? 'anytime'] ?? 0.55);

    connectedW += lineW;
    dailyKwh += kwh;
    nightKwh += night;
    byPriorityW[a.priority] += lineW;
    if (a.priority === 'essential') {
      essentialDailyKwh += kwh;
      essentialNightKwh += night;
    }

    largestUnitW = Math.max(largestUnitW, a.ratedWatts);
    // Only one motor is assumed to start at a time, so track the largest single start increment.
    largestStartIncrementW = Math.max(largestStartIncrementW, a.ratedWatts * (a.surgeFactor - 1));
    if (a.ratedWatts >= HIGH_POWER_WATTS || a.category === 'water_heater') highPowerLoads.push(a.name);

    breakdown.push({
      name: a.name,
      category: a.category,
      quantity: a.quantity,
      ratedWatts: a.ratedWatts,
      hoursPerDay: effectiveHours(a),
      dutyCycle: a.dutyCycle,
      surgeFactor: a.surgeFactor,
      priority: a.priority,
      dailyKwh: kwh,
    });
  }

  // Running peak: each priority group scaled by how much of it realistically runs together.
  const coincidentW =
    byPriorityW.essential * settings.coincidence.essential +
    byPriorityW.important * settings.coincidence.important +
    byPriorityW.heavy * settings.coincidence.heavy;
  // The peak can never be less than the single largest appliance running on its own.
  const peakW = appliances.length ? Math.max(coincidentW, largestUnitW) : 0;
  const surgePeakW = peakW + largestStartIncrementW;

  return {
    applianceCount: appliances.reduce((n, a) => n + a.quantity, 0),
    connectedLoadKw: round(connectedW / 1000),
    peakLoadKw: round(peakW / 1000),
    surgePeakKw: round(surgePeakW / 1000),
    dailyEnergyKwh: round(dailyKwh),
    essentialLoadKw: round(byPriorityW.essential / 1000),
    importantLoadKw: round(byPriorityW.important / 1000),
    heavyLoadKw: round(byPriorityW.heavy / 1000),
    essentialDailyKwh: round(essentialDailyKwh),
    nightEnergyKwh: round(nightKwh),
    essentialNightEnergyKwh: round(essentialNightKwh),
    breakdown,
    highPowerLoads: [...new Set(highPowerLoads)],
  };
}
