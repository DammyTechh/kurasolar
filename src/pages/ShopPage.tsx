import { Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useParams, useSearchParams } from 'react-router-dom';
import { ProductCard } from '@/components/shop/ProductCard';
import { ButtonLink } from '@/components/ui/Button';
import { controlClass } from '@/components/ui/Field';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { cn } from '@/lib/cn';
import { useCategories, useProducts, type ProductFilter } from '@/lib/queries';
import { breadcrumbLd, useSeo } from '@/lib/seo';

export default function ShopPage() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const sort = (params.get('sort') as ProductFilter['sort']) ?? 'featured';
  const { data: categories = [] } = useCategories();
  const current = categories.find((c) => c.slug === category);
  const products = useProducts({ category, search: params.get('q') ?? undefined, sort });

  useSeo({
    title: current ? `${current.name} in Nigeria` : 'Solar equipment shop',
    description: current?.description ?? 'Hybrid inverters, LiFePO4 batteries, solar panels, protection and cables, delivered across Nigeria.',
    jsonLd: breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, ...(current ? [{ name: current.name, path: `/shop/${current.slug}` }] : [])]),
  });

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const tab = (active: boolean) => cn('shrink-0 rounded-full px-4 py-2 text-sm transition-colors', active ? 'bg-primary text-white' : 'bg-white text-ink/80 ring-1 ring-line hover:text-primary');

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader title={current?.name ?? 'Solar equipment'} text={current?.description ?? 'Quality equipment matched to properly sized systems. Not sure what you need? Size your system first.'}
        actions={<ButtonLink to="/solar-calculator" variant="secondary" size="sm">Size my system first</ButtonLink>} />

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0" aria-label="Categories">
          <NavLink to="/shop" end className={({ isActive }) => tab(isActive)}>All</NavLink>
          {categories.map((c) => <NavLink key={c.id} to={`/shop/${c.slug}`} className={({ isActive }) => tab(isActive)}>{c.name}</NavLink>)}
        </nav>
        <div className="flex gap-2">
          <form className="relative flex-1 lg:w-64" onSubmit={(e) => { e.preventDefault(); setParam('q', q.trim()); }} role="search">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setParam('q', q.trim())} placeholder="Search equipment" aria-label="Search equipment" className={cn(controlClass, 'h-10 pl-10')} />
          </form>
          <label className="relative">
            <span className="sr-only">Sort</span>
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'featured' ? '' : e.target.value)} className={cn(controlClass, 'h-10 appearance-none pr-4 pl-10')}>
              <option value="featured">Featured</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
        {products.isLoading && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[5/4]" />)}
        {products.data?.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
      {products.data?.length === 0 && <EmptyState title="No equipment matches" text="Try another category or clear your search." action={<ButtonLink to="/shop" variant="secondary" size="sm">Clear filters</ButtonLink>} />}
    </div>
  );
}
