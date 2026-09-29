const SYMBOLS: Record<string, string> = { NGN: '₦', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', USD: '$', GBP: '£', EUR: '€' };

export function money(amount: number | string | null | undefined, currency = 'NGN') {
  const n = Number(amount ?? 0);
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const digits = n % 1 === 0 ? 0 : 2;
  return `${symbol}${n.toLocaleString('en-NG', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function num(n: number | string | null | undefined, dp = 1) {
  const v = Number(n ?? 0);
  return v.toLocaleString('en-NG', { maximumFractionDigits: dp, minimumFractionDigits: 0 });
}

export function kw(n: number | string | null | undefined) {
  return `${num(n, 2)} kW`;
}

export function kwh(n: number | string | null | undefined) {
  return `${num(n, 1)} kWh`;
}

export function date(value: string | null | undefined, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function titleCase(s: string | null | undefined) {
  return (s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sentence(s: string | null | undefined) {
  const t = (s ?? '').replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function initials(name?: string | null) {
  return (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
}
