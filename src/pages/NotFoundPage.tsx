import { ButtonLink } from '@/components/ui/Button';
import { useSeo } from '@/lib/seo';

export default function NotFoundPage() {
  useSeo({ title: 'Page not found', noindex: true });
  return (
    <div className="container-page py-24 sm:py-28">
      <p className="num text-sm font-medium text-accent">404</p>
      <h1 className="mt-3 text-3xl sm:text-5xl">This page doesn’t exist.</h1>
      <p className="mt-4 max-w-md text-muted">The link may be out of date. Try the calculator or browse equipment instead.</p>
      <div className="mt-8 flex flex-wrap gap-3"><ButtonLink to="/solar-calculator">Size my system</ButtonLink><ButtonLink to="/" variant="secondary">Go home</ButtonLink></div>
    </div>
  );
}
