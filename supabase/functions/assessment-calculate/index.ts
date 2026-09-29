/**
 * POST /functions/v1/assessment-calculate
 * Runs the calculation engine on the server, stores the assessment and its
 * full result, and returns only the pre-payment summary and teaser.
 */
import { admin, rateLimit, requireCaller } from '../_shared/db.ts';
import { type ApplianceInput, calculateSystem, resolveSettings, sanitizeAppliance, teaserFor } from '../_shared/engine/index.ts';
import { handler, HttpError, json, readJson } from '../_shared/http.ts';
import { recommendProducts } from '../_shared/recommend.ts';
import { getSettings } from '../_shared/settings.ts';
import { oneOf, str } from '../_shared/validate.ts';

const ENGINE_VERSION = '2026.09';
const GRID = ['reliable', 'intermittent', 'poor', 'none'] as const;

Deno.serve(handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const caller = await requireCaller(req);
  await rateLimit(`calc:${caller.user.id}`, 40, 3600);

  const body = await readJson<{
    assessment_id?: string;
    location?: Record<string, unknown>;
    customer?: Record<string, unknown>;
    appliances?: ApplianceInput[];
  }>(req);

  const loc = body.location ?? {};
  const customer = body.customer ?? {};
  const rawAppliances = Array.isArray(body.appliances) ? body.appliances : [];
  if (!rawAppliances.length) throw new HttpError(422, 'Add at least one appliance.');
  if (rawAppliances.length > 200) throw new HttpError(422, 'An assessment can hold up to 200 appliance lines.');
  const appliances = rawAppliances.map(sanitizeAppliance);

  const country = str(loc, 'country', { max: 80 }) ?? 'Nigeria';
  const state = str(loc, 'state', { max: 80 });
  const grid = oneOf(loc.gridAvailability, GRID, 'intermittent');
  const backupRaw = Number(loc.backupHours);
  const backupHours = Number.isFinite(backupRaw) && backupRaw > 0 ? Math.min(72, backupRaw) : null;
  const isDiaspora = Boolean(loc.isDiaspora);
  const recipient = isDiaspora && loc.recipient && typeof loc.recipient === 'object'
    ? {
      name: str(loc.recipient as Record<string, unknown>, 'name', { max: 120 }),
      phone: str(loc.recipient as Record<string, unknown>, 'phone', { max: 32 }),
      location: str(loc.recipient as Record<string, unknown>, 'location', { max: 200 }),
      relationship: str(loc.recipient as Record<string, unknown>, 'relationship', { max: 60 }),
    }
    : null;

  // Regional solar resource from the admin-managed tables.
  const db = admin();
  const { data: countryRow } = await db.from('countries').select('code, currency, default_peak_sun_hours, default_ambient_temp_c')
    .eq('name', country).maybeSingle();
  let psh = Number(countryRow?.default_peak_sun_hours ?? 5);
  let ambient: number | null = countryRow?.default_ambient_temp_c != null ? Number(countryRow.default_ambient_temp_c) : null;
  if (countryRow && state) {
    const { data: region } = await db.from('regions').select('peak_sun_hours, ambient_temp_c')
      .eq('country_code', countryRow.code).eq('name', state).maybeSingle();
    if (region) {
      psh = Number(region.peak_sun_hours);
      ambient = region.ambient_temp_c != null ? Number(region.ambient_temp_c) : ambient;
    }
  }

  const { engineering } = await getSettings('engineering');
  const settings = resolveSettings(engineering);
  const result = calculateSystem(appliances, { peakSunHours: psh, ambientTempC: ambient, gridAvailability: grid, backupHours }, settings);
  const teaser = teaserFor(result);
  const recommendation = await recommendProducts(result, settings.powerFactor);
  const standard = result.battery.tiers.find((t) => t.key === 'standard')!;

  const record = {
    user_id: caller.user.id,
    customer_name: str(customer, 'name', { max: 120 }) ?? caller.profile.full_name,
    customer_email: caller.user.email ?? caller.profile.email,
    customer_phone: str(customer, 'phone', { max: 32 }) ?? caller.profile.phone,
    country,
    state,
    city: str(loc, 'city', { max: 80 }),
    postcode: str(loc, 'postcode', { max: 20 }),
    grid_availability: grid,
    backup_hours: backupHours,
    currency: countryRow?.currency ?? 'NGN',
    property_type: str(loc, 'propertyType', { max: 40 }),
    is_diaspora: isDiaspora,
    recipient,
    appliance_count: result.summary.applianceCount,
    connected_load_kw: result.summary.connectedLoadKw,
    peak_load_kw: result.summary.peakLoadKw,
    surge_peak_kw: result.summary.surgePeakKw,
    daily_energy_kwh: result.summary.dailyEnergyKwh,
    essential_load_kw: result.summary.essentialLoadKw,
    heavy_load_kw: result.summary.heavyLoadKw,
    system_class: teaser.systemClass,
    inverter_class_kva: teaser.inverterClassKva,
  };

  // Re-calculating an unpaid assessment updates it; paid assessments are immutable.
  let assessmentId: string | null = null;
  if (body.assessment_id) {
    const { data: existing } = await db.from('assessments').select('id, user_id, status').eq('id', body.assessment_id).maybeSingle();
    if (existing && existing.user_id === caller.user.id && existing.status === 'calculated') assessmentId = existing.id;
  }

  let saved: { id: string; code: string; status: string };
  if (assessmentId) {
    const { data, error } = await db.from('assessments').update(record).eq('id', assessmentId).select('id, code, status').single();
    if (error) throw error;
    saved = data;
    await db.from('assessment_appliances').delete().eq('assessment_id', assessmentId);
  } else {
    const { data, error } = await db.from('assessments').insert(record).select('id, code, status').single();
    if (error) throw error;
    saved = data;
  }

  const { error: appErr } = await db.from('assessment_appliances').insert(
    appliances.map((a, i) => ({
      assessment_id: saved.id,
      position: i,
      category: a.category,
      name: a.name,
      quantity: a.quantity,
      rated_watts: a.ratedWatts,
      horsepower: a.horsepower ?? null,
      hours_per_day: a.hoursPerDay,
      days_per_week: a.daysPerWeek ?? 7,
      cycles_per_day: a.cyclesPerDay ?? 1,
      duty_cycle: a.dutyCycle,
      surge_factor: a.surgeFactor,
      priority: a.priority,
      usage_window: a.usageWindow ?? 'anytime',
      inverter_technology: a.inverterTechnology ?? false,
      attributes: a.attributes ?? null,
      daily_kwh: result.summary.breakdown[i].dailyKwh,
    })),
  );
  if (appErr) throw appErr;

  const { error: resErr } = await db.from('assessment_results').upsert({
    assessment_id: saved.id,
    result,
    recommended_pv_kwp: result.pv.arrayKwp,
    recommended_inverter_kw: result.inverter.recommendedKw,
    recommended_inverter_kva: result.inverter.recommendedKva,
    recommended_battery_kwh: standard.nominalKwh,
    recommended_products: recommendation,
    engine_version: ENGINE_VERSION,
    report_path: null,
    report_generated_at: null,
  });
  if (resErr) throw resErr;

  const { breakdown: _omit, ...summary } = result.summary;
  return json(req, { id: saved.id, code: saved.code, status: saved.status, summary, teaser });
}));
