import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Card } from '@/components/ui/Misc';
import { errorMessage, invoke } from '@/lib/api';
import { cn } from '@/lib/cn';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { JsonDocEditor, type Schema } from '../components/JsonEditor';

function Tabs({ tabs }: { tabs: { key: string; label: string; node: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]!.key);
  return (
    <div>
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={active === t.key} type="button" onClick={() => setActive(t.key)} className={cn('shrink-0 rounded-full px-4 py-2 text-sm', active === t.key ? 'bg-primary text-white' : 'bg-white text-ink/75 ring-1 ring-line hover:text-primary')}>{t.label}</button>
        ))}
      </div>
      <div className="mt-6">{tabs.find((t) => t.key === active)?.node}</div>
    </div>
  );
}

const Title = ({ t, d }: { t: string; d?: string }) => (
  <div className="mb-6"><h1 className="text-2xl sm:text-3xl">{t}</h1>{d && <p className="mt-2 max-w-2xl text-sm text-muted">{d}</p>}</div>
);

const p = (label: string, hint?: string): Schema => ({ type: 'percent', label, hint });
const n = (label: string, hint?: string, step?: number): Schema => ({ type: 'number', label, hint, step });
const s = (label: string, hint?: string): Schema => ({ type: 'string', label, hint });
const t = (label: string, hint?: string): Schema => ({ type: 'text', label, hint });
const items = (label: string, itemLabel = 'Item'): Schema => ({ type: 'list', label, itemLabel, item: { title: s('Title'), text: t('Text') } });

const ENGINEERING: Record<string, Schema> = {
  batteryDoD: p('Battery depth of discharge', 'LiFePO4 is typically 80–90%.'),
  batteryEfficiency: p('Battery round-trip efficiency'),
  inverterEfficiency: p('Inverter efficiency'),
  batteryReserveMargin: n('Battery reserve multiplier', '1.1 adds 10% spare capacity.', 0.01),
  batteryModuleKwh: n('Battery module size (kWh)', 'Standard tier is rounded to whole modules.', 0.01),
  batteryExtendedMultiplier: n('Extended tier multiplier', undefined, 0.1),
  pvDerating: p('PV derating', 'Soiling, mismatch, tolerance and ageing.'),
  temperatureLoss: p('Fallback temperature loss', 'Used when a region has no temperature.'),
  temperatureCoefficient: n('Temperature coefficient (per °C)', '0.0035 = 0.35%/°C', 0.0001),
  cellTempRise: n('Cell temperature rise above ambient (°C)'),
  wiringLoss: p('Wiring losses'),
  mpptEfficiency: p('MPPT efficiency'),
  pvDesignMargin: n('PV design margin multiplier', '1.15 oversizes the array by 15%.', 0.01),
  panelWattage: n('Reference panel wattage (W)'),
  inverterExpansionMargin: p('Inverter expansion headroom'),
  inverterSurgeRatio: n('Inverter surge / continuous ratio', undefined, 0.1),
  powerFactor: n('Power factor (kW → kVA)', undefined, 0.01),
  nightHours: n('Hours without useful sun'),
  inverterSizesKw: { type: 'numbers', label: 'Standard inverter sizes (kW)', hint: 'Ascending, comma separated. The engine snaps up to the next size.' },
  coincidence: { type: 'record', label: 'Coincidence factors by priority', hint: 'Share of each group expected to run at once.', percent: true },
  nightFraction: { type: 'record', label: 'Energy after sunset by usage window', percent: true },
  backupHoursByGrid: { type: 'record', label: 'Default backup hours by grid condition' },
  generatorLitresPerKwh: n('Generator fuel use (litres/kWh)', undefined, 0.01),
  fuelPricePerLitre: n('Fuel price per litre (₦)'),
  co2KgPerKwh: n('Generator CO₂ (kg/kWh)', undefined, 0.01),
};

