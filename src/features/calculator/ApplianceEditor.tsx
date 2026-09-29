import { applianceDailyKwh, type ApplianceInput } from '@engine';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { Segmented } from '@/components/ui/Segmented';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';
import type { ApplianceLookups } from '@/lib/settings';
import { CATEGORIES, compressorDefaults, HP_OPTIONS, lookupWatts, PRIORITY_OPTIONS, typeName, WINDOW_OPTIONS } from './config';

interface Props {
  open: boolean;
  appliance: ApplianceInput | null;
  isNew: boolean;
  lookups: ApplianceLookups;
  onClose: () => void;
  onSave: (a: ApplianceInput) => void;
}

export function ApplianceEditor({ open, appliance, isNew, lookups, onClose, onSave }: Props) {
  const [a, setA] = useState<ApplianceInput | null>(appliance);
  const [advanced, setAdvanced] = useState(false);
  const [wattsTouched, setWattsTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setA(appliance);
    setAdvanced(false);
    setWattsTouched(Boolean(appliance && !isNew));
    setError(null);
  }, [appliance, isNew]);

  if (!a) return <Modal open={open} onClose={onClose}>{null}</Modal>;
  const meta = CATEGORIES[a.category];
  const attrs = a.attributes ?? {};

  const patch = (p: Partial<ApplianceInput>) => setA((prev) => (prev ? { ...prev, ...p } : prev));
  const setAttrs = (next: Record<string, string | number | boolean>, extra: Partial<ApplianceInput> = {}) => {
    const merged = { ...attrs, ...next };
    const inverter = extra.inverterTechnology ?? a.inverterTechnology ?? false;
    const watts = wattsTouched ? null : lookupWatts(a.category, merged, inverter, lookups);
    patch({ attributes: merged, ...(watts ? { ratedWatts: watts } : {}), ...extra });
  };

  const autoName = (label: string) => (isNew || !a.name || a.name === meta.label || meta.types?.some((t) => typeName(a.category, t) === a.name) ? label : a.name);

  const onType = (value: string) => {
    const t = meta.types?.find((x) => x.value === value);
    setAttrs({ type: value }, { name: t && a.category !== 'air_conditioner' ? autoName(typeName(a.category, t)) : a.name, ...(t?.hours ? { hoursPerDay: t.hours } : {}) });
  };

  const onInverter = (inverter: boolean) => {
    const comp = compressorDefaults(a.category, inverter, lookups);
    setAttrs({}, { inverterTechnology: inverter, ...(comp ? { dutyCycle: comp.duty, surgeFactor: comp.surge } : {}) });
  };

  const save = () => {
    if (!a.name.trim()) {
      setError('Give this appliance a name.');
      return;
    }
    onSave({ ...a, name: a.name.trim() });
  };

  const tvSizes = Object.keys(lookups.tvWattsBySize);
  const kwh = applianceDailyKwh(a);
  const showWindowInline = a.category === 'air_conditioner' || a.category === 'water_heater' || a.category === 'custom';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <meta.icon className="size-5 text-primary" aria-hidden />
          {isNew ? `Add ${meta.label.toLowerCase()}` : `Edit ${meta.label.toLowerCase()}`}
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted">
            Uses about <span className="num font-medium text-ink">{num(kwh, 2)} kWh</span> a day
          </p>
          <Button onClick={save}>{isNew ? 'Add appliance' : 'Save changes'}</Button>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          wrapClassName="sm:col-span-2"
          label={a.category === 'custom' ? 'Appliance name' : 'Label'}
          placeholder={a.category === 'custom' ? 'e.g. Blender, borehole controller' : meta.label}
          value={a.name}
          onChange={(e) => {
            setError(null);
            patch({ name: e.target.value });
          }}
          error={error}
          maxLength={120}
        />

        {a.category === 'television' && (
          <Select
            label="Screen size"
            value={String(attrs.screenSize ?? '')}
            options={[...tvSizes.map((s) => ({ value: s, label: s })), { value: 'custom', label: 'Other size' }]}
            onChange={(e) => setAttrs({ screenSize: e.target.value }, { name: e.target.value === 'custom' ? a.name : autoName(`LED TV ${e.target.value}`) })}
          />
        )}

        {meta.types && a.category !== 'television' && (
          <Select label={meta.typeLabel} value={String(attrs.type ?? '')} options={meta.types.map((t) => ({ value: t.value, label: t.label }))} onChange={(e) => onType(e.target.value)} />
        )}

        {a.category === 'air_conditioner' && (
          <Select
            label="Capacity"
            value={String(attrs.hp ?? '')}
            options={[...HP_OPTIONS.map((h) => ({ value: h, label: `${h} HP` })), { value: 'custom', label: 'Other' }]}
            onChange={(e) => {
              const hp = e.target.value;
              const type = meta.types?.find((t) => t.value === attrs.type)?.label ?? 'AC';
              setAttrs({ hp }, { horsepower: hp === 'custom' ? undefined : Number(hp), name: hp === 'custom' ? a.name : autoName(`${type} AC ${hp} HP`) });
            }}
          />
        )}

        {(a.category === 'refrigerator' || a.category === 'freezer' || a.category === 'pump') && meta.horsepower && (
          <Select
            label="Horsepower"
            optional={a.category !== 'pump'}
            value={attrs.hp != null ? String(attrs.hp) : ''}
            placeholder={a.category === 'pump' ? undefined : 'Not sure'}
            options={meta.horsepower.map((h) => ({ value: String(h), label: `${h} HP` }))}
            onChange={(e) => {
              const hp = e.target.value;
              setAttrs(hp ? { hp } : {}, { horsepower: hp ? Number(hp) : undefined, ...(a.category === 'pump' && hp ? { name: autoName(`Water pump ${hp} HP`) } : {}) });
            }}
          />
        )}

        {meta.inverterToggle && (
          <Segmented
            label={a.category === 'air_conditioner' ? 'Inverter AC?' : 'Inverter compressor?'}
            value={a.inverterTechnology ? 'yes' : 'no'}
            onChange={(v) => onInverter(v === 'yes')}
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          />
        )}

        {a.category === 'television' && (
          <Segmented
            label="Energy-saving (inverter) TV?"
            value={attrs.inverterTv ? 'yes' : 'no'}
            onChange={(v) => setAttrs({ inverterTv: v === 'yes' })}
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          />
        )}

        <NumberStepper label="Quantity" value={a.quantity} min={1} max={500} onChange={(quantity) => patch({ quantity })} />

        <NumberStepper
          label="Rated power"
          unit="W"
          value={a.ratedWatts}
          min={1}
          max={200000}
          step={a.ratedWatts >= 1000 ? 50 : a.ratedWatts >= 100 ? 10 : 1}
          onChange={(ratedWatts) => {
            setWattsTouched(true);
            patch({ ratedWatts });
          }}
          hint="Check the label on the appliance if you can."
        />

        {meta.cycles ? (
          <>
            <NumberStepper label="Hours per cycle" unit="h" value={a.hoursPerDay} min={0.25} max={6} step={0.25} onChange={(hoursPerDay) => patch({ hoursPerDay })} />
            <NumberStepper label="Cycles per day" value={a.cyclesPerDay ?? 1} min={1} max={10} onChange={(cyclesPerDay) => patch({ cyclesPerDay })} />
          </>
        ) : (
          <NumberStepper label="Hours used per day" unit="h" value={a.hoursPerDay} min={0} max={24} step={0.5} onChange={(hoursPerDay) => patch({ hoursPerDay })} />
        )}

        {meta.days && (
          <NumberStepper label="Days used per week" value={a.daysPerWeek ?? 7} min={1} max={7} onChange={(daysPerWeek) => patch({ daysPerWeek })} />
        )}

        {meta.capacity && (
          <NumberStepper label={meta.capacity} unit="L" value={Number(attrs.capacity ?? 50)} min={5} max={500} step={5} onChange={(capacity) => setAttrs({ capacity })} />
        )}

        {a.category === 'custom' && (
          <NumberStepper label="Voltage" unit="V" value={a.voltage ?? 230} min={12} max={480} step={1} onChange={(voltage) => patch({ voltage })} />
        )}

        {showWindowInline && (
          <Segmented
            className="sm:col-span-2"
            label={a.category === 'water_heater' ? 'Operating schedule' : 'Preferred operating period'}
            value={a.usageWindow ?? meta.window}
            onChange={(usageWindow) => patch({ usageWindow })}
            options={WINDOW_OPTIONS}
          />
        )}

        {a.category === 'custom' && (
          <Segmented className="sm:col-span-2" label="Priority" value={a.priority} onChange={(priority) => patch({ priority })} options={PRIORITY_OPTIONS} columns={3} />
        )}
      </div>

      {meta.hint && <p className="mt-5 rounded-xl bg-tint px-4 py-3 text-sm leading-relaxed text-ink/80">{meta.hint}</p>}

      <button type="button" onClick={() => setAdvanced((v) => !v)} className="mt-5 flex items-center gap-1.5 text-sm font-medium text-primary" aria-expanded={advanced}>
        <ChevronDown className={cn('size-4 transition-transform', advanced && 'rotate-180')} />
        Engineering details
      </button>
      {advanced && (
        <div className="mt-4 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
          <NumberStepper
            label="Duty cycle"
            unit="%"
            value={Math.round(a.dutyCycle * 100)}
            min={5}
            max={100}
            step={5}
            onChange={(v) => patch({ dutyCycle: v / 100 })}
            hint="Share of running time the appliance draws full power."
          />
          <NumberStepper
            label="Start-up surge"
            unit="×"
            value={a.surgeFactor}
            min={1}
            max={8}
            step={0.1}
            onChange={(surgeFactor) => patch({ surgeFactor })}
            hint="Motors and compressors draw several times their rating when starting."
          />
          {!meta.days && (
            <NumberStepper label="Days used per week" value={a.daysPerWeek ?? 7} min={1} max={7} onChange={(daysPerWeek) => patch({ daysPerWeek })} />
          )}
          {!showWindowInline && (
            <Segmented className="sm:col-span-2" label="When is it mostly used?" value={a.usageWindow ?? meta.window} onChange={(usageWindow) => patch({ usageWindow })} options={WINDOW_OPTIONS} />
          )}
        </div>
      )}
    </Modal>
  );
}
