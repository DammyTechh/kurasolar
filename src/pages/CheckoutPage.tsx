import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductArt } from '@/components/shop/ProductArt';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Card, EmptyState, PageHeader } from '@/components/ui/Misc';
import { errorMessage, invoke } from '@/lib/api';
import { money } from '@/lib/format';
import { useNgStates } from '@/lib/queries';
import { useSeo } from '@/lib/seo';
import { useForm } from '@/lib/useForm';
import { useAuth } from '@/providers/AuthProvider';
import { useCart } from '@/providers/CartProvider';
import { useSite } from '@/providers/SiteProvider';
import { useToast } from '@/providers/ToastProvider';

export default function CheckoutPage() {
  useSeo({ title: 'Checkout', noindex: true });
  const cart = useCart();
  const { profile, user } = useAuth();
  const { settings } = useSite();
  const { states } = useNgStates();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const f = useForm({
    full_name: profile?.full_name ?? '', phone: profile?.phone ?? '', address: profile?.address ?? '',
    city: profile?.city ?? '', state: profile?.state ?? '', notes: '',
  });
  const c = settings.commerce;
  const delivery = cart.subtotal >= c.freeDeliveryThreshold ? 0 : c.deliveryFee;

  if (cart.lines.length === 0) {
    return <div className="container-page py-16"><EmptyState title="Your cart is empty" text="Add equipment to your cart to check out." action={<ButtonLink to="/shop">Browse the shop</ButtonLink>} /></div>;
  }

  const pay = async () => {
    if (!f.require({ full_name: 'Enter the recipient’s name.', phone: 'Enter a phone number for delivery.', address: 'Enter the delivery address.', city: 'Enter the city.', state: 'Choose the state.' })) return;
    setBusy(true);
    try {
      const res = await invoke<{ authorization_url: string }>('payment-initialize', {
        purpose: 'order',
        items: cart.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
        shipping: { ...f.values, country: 'Nigeria' },
      });
      window.location.assign(res.authorization_url);
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy(false);
    }
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader title="Checkout" text={`Signed in as ${user?.email}. Payment is processed securely by Paystack.`} />
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="p-5 sm:p-8">
          <h2 className="text-xl">Delivery details</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Input label="Full name" autoComplete="name" {...f.bind('full_name')} />
            <Input label="Phone" type="tel" autoComplete="tel" {...f.bind('phone')} />
            <Input wrapClassName="sm:col-span-2" label="Delivery address" autoComplete="street-address" {...f.bind('address')} />
            <Input label="City" autoComplete="address-level2" {...f.bind('city')} />
            <Select label="State" placeholder="Select" options={states} {...f.bind('state')} />
            <Textarea wrapClassName="sm:col-span-2" label="Delivery notes" optional rows={3} {...f.bind('notes')} />
          </div>
          <p className="mt-6 text-sm text-muted">{c.deliveryNote}</p>
        </Card>
        <Card className="p-5 sm:p-7 lg:sticky lg:top-24">
          <h2 className="text-lg">Order summary</h2>
          <ul className="mt-4 divide-y divide-line">
            {cart.lines.map((l) => (
              <li key={l.product_id} className="flex gap-3 py-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-lg"><ProductArt src={l.image} role={l.role} alt={l.name} /></div>
                <div className="min-w-0 flex-1 text-sm">
                  <Link to={`/product/${l.slug}`} className="font-medium leading-snug hover:text-primary">{l.name}</Link>
                  <p className="num text-muted">{l.quantity} × {money(l.price, c.currency)}</p>
                </div>
                <span className="num text-sm font-medium">{money(l.price * l.quantity, c.currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="num">{money(cart.subtotal, c.currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="num">{delivery ? money(delivery, c.currency) : 'Free'}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd className="num">{money(cart.subtotal + delivery, c.currency)}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted">Prices and stock are confirmed by our server before payment.</p>
          <Button size="lg" className="mt-5 w-full" onClick={pay} loading={busy}>Pay {money(cart.subtotal + delivery, c.currency)}</Button>
        </Card>
      </div>
    </div>
  );
}