export function Engineering() {
  return (
    <div>
      <Title t="Engineering assumptions" d="Every sizing calculation reads these values on the server. Changes apply to new calculations immediately; paid reports keep the assumptions they were calculated with." />
      <Tabs tabs={[
        { key: 'eng', label: 'Sizing assumptions', node: <JsonDocEditor table="site_settings" docKey="engineering" title="Sizing assumptions" schema={ENGINEERING} /> },
        { key: 'lookups', label: 'Appliance lookups', node: <JsonDocEditor table="site_settings" docKey="appliance_lookups" title="Appliance lookups" description="Default wattages the calculator suggests. TV sizes use keys like 43&quot;. AC values are edited per horsepower row." schema={{
          tvWattsBySize: { type: 'record', label: 'TV watts by screen size', keyLabel: 'Size', valueLabel: 'Watts' },
          acWattsByHp: { type: 'object', label: 'AC watts by horsepower', hint: 'Standard and inverter wattage for each capacity.', fields: Object.fromEntries(['1', '1.5', '2', '2.5', '3'].map((hp) => [hp, { type: 'object', label: `${hp} HP`, fields: { standard: n('Standard (W)'), inverter: n('Inverter (W)') } } as Schema])) },
          compressorDutyCycle: { type: 'record', label: 'Compressor duty cycles', percent: true },
          compressorSurge: { type: 'record', label: 'Compressor surge factors' },
        }} /> },
      ]} />
    </div>
  );
}

export function Pricing() {
  return (
    <div>
      <Title t="Fees and currencies" d="Amounts charged are always read from here by the server, never from the browser." />
      <div className="space-y-6">
        <JsonDocEditor table="site_settings" docKey="consultation" title="Consultation (inspection) fee" description="Fee per currency. Only currencies enabled on your Paystack account should be listed as payment currencies." schema={{
          fees: { type: 'record', label: 'Fee by currency', keyLabel: 'Currency', valueLabel: 'Amount' },
          paymentCurrencies: { type: 'strings', label: 'Currencies accepted at checkout', hint: 'e.g. NGN, USD' },
          defaultCurrency: s('Default currency'),
          fallbackCurrency: s('Fallback currency', 'Used when a customer’s currency is not accepted.'),
        }} />
        <JsonDocEditor table="site_settings" docKey="commerce" title="Shop and delivery" schema={{
          currency: s('Shop currency'), deliveryFee: n('Delivery fee'), freeDeliveryThreshold: n('Free delivery from'), deliveryNote: t('Delivery note shown to customers'),
        }} />
      </div>
    </div>
  );
}

export function Content() {
  const img = (label: string): Schema => ({ type: 'image', label });
  return (
    <div>
      <Title t="Site content" d="Edit the words and images on the public site. Changes go live when you save." />
      <Tabs tabs={[
        { key: 'hero', label: 'Hero', node: <JsonDocEditor table="site_content" docKey="hero" title="Hero" description="Leave the image empty to show the animated 3D scene." schema={{ headline: s('Headline'), subheadline: t('Sub-headline'), primaryCta: s('Main button'), secondaryCta: s('Second button'), imageUrl: img('Replacement image (optional)') }} /> },
        { key: 'trust', label: 'Trust points', node: <JsonDocEditor table="site_content" docKey="trust" title="Trust points" schema={{ items: items('Points', 'Point') }} /> },
        { key: 'how', label: 'How it works', node: <JsonDocEditor table="site_content" docKey="how_it_works" title="How it works" schema={{ title: s('Title'), steps: items('Steps', 'Step'), footnote: s('Footnote') }} /> },
        { key: 'why', label: 'Why us', node: <JsonDocEditor table="site_content" docKey="why_us" title="Why choose us" schema={{ title: s('Title'), items: items('Reasons', 'Reason') }} /> },
        { key: 'install', label: 'Installation', node: <JsonDocEditor table="site_content" docKey="installation" title="Installation band" schema={{ title: s('Title'), text: t('Text'), cta: s('Button') }} /> },
        { key: 'testimonials', label: 'Testimonials', node: <JsonDocEditor table="site_content" docKey="testimonials" title="Testimonials" description="Only real customer quotes, with permission. The section is hidden while empty." schema={{ title: s('Title'), items: { type: 'list', label: 'Testimonials', itemLabel: 'Testimonial', item: { name: s('Name'), location: s('Location'), quote: t('Quote'), avatarUrl: img('Photo') } } }} /> },
        { key: 'faq', label: 'FAQ', node: <JsonDocEditor table="site_content" docKey="faq" title="Frequently asked questions" description="Also published as FAQ structured data for search engines." schema={{ title: s('Title'), items: { type: 'list', label: 'Questions', itemLabel: 'Question', item: { q: s('Question'), a: t('Answer') } } }} /> },
        { key: 'cta', label: 'Closing call to action', node: <JsonDocEditor table="site_content" docKey="cta" title="Closing call to action" schema={{ title: s('Title'), text: t('Text'), button: s('Button') }} /> },
        { key: 'about', label: 'About page', node: <JsonDocEditor table="site_content" docKey="about" title="About page" schema={{ title: s('Title'), body: t('Body (Markdown)'), imageUrl: img('Image') }} /> },
        { key: 'contact', label: 'Contact page', node: <JsonDocEditor table="site_content" docKey="contact" title="Contact page" schema={{ title: s('Title'), text: t('Intro'), hours: s('Opening hours') }} /> },
        { key: 'disclaimer', label: 'Disclaimer', node: <JsonDocEditor table="site_content" docKey="disclaimer" title="Engineering disclaimer" description="Shown in the calculator, footer and PDF reports." schema={{ text: t('Disclaimer') }} /> },
      ]} />
    </div>
  );
}

