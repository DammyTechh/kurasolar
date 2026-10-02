import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { CatalogAppliance, Country, Package, Post, Product, ProductCategory, PublicInstaller, Region } from './types';

const LONG = 10 * 60_000;

async function rows<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

export const useCountries = () =>
  useQuery({
    queryKey: ['public', 'countries'],
    staleTime: LONG,
    queryFn: () => rows<Country[]>(
      supabase.from('countries').select('*').eq('is_active', true).order('sort_order').order('name').limit(500),
    ),
  });

/**
 * Countries split for the <select>: the markets we serve directly first, then
 * everywhere else alphabetically. `sort_order` below 100 marks a primary market.
 */
export const usePrimaryMarkets = () => {
  const q = useCountries();
  const all = q.data ?? [];
  return { ...q, primary: all.filter((c) => c.sort_order < 100), rest: all.filter((c) => c.sort_order >= 100) };
};

export const useRegions = (countryCode?: string | null) =>
  useQuery({
    queryKey: ['public', 'regions', countryCode],
    enabled: Boolean(countryCode),
    staleTime: LONG,
    queryFn: () => rows<Region[]>(
      supabase.from('regions').select('*').eq('country_code', countryCode!).eq('is_active', true).order('name').limit(1000),
    ),
  });

/** Nigerian states (used for addresses and installer filters). */
export const useNgStates = () => {
  const q = useRegions('NG');
  return { ...q, states: (q.data ?? []).map((r) => r.name) };
};

export const useApplianceCatalog = () =>
  useQuery({
    queryKey: ['public', 'appliance_catalog'],
    staleTime: LONG,
    queryFn: () => rows<CatalogAppliance[]>(supabase.from('appliance_catalog').select('*').eq('is_active', true).order('sort_order')),
  });

export const useCategories = () =>
  useQuery({
    queryKey: ['public', 'categories'],
    staleTime: LONG,
    queryFn: () => rows<ProductCategory[]>(supabase.from('product_categories').select('*').eq('is_active', true).order('sort_order')),
  });

export interface ProductFilter {
  category?: string;
  search?: string;
  featured?: boolean;
  sort?: 'featured' | 'price_asc' | 'price_desc' | 'newest';
  limit?: number;
  ids?: string[];
}

export const useProducts = (f: ProductFilter = {}) =>
  useQuery({
    queryKey: ['public', 'products', f],
    staleTime: 60_000,
    queryFn: async () => {
      const join = f.category ? 'product_categories!inner(slug, name)' : 'product_categories(slug, name)';
      let q = supabase.from('products').select(`*, ${join}`).eq('is_active', true);
      if (f.category) q = q.eq('product_categories.slug', f.category);
      if (f.featured) q = q.eq('is_featured', true);
      if (f.ids?.length) q = q.in('id', f.ids);
      if (f.search) {
        const s = f.search.replace(/[%,()]/g, ' ').trim();
        if (s) q = q.or(`name.ilike.%${s}%,brand.ilike.%${s}%,short_description.ilike.%${s}%`);
      }
      if (f.sort === 'price_asc') q = q.order('price', { ascending: true });
      else if (f.sort === 'price_desc') q = q.order('price', { ascending: false });
      else if (f.sort === 'newest') q = q.order('created_at', { ascending: false });
      else q = q.order('is_featured', { ascending: false }).order('name');
      if (f.limit) q = q.limit(f.limit);
      return rows<Product[]>(q);
    },
  });

export const useProduct = (slug?: string) =>
  useQuery({
    queryKey: ['public', 'product', slug],
    enabled: Boolean(slug),
    queryFn: () => rows<Product | null>(supabase.from('products').select('*, product_categories(slug, name)').eq('slug', slug!).eq('is_active', true).maybeSingle()),
  });

export const usePackages = () =>
  useQuery({
    queryKey: ['public', 'packages'],
    staleTime: LONG,
    queryFn: () => rows<Package[]>(supabase.from('packages').select('*').eq('is_active', true).order('sort_order')),
  });

export const usePosts = (limit?: number) =>
  useQuery({
    queryKey: ['public', 'posts', limit],
    staleTime: LONG,
    queryFn: () => {
      let q = supabase.from('posts').select('id, slug, title, excerpt, cover_url, tags, published_at, created_at').eq('is_published', true).order('published_at', { ascending: false, nullsFirst: false });
      if (limit) q = q.limit(limit);
      return rows<Post[]>(q);
    },
  });

export const usePost = (slug?: string) =>
  useQuery({
    queryKey: ['public', 'post', slug],
    enabled: Boolean(slug),
    queryFn: () => rows<Post | null>(supabase.from('posts').select('*').eq('slug', slug!).eq('is_published', true).maybeSingle()),
  });

export interface InstallerFilter { state?: string; city?: string; service?: string }

export const useInstallers = (f: InstallerFilter = {}) =>
  useQuery({
    queryKey: ['public', 'installers', f],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase.from('public_installers').select('*');
      if (f.state) {
        const st = f.state.replace(/["\\,(){}]/g, '');
        q = q.or(`state.eq."${st}",states_covered.cs.{"${st}"}`);
      }
      if (f.city) q = q.ilike('city', `%${f.city.replace(/[%,()]/g, '')}%`);
      if (f.service) q = q.contains('services', [f.service]);
      q = q.order('is_featured', { ascending: false }).order('years_experience', { ascending: false });
      return rows<PublicInstaller[]>(q);
    },
  });
