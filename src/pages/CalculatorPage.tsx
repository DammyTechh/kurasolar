import { applianceDailyKwh, resolveSettings, summarizeLoad, type ApplianceCategory, type ApplianceInput } from '@engine';
import { ArrowLeft, Copy, Pencil, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select } from '@/components/ui/Field';
import { Card } from '@/components/ui/Misc';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { Segmented } from '@/components/ui/Segmented';
import { ApplianceEditor } from '@/features/calculator/ApplianceEditor';
import { CATEGORIES, CATEGORY_ORDER, describe, fromCatalog, GRID_OPTIONS, newAppliance, PRIORITY_OPTIONS, PROPERTY_TYPES, uid, WINDOW_OPTIONS } from '@/features/calculator/config';
import { LiveSummary, MobileSummaryBar } from '@/features/calculator/LiveSummary';
import { useDraft } from '@/features/calculator/useDraft';
import { errorMessage, invoke } from '@/lib/api';
import { cn } from '@/lib/cn';
import { num, sentence } from '@/lib/format';
import { useApplianceCatalog, usePrimaryMarkets, useRegions } from '@/lib/queries';
import { useSeo } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import type { CalculateResponse } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useSite } from '@/providers/SiteProvider';
import { useToast } from '@/providers/ToastProvider';
import { OtpSignIn } from './auth/OtpSignIn';

const STEPS = ['Location', 'Appliances', 'Priorities', 'Review'];

export default function CalculatorPage() {
  useSeo({
    title: 'Solar system calculator',
    description: 'Size the solar panels, inverter and LiFePO4 battery your home needs. Add your appliances and see your load and daily energy update live.',
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'KuraSolar solar calculator', applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any' },
  });

  const { settings, content } = useSite();
  const engineering = useMemo(() => resolveSettings(settings.engineering), [settings.engineering]);
  const { draft, update, setLocation, setAppliances, reset } = useDraft();
  const summary = useMemo(() => summarizeLoad(draft.appliances, engineering), [draft.appliances, engineering]);
  const step = Math.min(draft.step, STEPS.length - 1);

  const go = (s: number) => {
    update({ step: s });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-surface/60 pb-28 lg:pb-16">
      <div className="container-page pt-8 sm:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl leading-tight sm:text-4xl">Size your solar system</h1>
            <p className="mt-2 max-w-xl text-muted">Add what you want to power. Your load updates as you go; your draft is saved on this device.</p>
          </div>
          {(draft.appliances.length > 0 || draft.step > 0) && (
            <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => confirm('Clear this calculation and start again?') && reset()}>
              Start over
            </Button>
          )}
        </div>

        <Progress step={step} onJump={(s) => s < step && go(s)} />

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {step === 0 && <LocationStep draft={draft} setLocation={setLocation} backupDefaults={engineering.backupHoursByGrid} onNext={() => go(1)} />}
            {step === 1 && <AppliancesStep appliances={draft.appliances} setAppliances={setAppliances} onBack={() => go(0)} onNext={() => go(2)} />}
            {step === 2 && <PrioritiesStep appliances={draft.appliances} setAppliances={setAppliances} onBack={() => go(1)} onNext={() => go(3)} />}
            {step === 3 && <ReviewStep draft={draft} onBack={() => go(2)} onCalculated={(id) => update({ assessmentId: id })} />}
            <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">{content.disclaimer?.text}</p>
          </motion.div>
          <aside className="sticky top-24 hidden lg:block">
            <LiveSummary summary={summary} />
          </aside>
        </div>
      </div>
      <MobileSummaryBar summary={summary} />
    </div>
  );
}

