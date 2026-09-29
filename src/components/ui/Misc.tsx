import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface text-ink/75',
  primary: 'bg-tint text-primary',
  accent: 'bg-accent/15 text-[color-mix(in_oklab,var(--ks-accent)_60%,black)]',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

const STATUS_TONE: Record<string, Tone> = {
  paid: 'success', success: 'success', verified: 'success', completed: 'success', delivered: 'success', closed: 'neutral',
  calculated: 'primary', pending: 'warning', pending_payment: 'warning', new: 'accent', matched: 'primary', contacted: 'primary',
  scheduled: 'primary', processing: 'primary', shipped: 'primary', in_progress: 'primary',
  failed: 'danger', abandoned: 'neutral', cancelled: 'neutral', refunded: 'neutral', suspended: 'danger',
};
const STATUS_LABEL: Record<string, string> = { calculated: 'Awaiting payment', pending_payment: 'Awaiting payment', success: 'Paid', in_progress: 'In progress' };

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{label}</Badge>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface', className)} />;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-white p-8">
      {icon && <div className="grid size-11 place-items-center rounded-full bg-tint text-primary">{icon}</div>}
      <div>
        <h3 className="text-base font-bold">{title}</h3>
        {text && <p className="mt-1 max-w-md text-sm text-muted">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-[var(--radius-card)] border border-line bg-white', className)}>{children}</div>;
}

export function Logo({ light, className, to = '/' }: { light?: boolean; className?: string; to?: string }) {
  return (
    <Link to={to} className={cn('inline-flex shrink-0 items-center', className)} aria-label="KuraSolar home">
      <img src={light ? '/logo-light.png' : '/logo.png'} alt="KuraSolar" width={960} height={266} className="h-8 w-auto sm:h-9" />
    </Link>
  );
}

export function PageHeader({ title, text, actions, className }: { title: ReactNode; text?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] leading-tight sm:text-4xl">{title}</h1>
        {text && <p className="mt-2 text-[1.0625rem] text-muted">{text}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-sm text-muted">{label}</span>
      <span className="num text-2xl font-bold text-ink">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}
