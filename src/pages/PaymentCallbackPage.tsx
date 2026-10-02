import { CheckCircle2, CircleAlert, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Misc';
import { errorMessage, invoke } from '@/lib/api';
import { useSeo } from '@/lib/seo';
import { useCart } from '@/providers/CartProvider';

interface Outcome { status: string; purpose: 'consultation' | 'order'; assessment_id: string | null; order_id: string | null; message: string }

export default function PaymentCallbackPage() {
  useSeo({ title: 'Confirming payment', noindex: true });
  const [params] = useSearchParams();
  const reference = params.get('reference') ?? params.get('trxref') ?? '';
  const nav = useNavigate();
  const qc = useQueryClient();
  const cart = useCart();
  const [state, setState] = useState<{ phase: 'checking' | 'done' | 'error'; outcome?: Outcome; error?: string }>({ phase: 'checking' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!reference) {
      setState({ phase: 'error', error: 'No payment reference was returned by Paystack.' });
      return;
    }
    (async () => {
      // Bank transfers can take a few seconds to settle; retry pending results briefly.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const out = await invoke<Outcome>('payment-verify', { reference });
          if (out.status === 'pending' && attempt < 4) {
            await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
            continue;
          }
          setState({ phase: 'done', outcome: out });
          if (out.status === 'success') {
            qc.invalidateQueries();
            if (out.purpose === 'order') cart.clear();
            if (out.purpose === 'consultation' && out.assessment_id) setTimeout(() => nav(`/assessments/${out.assessment_id}`, { replace: true }), 1400);
          }
          return;
        } catch (e) {
          setState({ phase: 'error', error: errorMessage(e) });
          return;
        }
      }
    })();
  }, [reference, nav, qc, cart]);

  const o = state.outcome;
  const ok = o?.status === 'success';
  return (
    <div className="container-page flex justify-center py-16 sm:py-24">
      <Card className="w-full max-w-lg p-8 text-left">
        {state.phase === 'checking' && (
          <>
            <Loader2 className="size-8 animate-spin text-primary" />
            <h1 className="mt-6 text-2xl">Confirming your payment</h1>
            <p className="mt-2 text-muted">We’re checking with Paystack. This usually takes a few seconds; please keep this page open.</p>
          </>
        )}
        {state.phase === 'done' && o && (
          <>
            {ok ? <CheckCircle2 className="size-9 text-success" /> : <CircleAlert className="size-9 text-warning" />}
            <h1 className="mt-6 text-2xl">{ok ? 'Payment confirmed' : o.status === 'pending' ? 'Payment still processing' : 'Payment not completed'}</h1>
            <p className="mt-2 text-muted">{ok ? (o.purpose === 'consultation' ? 'Your full report is unlocked. Taking you there now.' : 'Thank you. Your order is confirmed and a receipt is on its way to your email.') : o.message}</p>
            <p className="num mt-4 text-xs text-muted">Reference {reference}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {o.purpose === 'consultation' && o.assessment_id && <ButtonLink to={`/assessments/${o.assessment_id}`}>{ok ? 'View my report' : 'Back to assessment'}</ButtonLink>}
              {o.purpose === 'order' && <ButtonLink to="/account/orders">{ok ? 'View my order' : 'My orders'}</ButtonLink>}
              {!ok && <ButtonLink to="/contact" variant="secondary">Contact support</ButtonLink>}
            </div>
          </>
        )}
        {state.phase === 'error' && (
          <>
            <CircleAlert className="size-9 text-danger" />
            <h1 className="mt-6 text-2xl">We couldn’t confirm this payment</h1>
            <p className="mt-2 text-muted">{state.error} If you were charged, your payment will still be matched automatically; contact us with the reference below.</p>
            {reference && <p className="num mt-4 text-xs text-muted">Reference {reference}</p>}
            <div className="mt-6 flex gap-2"><ButtonLink to="/account/payments">My payments</ButtonLink><ButtonLink to="/contact" variant="secondary">Contact support</ButtonLink></div>
          </>
        )}
      </Card>
    </div>
  );
}
