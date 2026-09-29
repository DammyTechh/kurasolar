import { Camera } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select } from '@/components/ui/Field';
import { Card } from '@/components/ui/Misc';
import { PROPERTY_TYPES } from '@/features/calculator/config';
import { errorMessage } from '@/lib/api';
import { useCountries, useRegions } from '@/lib/queries';
import { useSeo } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import { useForm } from '@/lib/useForm';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { safeNext } from './SignInPage';

/** Profile form shared by onboarding and Account → Profile. */
export function ProfileForm({ submitLabel, onSaved, onboarding }: { submitLabel: string; onSaved?: () => void; onboarding?: boolean }) {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const { data: countries = [] } = useCountries();
  const f = useForm({
    full_name: profile?.full_name ?? '', phone: profile?.phone ?? '', country: profile?.country ?? 'Nigeria',
    state: profile?.state ?? '', city: profile?.city ?? '', address: profile?.address ?? '',
    property_type: profile?.property_type ?? 'residential', marketing_opt_in: profile?.marketing_opt_in ?? false,
    avatar_url: profile?.avatar_url ?? '',
  });
  const code = countries.find((c) => c.name === f.values.country)?.code;
  const { data: regions = [] } = useRegions(code);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (file?: File) => {
    if (!file || !user) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return toast('Upload a PNG, JPG, WebP or GIF image.', 'error');
    if (file.size > 2 * 1024 * 1024) return toast('Profile pictures must be 2 MB or smaller.', 'error');
    setUploading(true);
    const path = `avatars/${user.id}/${crypto.randomUUID()}.${file.name.split('.').pop()?.toLowerCase() || 'jpg'}`;
    const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    setUploading(false);
    if (error) return toast(errorMessage(error), 'error');
    f.set('avatar_url', path);
  };

  const save = async () => {
    if (!f.require({ full_name: 'Enter your full name.', phone: 'Enter a phone number so engineers can reach you.' })) return;
    setBusy(true);
    const patch: Partial<Profile> = {
      full_name: f.values.full_name.trim(), phone: f.values.phone.trim(), country: f.values.country, state: f.values.state || null,
      city: f.values.city.trim() || null, address: f.values.address.trim() || null, property_type: f.values.property_type,
      marketing_opt_in: f.values.marketing_opt_in, avatar_url: f.values.avatar_url || null,
      ...(onboarding ? { onboarded_at: new Date().toISOString() } : {}),
    };
    const { error } = await supabase.from('profiles').update(patch).eq('id', user!.id);
    setBusy(false);
    if (error) return toast(errorMessage(error), 'error');
    await refreshProfile();
    toast(onboarding ? 'Profile saved' : 'Profile updated');
    onSaved?.();
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="flex items-center gap-4 sm:col-span-2">
        <Avatar name={f.values.full_name || user?.email} url={f.values.avatar_url} size={64} />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-primary ring-1 ring-line hover:bg-tint">
          <Camera className="size-4" /> {uploading ? 'Uploading…' : f.values.avatar_url ? 'Change photo' : 'Add a photo'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      </div>
      <Input label="Full name" autoComplete="name" {...f.bind('full_name')} />
      <Input label="Phone" type="tel" autoComplete="tel" {...f.bind('phone')} />
      <Input wrapClassName="sm:col-span-2" label="Email" value={user?.email ?? ''} disabled hint="Your sign-in email. Contact us to change it." />
      <Select label="Country" options={countries.map((c) => c.name)} {...f.bind('country')} onChange={(e) => { f.set('country', e.target.value); f.set('state', ''); }} />
      {regions.length ? <Select label="State / region" placeholder="Select" options={regions.map((r) => r.name)} {...f.bind('state')} /> : <Input label="State / region" {...f.bind('state')} />}
      <Input label="City" autoComplete="address-level2" {...f.bind('city')} />
      <Select label="Property type" options={PROPERTY_TYPES} {...f.bind('property_type')} />
      <Input wrapClassName="sm:col-span-2" label="Address" optional autoComplete="street-address" {...f.bind('address')} />
      <div className="sm:col-span-2"><Checkbox label="Send me occasional product news and solar tips" checked={f.values.marketing_opt_in} onChange={(v) => f.set('marketing_opt_in', v)} /></div>
      <div className="sm:col-span-2"><Button size="lg" onClick={save} loading={busy}>{submitLabel}</Button></div>
    </div>
  );
}

export default function WelcomePage() {
  useSeo({ title: 'Complete your profile', noindex: true });
  const [params] = useSearchParams();
  const nav = useNavigate();
  const next = safeNext(params.get('next'));
  return (
    <div className="container-page py-10 sm:py-16">
      <h1 className="text-[2rem] leading-tight sm:text-4xl">Welcome to KuraSolar</h1>
      <p className="mt-3 max-w-xl text-muted">A few details so engineers can contact you and your reports carry the right name and location.</p>
      <Card className="mt-8 max-w-2xl p-5 sm:p-8">
        <ProfileForm onboarding submitLabel="Save and continue" onSaved={() => nav(next === '/welcome' ? '/account' : next, { replace: true })} />
      </Card>
    </div>
  );
}
