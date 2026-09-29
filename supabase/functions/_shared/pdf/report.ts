import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, StandardFonts } from '../deps.ts';
import type { SizingResult } from '../engine/index.ts';
import type { RecommendedItem } from '../recommend.ts';

export interface ReportInput {
  company: { name: string; legalName?: string; email: string; phone: string; address: string; reportSignatory?: string };
  brand: { primary: string; primaryDark: string; accent: string; surface: string; ink: string };
  logo?: { bytes: Uint8Array; type: 'png' | 'jpg' } | null;
  assessment: {
    code: string;
    created_at: string;
    paid_at: string | null;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    country: string;
    state: string | null;
    city: string | null;
    grid_availability: string;
    property_type: string | null;
    is_diaspora: boolean;
    recipient: { name?: string; phone?: string; location?: string; relationship?: string } | null;
  };
  appliances: { name: string; quantity: number; rated_watts: number; hours_per_day: number; daily_kwh: number; priority: string }[];
  result: SizingResult;
  products: RecommendedItem[];
  disclaimer: string;
}

/* ---------- helpers ---------- */

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // page margin

function hex(color: string) {
  const c = color.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Standard PDF fonts only cover WinAnsi; map or drop anything else. */
function clean(s: unknown): string {
  return String(s ?? '')
    .replace(/₦/g, 'NGN ')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/≈/g, '~')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2022\u2026\u20AC]/g, '');
}

