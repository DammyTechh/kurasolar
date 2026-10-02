import { Link } from 'react-router-dom';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { date } from '@/lib/format';
import { usePosts } from '@/lib/queries';
import { useSeo } from '@/lib/seo';
import { mediaUrl } from '@/lib/supabase';

export default function BlogPage() {
  useSeo({ title: 'Solar knowledge', description: 'Plain explanations of solar sizing, batteries, inverters and installation in Nigeria.' });
  const { data, isLoading } = usePosts();
  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader title="Solar knowledge" text="Plain answers to the questions customers ask before buying a system." />
      <div className="mt-12 grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        {data?.map((p) => (
          <Link key={p.id} to={`/blog/${p.slug}`} className="group">
            {p.cover_url && <img src={mediaUrl(p.cover_url)} alt="" loading="lazy" className="mb-4 aspect-[16/10] w-full rounded-[var(--radius-card)] object-cover" />}
            <p className="text-sm text-muted">{date(p.published_at ?? p.created_at)}</p>
            <h2 className="mt-2 text-xl leading-snug group-hover:text-primary">{p.title}</h2>
            {p.excerpt && <p className="mt-2 leading-relaxed text-muted">{p.excerpt}</p>}
          </Link>
        ))}
      </div>
      {data?.length === 0 && <EmptyState title="No articles yet" text="Check back soon." />}
    </div>
  );
}
