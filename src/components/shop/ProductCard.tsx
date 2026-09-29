import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money } from '@/lib/format';
import type { Product } from '@/lib/types';
import { useCart } from '@/providers/CartProvider';
import { useToast } from '@/providers/ToastProvider';
import { ProductArt } from './ProductArt';

export function ProductCard({ product }: { product: Product }) {
  const cart = useCart();
  const toast = useToast();
  const out = product.stock_quantity <= 0;
  const add = () => {
    cart.add({ product_id: product.id, slug: product.slug, name: product.name, price: Number(product.price), image: product.images[0], role: product.product_role, maxQuantity: product.stock_quantity });
    toast(`${product.name} added to cart`);
  };
  return (
    <article className="group flex flex-col">
      <Link to={`/product/${product.slug}`} className="relative block aspect-[5/4] overflow-hidden rounded-[var(--radius-card)] bg-tint">
        <ProductArt src={product.images[0]} role={product.product_role} alt={product.name} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        {out && <span className="absolute top-3 left-3 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-muted">Out of stock</span>}
      </Link>
      <div className="mt-3 flex flex-1 flex-col">
        {product.brand && <p className="text-xs text-muted">{product.brand}</p>}
        <Link to={`/product/${product.slug}`} className="mt-0.5 font-medium leading-snug text-ink hover:text-primary">{product.name}</Link>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <div className="flex items-baseline gap-2">
            <span className="num font-bold text-ink">{money(product.price, product.currency)}</span>
            {product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
              <span className="num text-sm text-muted line-through">{money(product.compare_at_price, product.currency)}</span>
            )}
          </div>
          <button type="button" onClick={add} disabled={out} className="grid size-9 shrink-0 place-items-center rounded-full bg-tint text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-40" aria-label={`Add ${product.name} to cart`}>
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