const n = (v: number, dp = 1) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: dp, minimumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${n(v * 100, 1)}%`;
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }) : '—';

class Writer {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  constructor(public doc: PDFDocument, public regular: PDFFont, public bold: PDFFont, public input: ReportInput) {}

  get c() {
    const b = this.input.brand;
    return { primary: hex(b.primary), dark: hex(b.primaryDark), accent: hex(b.accent), surface: hex(b.surface), ink: hex(b.ink), muted: rgb(0.42, 0.37, 0.47), line: rgb(0.91, 0.88, 0.94) };
  }

  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.pages.push(this.page);
    this.y = A4.h - M;
  }

  ensure(space: number) {
    if (this.y - space < M + 30) this.newPage();
  }

  text(s: string, x: number, y: number, size: number, opts: { font?: PDFFont; color?: ReturnType<typeof rgb>; maxWidth?: number } = {}) {
    this.page.drawText(clean(s), { x, y, size, font: opts.font ?? this.regular, color: opts.color ?? this.c.ink, maxWidth: opts.maxWidth });
  }

  wrap(s: string, size: number, width: number, font = this.regular): string[] {
    const words = clean(s).split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  paragraph(s: string, size = 10, gap = 6, color = this.c.ink) {
    for (const block of s.split(/\n+/)) {
      for (const line of this.wrap(block, size, A4.w - 2 * M)) {
        this.ensure(size + 4);
        this.text(line, M, this.y - size, size, { color });
        this.y -= size * 1.5;
      }
      this.y -= gap;
    }
  }

  heading(s: string) {
    this.ensure(48);
    this.y -= 10;
    this.page.drawRectangle({ x: M, y: this.y - 16, width: 3, height: 16, color: this.c.accent });
    this.text(s, M + 12, this.y - 13, 14, { font: this.bold, color: this.c.dark });
    this.y -= 30;
  }

  /** Two-column label/value grid. */
  facts(rows: [string, string][], cols = 2) {
    const colW = (A4.w - 2 * M) / cols;
    for (let i = 0; i < rows.length; i += cols) {
      this.ensure(36);
      rows.slice(i, i + cols).forEach(([k, v], j) => {
        const x = M + j * colW;
        this.text(k, x, this.y - 9, 8.5, { color: this.c.muted });
        this.text(v, x, this.y - 24, 11.5, { font: this.bold, color: this.c.dark, maxWidth: colW - 10 });
      });
      this.y -= 38;
    }
  }

  table(headers: string[], rows: string[][], widths: number[], align: ('l' | 'r')[] = []) {
    const total = A4.w - 2 * M;
    const w = widths.map((x) => x * total);
    const rowH = 20;
    const drawHeader = () => {
      this.page.drawRectangle({ x: M, y: this.y - rowH, width: total, height: rowH, color: this.c.surface });
      let x = M;
      headers.forEach((h, i) => {
        const tw = this.bold.widthOfTextAtSize(clean(h), 8.5);
        this.text(h, align[i] === 'r' ? x + w[i] - tw - 6 : x + 6, this.y - 13.5, 8.5, { font: this.bold, color: this.c.dark });
        x += w[i];
      });
      this.y -= rowH;
    };
    this.ensure(rowH * 2);
    drawHeader();
    for (const row of rows) {
      if (this.y - rowH < M + 30) {
        this.newPage();
        drawHeader();
      }
      let x = M;
      row.forEach((cell, i) => {
        let s = clean(cell);
        while (s.length > 1 && this.regular.widthOfTextAtSize(s, 9) > w[i] - 12) s = s.slice(0, -2) + '…';
        const tw = this.regular.widthOfTextAtSize(s, 9);
        this.text(s, align[i] === 'r' ? x + w[i] - tw - 6 : x + 6, this.y - 13.5, 9);
        x += w[i];
      });
      this.page.drawLine({ start: { x: M, y: this.y - rowH }, end: { x: M + total, y: this.y - rowH }, thickness: 0.5, color: this.c.line });
      this.y -= rowH;
    }
    this.y -= 12;
  }
}

/* ---------- report ---------- */

export async function buildReport(input: ReportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Solar load assessment ${input.assessment.code}`);
  doc.setAuthor(input.company.name);
  doc.setCreator(input.company.name);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let logo: PDFImage | null = null;
  if (input.logo) {
    try {
      logo = input.logo.type === 'png' ? await doc.embedPng(input.logo.bytes) : await doc.embedJpg(input.logo.bytes);
    } catch (err) {
      console.error('Logo could not be embedded', err);
    }
  }

  const w = new Writer(doc, regular, bold, input);
  const { assessment: a, result: r } = input;
  const s = r.summary;
  const location = [a.city, a.state, a.country].filter(Boolean).join(', ');
  const standard = r.battery.tiers.find((t) => t.key === 'standard')!;

  /* Cover */
  w.newPage();
  if (logo) {
    const scale = 150 / logo.width;
    w.page.drawImage(logo, { x: M, y: A4.h - M - logo.height * scale, width: 150, height: logo.height * scale });
  } else {
    w.text(input.company.name, M, A4.h - M - 20, 20, { font: bold, color: w.c.dark });
  }
  w.page.drawRectangle({ x: 0, y: A4.h - 150, width: A4.w, height: 4, color: w.c.accent });

  w.text('Residential Solar Energy', M, 560, 30, { font: bold, color: w.c.dark });
  w.text('Load Assessment', M, 522, 30, { font: bold, color: w.c.primary });
  w.text(`Prepared for ${a.customer_name ?? 'Customer'}`, M, 486, 13, { color: w.c.ink });
  w.text(location, M, 468, 11, { color: w.c.muted });

  // Key figures band
  w.page.drawRectangle({ x: M, y: 330, width: A4.w - 2 * M, height: 100, color: w.c.surface });
  const figures: [string, string][] = [
    ['Daily energy', `${n(s.dailyEnergyKwh)} kWh`],
    ['Solar PV', `${n(r.pv.arrayKwp, 2)} kWp`],
    ['Inverter', `${n(r.inverter.recommendedKw)} kW`],
    ['Battery', `${n(standard.nominalKwh)} kWh`],
  ];
  const fw = (A4.w - 2 * M) / 4;
  figures.forEach(([k, v], i) => {
    w.text(k, M + 18 + i * fw, 400, 9, { color: w.c.muted });
    w.text(v, M + 18 + i * fw, 372, 17, { font: bold, color: w.c.dark });
  });

  w.y = 290;
  w.facts([
    ['Assessment ID', a.code],
    ['Date', date(a.paid_at ?? a.created_at)],
    ['Grid supply', titleCase(a.grid_availability)],
    ['Property', a.property_type ? titleCase(a.property_type) : 'Residential'],
  ]);
  w.text('Preliminary automated estimate — final system design requires professional engineering assessment.', M, M + 40, 8.5, { color: w.c.muted });
  w.text(`${input.company.legalName ?? input.company.name}  |  ${input.company.email}  |  ${input.company.phone}`, M, M + 24, 8.5, { color: w.c.muted });

  /* Customer */
  w.newPage();
  w.heading('Customer information');
  w.facts([
    ['Name', a.customer_name ?? '—'],
    ['Email', a.customer_email ?? '—'],
    ['Phone', a.customer_phone ?? '—'],
    ['Location', location || '—'],
  ]);
  if (a.is_diaspora && a.recipient) {
    w.paragraph('This system is being designed on behalf of someone else. Recipient details:', 9.5, 4, w.c.muted);
    w.facts([
      ['Recipient', a.recipient.name ?? '—'],
      ['Recipient phone', a.recipient.phone ?? '—'],
      ['Property location', a.recipient.location ?? '—'],
      ['Relationship', a.recipient.relationship ?? '—'],
    ]);
  }

  /* Appliances */
  w.heading('Appliance inventory');
  w.table(
    ['Appliance', 'Qty', 'Rated W', 'Hours/day', 'Daily kWh', 'Priority'],
    input.appliances.map((x) => [x.name, String(x.quantity), n(x.rated_watts, 0), n(x.hours_per_day, 2), n(x.daily_kwh, 2), titleCase(x.priority)]),
    [0.36, 0.08, 0.13, 0.13, 0.14, 0.16],
    ['l', 'r', 'r', 'r', 'r', 'l'],
  );

  /* Load summary */
  w.heading('Load summary');
  w.facts([
    ['Connected load', `${n(s.connectedLoadKw, 2)} kW`],
    ['Estimated peak (running)', `${n(s.peakLoadKw, 2)} kW`],
    ['Peak including motor start', `${n(s.surgePeakKw, 2)} kW`],
    ['Average daily consumption', `${n(s.dailyEnergyKwh, 2)} kWh`],
    ['Night-time consumption', `${n(s.nightEnergyKwh, 2)} kWh`],
    ['Essential load', `${n(s.essentialLoadKw, 2)} kW`],
    ['Important load', `${n(s.importantLoadKw, 2)} kW`],
    ['Heavy / optional load', `${n(s.heavyLoadKw, 2)} kW`],
  ]);
  if (s.highPowerLoads.length) {
    w.paragraph(`High-power loads identified: ${s.highPowerLoads.join(', ')}. Run these during sunshine hours where possible to protect battery life.`, 9.5, 8, w.c.muted);
  }

  /* Recommendation */
  w.heading('Solar recommendation');
  w.facts([
    ['PV array (recommended)', `${n(r.pv.arrayKwp, 2)} kWp`],
    ['Panels', `${r.pv.panelCount} × ${r.pv.panelWattage} W`],
    ['PV minimum (no margin)', `${n(r.pv.minimumKwp, 2)} kWp`],
    ['Expected daily yield', `${n(r.pv.dailyYieldKwh)} kWh`],
    ['Inverter', `${n(r.inverter.recommendedKw)} kW / ${n(r.inverter.recommendedKva)} kVA`],
    ['Inverter surge capacity', `${n(r.inverter.surgeCapacityKw)} kW`],
    ['Battery chemistry', r.battery.chemistry],
    ['Backup target', `${n(r.battery.backupHoursTarget)} hours`],
  ]);
  w.table(
    ['Battery option', 'Nominal kWh', 'Usable kWh', 'Modules', 'Est. backup', 'Covers'],
    r.battery.tiers.map((t) => [t.label, n(t.nominalKwh, 2), n(t.usableKwh, 2), String(t.modules), `${n(t.backupHours)} h`, t.coverage === 'essential' ? 'Essential loads' : 'Full load']),
    [0.22, 0.15, 0.15, 0.12, 0.15, 0.21],
    ['l', 'r', 'r', 'r', 'r', 'l'],
  );

  /* Assumptions */
  w.heading('System assumptions');
  const as = r.assumptions;
  w.table(
    ['Assumption', 'Value'],
    [
      ['Peak sun hours (site)', `${n(as.peakSunHours, 2)} h/day`],
      ['PV system efficiency', pct(r.pv.systemEfficiency)],
      ['Temperature loss', pct(r.pv.temperatureLoss)],
      ['PV design margin', pct(as.pvDesignMargin - 1)],
      ['Battery depth of discharge', pct(as.batteryDoD)],
      ['Battery round-trip efficiency', pct(as.batteryEfficiency)],
      ['Inverter efficiency', pct(as.inverterEfficiency)],
      ['Battery reserve margin', pct(as.batteryReserveMargin - 1)],
      ['Inverter expansion margin', pct(as.inverterExpansionMargin)],
      ['Coincidence (essential / important / heavy)', `${pct(as.coincidence.essential)} / ${pct(as.coincidence.important)} / ${pct(as.coincidence.heavy)}`],
    ],
    [0.65, 0.35],
    ['l', 'r'],
  );

  /* Recommended system */
  w.heading('Recommended system');
  if (input.products.length) {
    w.table(
      ['Item', 'Qty', 'Why'],
      input.products.map((p) => [p.name, String(p.quantity), p.reason]),
      [0.46, 0.08, 0.46],
      ['l', 'r', 'l'],
    );
  }
  w.table(
    ['Component', 'Specification'],
    [
      ['Solar panels', `${r.pv.panelCount} × ${r.pv.panelWattage} W modules, ${n(r.pv.arrayKwp, 2)} kWp`],
      ['Inverter', `${n(r.inverter.recommendedKw)} kW hybrid, surge >= ${n(r.inverter.requiredSurgeKw, 1)} kW`],
      ['Battery', `${n(standard.nominalKwh)} kWh LiFePO4 (${standard.modules} × ${n(as.batteryModuleKwh, 2)} kWh)`],
      ['Protection', 'DC/AC breakers, surge protection devices, DC isolator, fusing'],
      ['Cables', 'UV-rated PV cable, battery cables sized to inverter current, earthing'],
      ['Mounting', 'Corrosion-resistant roof or ground mounting for all modules'],
      ['Installation', 'By a qualified installer, including commissioning and handover'],
    ],
    [0.25, 0.75],
  );

  /* Notes */
  w.heading('Engineering notes');
  w.paragraph(
    'Daily energy for each appliance is calculated as rated power × hours × quantity × duty cycle × days per week ÷ 7. ' +
      'Compressor loads use duty cycles so they are not counted as running continuously. Peak demand applies coincidence factors per load priority, ' +
      'and the inverter is sized to carry that peak with expansion headroom while absorbing the largest single motor start within its surge rating. ' +
      'Battery capacity covers night-time consumption or the backup target for your grid supply, whichever is greater, after depth of discharge, ' +
      'battery and inverter losses.',
    9.5,
  );
  w.paragraph(input.disclaimer, 9, 8, w.c.muted);

  w.heading('Consultation notice');
  w.paragraph('Final system sizing should be validated through an on-site engineering assessment before procurement or installation.', 10.5);
  w.paragraph(`Prepared by ${input.company.reportSignatory ?? input.company.name}.`, 9.5, 4, w.c.muted);

  /* Footer on every page */
  w.pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: M, y: M }, end: { x: A4.w - M, y: M }, thickness: 0.5, color: w.c.line });
    pg.drawText(clean(`${input.company.name}  |  ${a.code}`), { x: M, y: M - 14, size: 8, font: regular, color: w.c.muted });
    const label = `Page ${i + 1} of ${w.pages.length}`;
    pg.drawText(label, { x: A4.w - M - regular.widthOfTextAtSize(label, 8), y: M - 14, size: 8, font: regular, color: w.c.muted });
  });

  return await doc.save();
}
