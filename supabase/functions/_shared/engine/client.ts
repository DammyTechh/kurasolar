/**
 * Browser entry point. Exposes only what may be shown before payment.
 * Do not re-export sizing.ts from here.
 */
export * from './types.ts';
export { DEFAULT_ENGINEERING, resolveSettings } from './defaults.ts';
export { applianceDailyKwh, defaultUsageWindow, effectiveHours, sanitizeAppliance, summarizeLoad } from './load.ts';
