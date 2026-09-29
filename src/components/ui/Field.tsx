import { ChevronDown } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const controlClass =
  'w-full rounded-[var(--radius-control)] border border-line bg-white px-3.5 text-[0.95rem] text-ink placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:bg-surface disabled:text-muted';

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: (id: string) => ReactNode;
  optional?: boolean;
}

export function Field({ label, hint, error, className, children, optional }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
        </label>
      )}
      {children(id)}
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null; optional?: boolean; wrapClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, optional, wrapClassName, className, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={wrapClassName}>
      {(id) => <input ref={ref} id={rest.id ?? id} className={cn(controlClass, 'h-11', error && 'border-danger', className)} aria-invalid={Boolean(error) || undefined} {...rest} />}
    </Field>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null; optional?: boolean; wrapClassName?: string };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, optional, wrapClassName, className, rows = 4, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={wrapClassName}>
      {(id) => <textarea ref={ref} id={rest.id ?? id} rows={rows} className={cn(controlClass, 'py-2.5 leading-relaxed', className)} {...rest} />}
    </Field>
  );
});

type Option = { value: string; label: string };
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode; hint?: ReactNode; error?: string | null; optional?: boolean; wrapClassName?: string;
  options: Array<Option | string>; placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, optional, wrapClassName, className, options, placeholder, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={wrapClassName}>
      {(id) => (
        <div className="relative">
          <select ref={ref} id={rest.id ?? id} className={cn(controlClass, 'h-11 appearance-none pr-10', className)} {...rest}>
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) => {
              const opt = typeof o === 'string' ? { value: o, label: o } : o;
              return <option key={opt.value} value={opt.value}>{opt.label}</option>;
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        </div>
      )}
    </Field>
  );
});

export function Checkbox({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 rounded accent-[var(--ks-primary)]" />
      <span className="text-[0.95rem] leading-snug text-ink">
        {label}
        {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}
