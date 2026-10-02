/*
 * Regenerates supabase/migrations/20261002100000_global_countries_regions.sql.
 *
 * Needs the dataset package, which is a maintainer tool rather than a runtime
 * dependency, so install it on demand:
 *
 *   npm i --no-save country-state-city
 *   npm run geo:seed
 */
const { Country, State } = require('country-state-city');

/* -------------------------------------------------------------------------
 * Solar resource model
 *
 * There is no free global irradiance dataset we can bundle, so these are
 * modelled defaults: a latitude baseline for annual average daily GHI
 * (kWh/m²/day), adjusted by coarse climate boxes for the belts that deviate
 * most from the latitude average — deserts up, rainforest and maritime
 * climates down. They are starting points an admin refines per market, not
 * measurements. Nigeria's values are measured and are left untouched.
 * ---------------------------------------------------------------------- */

const PSH_BY_LAT = [[10, 4.9], [20, 5.3], [30, 5.4], [40, 4.7], [50, 3.6], [60, 2.9], [70, 2.3], [91, 1.9]];
const TEMP_BY_LAT = [[10, 26.5], [20, 26.0], [30, 22.0], [40, 17.0], [50, 11.0], [60, 7.0], [70, 2.0], [91, -8.0]];

// [latMin, latMax, lonMin, lonMax, pshDelta, tempDelta, label]
const CLIMATE = [
  [15, 35, -17, 60, 1.1, 4, 'Sahara and Arabian desert belt'],
  [40, 45, -10, 42, 0.8, 1, 'Mediterranean basin'],
  [-33, -17, 11, 30, 0.9, 1, 'Kalahari and Namib'],
  [-30, -5, -75, -65, 1.2, -2, 'Atacama and high Andes'],
  [-32, -18, 115, 145, 0.9, 3, 'Australian interior'],
  [24, 38, -120, -100, 0.8, 2, 'US Southwest and northern Mexico'],
  [28, 45, 50, 80, 0.6, 1, 'Iranian plateau and Central Asian deserts'],
  [0, 18, 32, 52, 0.8, 3, 'Horn of Africa'],
  [22, 33, 66, 78, 0.5, 3, 'Thar desert and Indus plain'],
  [28, 38, 78, 100, 1.0, -10, 'Tibetan plateau'],
  [-6, 5, 10, 30, -0.5, 0, 'Congo basin'],
  [-12, 5, -75, -45, -0.5, 0, 'Amazon basin'],
  [-10, 10, 95, 140, -0.4, 0, 'Maritime South East Asia'],
  [4, 8, -8, 10, -0.6, 0, 'Gulf of Guinea coast'],
  [45, 62, -11, 20, -0.15, 2, 'North West Europe'],
  [42, 60, -135, -118, -0.4, 2, 'Pacific North West'],
  [25, 45, 118, 146, -0.6, 0, 'East Asian humid subtropics'],
  [20, 28, 85, 95, -0.4, 2, 'Bay of Bengal monsoon'],
];

const pick = (table, absLat) => table.find(([max]) => absLat < max)[1];

function solar(lat, lon) {
  const absLat = Math.abs(lat);
  let psh = pick(PSH_BY_LAT, absLat);
  let temp = pick(TEMP_BY_LAT, absLat);
  if (lat < 0 && absLat > 30) temp += 1; // southern hemisphere is more maritime
  for (const [laMin, laMax, loMin, loMax, dP, dT] of CLIMATE) {
    if (lat >= laMin && lat <= laMax && lon >= loMin && lon <= loMax) { psh += dP; temp += dT; }
  }
  return {
    psh: Math.round(Math.min(7.0, Math.max(1.6, psh)) * 10) / 10,
    temp: Math.round(Math.min(35, Math.max(-15, temp))),
  };
}

/* ---------------------------------------------------------------------- */

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const clean = (s) => s.replace(/\s+/g, ' ').trim();

// Already seeded with measured values; do not touch.
const HAND_TUNED_COUNTRY = new Set(['NG', 'GH', 'KE', 'ZA', 'RW', 'UG', 'TZ']);
const SKIP_REGIONS_FOR = new Set(['NG']); // Nigeria's 37 states are complete and measured

// Dataset spellings that would duplicate a row already seeded by hand.
const RENAME = {
  'KE:Nairobi City': 'Nairobi',
  'RW:Kigali district': 'Kigali',
  'UG:Kampala District': 'Kampala',
};

const countries = Country.getAllCountries()
  .filter((c) => /^[A-Z]{2}$/.test(c.isoCode))
  .sort((a, b) => a.name.localeCompare(b.name));

const countryRows = [];
const regionRows = [];

for (const c of countries) {
  const lat = Number(c.latitude), lon = Number(c.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const s = solar(lat, lon);
  const currency = /^[A-Z]{3}$/.test(c.currency || '') ? c.currency : 'USD';

  if (!HAND_TUNED_COUNTRY.has(c.isoCode)) {
    countryRows.push(`  (${q(c.isoCode)}, ${q(clean(c.name))}, ${q(currency)}, ${s.psh}, ${s.temp}, 100)`);
  }
  if (SKIP_REGIONS_FOR.has(c.isoCode)) continue;

  const seen = new Set();
  for (const st of State.getStatesOfCountry(c.isoCode)) {
    let name = clean(st.name);
    name = RENAME[`${c.isoCode}:${name}`] ?? name;
    if (!name || name.length > 80 || seen.has(name)) continue;
    seen.add(name);
    const slat = Number(st.latitude), slon = Number(st.longitude);
    const r = Number.isFinite(slat) && Number.isFinite(slon) ? solar(slat, slon) : s;
    regionRows.push(`  (${q(c.isoCode)}, ${q(name)}, ${r.psh}, ${r.temp})`);
  }
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const out = [];
out.push(`-- =============================================================================
-- Global countries and regions
--
-- Replaces the seven-country African seed with every ISO 3166-1 country and
-- its ISO 3166-2 subdivisions, so the calculator works anywhere. Selecting a
-- country in the calculator loads that country's regions.
--
-- Peak sun hours and ambient temperatures are MODELLED defaults: a latitude
-- baseline adjusted by coarse climate belts (deserts up, rainforest and
-- maritime climates down). They are good enough to size a system sensibly and
-- are editable in Admin -> Regions & sun hours. Nigeria's 37 states keep their
-- measured values and are not touched by this migration, and the six other
-- African markets keep their hand-set country defaults.
--
-- Idempotent: every insert is "on conflict do nothing".
-- =============================================================================
`);

out.push('-- Countries ------------------------------------------------------------------');
for (const part of chunk(countryRows, 40)) {
  out.push('insert into public.countries (code, name, currency, default_peak_sun_hours, default_ambient_temp_c, sort_order) values');
  out.push(part.join(',\n') + '\non conflict (code) do nothing;\n');
}

out.push(`-- Keep the seven African markets at the top of the country list.
update public.countries set sort_order = 100 where sort_order = 0;
`);

out.push('-- Regions --------------------------------------------------------------------');
for (const part of chunk(regionRows, 300)) {
  out.push('insert into public.regions (country_code, name, peak_sun_hours, ambient_temp_c) values');
  out.push(part.join(',\n') + '\non conflict (country_code, name) do nothing;\n');
}

out.push(`-- Customers outside Nigeria should be charged in USD rather than naira.
update public.site_settings
   set value = value || '{"fallbackCurrency": "USD"}'::jsonb
 where key = 'consultation';
`);

require('fs').writeFileSync(process.argv[2], out.join('\n'));
console.log(`countries: ${countryRows.length} new, regions: ${regionRows.length}`);
