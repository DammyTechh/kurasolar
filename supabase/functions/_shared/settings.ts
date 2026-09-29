import { admin } from './db.ts';

export interface CompanySettings {
  name: string;
  legalName?: string;
  email: string;
  phone: string;
  address: string;
  logoUrl?: string;
  reportSignatory?: string;
}

export interface ConsultationSettings {
  defaultCurrency: string;
  fees: Record<string, number>;
  paymentCurrencies: string[];
  fallbackCurrency: string;
}

export interface CommerceSettings {
  currency: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  deliveryNote?: string;
}

export interface NotificationSettings {
  adminEmails: string[];
  replyTo?: string;
}

export interface MatchingSettings {
  maxInstallersPerRequest: number;
  notifyInstallers: boolean;
}

type SettingsMap = {
  company: CompanySettings;
  consultation: ConsultationSettings;
  commerce: CommerceSettings;
  notifications: NotificationSettings;
  matching: MatchingSettings;
  engineering: Record<string, unknown>;
  brand: Record<string, string>;
};

/** Loads site_settings rows by key. Values are cached for the life of the function instance (≤ 60 s). */
const cache = new Map<string, { at: number; value: unknown }>();

export async function getSettings<K extends keyof SettingsMap>(...keys: K[]): Promise<Pick<SettingsMap, K>> {
  const now = Date.now();
  const missing = keys.filter((k) => !cache.has(k) || now - cache.get(k)!.at > 60_000);
  if (missing.length) {
    const { data, error } = await admin().from('site_settings').select('key, value').in('key', missing);
    if (error) throw error;
    for (const row of data ?? []) cache.set(row.key, { at: now, value: row.value });
  }
  const out = {} as Pick<SettingsMap, K>;
  for (const k of keys) (out as Record<string, unknown>)[k] = cache.get(k)?.value ?? {};
  return out;
}

export async function getContent<T = Record<string, unknown>>(key: string): Promise<T | null> {
  const { data } = await admin().from('site_content').select('value').eq('key', key).maybeSingle();
  return (data?.value as T) ?? null;
}
