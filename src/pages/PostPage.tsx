import ReactMarkdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, Spinner } from '@/components/ui/Misc';
import { date } from '@/lib/format';
import { usePost } from '@/lib/queries';
import { useSeo } from '@/lib/seo';
import { mediaUrl } from '@/lib/supabase';

export default function PostPage() {
  const { slug } = useParams();
  const { data: p, isLoading } = usePost(slug);
  useSeo({
    title: p?.seo_title ?? p?.title,
    description: p?.seo_description ?? p?.excerpt ?? undefined,
    jsonLd: p ? { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, datePublished: p.published_at, image: p.cover_url ? mediaUrl(p.cover_url) : undefined, publisher: { '@type': 'Organization', name: 'KuraSolar' } } : null,
  });
  if (isLoading) return <Spinner />;
  if (!p) return <div className="container-page py-16"><EmptyState title="Article not found" action={<ButtonLink to="/blog" variant="secondary">All articles</ButtonLink>} /></div>;
  return (
    <article className="container-page py-12 sm:py-16">
      <Link to="/blog" className="text-sm text-muted hover:text-primary">Solar knowledge</Link>
      <h1 className="mt-4 max-w-[22ch] text-3xl leading-tight sm:text-5xl">{p.title}</h1>
      <p className="mt-4 text-sm text-muted">{date(p.published_at ?? p.created_at)}</p>
      {p.cover_url && <img src={mediaUrl(p.cover_url)} alt="" className="mt-8 aspect-[16/8] w-full rounded-[var(--radius-card)] object-cover" />}
      <div className="prose-ks mt-12"><ReactMarkdown>{p.body}</ReactMarkdown></div>
      <div className="mt-16 max-w-[68ch] rounded-[var(--radius-card)] bg-surface p-6">
        <p className="font-medium">Work out your own numbers</p>
        <p className="mt-1 text-sm text-muted">The calculator applies these principles to your appliances and location.</p>
        <ButtonLink to="/solar-calculator" className="mt-4" size="sm">Open the calculator</ButtonLink>
      </div>
    </article>
  );
}