export function Settings() {
  const c = (label: string): Schema => ({ type: 'color', label });
  return (
    <div>
      <Title t="Brand and settings" />
      <Tabs tabs={[
        { key: 'brand', label: 'Colours', node: <JsonDocEditor table="site_settings" docKey="brand" title="Brand colours" description="Applied across the website, admin and emails. Keep enough contrast between primary colours and white text." schema={{ primary: c('Primary'), primaryDark: c('Primary dark'), accent: c('Accent'), ink: c('Text'), surface: c('Soft background'), success: c('Success'), warning: c('Warning'), danger: c('Danger') }} /> },
        { key: 'company', label: 'Company', node: <JsonDocEditor table="site_settings" docKey="company" title="Company details" description="Used on the website, in emails and on PDF reports." schema={{ name: s('Brand name'), legalName: s('Legal name'), email: s('Email'), phone: s('Phone'), address: s('Address'), logoUrl: s('Logo URL', 'PNG or JPG. Use /logo.png for the bundled logo.'), reportSignatory: s('Report signed by') }} /> },
        { key: 'whatsapp', label: 'WhatsApp', node: <JsonDocEditor table="site_settings" docKey="whatsapp" title="WhatsApp button" schema={{ enabled: { type: 'boolean', label: 'Show the WhatsApp button' }, number: s('Number', 'International format without +, e.g. 2348012345678'), defaultMessage: t('Default message') }} /> },
        { key: 'seo', label: 'Search (SEO)', node: <JsonDocEditor table="site_settings" docKey="seo" title="Search engine defaults" schema={{ title: s('Home page title'), description: t('Meta description'), keywords: { type: 'strings', label: 'Keywords' } }} /> },
        { key: 'notifications', label: 'Notifications', node: <JsonDocEditor table="site_settings" docKey="notifications" title="Notifications" description="Where new orders, requests, enquiries and duplicate-payment alerts are sent." schema={{ adminEmails: { type: 'strings', label: 'Admin notification emails' }, replyTo: s('Reply-to address for customer emails') }} /> },
        { key: 'matching', label: 'Installer matching', node: <JsonDocEditor table="site_settings" docKey="matching" title="Installer matching" schema={{ maxInstallersPerRequest: n('Installers matched per request'), notifyInstallers: { type: 'boolean', label: 'Email matched installers automatically' } }} /> },
      ]} />
    </div>
  );
}

export function Account() {
  const { profile, user } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState(user?.email ?? '');
  const [sending, setSending] = useState(false);

  const change = async () => {
    if (pw.length < 10) return toast('Use at least 10 characters.', 'error');
    if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) return toast('Include upper and lower case letters and a number.', 'error');
    if (pw !== pw2) return toast('The passwords don’t match.', 'error');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast(errorMessage(error), 'error');
    setPw(''); setPw2('');
    toast('Password changed');
  };

  const test = async () => {
    setSending(true);
    try { await invoke('admin-actions', { action: 'test_email', to: testTo }); toast('Test email sent. Check the email log if it doesn’t arrive.'); } catch (e) { toast(errorMessage(e), 'error'); } finally { setSending(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Title t="My admin account" d={`Signed in as ${profile?.username ?? ''} (${user?.email}).`} />
      <Card className="p-6">
        <h2 className="text-lg">Change password</h2>
        <p className="mt-1 text-sm text-muted">Change the seeded password after your first sign-in.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Input label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Input label="Repeat new password" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        <Button className="mt-6" onClick={change} loading={busy}>Change password</Button>
      </Card>
      <Card className="p-6">
        <h2 className="text-lg">Test email delivery</h2>
        <p className="mt-1 text-sm text-muted">Sends a branded test message through Resend.</p>
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <Input wrapClassName="flex-1 min-w-60" label="Send to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <Button variant="secondary" onClick={test} loading={sending}>Send test</Button>
        </div>
      </Card>
    </div>
  );
}
