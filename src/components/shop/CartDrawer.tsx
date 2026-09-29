import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { money } from '@/lib/format';
import { useCart } from '@/providers/CartProvider';
import { useSite } from '@/providers/SiteProvider';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/Misc';
import { Modal } from '../ui/Modal';
import { ProductArt } from './ProductArt';

export function CartDrawer() {
  const cart = useCart();
  const { settings } = useSite();
  const nav = useNavigate();
  const currency = settings.commerce.currency;
  const go = (to: string) => {
    cart.setOpen(false);
    nav(to);
  };

  return (
    <Modal
      open={cart.open}
      onClose={() => cart.setOpen(false)}
      side="right"
      title={`Your cart${cart.count ? ` (${cart.count})` : ''}`}
      footer={cart.lines.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Subtotal</span>
            <span className="num text-lg font-bold">{money(cart.subtotal, currency)}</span>
          </div>
          <p className="text-xs text-muted">Delivery is calculated at checkout.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => go('/quote')}>Request a quote</Button>
            <Button onClick={() => go('/checkout')}>Checkout</Button>
          </div>
        </div>
      )}
    >
      {cart.lines.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-5" />}
          title="Your cart is empty"
          text="Browse equipment, or size your system first to get a matched list."
          action={<Button variant="secondary" size="sm" onClick={() => go('/shop')}>Browse the shop</Button>}
        />
      ) : (
        <ul className="divide-y divide-line">
          {cart.lines.map((l) => (
            <li key={l.product_id} className="flex gap-3 py-4 first:pt-0">
              <Link to={`/product/${l.slug}`} onClick={() => cart.setOpen(false)} className="size-20 shrink-0 overflow-hidden rounded-xl">
                <ProductArt src={l.image} role={l.role} alt={l.name} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-sm font-medium leading-snug">{l.name}</p>
                <p className="num mt-0.5 text-sm text-muted">{money(l.price, currency)}</p>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-full border border-line">
                    <button type="button" className="grid size-8 place-items-center text-primary disabled:opacity-40" onClick={() => cart.setQuantity(l.product_id, l.quantity - 1)} disabled={l.quantity <= 1} aria-label="Decrease quantity"><Minus className="size-3.5" /></button>
                    <span className="num w-7 text-center text-sm">{l.quantity}</span>
                    <button type="button" className="grid size-8 place-items-center text-primary disabled:opacity-40" onClick={() => cart.setQuantity(l.product_id, l.quantity + 1)} disabled={Boolean(l.maxQuantity && l.quantity >= l.maxQuantity)} aria-label="Increase quantity"><Plus className="size-3.5" /></button>
                  </div>
                  <button type="button" onClick={() => cart.remove(l.product_id)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Remove ${l.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
