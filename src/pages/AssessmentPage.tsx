import type { BatteryTier } from '@engine';
import { useQuery } from '@tanstack/react-query';
import { BatteryCharging, Download, FileText, Lock, PanelsTopLeft, Pencil, ShieldCheck, ShoppingBag, Sun, Wrench, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, EmptyState, Spinner, StatusBadge } from '@/components/ui/Misc';
import { ProductArt } from '@/components/shop/ProductArt';
import { errorMessage, invoke } from '@/lib/api';
import { cn } from '@/lib/cn';
import { date, money, num, sentence } from '@/lib/format';
import { useSeo } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import type { Assessment, AssessmentAppliance, AssessmentResult } from '@/lib/types';
import { useContextualWhatsapp } from '@/lib/whatsappStore';
import { useCart } from '@/providers/CartProvider';
import { useSite } from '@/providers/SiteProvider';
import { useToast } from '@/providers/ToastProvider';

export function useAssessment(id?: string) {
  return useQuery({
    queryKey: ['assessment', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data: a, error } = await supabase.from('assessments').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      if (!a) return null;
      const [apps, res] = await Promise.all([
        supabase.from('assessment_appliances').select('*').eq('assessment_id', id!).order('position'),
        // Row-level security only returns this row once the assessment is paid.
        supabase.from('assessment_results').select('*').eq('assessment_id', id!).maybeSingle(),
      ]);
      return {
        assessment: a as Assessment,
        appliances: (apps.data ?? []) as AssessmentAppliance[],
        result: (res.data ?? null) as AssessmentResult | null,
      };
    },
  });
}

