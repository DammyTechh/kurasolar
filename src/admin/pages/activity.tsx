import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Mail, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Checkbox, Select, Textarea } from '@/components/ui/Field';
import { Badge, Card, Spinner, StatusBadge } from '@/components/ui/Misc';
import { errorMessage, invoke } from '@/lib/api';
import { date, money, num, sentence } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Assessment, AssessmentAppliance, Enquiry, InstallerRequest, Order, PublicInstaller } from '@/lib/types';
import { useToast } from '@/providers/ToastProvider';
import { Resource } from '../components/Resource';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

interface Stats {
  assessments_total: number; assessments_paid: number; consultation_revenue: Record<string, number>; orders_paid: number;
  product_sales: number; requests_pending: number; installations_completed: number; installers_pending: number;
  enquiries_open: number; customers: number; top_system_sizes: { kva: number; total: number }[];
  assessments_by_day: { day: string; total: number; paid: number }[];
}

export function Overview() {
  const q = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_stats');
      if (error) throw error;
      return data as Stats;
    },
  });
  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data) return <p className="text-danger">{errorMessage(q.error)}</p>;
  const s = q.data;
  const conv = s.assessments_total ? Math.round((s.assessments_paid / s.assessments_total) * 100) : 0;
  const maxDay = Math.max(1, ...s.assessments_by_day.map((d) => d.total));
  const cards = [
    { label: 'Assessments', v: num(s.assessments_total, 0), sub: `${num(s.assessments_paid, 0)} paid, ${conv}% conversion`, to: '/admin/assessments' },
    { label: 'Consultation revenue', v: Object.entries(s.consultation_revenue).map(([c, t]) => money(t, c)).join(' + ') || money(0), sub: 'Successful payments', to: '/admin/payments' },
    { label: 'Product sales', v: money(s.product_sales), sub: `${num(s.orders_paid, 0)} paid orders`, to: '/admin/orders' },
    { label: 'Customers', v: num(s.customers, 0), sub: 'Registered accounts', to: '/admin/customers' },
    { label: 'Open installer requests', v: num(s.requests_pending, 0), sub: `${num(s.installations_completed, 0)} completed`, to: '/admin/requests' },
    { label: 'Installers awaiting review', v: num(s.installers_pending, 0), sub: 'Applications', to: '/admin/installers' },
    { label: 'Open enquiries', v: num(s.enquiries_open, 0), sub: 'Quotes and messages', to: '/admin/enquiries' },
  ];
  return (
    <div className="space-y-8">
      <h1 className="text-2xl sm:text-3xl">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-[var(--radius-card)] border border-line bg-white p-5 hover:border-primary/40">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="num mt-2 text-2xl font-bold">{c.v}</p>
            <p className="mt-1 text-xs text-muted">{c.sub}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <h2 className="text-lg">Assessments, last 30 days</h2>
          <div className="mt-6 flex h-44 items-end gap-1" role="img" aria-label="Daily assessments chart">
            {s.assessments_by_day.map((d) => (
              <div key={d.day} className="group relative flex flex-1 flex-col justify-end" title={`${d.day}: ${d.total} calculated, ${d.paid} paid`}>
                <div className="rounded-t bg-primary/25" style={{ height: `${(d.total / maxDay) * 100}%` }}>
                  <div className="h-full rounded-t bg-primary" style={{ height: `${d.total ? (d.paid / d.total) * 100 : 0}%`, marginTop: 'auto' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary/25" />Calculated</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Paid</span></div>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg">Most common system sizes</h2>
          <ul className="mt-5 space-y-3">
            {s.top_system_sizes.length === 0 && <li className="text-sm text-muted">No data yet.</li>}
            {s.top_system_sizes.map((t) => (
              <li key={t.kva} className="flex items-center justify-between text-sm"><span className="num">{num(t.kva)} kVA</span><Badge tone="primary">{t.total}</Badge></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function AssessmentDetail({ row }: { row: Row }) {
  const a = row as Assessment;
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const apps = useQuery({
    queryKey: ['admin', 'assessment_appliances', a.id],
    queryFn: async () => (await supabase.from('assessment_appliances').select('*').eq('assessment_id', a.id).order('position')).data as AssessmentAppliance[],
  });
  const res = useQuery({
    queryKey: ['admin', 'assessment_results', a.id],
    queryFn: async () => (await supabase.from('assessment_results').select('recommended_pv_kwp, recommended_inverter_kw, recommended_inverter_kva, recommended_battery_kwh, report_generated_at').eq('assessment_id', a.id).maybeSingle()).data,
  });
  const act = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try { await fn(); } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(null); }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<Download className="size-4" />} loading={busy === 'dl'} onClick={() => act('dl', async () => { const o = await invoke<{ url: string }>('report-download', { assessment_id: a.id }); window.open(o.url, '_blank', 'noopener'); })}>Download report</Button>
        <Button size="sm" variant="secondary" icon={<RefreshCw className="size-4" />} loading={busy === 'regen'} onClick={() => act('regen', async () => { await invoke('admin-actions', { action: 'regenerate_report', assessment_id: a.id }); toast('The report will be rebuilt on next download'); })}>Regenerate PDF</Button>
        {a.status === 'paid' && <Button size="sm" variant="secondary" icon={<Mail className="size-4" />} loading={busy === 'mail'} onClick={() => act('mail', async () => { await invoke('admin-actions', { action: 'resend_receipt', assessment_id: a.id }); toast('Receipt sent'); })}>Resend receipt</Button>}
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        {[
          ['Customer', `${a.customer_name ?? '—'}, ${a.customer_email ?? ''}`], ['Phone', a.customer_phone ?? '—'], ['Status', a.status],
          ['Location', [a.city, a.state, a.country].filter(Boolean).join(', ')], ['Grid', sentence(a.grid_availability)], ['Property', a.property_type ?? '—'],
          ['Daily energy', `${num(a.daily_energy_kwh)} kWh`], ['Peak / surge', `${num(a.peak_load_kw, 2)} / ${num(a.surge_peak_kw, 2)} kW`], ['System class', a.system_class ?? '—'],
          ['PV', res.data ? `${num(res.data.recommended_pv_kwp, 2)} kWp` : '—'], ['Inverter', res.data ? `${num(res.data.recommended_inverter_kw)} kW / ${num(res.data.recommended_inverter_kva)} kVA` : '—'], ['Battery', res.data ? `${num(res.data.recommended_battery_kwh, 2)} kWh` : '—'],
        ].map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}
        {a.is_diaspora && a.recipient && <div className="sm:col-span-3"><dt className="text-muted">Recipient</dt><dd className="mt-0.5 font-medium">{[a.recipient.name, a.recipient.phone, a.recipient.location, a.recipient.relationship].filter(Boolean).join(', ')}</dd></div>}
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 font-normal">Appliance</th><th className="text-right font-normal">Qty</th><th className="text-right font-normal">W</th><th className="text-right font-normal">h/day</th><th className="text-right font-normal">Duty</th><th className="text-right font-normal">kWh</th><th className="pl-3 font-normal">Priority</th></tr></thead>
          <tbody>
            {apps.data?.map((x) => (
              <tr key={x.id} className="border-b border-line/60"><td className="py-2">{x.name}</td><td className="num text-right">{x.quantity}</td><td className="num text-right">{num(x.rated_watts, 0)}</td><td className="num text-right">{num(x.hours_per_day)}</td><td className="num text-right">{Math.round(x.duty_cycle * 100)}%</td><td className="num text-right">{num(x.daily_kwh, 2)}</td><td className="pl-3">{sentence(x.priority)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Assessments() {
  return (
    <Resource config={{
      table: 'assessments', title: 'Assessments', order: { column: 'created_at', ascending: false }, search: ['code', 'customer_name', 'customer_email', 'state', 'city'],
      filters: [{ key: 'status', label: 'Status', options: [{ value: 'calculated', label: 'Awaiting payment' }, { value: 'paid', label: 'Paid' }] }],
      columns: [
        { key: 'code', label: 'Code', render: (r) => <span className="num font-medium">{r.code}</span> },
        { key: 'customer_name', label: 'Customer', render: (r) => <><p>{r.customer_name ?? '—'}</p><p className="text-xs text-muted">{r.customer_email}</p></> },
        { key: 'state', label: 'Location', render: (r) => [r.city, r.state].filter(Boolean).join(', ') },
        { key: 'daily_energy_kwh', label: 'kWh/day', className: 'text-right num', render: (r) => num(r.daily_energy_kwh) },
        { key: 'system_class', label: 'Class' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'created_at', label: 'Date', render: (r) => date(r.created_at) },
      ],
      detail: (row) => <AssessmentDetail row={row} />,
    }} />
  );
}

export function Payments() {
  return (
    <Resource config={{
      table: 'payments', title: 'Payments', description: 'Every Paystack transaction. Payments are only marked successful after server-side verification.', order: { column: 'created_at', ascending: false }, search: ['reference', 'email'],
      filters: [
        { key: 'status', label: 'Status', options: ['pending', 'success', 'failed', 'abandoned', 'refunded'].map((v) => ({ value: v, label: sentence(v) })) },
        { key: 'purpose', label: 'Type', options: [{ value: 'consultation', label: 'Consultation' }, { value: 'order', label: 'Order' }] },
      ],
      columns: [
        { key: 'reference', label: 'Reference', render: (r) => <span className="num">{r.reference}</span> },
        { key: 'email', label: 'Customer' },
        { key: 'purpose', label: 'Type', render: (r) => sentence(r.purpose) },
        { key: 'amount', label: 'Amount', className: 'text-right num', render: (r) => money(r.amount, r.currency) },
        { key: 'channel', label: 'Channel', render: (r) => r.channel ?? '—' },
        { key: 'status', label: 'Status', render: (r) => <span className="flex items-center gap-1.5"><StatusBadge status={r.status} />{r.is_duplicate && <Badge tone="danger">Duplicate</Badge>}</span> },
        { key: 'created_at', label: 'Date', render: (r) => date(r.created_at, true) },
      ],
    }} />
  );
}

const ORDER_STATUSES = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

function OrderDetail({ row, done }: { row: Row; done: () => void }) {
  const o = row as Order;
  const toast = useToast();
  const [status, setStatus] = useState(o.status);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const items = useQuery({ queryKey: ['admin', 'order_items', o.id], queryFn: async () => (await supabase.from('order_items').select('*').eq('order_id', o.id)).data ?? [] });
  const save = async () => {
    setBusy(true);
    try {
      await invoke('admin-actions', { action: 'update_order_status', order_id: o.id, status, notify });
      toast('Order updated');
      done();
    } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-muted">Customer</dt><dd className="font-medium">{o.full_name}</dd><dd>{o.email}</dd><dd>{o.phone}</dd></div>
        <div><dt className="text-muted">Deliver to</dt><dd className="font-medium">{o.address}, {o.city}, {o.state}</dd>{o.notes && <dd className="mt-1 text-muted">{o.notes}</dd>}</div>
        <div><dt className="text-muted">Total</dt><dd className="num font-medium">{money(o.total, o.currency)}</dd><dd className="text-muted">incl. delivery {money(o.delivery_fee, o.currency)}</dd></div>
      </dl>
      <ul className="divide-y divide-line rounded-xl border border-line text-sm">
        {items.data?.map((i: Row) => <li key={i.id} className="flex justify-between gap-4 px-4 py-2.5"><span>{i.quantity} × {i.product_name} <span className="text-muted">{i.sku}</span></span><span className="num">{money(i.line_total, o.currency)}</span></li>)}
      </ul>
      <div className="flex flex-wrap items-end gap-4">
        <Select wrapClassName="w-56" label="Status" value={status} options={ORDER_STATUSES.map((s) => ({ value: s, label: sentence(s) }))} onChange={(e) => setStatus(e.target.value as Order['status'])} />
        <Checkbox label="Email the customer" checked={notify} onChange={setNotify} />
        <Button onClick={save} loading={busy} disabled={status === o.status}>Update order</Button>
      </div>
    </div>
  );
}

export function Orders() {
  return (
    <Resource config={{
      table: 'orders', title: 'Orders', order: { column: 'created_at', ascending: false }, search: ['code', 'email', 'full_name', 'phone'],
      filters: [{ key: 'status', label: 'Status', options: ORDER_STATUSES.map((v) => ({ value: v, label: sentence(v) })) }],
      columns: [
        { key: 'code', label: 'Order', render: (r) => <span className="num font-medium">{r.code}</span> },
        { key: 'full_name', label: 'Customer', render: (r) => <><p>{r.full_name}</p><p className="text-xs text-muted">{r.email}</p></> },
        { key: 'state', label: 'Delivery', render: (r) => `${r.city}, ${r.state}` },
        { key: 'total', label: 'Total', className: 'text-right num', render: (r) => money(r.total, r.currency) },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'created_at', label: 'Date', render: (r) => date(r.created_at) },
      ],
      detail: (row, _close, refresh) => <OrderDetail row={row} done={refresh} />,
    }} />
  );
}

const REQUEST_STATUSES = ['new', 'matched', 'contacted', 'scheduled', 'completed', 'cancelled'];

function RequestDetail({ row, done }: { row: Row; done: () => void }) {
  const r = row as InstallerRequest;
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState(r.status);
  const [notes, setNotes] = useState(r.admin_notes ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const matches = useQuery({ queryKey: ['admin', 'matches', r.id], queryFn: async () => (await supabase.from('installer_request_matches').select('status, notified_at, installers(id, company_name, state, phone)').eq('request_id', r.id)).data ?? [] });
  const candidates = useQuery({ queryKey: ['admin', 'candidates', r.state], queryFn: async () => ((await supabase.from('installers').select('id, company_name, state, city, states_covered, services').eq('verification_status', 'verified').order('company_name')).data ?? []) as PublicInstaller[] });
  const matchedIds = new Set((matches.data ?? []).map((m: Row) => m.installers?.id));
  const local = (candidates.data ?? []).filter((i) => !matchedIds.has(i.id)).sort((a, b) => Number(b.state === r.state || b.states_covered.includes(r.state)) - Number(a.state === r.state || a.states_covered.includes(r.state)));

  const save = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from('installer_requests').update({ status, admin_notes: notes || null }).eq('id', r.id);
      if (error) throw error;
      if (picked.length) await invoke('admin-actions', { action: 'assign_installers', request_id: r.id, installer_ids: picked });
      toast('Request updated');
      qc.invalidateQueries({ queryKey: ['admin', 'matches', r.id] });
      done();
    } catch (e) { toast(errorMessage(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-muted">Customer</dt><dd className="font-medium">{r.full_name}</dd><dd>{r.email}</dd><dd>{r.phone}</dd></div>
        <div><dt className="text-muted">Site</dt><dd className="font-medium">{[r.address, r.city, r.state].filter(Boolean).join(', ')}</dd><dd>{r.property_type}</dd></div>
        <div><dt className="text-muted">System</dt><dd className="font-medium">{r.system_size ?? '—'}</dd><dd>{r.preferred_date ? `Preferred ${date(r.preferred_date)}` : ''}</dd>{r.assessment_id && <dd className="text-primary">Linked assessment</dd>}</div>
        {r.message && <div className="sm:col-span-3"><dt className="text-muted">Message</dt><dd className="whitespace-pre-line">{r.message}</dd></div>}
      </dl>
      <div>
        <h3 className="text-sm font-medium">Matched installers</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {(matches.data ?? []).length === 0 && <li className="text-muted">None yet.</li>}
          {(matches.data ?? []).map((m: Row) => <li key={m.installers?.id}>{m.installers?.company_name} ({m.installers?.state}) <Badge tone={m.notified_at ? 'success' : 'neutral'}>{m.status}</Badge></li>)}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-medium">Assign more installers</h3>
        <div className="mt-2 grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
          {local.length === 0 && <p className="text-sm text-muted">No other verified installers.</p>}
          {local.map((i) => <Checkbox key={i.id} label={i.company_name} hint={`${i.city ? `${i.city}, ` : ''}${i.state}`} checked={picked.includes(i.id)} onChange={(v) => setPicked((p) => (v ? [...p, i.id] : p.filter((x) => x !== i.id)))} />)}
        </div>
        <p className="mt-1.5 text-xs text-muted">Assigned installers receive the lead by email.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <Select label="Status" value={status} options={REQUEST_STATUSES.map((s) => ({ value: s, label: sentence(s) }))} onChange={(e) => setStatus(e.target.value as InstallerRequest['status'])} />
        <Textarea label="Internal notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button onClick={save} loading={busy}>Save</Button>
    </div>
  );
}

export function Requests() {
  return (
    <Resource config={{
      table: 'installer_requests', title: 'Installer requests', order: { column: 'created_at', ascending: false }, search: ['code', 'full_name', 'email', 'state', 'city'],
      filters: [{ key: 'status', label: 'Status', options: REQUEST_STATUSES.map((v) => ({ value: v, label: sentence(v) })) }],
      columns: [
        { key: 'code', label: 'Request', render: (r) => <span className="num font-medium">{r.code}</span> },
        { key: 'full_name', label: 'Customer', render: (r) => <><p>{r.full_name}</p><p className="text-xs text-muted">{r.phone}</p></> },
        { key: 'state', label: 'Location', render: (r) => [r.city, r.state].filter(Boolean).join(', ') },
        { key: 'system_size', label: 'System', render: (r) => r.system_size ?? '—' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'created_at', label: 'Date', render: (r) => date(r.created_at) },
      ],
      detail: (row, _c, refresh) => <RequestDetail row={row} done={refresh} />,
    }} />
  );
}

function EnquiryDetail({ row, done }: { row: Row; done: () => void }) {
  const e = row as Enquiry;
  const toast = useToast();
  const [status, setStatus] = useState(e.status);
  const [notes, setNotes] = useState(e.admin_notes ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('enquiries').update({ status, admin_notes: notes || null }).eq('id', e.id);
    setBusy(false);
    if (error) return toast(errorMessage(error), 'error');
    toast('Saved');
    done();
  };
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid gap-4 sm:grid-cols-3">
        <div><dt className="text-muted">From</dt><dd className="font-medium">{e.full_name}</dd><dd><a className="text-primary" href={`mailto:${e.email}`}>{e.email}</a></dd><dd>{e.phone}</dd></div>
        <div><dt className="text-muted">Type</dt><dd className="font-medium">{sentence(e.type)}</dd></div>
        <div><dt className="text-muted">Company / location</dt><dd>{[e.company, e.location].filter(Boolean).join(', ') || '—'}</dd></div>
      </dl>
      {e.message && <p className="rounded-xl bg-surface p-4 whitespace-pre-line">{e.message}</p>}
      {e.items?.length ? <ul className="list-disc pl-5">{e.items.map((i) => <li key={i.product_id}>{i.quantity} × {i.name}</li>)}</ul> : null}
      <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <Select label="Status" value={status} options={['new', 'in_progress', 'closed'].map((s) => ({ value: s, label: sentence(s) }))} onChange={(ev) => setStatus(ev.target.value as Enquiry['status'])} />
        <Textarea label="Internal notes" rows={3} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
      </div>
      <Button onClick={save} loading={busy}>Save</Button>
    </div>
  );
}

export function Enquiries() {
  return (
    <Resource config={{
      table: 'enquiries', title: 'Enquiries', description: 'Quote requests, custom installations, commercial projects and contact messages.', order: { column: 'created_at', ascending: false }, search: ['full_name', 'email', 'company'],
      filters: [
        { key: 'type', label: 'Type', options: ['quote', 'custom_installation', 'commercial', 'contact'].map((v) => ({ value: v, label: sentence(v) })) },
        { key: 'status', label: 'Status', options: ['new', 'in_progress', 'closed'].map((v) => ({ value: v, label: sentence(v) })) },
      ],
      columns: [
        { key: 'full_name', label: 'From', render: (r) => <><p>{r.full_name}</p><p className="text-xs text-muted">{r.email}</p></> },
        { key: 'type', label: 'Type', render: (r) => sentence(r.type) },
        { key: 'message', label: 'Message', render: (r) => <span className="line-clamp-1 max-w-xs text-muted">{r.message ?? (r.items ? `${r.items.length} items` : '')}</span> },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'created_at', label: 'Date', render: (r) => date(r.created_at) },
      ],
      detail: (row, _c, refresh) => <EnquiryDetail row={row} done={refresh} />,
    }} />
  );
}

export function Customers() {
  return (
    <Resource config={{
      table: 'profiles', title: 'Customers', order: { column: 'created_at', ascending: false }, search: ['full_name', 'email', 'phone', 'state'],
      filters: [{ key: 'role', label: 'Role', options: [{ value: 'customer', label: 'Customer' }, { value: 'admin', label: 'Admin' }] }],
      columns: [
        { key: 'full_name', label: 'Name', render: (r) => r.full_name ?? '—' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone', render: (r) => r.phone ?? '—' },
        { key: 'state', label: 'Location', render: (r) => [r.city, r.state, r.country].filter(Boolean).join(', ') },
        { key: 'role', label: 'Role', render: (r) => <Badge tone={r.role === 'admin' ? 'accent' : 'neutral'}>{sentence(r.role)}</Badge> },
        { key: 'created_at', label: 'Joined', render: (r) => date(r.created_at) },
      ],
    }} />
  );
}

export function Emails() {
  return (
    <Resource config={{
      table: 'email_log', title: 'Email log', description: 'Every transactional email sent through Resend.', order: { column: 'created_at', ascending: false }, search: ['recipient', 'template', 'subject'],
      filters: [{ key: 'status', label: 'Status', options: [{ value: 'sent', label: 'Sent' }, { value: 'failed', label: 'Failed' }] }],
      columns: [
        { key: 'recipient', label: 'To' },
        { key: 'template', label: 'Template', render: (r) => sentence(r.template) },
        { key: 'subject', label: 'Subject', render: (r) => <span className="line-clamp-1 max-w-xs">{r.subject}</span> },
        { key: 'status', label: 'Status', render: (r) => <span title={r.error ?? ''}><Badge tone={r.status === 'sent' ? 'success' : 'danger'}>{sentence(r.status)}</Badge></span> },
        { key: 'created_at', label: 'Sent', render: (r) => date(r.created_at, true) },
      ],
    }} />
  );
}
