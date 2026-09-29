import { ClipboardList, CreditCard, ListChecks, Package, Wrench } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ButtonLink, Button } from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatusBadge } from '@/components/ui/Misc';
import { seedDraft } from '@/features/calculator/useDraft';
import { date, money, num } from '@/lib/format';
import { useSeo } from '@/lib/seo';
import { supabase } from '@/lib/supabase';
import type { ApplianceInput } from '@engine';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { ProfileForm } from '../auth/WelcomePage';
import { useMyAssessments, useMyOrders, useMyPayments, useMyRequests, useMySets } from './data';

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4"><h1 className="text-2xl sm:text-3xl">{title}</h1>{action}</div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const Loading = () => <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>;

export function AssessmentList({ limit }: { limit?: number }) {
  const { data, isLoading } = useMyAssessments();
  if (isLoading) return <Loading />;
  if (!data?.length) return <EmptyState icon={<ClipboardList className="size-5" />} title="No assessments yet" text="Size your system in about five minutes." action={<ButtonLink to="/solar-calculator" size="sm">Start the calculator</ButtonLink>} />;
  return (
    <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
      {data.slice(0, limit).map((a) => (
        <li key={a.id}>
          <Link to={`/assessments/${a.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 hover:bg-surface/60 sm:p-5">
            <div className="min-w-0 flex-1">
              <p className="num font-medium">{a.code}</p>
              <p className="text-sm text-muted">{[a.city, a.state].filter(Boolean).join(", ")}, {date(a.created_at)}</p>
            </div>
            <span className="num text-sm">{num(a.daily_energy_kwh)} kWh/day</span>
            <span className="text-sm text-muted">{a.system_class}</span>
            <StatusBadge status={a.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AccountHomePage() {
  useSeo({ title: 'My account', noindex: true });
  const { profile } = useAuth();
  const a = useMyAssessments();
  const o = useMyOrders();
  const r = useMyRequests();
  const stats = [
    { label: 'Assessments', v: a.data?.length ?? 0, to: '/account/assessments', icon: ClipboardList },
    { label: 'Orders', v: o.data?.length ?? 0, to: '/account/orders', icon: Package },
    { label: 'Installer requests', v: r.data?.length ?? 0, to: '/account/requests', icon: Wrench },
  ];
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl sm:text-3xl">Hello{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
        <p className="mt-2 text-muted">Everything about your solar project in one place.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="rounded-[var(--radius-card)] border border-line bg-white p-5 hover:border-primary/40">
            <s.icon className="size-5 text-primary" />
            <p className="num mt-4 text-3xl font-bold">{s.v}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </Link>
        ))}
      </div>
      <Section title="Recent assessments" action={<ButtonLink to="/solar-calculator" size="sm">New assessment</ButtonLink>}>
        <AssessmentList limit={3} />
      </Section>
    </div>
  );
}

export function AccountAssessmentsPage() {
  useSeo({ title: 'My assessments', noindex: true });
  return <Section title="Assessments" action={<ButtonLink to="/solar-calculator" size="sm">New assessment</ButtonLink>}><AssessmentList /></Section>;
}

export function AccountOrdersPage() {
  useSeo({ title: 'My orders', noindex: true });
  const { data, isLoading } = useMyOrders();
  return (
    <Section title="Orders">
      {isLoading ? <Loading /> : !data?.length ? (
        <EmptyState icon={<Package className="size-5" />} title="No orders yet" action={<ButtonLink to="/shop" size="sm">Browse the shop</ButtonLink>} />
      ) : (
        <div className="space-y-4">
          {data.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="num font-medium">{o.code}</p><p className="text-sm text-muted">{date(o.created_at)}</p></div>
                <div className="flex items-center gap-3"><span className="num font-bold">{money(o.total, o.currency)}</span><StatusBadge status={o.status} /></div>
              </div>
              <ul className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
                {o.order_items?.map((i) => <li key={i.id} className="flex justify-between gap-4"><span>{i.quantity} × {i.product_name}</span><span className="num text-muted">{money(i.line_total, o.currency)}</span></li>)}
              </ul>
              <p className="mt-3 text-sm text-muted">Deliver to {o.address}, {o.city}, {o.state}</p>
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}

export function AccountPaymentsPage() {
  useSeo({ title: 'My payments', noindex: true });
  const { data, isLoading } = useMyPayments();
  return (
    <Section title="Payments">
      {isLoading ? <Loading /> : !data?.length ? <EmptyState icon={<CreditCard className="size-5" />} title="No payments yet" /> : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="p-4 font-normal">Reference</th><th className="p-4 font-normal">For</th><th className="p-4 font-normal">Date</th><th className="p-4 text-right font-normal">Amount</th><th className="p-4 font-normal">Status</th></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-line/70 last:border-0">
                  <td className="num p-4">{p.reference}</td>
                  <td className="p-4">{p.purpose === 'consultation' ? <Link className="text-primary hover:underline" to={`/assessments/${p.assessment_id}`}>Consultation</Link> : 'Order'}</td>
                  <td className="p-4">{date(p.created_at)}</td>
                  <td className="num p-4 text-right">{money(p.amount, p.currency)}</td>
                  <td className="p-4"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export function AccountRequestsPage() {
  useSeo({ title: 'Installer requests', noindex: true });
  const { data, isLoading } = useMyRequests();
  return (
    <Section title="Installer requests" action={<ButtonLink to="/solar-installers/request" size="sm">New request</ButtonLink>}>
      {isLoading ? <Loading /> : !data?.length ? <EmptyState icon={<Wrench className="size-5" />} title="No requests yet" text="Ask us to match you with verified installers in your state." /> : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 sm:p-5">
              <div className="min-w-0 flex-1"><p className="num font-medium">{r.code}</p><p className="text-sm text-muted">{[r.city, r.state].filter(Boolean).join(', ')}, {date(r.created_at)}</p></div>
              {r.system_size && <span className="text-sm text-muted">{r.system_size}</span>}
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function AccountSavedPage() {
  useSeo({ title: 'Saved appliances', noindex: true });
  const { data, isLoading } = useMySets();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const remove = async (id: string) => {
    if (!confirm('Delete this saved list?')) return;
    const { error } = await supabase.from('saved_appliance_sets').delete().eq('id', id);
    if (error) toast(error.message, 'error');
    else qc.invalidateQueries({ queryKey: ['mine', 'sets'] });
  };
  return (
    <Section title="Saved appliance lists">
      {isLoading ? <Loading /> : !data?.length ? <EmptyState icon={<ListChecks className="size-5" />} title="Nothing saved" text="Save an appliance list from the calculator’s review step to reuse it later." /> : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <div className="min-w-0 flex-1"><p className="font-medium">{s.name}</p><p className="text-sm text-muted">{s.appliances.length} appliances, saved {date(s.updated_at)}</p></div>
              <Button size="sm" onClick={() => { seedDraft(s.appliances as ApplianceInput[]); nav('/solar-calculator'); }}>Use in calculator</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>Delete</Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function AccountProfilePage() {
  useSeo({ title: 'Profile', noindex: true });
  return <Section title="Profile"><Card className="max-w-2xl p-5 sm:p-8"><ProfileForm submitLabel="Save changes" /></Card></Section>;
}

