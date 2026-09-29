import { HttpError } from './http.ts';

type Obj = Record<string, unknown>;

export function str(o: Obj, key: string, opts: { required?: boolean; max?: number; label?: string } = {}): string | null {
  const raw = o[key];
  const value = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
  if (!value) {
    if (opts.required) throw new HttpError(422, `${opts.label ?? key} is required.`);
    return null;
  }
  return value.slice(0, opts.max ?? 500);
}

export function email(o: Obj, key = 'email', required = true): string | null {
  const value = str(o, key, { required, max: 254, label: 'Email' });
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) throw new HttpError(422, 'Enter a valid email address.');
  return value?.toLowerCase() ?? null;
}

export function phone(o: Obj, key = 'phone', required = true): string | null {
  const value = str(o, key, { required, max: 32, label: 'Phone number' });
  if (value && !/^\+?[0-9\s()-]{7,20}$/.test(value)) throw new HttpError(422, 'Enter a valid phone number.');
  return value;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export const escapeHtml = (s: string | null | undefined) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60);
}

export const randomToken = (bytes = 6) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
