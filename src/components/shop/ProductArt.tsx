import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/supabase';

/**
 * Product image with a clean drawn fallback per equipment type, so the
 * catalogue looks intentional before real photography is uploaded.
 */
export function ProductArt({ src, role, alt, className }: { src?: string | null; role?: string | null; alt: string; className?: string }) {
  if (src) {
    return <img src={mediaUrl(src)} alt={alt} loading="lazy" decoding="async" className={cn('size-full object-contain', className)} />;
  }
  return (
    <svg viewBox="0 0 200 160" role="img" aria-label={alt} className={cn('size-full', className)}>
      <rect width="200" height="160" fill="var(--color-tint)" />
      {role === 'panel' && (
        <g transform="translate(100 84) skewX(-12)">
          <rect x="-58" y="-44" width="116" height="84" rx="4" fill="var(--ks-primary-dark)" />
          {Array.from({ length: 24 }).map((_, i) => (
            <rect key={i} x={-54 + (i % 6) * 18.5} y={-40 + Math.floor(i / 6) * 19.5} width="16" height="17" rx="1.5" fill="var(--ks-primary)" opacity={0.75 + (i % 3) * 0.08} />
          ))}
          <rect x="-58" y="-44" width="116" height="84" rx="4" fill="none" stroke="#fff" strokeOpacity=".35" />
        </g>
      )}
      {role === 'inverter' && (
        <g>
          <rect x="62" y="28" width="76" height="104" rx="10" fill="#fff" stroke="var(--color-line)" />
          <rect x="74" y="42" width="52" height="26" rx="4" fill="var(--ks-primary-dark)" />
          <rect x="80" y="50" width="22" height="4" rx="2" fill="var(--ks-accent)" />
          <rect x="80" y="58" width="34" height="3" rx="1.5" fill="#fff" opacity=".5" />
          {[0, 1, 2].map((i) => <circle key={i} cx={84 + i * 16} cy="84" r="4" fill={i === 0 ? 'var(--ks-success)' : 'var(--color-line)'} />)}
          <rect x="74" y="100" width="52" height="3" rx="1.5" fill="var(--color-line)" />
          <rect x="74" y="108" width="52" height="3" rx="1.5" fill="var(--color-line)" />
        </g>
      )}
      {role === 'battery' && (
        <g>
          <rect x="56" y="30" width="88" height="104" rx="12" fill="var(--ks-primary)" />
          <rect x="56" y="30" width="88" height="22" rx="12" fill="var(--ks-primary-dark)" />
          <rect x="70" y="66" width="60" height="10" rx="5" fill="#fff" opacity=".18" />
          <rect x="70" y="66" width="44" height="10" rx="5" fill="var(--ks-accent)" />
          <text x="100" y="108" textAnchor="middle" fontSize="12" fontFamily="Ubuntu, sans-serif" fill="#fff" opacity=".8">LiFePO4</text>
        </g>
      )}
      {(role === 'protection' || role === 'accessory') && (
        <g>
          <rect x="46" y="44" width="108" height="76" rx="8" fill="#fff" stroke="var(--color-line)" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={58 + i * 24} y="58" width="16" height="48" rx="3" fill="var(--color-tint)" stroke="var(--color-line)" />
              <rect x={61 + i * 24} y={i % 2 ? 70 : 64} width="10" height="12" rx="2" fill={i === 3 ? 'var(--ks-danger)' : 'var(--ks-primary)'} />
            </g>
          ))}
        </g>
      )}
      {role === 'cable' && (
        <g fill="none" strokeLinecap="round">
          <circle cx="100" cy="80" r="40" stroke="var(--ks-primary-dark)" strokeWidth="14" />
          <circle cx="100" cy="80" r="40" stroke="var(--ks-danger)" strokeWidth="5" strokeDasharray="4 10" opacity=".8" />
          <circle cx="100" cy="80" r="18" fill="var(--color-tint)" stroke="var(--color-line)" strokeWidth="2" />
        </g>
      )}
      {role === 'mounting' && (
        <g stroke="var(--ks-primary)" strokeWidth="6" strokeLinecap="round">
          <path d="M40 116 L160 116" />
          <path d="M52 116 L96 52 M112 116 L152 60" />
          <path d="M80 76 L128 84" stroke="var(--ks-accent)" />
        </g>
      )}
      {!role && <circle cx="100" cy="80" r="26" fill="var(--ks-accent)" opacity=".8" />}
    </svg>
  );
}
