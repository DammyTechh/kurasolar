import { BadgeCheck, CreditCard, MapPinned, Ruler } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Faq } from '@/components/Faq';
import { PackageCard } from '@/components/shop/PackageCard';
import { ProductCard } from '@/components/shop/ProductCard';
import { HeroVisual } from '@/components/three/HeroVisual';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Misc';
import { date } from '@/lib/format';
import { useInstallers, usePackages, usePosts, useProducts } from '@/lib/queries';
import { useSeo } from '@/lib/seo';
import { mediaUrl } from '@/lib/supabase';
import { useSite } from '@/providers/SiteProvider';

const TRUST_ICONS = [Ruler, CreditCard, BadgeCheck, MapPinned];

function SectionHead({ title, text, link }: { title: string; text?: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h2 className="text-3xl leading-tight sm:text-4xl">{title}</h2>
        {text && <p className="mt-3 text-base text-muted">{text}</p>}
      </div>
      {link && <Link to={link.to} className="shrink-0 font-medium text-primary underline decoration-accent/60 underline-offset-4 hover:decoration-primary">{link.label}</Link>}
    </div>
  );
}

export default function HomePage() {
  const { settings, content } = useSite();
  const hero = content.hero;
  const faq = content.faq;
  useSeo({
    rawTitle: settings.seo.title,
    description: settings.seo.description,
    jsonLd: faq?.items?.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) } : null,
  });
  const products = useProducts({ featured: true, limit: 8 });
  const packages = usePackages();
  const posts = usePosts(3);
  const installers = useInstallers();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-surface to-white">
        <div className="container-page grid items-center gap-6 pt-12 pb-8 md:grid-cols-[1.05fr_1fr] md:gap-4 md:pt-16 md:pb-16">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
            <h1 className="max-w-[16ch] text-4xl leading-tight sm:text-5xl lg:text-6xl">{hero?.headline ?? 'Know exactly what solar system your home needs.'}</h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ink/75">{hero?.subheadline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/solar-calculator" size="lg">{hero?.primaryCta ?? 'Calculate my solar system'}</ButtonLink>
              <ButtonLink to="/shop" size="lg" variant="secondary">{hero?.secondaryCta ?? 'Shop solar equipment'}</ButtonLink>
            </div>
            <p className="mt-6 text-sm text-muted">Free to calculate. Pay only for the full engineering report.</p>
          </motion.div>
          <div className="relative aspect-[4/3] w-full md:aspect-[5/4]">
            {hero?.imageUrl ? <img src={mediaUrl(hero.imageUrl)} alt="" className="size-full rounded-[var(--radius-card)] object-cover" /> : <HeroVisual />}
          </div>
        </div>
        {content.trust?.items?.length ? (
          <div className="container-page pb-12">
            <ul className="grid gap-x-8 gap-y-6 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
              {content.trust.items.map((t, i) => {
                const Icon = TRUST_ICONS[i % TRUST_ICONS.length]!;
                return (
                  <li key={t.title} className="flex gap-3">
                    <Icon className="mt-1 size-5 shrink-0 text-accent" aria-hidden />
                    <div><p className="font-medium">{t.title}</p><p className="mt-1 text-sm text-muted">{t.text}</p></div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      {/* How it works */}
      {content.how_it_works && (
        <section className="container-page py-16 sm:py-24">
          <SectionHead title={content.how_it_works.title} />
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {content.how_it_works.steps.map((s, i) => (
              <li key={s.title} className="relative border-t-2 border-primary pt-6">
                <span className="num text-sm font-medium text-accent">Step {i + 1}</span>
                <h3 className="mt-2 text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          {content.how_it_works.footnote && (
            <p className="mt-12 text-sm text-ink/80">{content.how_it_works.footnote} <Link to="/solar-installers" className="font-medium text-primary underline decoration-accent/60 underline-offset-4">Find an installer</Link></p>
          )}
        </section>
      )}

      {/* Packages */}
      {(packages.data?.length ?? 0) > 0 && (
        <section className="bg-surface py-16 sm:py-24">
          <div className="container-page">
            <SectionHead title="Typical systems" text="Starting points our customers choose most. Your calculated system may differ." link={{ to: '/packages', label: 'Compare packages' }} />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {packages.data!.map((p) => <PackageCard key={p.id} p={p} currency={settings.commerce.currency} />)}
            </div>
          </div>
        </section>
      )}

      {/* Products */}
      <section className="container-page py-16 sm:py-24">
        <SectionHead title="Equipment in stock" text="Hybrid inverters, LiFePO4 batteries, panels and protection, matched to your calculated system." link={{ to: '/shop', label: 'Browse the shop' }} />
        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
          {products.isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[5/4]" />)
            : products.data?.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Why us */}
      {content.why_us && (
        <section className="border-t border-line py-16 sm:py-24">
          <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <h2 className="text-3xl leading-tight sm:text-4xl">{content.why_us.title}</h2>
            <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {content.why_us.items.map((it) => (
                <div key={it.title}>
                  <dt className="text-lg font-medium">{it.title}</dt>
                  <dd className="mt-2 leading-relaxed text-muted">{it.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* Installation */}
      {content.installation && (
        <section className="bg-primary-dark py-16 text-white sm:py-24">
          <div className="container-page grid items-center gap-12 md:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-3xl leading-tight text-white sm:text-4xl">{content.installation.title}</h2>
              <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-white/75">{content.installation.text}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink to="/solar-installers/request" variant="accent">{content.installation.cta}</ButtonLink>
                <ButtonLink to="/solar-installers/join" variant="light">Join as an installer</ButtonLink>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] bg-white/10">
              {[
                [String(installers.data?.length ?? 0), 'Verified installers'],
                [String(new Set((installers.data ?? []).flatMap((i) => [i.state, ...i.states_covered])).size), 'States covered'],
                ['3', 'Installers matched per request'],
                ['PDF', 'Assessment shared with your installer'],
              ].map(([v, l]) => (
                <div key={l} className="bg-primary-dark p-6">
                  <p className="num text-3xl font-semibold text-accent">{v}</p>
                  <p className="mt-1 text-sm text-white/70">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {(content.testimonials?.items?.length ?? 0) > 0 && (
        <section className="container-page py-16 sm:py-24">
          <SectionHead title={content.testimonials!.title} />
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {content.testimonials!.items.map((t) => (
              <figure key={t.name} className="border-l-2 border-accent pl-6">
                <blockquote className="text-base leading-relaxed text-ink/85">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-sm"><span className="font-medium">{t.name}</span>{t.location && <span className="text-muted">, {t.location}</span>}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Knowledge */}
      {(posts.data?.length ?? 0) > 0 && (
        <section className="bg-surface py-16 sm:py-24">
          <div className="container-page">
            <SectionHead title="Solar, explained plainly" link={{ to: '/blog', label: 'All articles' }} />
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {posts.data!.map((p) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className="group">
                  <p className="text-sm text-muted">{date(p.published_at ?? p.created_at)}</p>
                  <h3 className="mt-2 text-lg leading-snug group-hover:text-primary">{p.title}</h3>
                  {p.excerpt && <p className="mt-2 text-sm leading-relaxed text-muted">{p.excerpt}</p>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faq?.items?.length ? (
        <section className="container-page grid gap-12 py-16 sm:py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 className="text-3xl leading-tight sm:text-4xl">{faq.title}</h2>
          <Faq items={faq.items} />
        </section>
      ) : null}

      {/* CTA */}
      {content.cta && (
        <section className="container-page pb-24">
          <div className="flex flex-col items-start gap-6 rounded-[var(--radius-card)] bg-primary p-8 text-white sm:p-12 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl text-white sm:text-3xl">{content.cta.title}</h2>
              <p className="mt-2 max-w-[48ch] text-white/75">{content.cta.text}</p>
            </div>
            <ButtonLink to="/solar-calculator" variant="accent" size="lg">{content.cta.button}</ButtonLink>
          </div>
        </section>
      )}
    </>
  );
}
