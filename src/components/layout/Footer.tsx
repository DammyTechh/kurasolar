import { Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSite } from '@/providers/SiteProvider';

const COLUMNS = [
  { title: 'Plan', links: [['Solar calculator', '/solar-calculator'], ['System packages', '/packages'], ['Find an installer', '/solar-installers'], ['Solar knowledge', '/blog']] },
  { title: 'Shop', links: [['Inverters', '/shop/inverters'], ['Batteries', '/shop/batteries'], ['Solar panels', '/shop/solar-panels'], ['Protection & cables', '/shop/protection']] },
  { title: 'Company', links: [['About us', '/about'], ['Contact', '/contact'], ['Become an installer', '/solar-installers/join'], ['My account', '/account']] },
];

export function Footer() {
  const { settings } = useSite();
  const c = settings.company;
  return (
    <footer className="mt-auto bg-primary-dark text-white">
      <div className="container-page grid gap-12 py-14 md:grid-cols-[1.3fr_2fr]">
        <div className="max-w-sm">
          <img src="/logo-light.png" alt={c.name} width={960} height={266} className="h-9 w-auto" loading="lazy" />
          <p className="mt-5 text-[0.95rem] leading-relaxed text-white/70">
            Engineering-grade solar sizing, equipment and verified installers for homes and businesses across Nigeria and Africa.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-white/80">
            <li className="flex items-center gap-2.5"><Phone className="size-4 text-accent" /><a href={`tel:${c.phone.replace(/\s/g, '')}`} className="hover:text-white">{c.phone}</a></li>
            <li className="flex items-center gap-2.5"><Mail className="size-4 text-accent" /><a href={`mailto:${c.email}`} className="hover:text-white">{c.email}</a></li>
            <li className="flex items-center gap-2.5"><MapPin className="size-4 text-accent" />{c.address}</li>
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-medium text-accent">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map(([label, to]) => (
                  <li key={to}><Link to={to} className="text-[0.95rem] text-white/75 hover:text-white">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-xs leading-relaxed text-white/55 md:flex-row md:justify-between">
          <p className="max-w-3xl">Calculator results are preliminary automated estimates. Final system sizing should be validated by a qualified engineer.</p>
          <p className="shrink-0">© {new Date().getFullYear()} {c.legalName}</p>
        </div>
      </div>
    </footer>
  );
}
