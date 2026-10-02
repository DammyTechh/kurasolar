import { Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Logo } from '@/components/ui/Misc';
import { errorMessage, invoke } from '@/lib/api';
import { useSeo } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export default function AdminLoginPage() {
  useSeo({ title: 'Admin sign in', noindex: true });
  const { isAdmin, ready } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ready && isAdmin) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await invoke<{ access_token: string; refresh_token: string }>('admin-login', { identifier, password });
      const { error: err } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
      if (err) throw err;
      setTimeout(() => nav('/admin', { replace: true }), 150);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-primary-dark px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><img src="/logo-light.png" alt="KuraSolar" className="h-8 w-auto" /></div>
        <form onSubmit={submit} className="rounded-2xl bg-white p-8 shadow-2xl">
          <div className="flex items-center gap-2 text-sm text-muted"><Lock className="size-4" />Administrator</div>
          <h1 className="mt-2 text-2xl">Sign in</h1>
          <div className="mt-6 space-y-4">
            <Input label="Email or username" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
            <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
          </div>
        </form>
        <p className="mt-6 text-center text-xs text-white/50">Admin accounts are created by an existing administrator only.</p>
        <div className="sr-only"><Logo /></div>
      </div>
    </div>
  );
}
