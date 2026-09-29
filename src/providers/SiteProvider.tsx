import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_CONTENT, DEFAULT_SETTINGS, type SiteContent, type SiteSettings } from '@/lib/settings';

interface SiteValue {
  settings: SiteSettings;
  content: Partial<SiteContent>;
  loading: boolean;
}

const SiteContext = createContext<SiteValue>({ settings: DEFAULT_SETTINGS, content: DEFAULT_CONTENT, loading: true });

const BRAND_VARS: Record<keyof SiteSettings['brand'], string> = {
  primary: '--ks-primary', primaryDark: '--ks-primary-dark', accent: '--ks-accent', ink: '--ks-ink',
  surface: '--ks-surface', success: '--ks-success', warning: '--ks-warning', danger: '--ks-danger',
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function applyBrand(brand: Partial<SiteSettings['brand']>) {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(BRAND_VARS)) {
    const value = brand[key as keyof SiteSettings['brand']];
    if (value && HEX.test(value)) root.style.setProperty(cssVar, value);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && brand.primaryDark && HEX.test(brand.primaryDark)) meta.setAttribute('content', brand.primaryDark);
}

export function useSiteQuery() {
  return useQuery({
    queryKey: ['site'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [s, c] = await Promise.all([
        supabase.from('site_settings').select('key, value'),
        supabase.from('site_content').select('key, value'),
      ]);
      if (s.error) throw s.error;
      if (c.error) throw c.error;
      const settings = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
      for (const row of s.data ?? []) {
        const base = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[row.key];
        settings[row.key] = base && typeof base === 'object' && !Array.isArray(base) ? { ...base, ...(row.value as object) } : row.value;
      }
      const content: Record<string, unknown> = { ...DEFAULT_CONTENT };
      for (const row of c.data ?? []) content[row.key] = row.value;
      return { settings: settings as unknown as SiteSettings, content: content as Partial<SiteContent> };
    },
  });
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useSiteQuery();

  useEffect(() => {
    if (data?.settings.brand) applyBrand(data.settings.brand);
  }, [data?.settings.brand]);

  const value = useMemo<SiteValue>(
    () => ({ settings: data?.settings ?? DEFAULT_SETTINGS, content: data?.content ?? DEFAULT_CONTENT, loading: isLoading }),
    [data, isLoading],
  );
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
