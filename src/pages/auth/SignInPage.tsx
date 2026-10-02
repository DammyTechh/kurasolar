import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Misc';
import { useSeo } from '@/lib/seo';
import { useAuth } from '@/providers/AuthProvider';
import { OtpSignIn } from './OtpSignIn';

export function safeNext(raw: string | null, fallback = '/account') {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/admin') ? raw : fallback;
}

export default function SignInPage() {
  useSeo({ title: 'Sign in', noindex: true });
  const { user, ready } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const nav = useNavigate();
  useEffect(() => { if (user) nav(next, { replace: true }); }, [user, next, nav]);
  if (ready && user) return <Navigate to={next} replace />;

  return (
    <div className="container-page grid items-center gap-12 py-12 sm:py-24 lg:grid-cols-2">
      <div className="max-w-md">
        <h1 className="text-3xl leading-tight sm:text-5xl">Sign in or create an account</h1>
        <p className="mt-4 text-base text-muted">Keep your assessments, reports, orders and installer requests in one place. We’ll email you a one-time code; no password to remember.</p>
      </div>
      <Card className="w-full max-w-md p-6 sm:p-8 lg:justify-self-end">
        <OtpSignIn onSignedIn={() => nav(next, { replace: true })} />
      </Card>
    </div>
  );
}
