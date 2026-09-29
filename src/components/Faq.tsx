import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it) => (
        <details key={it.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left text-[1.0625rem] font-medium [&::-webkit-details-marker]:hidden">
            {it.q}
            <Plus className={cn('mt-1 size-5 shrink-0 text-primary transition-transform group-open:rotate-45')} />
          </summary>
          <p className="mt-3 max-w-[68ch] leading-relaxed text-ink/75">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
