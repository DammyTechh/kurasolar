import { Minus, Plus } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
  size?: 'md' | 'lg';
  className?: string;
}

/** Large touch-friendly stepper; the middle value can also be typed. */
export function NumberStepper({ label, value, onChange, min = 0, max = 9999, step = 1, unit, hint, size = 'md', className }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const clamp = (n: number) => {
    const snapped = Math.round(n / step) * step;
    return Math.min(max, Math.max(min, Number(snapped.toFixed(4))));
  };
  const commit = (raw: string) => {
    const n = Number(raw);
    const next = Number.isFinite(n) ? clamp(n) : value;
    onChange(next);
    setDraft(String(next));
  };

  const btn = cn(
    'grid shrink-0 place-items-center rounded-full bg-tint text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-40 disabled:hover:bg-tint disabled:hover:text-primary',
    size === 'lg' ? 'size-12' : 'size-10',
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>}
      <div className={cn('flex items-center gap-2 rounded-full border border-line bg-white p-1', size === 'lg' && 'p-2')}>
        <button type="button" className={btn} onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`Decrease ${label ?? 'value'}`}>
          <Minus className="size-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          <input
            id={id}
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
            className={cn('num w-full min-w-0 bg-transparent text-center font-medium text-ink focus:outline-none', size === 'lg' ? 'text-xl' : 'text-base')}
          />
          {unit && <span className="shrink-0 pr-1 text-sm text-muted">{unit}</span>}
        </div>
        <button type="button" className={btn} onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`Increase ${label ?? 'value'}`}>
          <Plus className="size-4" />
        </button>
      </div>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}