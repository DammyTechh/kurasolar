import ReactMarkdown from 'react-markdown';
import { ButtonLink } from '@/components/ui/Button';
import { useSeo } from '@/lib/seo';
import { mediaUrl } from '@/lib/supabase';
import { useSite } from '@/providers/SiteProvider';

export default function AboutPage() {
  const { content } = useSite();
  const a = content.about;
  useSeo({ title: a?.title ?? 'About us', description: a?.body?.slice(0, 155) });
  return (
    <div className="container-page grid gap-10 py-10 sm:py-16 lg:grid-cols-[1fr_0.9fr]">
      <div>
        <h1 className="text-[2rem] leading-tight sm:text-5xl">{a?.title ?? 'About us'}</h1>
        <div className="prose-ks mt-8"><ReactMarkdown>{a?.body ?? ''}</ReactMarkdown></div>
        <div className="mt-8 flex flex-wrap gap-3"><ButtonLink to="/solar-calculator">Try the calculator</ButtonLink><ButtonLink to="/contact" variant="secondary">Contact us</ButtonLink></div>
      </div>
      {a?.imageUrl ? <img src={mediaUrl(a.imageUrl)} alt="" className="w-full rounded-[var(--radius-card)] object-cover" /> : <img src="/mark.png" alt="" className="hidden w-48 self-center justify-self-center opacity-90 lg:block" />}
    </div>
  );
}
