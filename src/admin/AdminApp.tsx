import {
  BarChart3, BookOpen, Boxes, ClipboardList, Cog, CreditCard, FileText, Gauge, Globe2, Inbox, LayoutTemplate, LogOut, Mail, Menu, Package,
  Palette, Plug, ShoppingCart, Tags, UserRound, Users, Wrench, X, Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useSeo } from '@/lib/seo';
import { useAuth } from '@/providers/AuthProvider';
import * as P from './pages';

const GROUPS: { title: string; links: { to: string; label: string; icon: typeof Gauge }[] }[] = [
  { title: 'Activity', links: [
    { to: '/admin', label: 'Overview', icon: BarChart3 },
    { to: '/admin/assessments', label: 'Assessments', icon: ClipboardList },
    { to: '/admin/payments', label: 'Payments', icon: CreditCard },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { to: '/admin/requests', label: 'Installer requests', icon: Wrench },
    { to: '/admin/enquiries', label: 'Enquiries', icon: Inbox },
    { to: '/admin/customers', label: 'Customers', icon: Users },
  ] },
  { title: 'Catalogue', links: [
    { to: '/admin/products', label: 'Products', icon: Boxes },
    { to: '/admin/categories', label: 'Categories', icon: Tags },
    { to: '/admin/packages', label: 'Packages', icon: Package },
    { to: '/admin/installers', label: 'Installers', icon: UserRound },
  ] },
  { title: 'Calculator', links: [
    { to: '/admin/appliances', label: 'Appliance database', icon: Plug },
    { to: '/admin/regions', label: 'Regions & sun hours', icon: Globe2 },
    { to: '/admin/engineering', label: 'Engineering', icon: Zap },
    { to: '/admin/pricing', label: 'Fees & currencies', icon: CreditCard },
  ] },
  { title: 'Website', links: [
    { to: '/admin/content', label: 'Site content', icon: LayoutTemplate },
    { to: '/admin/posts', label: 'Articles', icon: BookOpen },
    { to: '/admin/settings', label: 'Brand & settings', icon: Palette },
    { to: '/admin/emails', label: 'Email log', icon: Mail },
    { to: '/admin/account', label: 'My admin account', icon: Cog },
  ] },
];

export default function AdminApp() {
  useSeo({ title: 'Admin', noindex: true });
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6" aria-label="Admin">
      <Link to="/admin" className="px-2"><img src="/logo-light.png" alt="KuraSolar" className="h-7 w-auto" /></Link>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-3 text-xs text-white/45">{g.title}</p>
          <ul className="mt-1.5 space-y-0.5">
            {g.links.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.to === '/admin'} onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors', isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white')}>
                  <l.icon className="size-4" />{l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-auto border-t border-white/10 pt-4">
        <p className="truncate px-3 text-sm text-white/80">{profile?.full_name ?? profile?.username}</p>
        <p className="truncate px-3 text-xs text-white/45">{profile?.email}</p>
        <div className="mt-3 flex gap-1">
          <Link to="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 hover:text-white"><FileText className="size-4" />View site</Link>
          <button type="button" onClick={async () => { await signOut(); nav('/admin/login'); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 hover:text-white"><LogOut className="size-4" />Sign out</button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-surface/70 lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh bg-primary-dark lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-primary-dark px-4 lg:hidden">
        <img src="/logo-light.png" alt="KuraSolar" className="h-7 w-auto" />
        <button type="button" onClick={() => setOpen(true)} className="grid size-10 place-items-center text-white" aria-label="Menu"><Menu className="size-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-primary-dark">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-4 right-3 grid size-9 place-items-center text-white" aria-label="Close"><X className="size-5" /></button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-10">
        <Routes>
          <Route index element={<P.Overview />} />
          <Route path="assessments" element={<P.Assessments />} />
          <Route path="payments" element={<P.Payments />} />
          <Route path="orders" element={<P.Orders />} />
          <Route path="requests" element={<P.Requests />} />
          <Route path="enquiries" element={<P.Enquiries />} />
          <Route path="customers" element={<P.Customers />} />
          <Route path="products" element={<P.Products />} />
          <Route path="categories" element={<P.Categories />} />
          <Route path="packages" element={<P.Packages />} />
          <Route path="installers" element={<P.Installers />} />
          <Route path="appliances" element={<P.Appliances />} />
          <Route path="regions" element={<P.Regions />} />
          <Route path="engineering" element={<P.Engineering />} />
          <Route path="pricing" element={<P.Pricing />} />
          <Route path="content" element={<P.Content />} />
          <Route path="posts" element={<P.Posts />} />
          <Route path="settings" element={<P.Settings />} />
          <Route path="emails" element={<P.Emails />} />
          <Route path="account" element={<P.Account />} />
          <Route path="*" element={<P.Overview />} />
        </Routes>
      </main>
    </div>
  );
}
