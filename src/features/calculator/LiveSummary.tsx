import type { LoadSummary } from '@engine';
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';

function Counter({ value, dp = 1 }: { value: number; dp?: number }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => num(v, dp));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.45, ease: 'easeOut' });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className="num">{text}</motion.span>;
}

/** Energy "gauge": daily kWh split by priority, drawn as a segmented bar. */
function PriorityBar({ s }: { s: LoadSummary }) {
  const total = s.essentialLoadKw + s.importantLoadKw + s.heavyLoadKw || 1;
  const parts = [
    { key: 'Essential', v: s.essentialLoadKw, c: 'bg-white' },
    { key: 'Important', v: s.importantLoadKw, c: 'bg-white/40' },
    { key: 'Heavy', v: s.heavyLoadKw, c: 'bg-accent' },
  ];
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
        {parts.map((p) => (
          <motion.div key={p.key} className={p.c} initial={false} animate={{ width: `${(p.v / total) * 100}%` }} transition={{ duration: 0.4 }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', p.c)} />
            {p.key} <span className="num text-white">{num(p.v, 2)} kW</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function LiveSummary({ summary, className }: { summary: LoadSummary; className?: string }) {
  const empty = summary.applianceCount === 0;
  return (
    <section className={cn('rounded-[var(--radius-card)] bg-primary-dark p-6 text-white', className)} aria-live="polite" aria-label="Current estimate">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-white">Current estimate</h2>
        <span className="text-xs text-white/60">{summary.applianceCount} item{summary.applianceCount === 1 ? '' : 's'}</span>
      </div>

      <div className="mt-5">
        <p className="text-sm text-white/65">Daily consumption</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-5xl font-bold tracking-tight"><Counter value={summary.dailyEnergyKwh} /></span>
          <span className="text-lg text-white/70">kWh</span>
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-white/10 pt-5">
        <div>
          <dt className="text-xs text-white/60">Connected load</dt>
          <dd className="mt-0.5 text-lg font-medium"><Counter value={summary.connectedLoadKw} dp={2} /> kW</dd>
        </div>
        <div>
          <dt className="text-xs text-white/60">Estimated peak</dt>
          <dd className="mt-0.5 text-lg font-medium"><Counter value={summary.peakLoadKw} dp={2} /> kW</dd>
        </div>
        <div>
          <dt className="text-xs text-white/60">Peak with motor start</dt>
          <dd className="mt-0.5 text-lg font-medium"><Counter value={summary.surgePeakKw} dp={2} /> kW</dd>
        </div>
        <div>
          <dt className="text-xs text-white/60">After sunset</dt>
          <dd className="mt-0.5 text-lg font-medium"><Counter value={summary.nightEnergyKwh} /> kWh</dd>
        </div>
      </dl>

      {!empty && (
        <div className="mt-6 border-t border-white/10 pt-5">
          <PriorityBar s={summary} />
        </div>
      )}
      {summary.highPowerLoads.length > 0 && (
        <p className="mt-5 rounded-xl bg-white/[0.06] px-3.5 py-3 text-xs leading-relaxed text-white/75">
          High-power load: {summary.highPowerLoads.join(', ')}. Running it in daytime keeps your battery smaller.
        </p>
      )}
      <p className="mt-5 text-xs leading-relaxed text-white/50">
        PV, inverter and battery sizing are worked out on our server when you finish.
      </p>
    </section>
  );
}

/** Compact sticky bar for phones; expands into the full summary. */
export function MobileSummaryBar({ summary }: { summary: LoadSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <AnimatePresence>
        {open && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="max-h-[70dvh] overflow-y-auto rounded-t-3xl">
            <LiveSummary summary={summary} className="rounded-b-none pb-24" />
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="absolute inset-x-0 bottom-0 flex items-center gap-4 bg-primary-dark px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-left text-white shadow-[0_-8px_24px_-12px_rgba(0,0,0,.4)]"
        aria-expanded={open}
      >
        <span className="flex-1">
          <span className="block text-[0.7rem] text-white/60">Daily use</span>
          <span className="num text-lg font-bold">{num(summary.dailyEnergyKwh)} kWh</span>
        </span>
        <span className="flex-1">
          <span className="block text-[0.7rem] text-white/60">Peak</span>
          <span className="num text-lg font-bold">{num(summary.peakLoadKw, 2)} kW</span>
        </span>
        <span className="flex-1">
          <span className="block text-[0.7rem] text-white/60">Connected</span>
          <span className="num text-lg font-bold">{num(summary.connectedLoadKw, 2)} kW</span>
        </span>
        <ChevronUp className={cn('size-5 shrink-0 text-accent transition-transform', open && 'rotate-180')} />
      </button>
    </div>
  );
}