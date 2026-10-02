import { BadgeCheck, Globe, MapPin, Phone } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { sentence } from '@/lib/format';
import { useInstallers, useNgStates } from '@/lib/queries';
import { useSeo } from '@/lib/seo';
import { mediaUrl } from '@/lib/supabase';
import { INSTALLER_SERVICES } from '@/lib/types';
import { whatsappLink } from '@/lib/whatsapp';

export default function InstallersPage() {
  const [params, setParams] = useSearchParams();
  const state = params.get('state') ?? '';
  const city = params.get('city') ?? '';
  const service = params.get('service') ?? '';
  const { states } = useNgStates();
  const { data, isLoading } = useInstallers({ state, city, service });
  useSeo({ title: state ? `Solar installers in ${state}` : 'Verified solar installers in Nigeria', description: 'Find verified solar installation engineers by state and system type, or let us match you with installers near you.' });

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader title="Verified installers" text="Every installer here has been checked by our team. Browse, or send one request and we’ll match you with up to three who cover your state."
        actions={<><ButtonLink to="/solar-installers/request">Match me with installers</ButtonLink><ButtonLink to="/solar-installers/join" variant="secondary">Join the network</ButtonLink></>} />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Select aria-label="State" placeholder="All states" value={state} options={states} onChange={(e) => set('state', e.target.value)} />
        <Input aria-label="City" placeholder="City" defaultValue={city} onBlur={(e) => set('city', e.target.value.trim())} onKeyDown={(e) => e.key === 'Enter' && set('city', (e.target as HTMLInputElement).value.trim())} />
        <Select aria-label="Service" placeholder="All services" value={service} options={INSTALLER_SERVICES.map((s) => ({ value: s, label: s === 'bess' ? 'Battery storage (BESS)' : s === 'solar_pv' ? 'Solar PV' : sentence(s) }))} onChange={(e) => set('service', e.target.value)} />
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        {data?.map((i) => (
          <article key={i.id} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-6">
            <div className="flex items-start gap-4">
              {i.logo_url ? <img src={mediaUrl(i.logo_url)} alt="" className="size-14 rounded-xl object-cover" loading="lazy" /> : <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-tint text-lg font-semibold text-primary">{i.company_name[0]}</span>}
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-lg">{i.company_name}<BadgeCheck className="size-4 text-success" aria-label="Verified" /></h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" />{[i.city, i.state].filter(Boolean).join(', ')}</p>
              </div>
            </div>
            {i.bio && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-ink/80">{i.bio}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {i.services.map((s) => <span key={s} className="rounded-full bg-surface px-3 py-1 text-xs text-ink/75">{s === 'bess' ? 'BESS' : s === 'solar_pv' ? 'Solar PV' : sentence(s)}</span>)}
            </div>
            <p className="mt-4 text-sm text-muted">{i.years_experience} years’ experience, {i.completed_projects} projects{i.states_covered.length ? `, covers ${i.states_covered.slice(0, 4).join(', ')}${i.states_covered.length > 4 ? '…' : ''}` : ''}</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              <ButtonLink to={`/solar-installers/request?installer=${i.slug}&state=${encodeURIComponent(i.state)}`} size="sm">Request this installer</ButtonLink>
              {i.whatsapp && <a href={whatsappLink(i.whatsapp, `Hello ${i.company_name}, I found you on KuraSolar.`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium text-primary ring-1 ring-line hover:bg-tint"><Phone className="size-3.5" />WhatsApp</a>}
              {i.website && <a href={i.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium text-primary ring-1 ring-line hover:bg-tint"><Globe className="size-3.5" />Website</a>}
            </div>
          </article>
        ))}
      </div>
      {data?.length === 0 && <EmptyState title="No verified installers here yet" text="Send a request anyway. We’ll find an engineer who can travel to you." action={<ButtonLink to={`/solar-installers/request${state ? `?state=${encodeURIComponent(state)}` : ''}`}>Send a request</ButtonLink>} />}
    </div>
  );
}
