import { Minus, Plus, ShoppingBag, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ProductArt } from '@/components/shop/ProductArt';
import { ProductCard } from '@/components/shop/ProductCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, Spinner } from '@/components/ui/Misc';
import { cn } from '@/lib/cn';
import { money } from '@/lib/format';
import { useProduct, useProducts } from '@/lib/queries';
import { breadcrumbLd, useSeo } from '@/lib/seo';
import { mediaUrl } from '@/lib/supabase';
import { useContextualWhatsapp } from '@/lib/whatsappStore';
import { useCart } from '@/providers/CartProvider';
import { useSite } from '@/providers/SiteProvider';
import { useToast } from '@/providers/ToastProvider';

export default function ProductPage() {
  const { slug } = useParams();
  const { data: p, isLoading } = useProduct(slug);
  const { settings } = useSite();
  const cart = useCart();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const related = useProducts({ category: p?.product_categories?.slug, limit: 5 });

  useSeo({
    title: p?.name ?? 'Product',
    description: p?.short_description ?? undefined,
    image: p?.images[0] ? mediaUrl(p.images[0]) : undefined,
    jsonLd: p ? [
      {
        '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku ?? undefined, brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
        description: p.short_description ?? undefined, image: p.images.map(mediaUrl),
        offers: { '@type': 'Offer', priceCurrency: p.currency, price: Number(p.price), availability: p.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: location.href },
      },
      breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, ...(p.product_categories ? [{ name: p.product_categories.name, path: `/shop/${p.product_categories.slug}` }] : []), { name: p.name, path: `/product/${p.slug}` }]),
    ] : null,
  });
  useContextualWhatsapp(p ? `Hello, I'd like to ask about the ${p.name}${p.sku ? ` (${p.sku})` : ''}.` : null);

  if (isLoading) return <Spinner />;
  if (!p) return <div className="container-page py-16"><EmptyState title="Product not found" text="It may have been removed from the catalogue." action={<ButtonLink to="/shop" variant="secondary">Back to shop</ButtonLink>} /></div>;

  const out = p.stock_quantity <= 0;
  const specs = Object.entries(p.specs ?? {});
  const add = () => {
    cart.add({ product_id: p.id, slug: p.slug, name: p.name, price: Number(p.price), image: p.images[0], role: p.product_role, maxQuantity: p.stock_quantity }, qty);
    toast(`${p.name} added to cart`);
  };

  return (
    <div className="container-page py-8 sm:py-12">
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link to="/shop" className="hover:text-primary">Shop</Link>
        {p.product_categories && <> / <Link to={`/shop/${p.product_categories.slug}`} className="hover:text-primary">{p.product_categories.name}</Link></>}
      </nav>
      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <div className="aspect-[5/4] overflow-hidden rounded-[var(--radius-card)] bg-tint">
            <ProductArt src={p.images[img]} role={p.product_role} alt={p.name} />
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {p.images.map((src, i) => (
                <button key={src} type="button" onClick={() => setImg(i)} className={cn('size-20 shrink-0 overflow-hidden rounded-xl ring-2', i === img ? 'ring-primary' : 'ring-transparent')} aria-label={`Image ${i + 1}`}>
                  <ProductArt src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          {p.brand && <p className="text-sm text-muted">{p.brand}</p>}
          <h1 className="mt-1 text-[1.75rem] leading-tight sm:text-4xl">{p.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="num text-3xl font-bold">{money(p.price, p.currency)}</span>
            {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) && <span className="num text-lg text-muted line-through">{money(p.compare_at_price, p.currency)}</span>}
          </div>
          <p className={cn('mt-2 text-sm', out ? 'text-danger' : p.stock_quantity < 5 ? 'text-warning' : 'text-success')}>
            {out ? 'Out of stock' : p.stock_quantity < 5 ? `Only ${p.stock_quantity} left` : 'In stock'}
          </p>
          {p.short_description && <p className="mt-5 text-[1.0625rem] leading-relaxed text-ink/80">{p.short_description}</p>}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-line">
              <button type="button" className="grid size-11 place-items-center text-primary disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><Minus className="size-4" /></button>
              <span className="num w-10 text-center font-medium">{qty}</span>
              <button type="button" className="grid size-11 place-items-center text-primary disabled:opacity-30" onClick={() => setQty((q) => Math.min(p.stock_quantity || 1, q + 1))} disabled={qty >= p.stock_quantity} aria-label="Increase quantity"><Plus className="size-4" /></button>
            </div>
            <Button size="lg" onClick={add} disabled={out} icon={<ShoppingBag className="size-4" />}>Add to cart</Button>
            <Button size="lg" variant="secondary" onClick={() => { add(); cart.setOpen(true); }} disabled={out}>Add to quote</Button>
          </div>
          <p className="mt-5 flex items-start gap-2 text-sm text-muted"><Truck className="mt-0.5 size-4 shrink-0" />{settings.commerce.deliveryNote}</p>

          {specs.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg">Specifications</h2>
              <dl className="mt-3 divide-y divide-line border-y border-line text-sm">
                {specs.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[10rem_1fr] gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd>{String(v)}</dd></div>
                ))}
                {p.sku && <div className="grid grid-cols-[10rem_1fr] gap-4 py-2.5"><dt className="text-muted">SKU</dt><dd className="num">{p.sku}</dd></div>}
              </dl>
            </div>
          )}
          {p.description && <div className="prose-ks mt-8"><ReactMarkdown>{p.description}</ReactMarkdown></div>}
        </div>
      </div>
      {(related.data?.filter((r) => r.id !== p.id).length ?? 0) > 0 && (
        <section className="mt-20">
          <h2 className="text-2xl">Often bought with it</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
            {related.data!.filter((r) => r.id !== p.id).slice(0, 4).map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </section>
      )}
    </div>
  );
}