export default function AssessmentPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useAssessment(id);
  useSeo({ title: data?.assessment ? `Assessment ${data.assessment.code}` : 'Your assessment', noindex: true });

  const a = data?.assessment;
  const r = data?.result;
  const std = r?.result.battery.tiers.find((t) => t.key === 'standard');
  useContextualWhatsapp(
    a
      ? r
        ? `Hello, I completed solar assessment ${a.code} and would like to discuss a ${r.recommended_inverter_kw} kW inverter + ${num(std?.nominalKwh ?? r.recommended_battery_kwh)} kWh battery system.`
        : `Hello, I completed solar assessment ${a.code} (${a.system_class ?? ''}) and have a question before unlocking the report.`
      : null,
  );

  if (isLoading) return <Spinner label="Loading your assessment" />;
  if (error || !a) {
    return (
      <div className="container-page py-16">
        <EmptyState title="Assessment not found" text="It may belong to another account. Sign in with the email you used for the calculation." action={<ButtonLink to="/account/assessments" variant="secondary">My assessments</ButtonLink>} />
      </div>
    );
  }

  return (
    <div className="bg-surface/60 pb-16">
      <div className="container-page pt-8 sm:pt-12">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <Link to="/account/assessments" className="hover:text-primary">My assessments</Link>
          <span aria-hidden>/</span>
          <span className="num">{a.code}</span>
          <StatusBadge status={a.status} />
        </div>
        {a.status === 'paid' && r ? <PaidView a={a} r={r} appliances={data.appliances} /> : <LockedView a={a} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Figure({ icon, label, value, unit, sub, className }: { icon: React.ReactNode; label: string; value: string; unit?: string; sub?: string; className?: string }) {
  return (
    <div className={cn('rounded-[var(--radius-card)] border border-line bg-white p-5', className)}>
      <div className="flex items-center gap-2 text-sm text-muted">{icon}{label}</div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="num text-3xl font-bold tracking-tight">{value}</span>
        {unit && <span className="text-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

function LockedView({ a }: { a: Assessment }) {
  const { settings } = useSite();
  const toast = useToast();
  const c = settings.consultation;
  const currencies = c.paymentCurrencies.filter((cur) => c.fees[cur] > 0);
  const initial = currencies.includes(a.currency) ? a.currency : a.is_diaspora && currencies.includes('USD') ? 'USD' : currencies.includes(c.defaultCurrency) ? c.defaultCurrency : currencies[0] ?? 'NGN';
  const [currency, setCurrency] = useState(initial);
  const [busy, setBusy] = useState(false);
  const fee = c.fees[currency] ?? 0;

  const pay = async () => {
    setBusy(true);
    try {
      const res = await invoke<{ authorization_url: string }>('payment-initialize', { purpose: 'consultation', assessment_id: a.id, currency });
      window.location.assign(res.authorization_url);
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mt-6 max-w-2xl">
        <h1 className="text-[1.75rem] leading-tight sm:text-4xl">Your solar assessment is ready.</h1>
        <p className="mt-2 text-muted">
          {[a.city, a.state, a.country].filter(Boolean).join(', ')}, {a.appliance_count} appliance{a.appliance_count === 1 ? '' : 's'}, calculated {date(a.created_at)}.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure icon={<Zap className="size-4" />} label="Daily consumption" value={num(a.daily_energy_kwh)} unit="kWh" />
        <Figure icon={<Zap className="size-4" />} label="Estimated peak load" value={num(a.peak_load_kw, 2)} unit="kW" sub={`${num(a.surge_peak_kw, 2)} kW with motor start`} />
        <Figure icon={<Zap className="size-4" />} label="Connected load" value={num(a.connected_load_kw, 2)} unit="kW" />
        <Figure icon={<ShieldCheck className="size-4" />} label="System class" value={a.system_class ?? '—'} sub={a.inverter_class_kva ? `Around ${num(a.inverter_class_kva)} kVA inverter class` : undefined} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <h2 className="text-xl">Inside your full report</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2" aria-hidden>
            {[
              { icon: <Sun className="size-4" />, label: 'Solar PV array', v: '8.8 kWp', s: '16 × 550 W panels' },
              { icon: <Zap className="size-4" />, label: 'Inverter', v: '8 kW', s: '10 kVA class' },
              { icon: <BatteryCharging className="size-4" />, label: 'Battery options', v: '20.5 kWh', s: 'Economy, standard, extended' },
              { icon: <PanelsTopLeft className="size-4" />, label: 'Backup time', v: '14 h', s: 'Per battery option' },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl bg-surface p-4">
                <div className="flex items-center gap-2 text-sm text-muted">{f.icon}{f.label}</div>
                <p className="num mt-2 text-2xl font-bold blur-[7px] select-none">{f.v}</p>
                <p className="text-sm text-muted blur-[5px] select-none">{f.s}</p>
              </div>
            ))}
          </div>
          <ul className="mt-6 grid gap-2.5 text-sm text-ink/85 sm:grid-cols-2">
            {['Full appliance inventory and daily energy', 'PV, inverter and battery sizing', 'Three battery options with backup times', 'Matched equipment list from our stock', 'Engineering assumptions and notes', 'Professional PDF you can share'].map((t) => (
              <li key={t} className="flex items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-accent" />{t}</li>
            ))}
          </ul>
          <div className="mt-6">
            <ButtonLink to="/solar-calculator" variant="ghost" size="sm" icon={<Pencil className="size-4" />} className="-ml-4">Edit appliances and recalculate</ButtonLink>
          </div>
        </Card>

        <Card className="border-primary/30 p-6 sm:p-8 lg:sticky lg:top-24">
          <div className="grid size-11 place-items-center rounded-full bg-primary text-white"><Lock className="size-5" /></div>
          <h2 className="mt-4 text-xl">Unlock your complete professional load assessment</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">One-off consultation fee. Your report unlocks as soon as Paystack confirms the payment with our server.</p>
          {currencies.length > 1 && (
            <div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Currency">
              {currencies.map((cur) => (
                <button key={cur} type="button" role="radio" aria-checked={currency === cur} onClick={() => setCurrency(cur)} className={cn('rounded-xl border px-3 py-2.5 text-left text-sm', currency === cur ? 'border-primary bg-tint' : 'border-line')}>
                  <span className="block text-xs text-muted">{cur}</span>
                  <span className="num font-medium">{money(c.fees[cur], cur)}</span>
                </button>
              ))}
            </div>
          )}
          <Button size="lg" className="mt-6 w-full" onClick={pay} loading={busy} disabled={!fee}>
            Pay {money(fee, currency)} & unlock report
          </Button>
          <p className="mt-3 text-center text-xs text-muted">Card, bank transfer or USSD via Paystack</p>
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm font-medium">Need an installer now?</p>
            <p className="mt-1 text-sm text-muted">You can request one without paying for the report.</p>
            <ButtonLink to={`/solar-installers/request?assessment=${a.id}`} variant="secondary" size="sm" className="mt-3">Connect me with an installer</ButtonLink>
          </div>
        </Card>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function PaidView({ a, r, appliances }: { a: Assessment; r: AssessmentResult; appliances: AssessmentAppliance[] }) {
  const toast = useToast();
  const cart = useCart();
  const { settings } = useSite();
  const [downloading, setDownloading] = useState(false);
  const res = r.result;
  const std = res.battery.tiers.find((t) => t.key === 'standard');
  const items = r.recommended_products?.items ?? [];
  const itemsTotal = useMemo(() => items.reduce((s, i) => s + i.unit_price * i.quantity, 0), [items]);

  const download = async () => {
    setDownloading(true);
    try {
      const out = await invoke<{ url: string; filename: string }>('report-download', { assessment_id: a.id });
      const link = document.createElement('a');
      link.href = out.url;
      link.download = out.filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setDownloading(false);
    }
  };

  const addAll = () => {
    items.forEach((i) => cart.add({ product_id: i.product_id, slug: i.slug, name: i.name, price: i.unit_price, role: i.role }, i.quantity));
    cart.setOpen(true);
  };

  return (
    <>
      <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-[1.75rem] leading-tight sm:text-4xl">Your recommended system</h1>
          <p className="mt-2 text-muted">
            {a.customer_name ? `${a.customer_name}, ` : ''}{[a.city, a.state, a.country].filter(Boolean).join(', ')}. Paid {date(a.paid_at)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download} loading={downloading} icon={<Download className="size-4" />}>Download PDF report</Button>
          <ButtonLink to={`/solar-installers/request?assessment=${a.id}`} variant="secondary" icon={<Wrench className="size-4" />}>Request installation</ButtonLink>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure icon={<Sun className="size-4" />} label="Solar PV" value={num(res.pv.arrayKwp, 2)} unit="kWp" sub={`${res.pv.panelCount} × ${res.pv.panelWattage} W panels`} className="border-primary/30" />
        <Figure icon={<Zap className="size-4" />} label="Inverter" value={num(res.inverter.recommendedKw)} unit="kW" sub={`${num(res.inverter.recommendedKva)} kVA class, surge ${num(res.inverter.surgeCapacityKw)} kW`} className="border-primary/30" />
        <Figure icon={<BatteryCharging className="size-4" />} label="Battery (standard)" value={num(std?.nominalKwh ?? 0)} unit="kWh" sub={`${res.battery.chemistry}, ${std?.modules ?? 0} modules`} className="border-primary/30" />
        <Figure icon={<PanelsTopLeft className="size-4" />} label="Estimated backup" value={num(std?.backupHours ?? 0)} unit="hours" sub="Average night-time load" className="border-primary/30" />
      </div>

      <p className="mt-4 rounded-xl bg-accent/10 px-4 py-3 text-sm text-ink/85">
        Preliminary automated estimate. Final system design requires a professional engineering assessment.
      </p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl">Load summary</h2>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {[
              ['Connected load', `${num(res.summary.connectedLoadKw, 2)} kW`],
              ['Peak running load', `${num(res.summary.peakLoadKw, 2)} kW`],
              ['Peak with motor start', `${num(res.summary.surgePeakKw, 2)} kW`],
              ['Daily consumption', `${num(res.summary.dailyEnergyKwh)} kWh`],
              ['After-sunset energy', `${num(res.summary.nightEnergyKwh)} kWh`],
              ['Essential load', `${num(res.summary.essentialLoadKw, 2)} kW`],
              ['Important load', `${num(res.summary.importantLoadKw, 2)} kW`],
              ['Heavy load', `${num(res.summary.heavyLoadKw, 2)} kW`],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-muted">{k}</dt><dd className="num mt-0.5 font-medium">{v}</dd></div>
            ))}
          </dl>
          {res.summary.highPowerLoads.length > 0 && (
            <p className="mt-5 text-sm text-warning">High-power loads: {res.summary.highPowerLoads.join(', ')}. Run them in daylight where possible.</p>
          )}
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-xl">Battery options</h2>
          <p className="mt-1 text-sm text-muted">LiFePO4, {num(res.assumptions.batteryModuleKwh, 2)} kWh modules. Backup is measured against the average night-time load.</p>
          <div className="mt-5 space-y-3">
            {res.battery.tiers.map((t) => <TierRow key={t.key} t={t} highlight={t.key === 'standard'} max={res.battery.tiers[res.battery.tiers.length - 1]!.nominalKwh} />)}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl">Recommended equipment</h2>
            <p className="mt-1 text-sm text-muted">Picked from current stock to match your system.</p>
          </div>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="num text-sm text-muted">Equipment total {money(itemsTotal, settings.commerce.currency)}</span>
              <Button size="sm" icon={<ShoppingBag className="size-4" />} onClick={addAll}>Add all to cart</Button>
            </div>
          )}
        </div>
        {items.length === 0 ? (
          <p className="mt-5 text-sm text-muted">We’ll confirm matching equipment with you after the site assessment.</p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => (
              <li key={i.product_id} className="flex gap-4 rounded-2xl border border-line p-3">
                <div className="size-20 shrink-0 overflow-hidden rounded-xl"><ProductArt role={i.role} alt={i.name} /></div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/product/${i.slug}`} className="text-sm leading-snug font-medium hover:text-primary">{i.quantity > 1 ? `${i.quantity} × ` : ''}{i.name}</Link>
                  <p className="mt-0.5 text-xs text-muted">{i.reason}</p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="num text-sm font-medium">{money(i.unit_price * i.quantity, settings.commerce.currency)}</span>
                    <button type="button" onClick={() => { cart.add({ product_id: i.product_id, slug: i.slug, name: i.name, price: i.unit_price, role: i.role }, i.quantity); toast(`${i.name} added to cart`); }} className="text-sm font-medium text-primary hover:underline">Add to quote</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6 p-6 sm:p-8">
        <h2 className="text-xl">Appliance inventory</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 pr-3 font-normal">Appliance</th>
                <th className="py-2 pr-3 text-right font-normal">Qty</th>
                <th className="py-2 pr-3 text-right font-normal">Rated W</th>
                <th className="py-2 pr-3 text-right font-normal">Hours/day</th>
                <th className="py-2 pr-3 text-right font-normal">Daily kWh</th>
                <th className="py-2 font-normal">Priority</th>
              </tr>
            </thead>
            <tbody>
              {appliances.map((x) => (
                <tr key={x.id} className="border-b border-line/70">
                  <td className="py-2.5 pr-3">{x.name}</td>
                  <td className="num py-2.5 pr-3 text-right">{x.quantity}</td>
                  <td className="num py-2.5 pr-3 text-right">{num(x.rated_watts, 0)}</td>
                  <td className="num py-2.5 pr-3 text-right">{num(x.hours_per_day)}</td>
                  <td className="num py-2.5 pr-3 text-right">{num(x.daily_kwh, 2)}</td>
                  <td className="py-2.5">{sentence(x.priority)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer font-medium text-primary">Engineering assumptions</summary>
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-3">
            {[
              ['Peak sun hours', `${num(res.pv.peakSunHours)} h/day`],
              ['PV system efficiency', `${num(res.pv.systemEfficiency * 100)}%`],
              ['Temperature loss', `${num(res.pv.temperatureLoss * 100)}%`],
              ['Battery depth of discharge', `${num(res.assumptions.batteryDoD * 100)}%`],
              ['Battery efficiency', `${num(res.assumptions.batteryEfficiency * 100)}%`],
              ['Inverter efficiency', `${num(res.assumptions.inverterEfficiency * 100)}%`],
              ['PV design margin', `${num((res.assumptions.pvDesignMargin - 1) * 100)}%`],
              ['Inverter expansion margin', `${num(res.assumptions.inverterExpansionMargin * 100)}%`],
              ['Backup target', `${num(res.battery.backupHoursTarget)} h`],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-muted">{k}</dt><dd className="num font-medium">{v}</dd></div>
            ))}
          </dl>
        </details>
      </Card>
    </>
  );
}

function TierRow({ t, highlight, max }: { t: BatteryTier; highlight: boolean; max: number }) {
  return (
    <div className={cn('rounded-2xl border p-4', highlight ? 'border-primary bg-tint' : 'border-line')}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{t.label}{highlight && <span className="ml-2 text-xs font-normal text-primary">Recommended</span>}</p>
        <p className="num font-bold">{num(t.nominalKwh, 2)} kWh</p>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-white">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (t.nominalKwh / max) * 100)}%` }} />
      </div>
      <p className="num mt-2 text-sm text-muted">
        {t.modules} module{t.modules === 1 ? '' : 's'}, {num(t.usableKwh, 1)} kWh usable, about {num(t.backupHours)} h for {t.coverage === 'essential' ? 'essential loads' : 'the full load'}
      </p>
    </div>
  );
}
