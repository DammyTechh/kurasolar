import { useState } from 'react';
import { SuccessCard } from '@/components/SuccessCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Card, PageHeader } from '@/components/ui/Misc';
import { errorMessage, invoke } from '@/lib/api';
import { sentence } from '@/lib/format';
import { useNgStates } from '@/lib/queries';
import { useSeo } from '@/lib/seo';
import { INSTALLER_SERVICES } from '@/lib/types';
import { isEmail, useForm } from '@/lib/useForm';
import { useToast } from '@/providers/ToastProvider';

export default function InstallerJoinPage() {
  useSeo({ title: 'Become a KuraSolar installer', description: 'Join our network of verified solar installers and receive qualified leads in your state.' });
  const { states } = useNgStates();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const f = useForm({
    company_name: '', contact_person: '', email: '', phone: '', whatsapp: '', website: '', state: '', city: '',
    years_experience: '', completed_projects: '', certifications: '', bio: '',
    services: [] as string[], states_covered: [] as string[],
  });

  const toggle = (key: 'services' | 'states_covered', v: string) =>
    f.set(key, f.values[key].includes(v) ? f.values[key].filter((x) => x !== v) : [...f.values[key], v]);

  const submit = async () => {
    if (!f.require({ company_name: 'Enter your company name.', contact_person: 'Enter a contact person.', email: 'Enter an email.', phone: 'Enter a phone number.', state: 'Choose your base state.', services: 'Choose at least one service.' })) return;
    if (!isEmail(f.values.email)) return f.setErrors({ email: 'Enter a valid email address.' });
    setBusy(true);
    try {
      await invoke('enquiry-submit', {
        type: 'installer_application', ...f.values,
        certifications: f.values.certifications.split(',').map((s) => s.trim()).filter(Boolean),
        years_experience: Number(f.values.years_experience) || 0, completed_projects: Number(f.values.completed_projects) || 0,
      });
      setDone(true);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (done) return <SuccessCard title="Application received" text="Our team reviews every installer before listing. We’ll email you once your profile is verified, usually within five working days."><ButtonLink to="/" variant="secondary">Back home</ButtonLink></SuccessCard>;

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader title="Join the installer network" text="Receive requests from customers who already know the system they need, with the load assessment attached." />
      <Card className="mt-8 grid max-w-3xl gap-6 p-6 sm:grid-cols-2 sm:p-8">
        <Input label="Company name" {...f.bind('company_name')} />
        <Input label="Contact person" {...f.bind('contact_person')} />
        <Input label="Email" type="email" {...f.bind('email')} />
        <Input label="Phone" type="tel" {...f.bind('phone')} />
        <Input label="WhatsApp number" optional type="tel" {...f.bind('whatsapp')} />
        <Input label="Website" optional type="url" placeholder="https://" {...f.bind('website')} />
        <Select label="Base state" placeholder="Select" options={states} {...f.bind('state')} />
        <Input label="City" {...f.bind('city')} />
        <Input label="Years of experience" inputMode="numeric" {...f.bind('years_experience')} />
        <Input label="Completed projects" inputMode="numeric" {...f.bind('completed_projects')} />
        <Input wrapClassName="sm:col-span-2" label="Certifications" optional hint="Separate with commas, e.g. COREN, NABCEP, manufacturer training" {...f.bind('certifications')} />
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Services</legend>
          {f.errors.services && <p className="mt-1 text-sm text-danger">{f.errors.services}</p>}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {INSTALLER_SERVICES.map((s) => <Checkbox key={s} label={s === 'bess' ? 'BESS' : s === 'solar_pv' ? 'Solar PV' : sentence(s)} checked={f.values.services.includes(s)} onChange={() => toggle('services', s)} />)}
          </div>
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Other states you cover</legend>
          <div className="mt-3 grid max-h-56 grid-cols-2 gap-3 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-3">
            {states.filter((s) => s !== f.values.state).map((s) => <Checkbox key={s} label={s} checked={f.values.states_covered.includes(s)} onChange={() => toggle('states_covered', s)} />)}
          </div>
        </fieldset>
        <Textarea wrapClassName="sm:col-span-2" label="About your company" optional rows={4} {...f.bind('bio')} />
        <div className="sm:col-span-2"><Button size="lg" onClick={submit} loading={busy}>Submit application</Button></div>
      </Card>
    </div>
  );
}
