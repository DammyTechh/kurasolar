import { Check } from 'lucide-react';
import { ButtonLink } from '../ui/Button';
import { cn } from '@/lib/cn';
import { money, num } from '@/lib/format';
import type { Package } from '@/lib/types';

export function PackageCard({ p, currency = 'NGN' }: { p: Package; currency?: string }) {
  return (
    <article className={cn('relative flex flex-col rounded-[var(--radius-card)] p-6 sm:p-8', p.is_popular ? 'bg-primary-dark text-white' : 'border border-line bg-white')}>
      {p.is_popular && <span className="absolute top-6 right-6 rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary-dark">Most chosen</span>}
      <h3 className={cn('text-xl', p.is_popular && 'text-white')}>{p.name}</h3>
      {p.ideal_for && <p className={cn('mt-1 text-sm', p.is_popular ? 'text-white/65' : 'text-muted')}>{p.ideal_for}</p>}
      <div className="mt-6 flex items-baseline gap-2">
        <span className="num text-4xl font-semibold tracking-tight">{num(p.inverter_kw)}</span>
        <span className={p.is_popular ? 'text-white/70' : 'text-muted'}>kW</span>
        <span className="mx-2 h-6 w-px self-center bg-current opacity-20" />
        <span className="num text-4xl font-semibold tracking-tight">{num(p.battery_kwh)}</span>
        <span className={p.is_popular ? 'text-white/70' : 'text-muted'}>kWh</span>
      </div>
      {p.tagline && <p className={cn('mt-3 text-sm', p.is_popular ? 'text-white/80' : 'text-ink/80')}>{p.tagline}</p>}
      <ul className="mt-6 space-y-3 text-sm">
        {p.features.map((f) => (
          <li key={f} className="flex items-start gap-3"><Check className={cn('mt-1 size-4 shrink-0', p.is_popular ? 'text-accent' : 'text-primary')} />{f}</li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <p className={cn('text-sm', p.is_popular ? 'text-white/70' : 'text-muted')}>{p.price ? <>From <span className="num font-semibold text-lg">{money(p.price, currency)}</span></> : 'Priced after a site survey'}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink to={`/quote?package=${p.slug}`} variant={p.is_popular ? 'accent' : 'primary'} size="sm">Request a quote</ButtonLink>
          <ButtonLink to="/solar-calculator" variant={p.is_popular ? 'light' : 'secondary'} size="sm">Check it fits</ButtonLink>
        </div>
      </div>
    </article>
  );
}
