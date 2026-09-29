import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Card, PageHeader } from '@/components/ui/Misc';
import { errorMessage, invoke } from '@/lib/api';
import { useSeo } from '@/lib/seo';
import { isEmail, useForm } from '@/lib/useForm';
import { useAuth } from '@/providers/AuthProvider';
import { useCart } from '@/providers/CartProvider';
import { useToast } from '@/providers/ToastProvider';

export default function QuotePage() {
  useSeo({ title: 'Request a quote', description: 'Get a quote for solar equipment, a complete package or installation.' });
  const [params] = useSearchParams();
  const pkg = params.get('package');
  const cart = useCart();
  const { profile, user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const f = useForm({
    full_name: profile?.full_name ?? '', email: user?.email ?? '', phone: profile?.phone ?? '',
    location: [profile?.city, profile?.state].filter(Boolean).join(', '),
    message: pkg ? `I would like a quote for the ${pkg.replace(/-/g, ' ')} package.` : '',
  });

  const submit = async () => {
    if (!f.require({ full_name: 'Enter your name.', email: 'Enter your email.', phone: 'Enter a phone number.' })) return;
    if (!isEmail(f.values.email)) return f.setErrors({ email: 'Enter a valid email address.' });
    setBusy(true);
    try {
      await invoke('enquiry-submit', { type: 'quote', ...f.values, items: cart.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })) });
      setDone(true);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="container-page py-16">
        <Card className="max-w-lg p-8">
          <CheckCircle2 className="size-9 text-success" />
          <h1 className="mt-4 text-2xl">Quote request sent</h1>
          <p className="mt-2 text-muted">An engineer will reply within one working day. A copy is in your inbox.</p>
          <ButtonLink to="/shop" variant="secondary" className="mt-6">Back to shop</ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader title="Request a quote" text="Tell us what you need. We’ll confirm availability, delivery and installation costs." />
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="grid gap-5 p-5 sm:grid-cols-2 sm:p-8">
          <Input label="Full name" autoComplete="name" {...f.bind('full_name')} />
          <Input label="Email" type="email" autoComplete="email" {...f.bind('email')} />
          <Input label="Phone" type="tel" autoComplete="tel" {...f.bind('phone')} />
          <Input label="Installation location" optional {...f.bind('location')} />
          <Textarea wrapClassName="sm:col-span-2" label="Anything else we should know?" optional rows={5} {...f.bind('message')} />
          <div className="sm:col-span-2"><Button size="lg" onClick={submit} loading={busy}>Send quote request</Button></div>
        </Card>
        <Card className="p-5 sm:p-7">
          <h2 className="text-lg">Items</h2>
          {cart.lines.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No items in your cart. That’s fine; describe what you need in the message.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {cart.lines.map((l) => <li key={l.product_id} className="flex justify-between gap-3"><span>{l.name}</span><span className="num text-muted">× {l.quantity}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
