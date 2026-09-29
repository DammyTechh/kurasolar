import { cn } from '@/lib/cn';

interface Props<T extends string> {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; hint?: string }[];
  className?: string;
  columns?: 2 | 3 | 4;
}

/** Radio group styled as large tappable tiles. */
export function Segmented<T extends string>({ label, value, onChange, options, className, columns }: Props<T>) {
  const cols = columns ?? (options.length >= 4 ? 4 : options.length === 3 ? 3 : 2);
  return (
    <fieldset className={cn('flex flex-col gap-1.5', className)}>
      {label && <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>}
      <div className={cn('grid gap-2', cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')} role="radiogroup">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'rounded-[var(--radius-control)] border px-3 py-2.5 text-left text-sm transition-colors',
                active ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink hover:border-primary/40',
              )}
            >
              <span className="block font-medium">{o.label}</span>
              {o.hint && <span className={cn('mt-0.5 block text-xs', active ? 'text-white/75' : 'text-muted')}>{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