function Progress({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  return (
    <nav aria-label="Progress" className="mt-8">
      <p className="mb-3 text-sm text-muted lg:hidden">
        Step {step + 1} of {STEPS.length}: <span className="font-medium text-ink">{STEPS[step]}</span>
      </p>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button type="button" onClick={() => onJump(i)} disabled={i >= step} className="group w-full text-left disabled:cursor-default" aria-current={i === step ? 'step' : undefined}>
              <span className={cn('block h-1.5 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-line')} />
              <span className={cn('mt-2 hidden text-sm lg:block', i === step ? 'font-medium text-ink' : i < step ? 'text-primary group-hover:underline' : 'text-muted')}>
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StepNav({ onBack, onNext, nextLabel = 'Continue', disabled, loading }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; disabled?: boolean; loading?: boolean }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      {onBack ? <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onBack}>Back</Button> : <span />}
      {onNext && <Button size="lg" onClick={onNext} disabled={disabled} loading={loading}>{nextLabel}</Button>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

type DraftApi = ReturnType<typeof useDraft>;

function LocationStep({ draft, setLocation, backupDefaults, onNext }: { draft: DraftApi['draft']; setLocation: DraftApi['setLocation']; backupDefaults: Record<string, number>; onNext: () => void }) {
  const loc = draft.location;
  const { data: countries = [], primary, rest } = usePrimaryMarkets();
  const known = countries.find((c) => c.name === loc.country);
  const { data: regions = [], isLoading: regionsLoading } = useRegions(known?.code);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const defaultBackup = backupDefaults[loc.gridAvailability] ?? 10;
  const countryGroups = countries.length
    ? [
        { label: 'Where we work most', options: primary.map((c) => c.name) },
        { label: 'Everywhere else', options: rest.map((c) => c.name) },
      ]
    : [{ label: 'Countries', options: [loc.country || 'Nigeria'] }];

  const next = () => {
    const e: Record<string, string> = {};
    if (!loc.country.trim()) e.country = 'Choose a country.';
    if (regions.length > 0 && !loc.state) e.state = 'Choose a state or region. Sun hours vary by region.';
    if (regions.length === 0 && !loc.state.trim()) e.state = 'Enter the state or region.';
    if (loc.isDiaspora && !loc.recipient.name.trim()) e.recipientName = 'Enter the recipient’s name.';
    if (loc.isDiaspora && !loc.recipient.phone.trim()) e.recipientPhone = 'Enter the recipient’s phone number.';
    setErrors(e);
    if (Object.keys(e).length === 0) onNext();
  };

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-xl">Where will the system be installed?</h2>
      <p className="mt-1 text-sm text-muted">We size against the sun hours and temperature where the system will stand, so a Kano roof is sized differently from one in Port Harcourt.</p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Select
          label="Country"
          placeholder="Select a country"
          value={loc.country}
          groups={countryGroups}
          onChange={(e) => setLocation({ country: e.target.value, state: '' })}
          error={errors.country}
        />
        {regionsLoading ? (
          <Select label="State / region" placeholder="Loading…" value="" options={[]} disabled />
        ) : regions.length > 0 ? (
          <Select
            label="State / region"
            placeholder="Select"
            value={loc.state}
            options={regions.map((r) => r.name)}
            onChange={(e) => setLocation({ state: e.target.value })}
            error={errors.state}
          />
        ) : (
          <Input
            label="State / region"
            hint={known ? 'We have no region list for this country yet, so we use its national average sun hours.' : undefined}
            value={loc.state}
            onChange={(e) => setLocation({ state: e.target.value })}
            error={errors.state}
            maxLength={80}
          />
        )}
        <Input label="City or town" value={loc.city} onChange={(e) => setLocation({ city: e.target.value })} maxLength={80} />
        <Input label="Postcode" optional value={loc.postcode} onChange={(e) => setLocation({ postcode: e.target.value })} maxLength={20} />
        <Select wrapClassName="sm:col-span-2" label="Property type" value={loc.propertyType} options={PROPERTY_TYPES} onChange={(e) => setLocation({ propertyType: e.target.value })} />
      </div>

      <Segmented className="mt-8" label="How reliable is grid power there?" value={loc.gridAvailability} onChange={(gridAvailability) => setLocation({ gridAvailability })} options={GRID_OPTIONS} />

      <div className="mt-6 rounded-2xl bg-surface p-4 sm:p-6">
        <Checkbox
          label="Set my own backup time"
          hint={`Otherwise we plan for ${defaultBackup} hours of battery backup, based on the grid condition.`}
          checked={loc.backupHours != null}
          onChange={(v) => setLocation({ backupHours: v ? defaultBackup : null })}
        />
        {loc.backupHours != null && (
          <NumberStepper className="mt-4 max-w-xs" label="Hours of backup needed" unit="h" value={loc.backupHours} min={1} max={72} onChange={(backupHours) => setLocation({ backupHours })} />
        )}
      </div>

      <div className="mt-6 border-t border-line pt-6">
        <Checkbox
          label="I am designing this system for someone in another country"
          hint="For parents, a family home, a new build or a project back home."
          checked={loc.isDiaspora}
          onChange={(isDiaspora) => setLocation({ isDiaspora })}
        />
        {loc.isDiaspora && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Input label="Recipient’s name" value={loc.recipient.name} onChange={(e) => setLocation({ recipient: { ...loc.recipient, name: e.target.value } })} error={errors.recipientName} maxLength={120} />
            <Input label="Recipient’s phone" type="tel" value={loc.recipient.phone} onChange={(e) => setLocation({ recipient: { ...loc.recipient, phone: e.target.value } })} error={errors.recipientPhone} maxLength={32} />
            <Input label="Property address" value={loc.recipient.location} onChange={(e) => setLocation({ recipient: { ...loc.recipient, location: e.target.value } })} maxLength={200} />
            <Select
              label="Relationship"
              placeholder="Select"
              value={loc.recipient.relationship}
              options={['Parents', 'Family home', 'New property', 'Rural home', 'Business', 'Development project'].map((v) => ({ value: v, label: v }))}
              onChange={(e) => setLocation({ recipient: { ...loc.recipient, relationship: e.target.value } })}
            />
          </div>
        )}
      </div>

      <StepNav onNext={next} nextLabel="Continue to appliances" />
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function AppliancesStep({ appliances, setAppliances, onBack, onNext }: { appliances: ApplianceInput[]; setAppliances: DraftApi['setAppliances']; onBack: () => void; onNext: () => void }) {
  const { settings } = useSite();
  const lookups = settings.appliance_lookups;
  const { data: catalog = [] } = useApplianceCatalog();
  const toast = useToast();
  const [editing, setEditing] = useState<{ a: ApplianceInput; isNew: boolean } | null>(null);
  const [showAllPresets, setShowAllPresets] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<ApplianceCategory, number>();
    appliances.forEach((a) => m.set(a.category, (m.get(a.category) ?? 0) + a.quantity));
    return m;
  }, [appliances]);

  const saveAppliance = (a: ApplianceInput) => {
    setAppliances((list) => (list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a]));
    setEditing(null);
  };

  const quickAdd = (a: ApplianceInput) => {
    setAppliances((list) => [...list, a]);
    toast(`${a.name} added`, 'info');
  };

  const presets = showAllPresets ? catalog : catalog.slice(0, 10);
  const grouped = CATEGORY_ORDER.map((c) => ({ c, items: appliances.filter((a) => a.category === c) })).filter((g) => g.items.length);

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl">What do you want to power?</h2>
        <p className="mt-1 text-sm text-muted">Choose a type to add it with sensible defaults you can adjust.</p>
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
          {CATEGORY_ORDER.map((c) => {
            const meta = CATEGORIES[c];
            const count = counts.get(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => setEditing({ a: newAppliance(c, lookups), isNew: true })}
                className="relative flex flex-col items-start gap-3 rounded-2xl border border-line bg-white p-3 text-left transition-colors hover:border-primary/50 hover:bg-tint sm:p-4"
              >
                <meta.icon className="size-6 text-primary" aria-hidden />
                <span className="text-xs leading-tight font-medium sm:text-sm">{meta.label}</span>
                {count ? <span className="num absolute top-2.5 right-2.5 grid min-w-6 place-items-center rounded-full bg-accent px-2 text-xs font-semibold text-primary-dark">{count}</span> : null}
              </button>
            );
          })}
        </div>

        {catalog.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-ink">Quick add</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((row) => (
                <button key={row.id} type="button" onClick={() => quickAdd(fromCatalog(row))} className="flex items-center gap-2 rounded-full border border-line bg-white py-2 pr-4 pl-3 text-sm text-ink/85 hover:border-primary/50 hover:text-primary">
                  <Plus className="size-3.5 text-primary" /> {row.name}
                </button>
              ))}
              {catalog.length > 10 && (
                <button type="button" onClick={() => setShowAllPresets((v) => !v)} className="rounded-full px-3 py-2 text-sm font-medium text-primary">
                  {showAllPresets ? 'Show fewer' : `Show all ${catalog.length}`}
                </button>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl">Your appliances</h2>
          <span className="text-sm text-muted">{appliances.length} line{appliances.length === 1 ? '' : 's'}</span>
        </div>
        {grouped.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line p-6 text-sm text-muted">Nothing added yet. Start with lights and sockets, then add your larger appliances.</p>
        ) : (
          <div className="mt-6 space-y-6">
            {grouped.map(({ c, items }) => (
              <div key={c}>
                <h3 className="text-sm text-muted">{CATEGORIES[c].plural}</h3>
                <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
                  {items.map((a) => (
                    <ApplianceRow
                      key={a.id}
                      a={a}
                      onEdit={() => setEditing({ a, isNew: false })}
                      onDuplicate={() => setAppliances((list) => [...list, { ...a, id: uid() }])}
                      onRemove={() => setAppliances((list) => list.filter((x) => x.id !== a.id))}
                      onQty={(q) => setAppliances((list) => list.map((x) => (x.id === a.id ? { ...x, quantity: q } : x)))}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <StepNav onBack={onBack} onNext={onNext} disabled={appliances.length === 0} nextLabel="Set priorities" />
      </Card>

      <ApplianceEditor open={Boolean(editing)} appliance={editing?.a ?? null} isNew={editing?.isNew ?? true} lookups={lookups} onClose={() => setEditing(null)} onSave={saveAppliance} />
    </div>
  );
}

function ApplianceRow({ a, onEdit, onDuplicate, onRemove, onQty }: { a: ApplianceInput; onEdit: () => void; onDuplicate: () => void; onRemove: () => void; onQty: (q: number) => void }) {
  const kwh = applianceDailyKwh(a);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:flex-nowrap sm:p-4">
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium text-ink">{a.name}</p>
        <p className="truncate text-sm text-muted">{describe(a)}</p>
      </button>
      <div className="flex items-center rounded-full border border-line">
        <button type="button" className="grid size-8 place-items-center text-primary disabled:opacity-30" onClick={() => onQty(a.quantity - 1)} disabled={a.quantity <= 1} aria-label="Fewer">−</button>
        <span className="num w-8 text-center text-sm font-medium">{a.quantity}</span>
        <button type="button" className="grid size-8 place-items-center text-primary" onClick={() => onQty(Math.min(500, a.quantity + 1))} aria-label="More">+</button>
      </div>
      <span className="num w-24 text-right text-sm text-ink/80">{num(kwh, 2)} kWh</span>
      <div className="flex items-center">
        <button type="button" onClick={onEdit} className="grid size-9 place-items-center rounded-full text-muted hover:bg-tint hover:text-primary" aria-label={`Edit ${a.name}`}><Pencil className="size-4" /></button>
        <button type="button" onClick={onDuplicate} className="grid size-9 place-items-center rounded-full text-muted hover:bg-tint hover:text-primary" aria-label={`Duplicate ${a.name}`}><Copy className="size-4" /></button>
        <button type="button" onClick={onRemove} className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Remove ${a.name}`}><Trash2 className="size-4" /></button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */

function PrioritiesStep({ appliances, setAppliances, onBack, onNext }: { appliances: ApplianceInput[]; setAppliances: DraftApi['setAppliances']; onBack: () => void; onNext: () => void }) {
  const set = (id: string | undefined, patch: Partial<ApplianceInput>) => setAppliances((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-xl">Which loads matter most?</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Essential loads get the most battery. Heavy loads such as water heaters and irons are best run in sunshine. We use this to size the economy, standard and extended battery options.
      </p>
      <ul className="mt-6 divide-y divide-line">
        {appliances.map((a) => {
          const Icon = CATEGORIES[a.category].icon;
          return (
            <li key={a.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto_10rem] md:items-center md:gap-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-tint text-primary"><Icon className="size-4" /></span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.quantity > 1 ? `${a.quantity} × ` : ''}{a.name}</p>
                  <p className="text-xs text-muted">{a.ratedWatts * a.quantity} W connected</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-full bg-surface p-1" role="radiogroup" aria-label={`Priority for ${a.name}`}>
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={a.priority === p.value}
                    onClick={() => set(a.id, { priority: p.value })}
                    className={cn('rounded-full px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm', a.priority === p.value ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-ink')}
                  >
                    {p.value === 'heavy' ? 'Heavy' : p.label}
                  </button>
                ))}
              </div>
              <Select aria-label={`When ${a.name} is used`} value={a.usageWindow ?? 'anytime'} options={WINDOW_OPTIONS.map((w) => ({ value: w.value, label: w.label }))} onChange={(e) => set(a.id, { usageWindow: e.target.value as ApplianceInput['usageWindow'] })} className="h-10" />
            </li>
          );
        })}
      </ul>
      <StepNav onBack={onBack} onNext={onNext} nextLabel="Review" />
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function ReviewStep({ draft, onBack, onCalculated }: { draft: DraftApi['draft']; onBack: () => void; onCalculated: (id: string) => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingSet, setSavingSet] = useState(false);
  const loc = draft.location;

  const calculate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await invoke<CalculateResponse>('assessment-calculate', {
        assessment_id: draft.assessmentId,
        location: { ...loc, country: loc.country === 'Other' ? 'Other' : loc.country },
        customer: { name: profile?.full_name, phone: profile?.phone },
        appliances: draft.appliances,
      });
      onCalculated(res.id);
      nav(`/assessments/${res.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const saveSet = async () => {
    if (!user) return;
    const name = prompt('Name this appliance list', `${loc.city || loc.state || 'My home'} appliances`);
    if (!name) return;
    setSavingSet(true);
    const { error: err } = await supabase.from('saved_appliance_sets').insert({ user_id: user.id, name: name.slice(0, 80), appliances: draft.appliances });
    setSavingSet(false);
    if (err) toast(errorMessage(err), 'error');
    else toast('Appliance list saved to your account');
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl">Review</h2>
        <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Location</dt><dd className="mt-1 font-medium">{[loc.city, loc.state, loc.country].filter(Boolean).join(', ')}</dd></div>
          <div><dt className="text-muted">Grid</dt><dd className="mt-1 font-medium">{sentence(loc.gridAvailability)}</dd></div>
          <div><dt className="text-muted">Backup</dt><dd className="mt-1 font-medium">{loc.backupHours ? `${loc.backupHours} hours` : 'Standard for grid'}</dd></div>
          {loc.isDiaspora && <div className="sm:col-span-3"><dt className="text-muted">Designed for</dt><dd className="mt-1 font-medium">{loc.recipient.name} {loc.recipient.relationship && `(${loc.recipient.relationship.toLowerCase()})`}</dd></div>}
        </dl>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 pr-3 font-normal">Appliance</th>
                <th className="py-2 pr-3 text-right font-normal">Qty</th>
                <th className="py-2 pr-3 text-right font-normal">Watts</th>
                <th className="py-2 pr-3 text-right font-normal">Hours</th>
                <th className="py-2 font-normal">Priority</th>
              </tr>
            </thead>
            <tbody>
              {draft.appliances.map((a) => (
                <tr key={a.id} className="border-b border-line/70">
                  <td className="py-3 pr-3">{a.name}</td>
                  <td className="num py-3 pr-3 text-right">{a.quantity}</td>
                  <td className="num py-3 pr-3 text-right">{a.ratedWatts}</td>
                  <td className="num py-3 pr-3 text-right">{a.hoursPerDay}</td>
                  <td className="py-3">{sentence(a.priority)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {user && (
          <Button variant="ghost" size="sm" className="mt-4" icon={<Save className="size-4" />} onClick={saveSet} loading={savingSet}>
            Save this appliance list
          </Button>
        )}
      </Card>

      <Card className="p-6 sm:p-8">
        {user ? (
          <>
            <h2 className="text-xl">Ready to calculate</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Our engine sizes your PV array, inverter and battery options on the server. You’ll see a summary straight away; the full engineering report unlocks after the consultation fee.
            </p>
            {error && <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{error}</p>}
            <StepNav onBack={onBack} onNext={calculate} nextLabel={draft.assessmentId ? 'Recalculate my system' : 'Calculate my system'} loading={busy} />
          </>
        ) : (
          <div className="grid gap-8 md:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-xl">Where should we send your results?</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Your assessment is saved to your account so you can return to it, pay when you’re ready and download the report later. We’ll email you a sign-in code.
              </p>
              <Button variant="ghost" className="mt-6 -ml-4" icon={<ArrowLeft className="size-4" />} onClick={onBack}>Back</Button>
            </div>
            <OtpSignIn collectDetails submitLabel="Email me a code" location={{ country: loc.country, state: loc.state, city: loc.city }} />
          </div>
        )}
      </Card>
    </div>
  );
}
