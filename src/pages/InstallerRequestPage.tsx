import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SuccessCard } from '@/components/SuccessCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Card, PageHeader } from '@/components/ui/Misc';
import { PROPERTY_TYPES } from '@/features/calculator/config';
import { useAssessment } from './AssessmentPage';
import { errorMessage, invoke } from '@/lib/api';
import { useNgStates } from '@/lib/queries';
import { useSeo } from '@/lib/seo';
import { isEmail, useForm } from '@/lib/useForm';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';

export default function InstallerRequestPage() {
  useSeo({ title: 'Request a solar installer', description: 'Send one request and get matched with verified solar installers who cover your state.' });
  const [params] = useSearchParams();
  const assessmentId = params.get('assessment');
  const { user, profile } = useAuth();
  const { data: a } = useAssessment(user && assessmentId ? assessmentId : undefined);
  const { states } = useNgStates();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; matched: number } | null>(null);
  const f = useForm({
    full_name: profile?.full_name ?? '', email: user?.email ?? '', phone: profile?.phone ?? '',
    state: params.get('state') ?? profile?.state ?? '', city: profile?.city ?? '', address: profile?.address ?? '',
    property_type: profile?.property_type ?? 'residential', system_size: '', preferred_date: '',
    message: params.get('installer') ? `I’d like to work with ${params.get('installer')!.replace(/-[a-z0-9]{3,}$/, '').replace(/-/g, ' ')}.` : '',
  });

  const submit = async () => {
    if (!f.require({ full_name: 'Enter your name.', email: 'Enter your email.', phone: 'Enter a phone number.', state: 'Choose the state for the installation.' })) return;
    if (!isEmail(f.values.email)) return f.setErrors({ email: 'Enter a valid email address.' });
    setBusy(true);
    try {
      const res = await invoke<{ code: string; matched: number }>('installer-request', { ...f.values, assessment_id: assessmentId });
      setDone(res);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <SuccessCard title="Request received" text={<>Your reference is <span className="num font-medium text-ink">{done.code}</span>. {done.matched > 0 ? `We’ve matched you with ${done.matched} verified installer${done.matched > 1 ? 's' : ''}; expect a call soon.` : 'Our team will find an installer who covers your area and get back to you.'}</>}>
        {user && <ButtonLink to="/account/requests">View my requests</ButtonLink>}
        <ButtonLink to="/" variant="secondary">Back home</ButtonLink>
      </SuccessCard>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader title="Request an installer" text="One request, up to three verified installers who cover your state and system type." />
      {a?.assessment && (
        <p className="mt-6 max-w-2xl rounded-xl bg-tint px-4 py-3 text-sm">
          Linked to assessment <span className="num font-medium">{a.assessment.code}</span> ({a.assessment.system_class}). Installers will see your system size.
        </p>
      )}
      <Card className="mt-8 grid max-w-3xl gap-5 p-5 sm:grid-cols-2 sm:p-8">
        <Input label="Full name" autoComplete="name" {...f.bind('full_name')} />
        <Input label="Phone" type="tel" autoComplete="tel" {...f.bind('phone')} />
        <Input wrapClassName="sm:col-span-2" label="Email" type="email" autoComplete="email" {...f.bind('email')} />
        <Select label="State" placeholder="Select" options={states} {...f.bind('state')} />
        <Input label="City" {...f.bind('city')} />
        <Input wrapClassName="sm:col-span-2" label="Installation address" optional {...f.bind('address')} />
        <Select label="Property type" options={PROPERTY_TYPES} {...f.bind('property_type')} />
        {!a?.assessment && <Input label="System size, if known" optional placeholder="e.g. 5 kW + 10 kWh" {...f.bind('system_size')} />}
        <Input label="Preferred date" optional type="date" min={today} {...f.bind('preferred_date')} />
        <Textarea wrapClassName="sm:col-span-2" label="Message" optional rows={4} {...f.bind('message')} />
        <div className="sm:col-span-2"><Button size="lg" onClick={submit} loading={busy}>Send request</Button></div>
      </Card>
    </div>
  );
}
