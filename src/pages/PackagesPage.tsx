import { PackageCard } from '@/components/shop/PackageCard';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader, Skeleton } from '@/components/ui/Misc';
import { usePackages } from '@/lib/queries';
import { useSeo } from '@/lib/seo';
import { useSite } from '@/providers/SiteProvider';

export default function PackagesPage() {
  useSeo({ title: 'Solar system packages', description: 'Complete solar inverter, battery and panel packages for Nigerian homes, from 2-bedroom flats to 5-bedroom duplexes.' });
  const { data, isLoading } = usePackages();
  const { settings } = useSite();
  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader title="System packages" text="Complete systems with inverter, LiFePO4 battery, panels, protection and installation. Every home is different, so run the calculator to confirm the right size before you buy." actions={<ButtonLink to="/solar-calculator">Check what fits my home</ButtonLink>} />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96" />) : data?.map((p) => <PackageCard key={p.id} p={p} currency={settings.commerce.currency} />)}
      </div>
      <div className="mt-12 rounded-[var(--radius-card)] bg-surface p-6 sm:p-8">
        <h2 className="text-xl">Need something larger?</h2>
        <p className="mt-2 max-w-2xl text-muted">We design commercial, school, hospital and industrial systems, including battery energy storage (BESS) from 50 kWh upwards.</p>
        <ButtonLink to="/contact?type=commercial" variant="secondary" className="mt-5">Talk to an engineer</ButtonLink>
      </div>
    </div>
  );
}
