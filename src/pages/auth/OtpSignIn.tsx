import { ArrowLeft, MailCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { errorMessage } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface Props {
  /** Collect name and phone before sending the code (used for sign-up and the calculator). */
  collectDetails?: boolean;
  defaults?: { email?: string; fullName?: string; phone?: string };
  location?: { country?: string; state?: string; city?: string };
  submitLabel?: string;
  onSignedIn?: () => void;
}

const CODE_LENGTH = 6;

/**
 * Passwordless sign-in and sign-up in one flow. Supabase creates the account
 * on first use; the one-time code is delivered by our Resend email hook.
 */
export function OtpSignIn({ collectDetails, defaults, location, submitLabel = 'Email me a code', onSignedIn }: Props) {
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(defaults?.email ?? '');
  const [fullName, setFullName] = useState(defaults?.fullName ?? '');
  const [phone, setPhone] = useState(defaults?.phone ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) return setError('Enter a valid email address.');
    if (collectDetails && fullName.trim().length < 2) return setError('Enter your full name.');
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/account`,
          data: {
            ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
            ...(location?.country ? { country: location.country } : {}),
            ...(location?.state ? { state: location.state } : {}),
            ...(location?.city ? { city: location.city } : {}),
          },
        },
      });
      if (err) throw err;
      setEmail(cleanEmail);
      setStage('code');
      setCooldown(45);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      const msg = errorMessage(err);
      setError(/rate|seconds/i.test(msg) ? 'Please wait a moment before requesting another code.' : msg);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    const token = code.replace(/\D/g, '');
    if (token.length !== CODE_LENGTH) return setError(`Enter the ${CODE_LENGTH}-digit code from your email.`);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      if (err) throw err;
      onSignedIn?.();
    } catch (err) {
      const msg = errorMessage(err);
      setError(/expired|invalid/i.test(msg) ? 'That code is incorrect or has expired. Request a new one.' : msg);
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'code') {
    return (
      <form onSubmit={verify} className="space-y-6">
        <div className="flex items-start gap-3 rounded-2xl bg-tint p-4">
          <MailCheck className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm leading-relaxed text-ink/85">
            We sent a {CODE_LENGTH}-digit code to <strong className="font-medium text-ink">{email}</strong>. It expires in 15 minutes.
          </p>
        </div>
        <Input
          ref={codeRef}
          label="Sign-in code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
            setCode(v);
            setError(null);
          }}
          className="num h-12 text-center text-2xl tracking-[0.5em]"
          error={error}
        />
        <Button type="submit" className="w-full" size="lg" loading={busy}>Verify and continue</Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => { setStage('email'); setCode(''); setError(null); }} className="flex items-center gap-2 text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Change email
          </button>
          <button type="button" onClick={() => send()} disabled={cooldown > 0 || busy} className="font-medium text-primary disabled:text-muted">
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={send} className="space-y-4" noValidate>
      {collectDetails && (
        <>
          <Input label="Full name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
          <Input label="Phone number" type="tel" autoComplete="tel" placeholder="+234 801 234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} optional maxLength={32} />
        </>
      )}
      <Input label="Email address" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} error={error} maxLength={254} />
      <Button type="submit" className="w-full" size="lg" loading={busy}>{submitLabel}</Button>
      <p className="text-xs leading-relaxed text-muted">No password needed. We’ll email you a one-time code; new accounts are created automatically.</p>
    </form>
  );
}
