/**
 * KuraSolar calculation engine — shared types.
 *
 * This folder is framework-free TypeScript. It is imported by the React app
 * (load summary only) and by Supabase Edge Functions (full sizing), and can be
 * reused unchanged by a future mobile app or API.
 */

export type LoadPriority = 'essential' | 'important' | 'heavy';

export type GridAvailability = 'reliable' | 'intermittent' | 'poor' | 'none';

/** When an appliance is mostly used. Drives how much energy the battery must supply. */
export type UsageWindow = 'day' | 'evening' | 'night' | 'anytime';

export type ApplianceCategory =
  | 'television'
  | 'refrigerator'
  | 'freezer'
  | 'air_conditioner'
  | 'audio'
  | 'washing_machine'
  | 'lighting'
  | 'plug_load'
  | 'electric_iron'
  | 'water_heater'
  | 'pump'
  | 'custom';

export interface ApplianceInput {
  /** Client-side id; not trusted by the server. */
  id?: string;
  category: ApplianceCategory;
  name: string;
  quantity: number;
  ratedWatts: number;
  /** Hours of operation per day (for washing machines: hours per cycle). */
  hoursPerDay: number;
  /** 1–7. Defaults to 7. Used for irons, washing machines, custom loads. */
  daysPerWeek?: number;
  /** Washing machines: cycles per day. Multiplies hoursPerDay. Defaults to 1. */
  cyclesPerDay?: number;
  /** 0.05–1. Fraction of operating time the load actually draws rated power (compressors, thermostats). */
  dutyCycle: number;
  /** ≥ 1. Starting current multiple for motors/compressors. */
  surgeFactor: number;
  priority: LoadPriority;
  usageWindow?: UsageWindow;
  inverterTechnology?: boolean;
  horsepower?: number;
  voltage?: number;
  /** Free-form descriptive attributes: screen size, AC type, capacity, etc. */
  attributes?: Record<string, string | number | boolean>;
}

export interface EngineeringSettings {
  /** Fraction of battery capacity that may be used (LiFePO4 ≈ 0.8–0.9). */
  batteryDoD: number;
  /** Battery round-trip efficiency. */
  batteryEfficiency: number;
  /** Inverter conversion efficiency. */
  inverterEfficiency: number;
  /** Extra battery capacity held in reserve (1.1 = 10%). */
  batteryReserveMargin: number;
  /** Nominal energy of one battery module, kWh. */
  batteryModuleKwh: number;
  /** Extended-backup tier multiplier over the standard tier. */
  batteryExtendedMultiplier: number;

  /** PV module derating: soiling, mismatch, nameplate tolerance, ageing (0–1). */
  pvDerating: number;
  /** Fixed temperature loss used when a region has no temperature data (0–1). */
  temperatureLoss: number;
  /** Power temperature coefficient, fraction per °C (0.0035 = 0.35 %/°C). */
  temperatureCoefficient: number;
  /** Cell temperature rise above ambient under irradiance, °C. */
  cellTempRise: number;
  /** DC + AC wiring losses (0–1). */
  wiringLoss: number;
  /** Charge controller / MPPT efficiency. */
  mpptEfficiency: number;
  /** Oversizing factor applied to the PV array (1.2 = 20%). */
  pvDesignMargin: number;
  /** Nameplate wattage of the reference PV module. */
  panelWattage: number;

  /** Future expansion headroom on the inverter (0.25 = 25%). */
  inverterExpansionMargin: number;
  /** Ratio of short-term surge rating to continuous rating for a typical hybrid inverter. */
  inverterSurgeRatio: number;
  /** Power factor used to express kW as kVA. */
  powerFactor: number;
  /** Standard inverter sizes available on the market, kW, ascending. */
  inverterSizesKw: number[];

  /** Coincidence factors: share of each priority group expected to run at the same time. */
  coincidence: Record<LoadPriority, number>;
  /** Share of each usage window's energy that falls outside solar hours. */
  nightFraction: Record<UsageWindow, number>;
  /** Hours per day without useful solar output; used to express night-time load in kW. */
  nightHours: number;
  /** Default backup hours required by grid condition. */
  backupHoursByGrid: Record<GridAvailability, number>;

  /** Optional savings model (shown only for NGN). */
  generatorLitresPerKwh: number;
  fuelPricePerLitre: number;
  co2KgPerKwh: number;
}

export interface SiteContext {
  peakSunHours: number;
  /** Mean ambient temperature, °C. Optional; enables regional temperature loss. */
  ambientTempC?: number | null;
  gridAvailability: GridAvailability;
  /** Overrides the grid-based default. */
  backupHours?: number | null;
}

export interface ApplianceBreakdown {
  name: string;
  category: ApplianceCategory;
  quantity: number;
  ratedWatts: number;
  hoursPerDay: number;
  dutyCycle: number;
  surgeFactor: number;
  priority: LoadPriority;
  dailyKwh: number;
}

/** Everything that can be shown before payment. */
export interface LoadSummary {
  applianceCount: number;
  connectedLoadKw: number;
  /** Expected simultaneous running load after coincidence. */
  peakLoadKw: number;
  /** Running load plus the largest single motor start. */
  surgePeakKw: number;
  dailyEnergyKwh: number;
  essentialLoadKw: number;
  importantLoadKw: number;
  heavyLoadKw: number;
  essentialDailyKwh: number;
  nightEnergyKwh: number;
  essentialNightEnergyKwh: number;
  breakdown: ApplianceBreakdown[];
  highPowerLoads: string[];
}

export interface BatteryTier {
  key: 'economy' | 'standard' | 'extended';
  label: string;
  nominalKwh: number;
  usableKwh: number;
  modules: number;
  /** Hours the tier can carry the average night-time load it is designed for. */
  backupHours: number;
  /** Which load the backup figure refers to. */
  coverage: 'essential' | 'full';
}

export interface SizingResult {
  summary: LoadSummary;
  pv: {
    peakSunHours: number;
    systemEfficiency: number;
    temperatureLoss: number;
    minimumKwp: number;
    recommendedKwp: number;
    panelWattage: number;
    panelCount: number;
    arrayKwp: number;
    dailyYieldKwh: number;
  };
  inverter: {
    requiredContinuousKw: number;
    requiredSurgeKw: number;
    recommendedKw: number;
    recommendedKva: number;
    surgeCapacityKw: number;
  };
  battery: {
    chemistry: 'LiFePO4';
    targetEnergyKwh: number;
    backupHoursTarget: number;
    tiers: BatteryTier[];
  };
  savings: {
    monthlyFuelSavings: number;
    co2TonnesPerYear: number;
  };
  assumptions: EngineeringSettings & SiteContext;
}

/** Limited recommendation shown before payment. */
export interface SizingTeaser {
  systemClass: string;
  inverterClassKva: number;
}
