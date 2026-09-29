import { lazy, Suspense, useEffect, useState } from 'react';

const HeroScene = lazy(() => import('./HeroScene'));

function canRender3D() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.innerWidth < 768) return false; // keep mobile data light
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Static drawing of the same scene, used on phones and as the 3D loading state. */
export function HeroIllustration() {
  const cells = Array.from({ length: 8 });
  return (
    <svg viewBox="0 0 520 380" className="size-full" role="img" aria-label="Solar panels on a roof charging a battery under the sun">
      <g fill="var(--ks-accent)">
        <circle cx="330" cy="92" r="34" />
        {Array.from({ length: 7 }).map((_, i) => {
          const a = Math.PI * (1.12 + (i * 0.76) / 6);
          const x = 330 + Math.cos(a) * 62, y = 92 + Math.sin(a) * 62;
          return <rect key={i} x={x - 6} y={y - 14} width="12" height={i % 2 ? 20 : 28} rx="3" transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} />;
        })}
      </g>
      <path d="M40 300 L300 360 L500 290 L240 238 Z" fill="#f3eef8" />
      <path d="M40 300 L300 360 L300 372 L40 312 Z" fill="var(--ks-primary-dark)" />
      <path d="M300 360 L500 290 L500 302 L300 372 Z" fill="var(--ks-primary)" />
      {cells.map((_, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const x = 88 + col * 58 + row * 34, y = 250 + col * 13 - row * 36;
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M0 0 L52 12 L78 -16 L26 -28 Z" fill="var(--ks-primary-dark)" />
            <path d="M4 -1 L50 9 L73 -15 L27 -25 Z" fill="var(--ks-primary)" opacity=".9" />
            <path d="M16 2 L39 -24 M31 6 L54 -20 M46 9 L66 -14" stroke="#fff" strokeOpacity=".12" />
          </g>
        );
      })}
      <path d="M380 300 C 400 296, 420 290, 430 270" fill="none" stroke="#e7e0ef" strokeWidth="4" strokeLinecap="round" />
      <circle cx="404" cy="295" r="4" fill="var(--ks-accent)" />
      <g transform="translate(424 170)">
        <rect width="46" height="104" rx="8" fill="var(--ks-primary)" />
        <rect width="46" height="12" rx="6" fill="var(--ks-primary-dark)" />
        <rect x="19" y="30" width="8" height="60" rx="4" fill="#fff" opacity=".18" />
        <rect x="19" y="48" width="8" height="42" rx="4" fill="var(--ks-accent)" />
      </g>
    </svg>
  );
}

export function HeroVisual() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const id = window.requestIdleCallback ? window.requestIdleCallback(() => setEnabled(canRender3D())) : window.setTimeout(() => setEnabled(canRender3D()), 200);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  return (
    <div className="relative size-full">
      {enabled ? (
        <Suspense fallback={<HeroIllustration />}>
          <HeroScene />
        </Suspense>
      ) : (
        <HeroIllustration />
      )}
    </div>
  );
}
