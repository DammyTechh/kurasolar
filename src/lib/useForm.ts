import { useState } from 'react';

/** Minimal controlled-form state for plain objects. */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const bind = (key: keyof T) => ({
    value: String(values[key] ?? ''),
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as T[typeof key]),
    error: errors[key] ?? null,
  });
  const require = (rules: Partial<Record<keyof T, string>>) => {
    const next: Partial<Record<keyof T, string>> = {};
    for (const [k, msg] of Object.entries(rules) as [keyof T, string][]) {
      const v = values[k];
      if (v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0)) next[k] = msg;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  return { values, set, setValues, errors, setErrors, bind, require };
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
