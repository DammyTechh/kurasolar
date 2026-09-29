import { summarizeLoad } from './load.ts';
import type {
  ApplianceInput,
  BatteryTier,
  EngineeringSettings,
  SiteContext,
  SizingResult,
  SizingTeaser,
} from './types.ts';

/**
 * Server-only sizing. The React app never imports this file, so the paid
 * recommendation is not shipped to the browser.
 */

const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

/** Smallest standard inverter that meets the requirement; beyond the list, round up to the next 10 kW. */
export function snapInverter(requiredKw: number, sizes: number[]): number {
  if (requiredKw <= 0) return 0;
  const match = sizes.find((s) => s >= requiredKw);
  return match ?? Math.ceil(requiredKw / 10) * 10;
}

/** Temperature loss from regional ambient temperature, or the configured fixed value. */
export function temperatureLoss(settings: EngineeringSettings, ambientTempC?: number | null): number {
  if (ambientTempC == null || !Number.isFinite(ambientTempC)) return settings.temperatureLoss;
  const cellTemp = ambientTempC + settings.cellTempRise;
  return Math.min(0.3, Math.max(0, (cellTemp - 25) * settings.temperatureCoefficient));
}

export function calculateSystem(
  appliances: ApplianceInput[],
  site: SiteContext,
  settings: EngineeringSettings,
): SizingResult {
  const summary = summarizeLoad(appliances, settings);
  const psh = Math.max(1, site.peakSunHours);

  // ---- PV ----------------------------------------------------------------
  // PV must supply daytime loads through the inverter, and night-time loads
  // through the battery and the inverter (so they carry both losses).
  const tempLoss = temperatureLoss(settings, site.ambientTempC);
  const systemEfficiency =
    settings.pvDerating * (1 - tempLoss) * (1 - settings.wiringLoss) * settings.mpptEfficiency;
  const dayEnergy = Math.max(0, summary.dailyEnergyKwh - summary.nightEnergyKwh);
  const pvEnergyNeed =
    safeDiv(dayEnergy, settings.inverterEfficiency) +
    safeDiv(summary.nightEnergyKwh, settings.inverterEfficiency * settings.batteryEfficiency);

  const minimumKwp = safeDiv(pvEnergyNeed, psh * systemEfficiency);
  const recommendedKwp = minimumKwp * settings.pvDesignMargin;
  const panelCount = recommendedKwp > 0 ? Math.ceil((recommendedKwp * 1000) / settings.panelWattage) : 0;
  const arrayKwp = (panelCount * settings.panelWattage) / 1000;

  // ---- Inverter ----------------------------------------------------------
  // Continuous rating covers the running peak plus expansion headroom; the
  // surge rating (continuous × surge ratio) must also absorb the largest motor start.
  const requiredContinuousKw = summary.peakLoadKw * (1 + settings.inverterExpansionMargin);
  const requiredSurgeKw = summary.surgePeakKw;
  const ratingForSurge = safeDiv(requiredSurgeKw, settings.inverterSurgeRatio);
  const recommendedKw = snapInverter(Math.max(requiredContinuousKw, ratingForSurge), settings.inverterSizesKw);
  const recommendedKva = Math.ceil(safeDiv(recommendedKw, settings.powerFactor) * 2) / 2;

  // ---- Battery -----------------------------------------------------------
  //   Nominal kWh = required energy × reserve ÷ (DoD × battery eff × inverter eff)
  const backupHoursTarget = site.backupHours ?? settings.backupHoursByGrid[site.gridAvailability];
  const chain = settings.batteryDoD * settings.batteryEfficiency * settings.inverterEfficiency;
  const avgLoadKw = summary.dailyEnergyKwh / 24;
  const avgEssentialKw = summary.essentialDailyKwh / 24;
  // Backup duration is quoted against the average night-time draw, which is
  // what the battery actually carries, rather than the 24-hour average.
  const nightHours = Math.max(1, settings.nightHours);
  const nightLoadKw = summary.nightEnergyKwh / nightHours || avgLoadKw;
  const nightEssentialKw = summary.essentialNightEnergyKwh / nightHours || avgEssentialKw;

  const targetEnergyKwh = Math.max(summary.nightEnergyKwh, avgLoadKw * backupHoursTarget);
  const essentialTargetKwh = Math.max(summary.essentialNightEnergyKwh, avgEssentialKw * backupHoursTarget);

  const toModules = (energyKwh: number) =>
    energyKwh > 0
      ? Math.max(1, Math.ceil(safeDiv(energyKwh * settings.batteryReserveMargin, chain) / settings.batteryModuleKwh))
      : 0;

  const standardModules = toModules(targetEnergyKwh);
  const economyModules = Math.min(standardModules, toModules(essentialTargetKwh || targetEnergyKwh * 0.5));
  const extendedModules = standardModules
    ? Math.max(standardModules + 1, Math.ceil(standardModules * settings.batteryExtendedMultiplier))
    : 0;

  const tier = (
    key: BatteryTier['key'],
    label: string,
    modules: number,
    coverage: BatteryTier['coverage'],
  ): BatteryTier => {
    const nominal = modules * settings.batteryModuleKwh;
    const usable = nominal * settings.batteryDoD;
    const loadKw = coverage === 'essential' ? nightEssentialKw || nightLoadKw : nightLoadKw;
    return {
      key,
      label,
      modules,
      coverage,
      nominalKwh: round(nominal, 2),
      usableKwh: round(usable, 2),
      backupHours: round(safeDiv(usable * settings.batteryEfficiency * settings.inverterEfficiency, loadKw), 1),
    };
  };

  const tiers: BatteryTier[] = [
    tier('economy', 'Economy', economyModules, 'essential'),
    tier('standard', 'Standard', standardModules, 'full'),
    tier('extended', 'Extended backup', extendedModules, 'full'),
  ];

  return {
    summary,
    pv: {
      peakSunHours: psh,
      systemEfficiency: round(systemEfficiency, 3),
      temperatureLoss: round(tempLoss, 3),
      minimumKwp: round(minimumKwp, 2),
      recommendedKwp: round(recommendedKwp, 2),
      panelWattage: settings.panelWattage,
      panelCount,
      arrayKwp: round(arrayKwp, 2),
      dailyYieldKwh: round(arrayKwp * psh * systemEfficiency, 1),
    },
    inverter: {
      requiredContinuousKw: round(requiredContinuousKw, 2),
      requiredSurgeKw: round(requiredSurgeKw, 2),
      recommendedKw,
      recommendedKva,
      surgeCapacityKw: round(recommendedKw * settings.inverterSurgeRatio, 1),
    },
    battery: {
      chemistry: 'LiFePO4',
      targetEnergyKwh: round(targetEnergyKwh, 2),
      backupHoursTarget,
      tiers,
    },
    savings: {
      monthlyFuelSavings: Math.round(
        summary.dailyEnergyKwh * 30 * settings.generatorLitresPerKwh * settings.fuelPricePerLitre,
      ),
      co2TonnesPerYear: round((summary.dailyEnergyKwh * 365 * settings.co2KgPerKwh) / 1000, 1),
    },
    assumptions: { ...settings, ...site },
  };
}

/** What the customer sees before paying: a class of system, not the design. */
export function teaserFor(result: SizingResult): SizingTeaser {
  const kw = result.inverter.recommendedKw;
  const systemClass =
    kw === 0 ? 'No load entered'
      : kw <= 3.6 ? 'Compact home system'
      : kw <= 8 ? 'Standard home system'
      : kw <= 15 ? 'Large home system'
      : kw <= 30 ? 'Estate or small business system'
      : 'Commercial system';
  return { systemClass, inverterClassKva: result.inverter.recommendedKva };
}
