import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SuccessCard } from '@/components/SuccessCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Card } from '@/components/ui/Misc';
import { errorMessage, invoke } from '@/lib/api';
import { useSeo } from '@/lib/seo';
import { isEmail, useForm } from '@/lib/useForm';
import { useAuth } from '@/providers/AuthProvider';
import { useSite } from '@/providers/SiteProvider';
import { useToast } from '@/providers/ToastProvider';

const TYPES = [
  { value: 'contact', label: 'General question' },
  { value: 'custom_installation', label: 'Custom installation' },
  { value: 'commercial', label: 'Commercial or industrial project' },
];

export default function ContactPage() {
  const { settings, content } = useSite();
  const c = settings.company;
  const cc = content.contact;
  useSeo({ title: 'Contact', description: cc?.text });
  const [params] = useSearchParams();
  const { user, profile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const f = useForm({ type: TYPES.some((t) => t.value === params.get('type')) ? params.get('type')! : 'contact', full_name: profile?.full_name ?? '', email: user?.email ?? '', phone: profile?.phone ?? '', company: '', location: '', message: '' });

  const submit = async () => {
    if (!f.require({ full_name: 'Enter your name.', email: 'Enter your email.', message: 'Write a short message.' })) return;
    if (!isEmail(f.values.email)) return f.setErrors({ email: 'Enter a valid email address.' });
    if (f.values.type !== 'contact' && !f.values.phone.trim()) return f.setErrors({ phone: 'A phone number helps our engineers reach you.' });
    setBusy(true);
    try {
      await invoke('enquiry-submit', f.values);
      setDone(true);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (done) return <SuccessCard title="Message sent" text="Thanks. An engineer will reply within one working day."><ButtonLink to="/" variant="secondary">Back home</ButtonLink></SuccessCard>;

  return (
    <div className="container-page grid gap-12 py-12 sm:py-16 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <h1 className="text-3xl leading-tight sm:text-5xl">{cc?.title ?? 'Contact us'}</h1>
        <p className="mt-4 max-w-md text-base text-muted">{cc?.text}</p>
        <ul className="mt-8 space-y-4 text-sm">
          <li className="flex gap-3"><Phone className="size-5 text-accent" /><a href={`tel:${c.phone.replace(/\s/g, '')}`} className="hover:text-primary">{c.phone}</a></li>
          <li className="flex gap-3"><Mail className="size-5 text-accent" /><a href={`mailto:${c.email}`} className="hover:text-primary">{c.email}</a></li>
          <li className="flex gap-3"><MapPin className="size-5 text-accent" />{c.address}</li>
          {cc?.hours && <li className="flex gap-3"><Clock className="size-5 text-accent" />{cc.hours}</li>}
        </ul>
      </div>
      <Card className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
        <Select wrapClassName="sm:col-span-2" label="What is it about?" options={TYPES} {...f.bind('type')} />
        <Input label="Full name" autoComplete="name" {...f.bind('full_name')} />
        <Input label="Email" type="email" autoComplete="email" {...f.bind('email')} />
        <Input label="Phone" type="tel" optional={f.values.type === 'contact'} {...f.bind('phone')} />
        {f.values.type === 'commercial' ? <Input label="Organisation" optional {...f.bind('company')} /> : <Input label="Location" optional {...f.bind('location')} />}
        <Textarea wrapClassName="sm:col-span-2" label="Message" rows={6} {...f.bind('message')} />
        <div className="sm:col-span-2"><Button size="lg" onClick={submit} loading={busy}>Send message</Button></div>
      </Card>
    </div>
  );
}
