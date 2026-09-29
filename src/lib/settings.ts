/** Shapes of the admin-editable JSON documents in site_settings and site_content. */

export interface BrandSettings {
  primary: string; primaryDark: string; accent: string; ink: string; surface: string;
  success: string; warning: string; danger: string;
}
export interface CompanySettings {
  name: string; legalName: string; email: string; phone: string; address: string; logoUrl: string; reportSignatory: string;
  socials?: { label: string; url: string }[];
}
export interface ConsultationSettings {
  defaultCurrency: string; fees: Record<string, number>; paymentCurrencies: string[]; fallbackCurrency: string;
}
export interface ApplianceLookups {
  tvWattsBySize: Record<string, number>;
  acWattsByHp: Record<string, { standard: number; inverter: number }>;
  compressorDutyCycle: { refrigerator: number; freezer: number; air_conditioner: number };
  compressorSurge: { standard: number; inverter: number };
}
export interface CommerceSettings { currency: string; deliveryFee: number; freeDeliveryThreshold: number; deliveryNote: string }
export interface WhatsappSettings { number: string; defaultMessage: string; enabled: boolean }
export interface SeoSettings { title: string; description: string; keywords: string[] }
export interface NotificationSettings { adminEmails: string[]; replyTo: string }
export interface MatchingSettings { maxInstallersPerRequest: number; notifyInstallers: boolean }

export interface SiteSettings {
  brand: BrandSettings;
  company: CompanySettings;
  consultation: ConsultationSettings;
  engineering: Record<string, unknown>;
  appliance_lookups: ApplianceLookups;
  commerce: CommerceSettings;
  whatsapp: WhatsappSettings;
  seo: SeoSettings;
  notifications: NotificationSettings;
  matching: MatchingSettings;
}

type Item = { title: string; text: string };
export interface SiteContent {
  hero: { headline: string; subheadline: string; primaryCta: string; secondaryCta: string; imageUrl?: string };
  trust: { items: Item[] };
  how_it_works: { title: string; steps: Item[]; footnote: string };
  why_us: { title: string; items: Item[] };
  installation: { title: string; text: string; cta: string; imageUrl?: string };
  testimonials: { title: string; items: { name: string; location?: string; quote: string; avatarUrl?: string }[] };
  faq: { title: string; items: { q: string; a: string }[] };
  cta: { title: string; text: string; button: string };
  disclaimer: { text: string };
  about: { title: string; body: string; imageUrl?: string };
  contact: { title: string; text: string; hours: string };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  brand: { primary: '#5B2A86', primaryDark: '#34184A', accent: '#C8973F', ink: '#1E1428', surface: '#F6F2FA', success: '#15803D', warning: '#B45309', danger: '#B91C1C' },
  company: { name: 'KuraSolar', legalName: 'KuraSolar Energy Systems Ltd.', email: 'hello@kurasolar.ng', phone: '+234 800 000 0000', address: 'Lagos, Nigeria', logoUrl: '/logo.png', reportSignatory: 'KuraSolar Engineering Team' },
  consultation: { defaultCurrency: 'NGN', fees: { NGN: 20000, USD: 25 }, paymentCurrencies: ['NGN', 'USD'], fallbackCurrency: 'NGN' },
  engineering: {},
  appliance_lookups: {
    tvWattsBySize: { '24"': 35, '32"': 50, '40"': 70, '43"': 85, '50"': 110, '55"': 130, '65"': 170, '75"': 220 },
    acWattsByHp: { '1': { standard: 950, inverter: 800 }, '1.5': { standard: 1450, inverter: 1150 }, '2': { standard: 1900, inverter: 1650 }, '2.5': { standard: 2450, inverter: 2100 }, '3': { standard: 2950, inverter: 2550 } },
    compressorDutyCycle: { refrigerator: 0.4, freezer: 0.45, air_conditioner: 0.7 },
    compressorSurge: { standard: 3, inverter: 1.3 },
  },
  commerce: { currency: 'NGN', deliveryFee: 15000, freeDeliveryThreshold: 1500000, deliveryNote: '' },
  whatsapp: { number: '', defaultMessage: 'Hello KuraSolar, I would like to speak with a solar engineer.', enabled: false },
  seo: { title: 'KuraSolar', description: '', keywords: [] },
  notifications: { adminEmails: [], replyTo: '' },
  matching: { maxInstallersPerRequest: 3, notifyInstallers: true },
};

/** Shown until the database content loads, or if a section was deleted. */
export const DEFAULT_CONTENT: Partial<SiteContent> = {
  hero: {
    headline: 'Know exactly what solar system your home needs.',
    subheadline: 'Calculate your household energy use, see the right solar and battery setup, and connect with a qualified installer.',
    primaryCta: 'Calculate my solar system',
    secondaryCta: 'Shop solar equipment',
  },
  cta: { title: 'Ready to size your system?', text: 'It takes about five minutes. You only pay if you want the full engineering report.', button: 'Start the calculator' },
  disclaimer: {
    text: 'This calculator provides an automated preliminary energy assessment based on information supplied by the customer and configured engineering assumptions. Final system sizing should be validated by a qualified solar/electrical engineer before procurement or installation.',
  },
};
