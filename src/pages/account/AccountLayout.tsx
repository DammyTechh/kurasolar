import { ClipboardList, CreditCard, LayoutGrid, ListChecks, LogOut, Package, UserRound, Wrench } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/layout/Header';
import { cn } from '@/lib/cn';
import { useAuth } from '@/providers/AuthProvider';

const LINKS = [
  { to: '/account', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/account/assessments', label: 'Assessments', icon: ClipboardList },
  { to: '/account/orders', label: 'Orders', icon: Package },
  { to: '/account/payments', label: 'Payments', icon: CreditCard },
  { to: '/account/requests', label: 'Installer requests', icon: Wrench },
  { to: '/account/saved', label: 'Saved appliances', icon: ListChecks },
  { to: '/account/profile', label: 'Profile', icon: UserRound },
];

export default function AccountLayout() {
  const { profile, user, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="container-page grid gap-8 py-8 sm:py-12 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside>
        <div className="flex items-center gap-3">
          <Avatar name={profile?.full_name ?? user?.email} url={profile?.avatar_url} size={44} />
          <div className="min-w-0">
            <p className="truncate font-medium">{profile?.full_name ?? 'My account'}</p>
            <p className="truncate text-sm text-muted">{user?.email}</p>
          </div>
        </div>
        <nav className="-mx-5 mt-6 flex gap-1 overflow-x-auto px-5 lg:mx-0 lg:flex-col lg:px-0" aria-label="Account">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cn('flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-sm transition-colors lg:rounded-xl', isActive ? 'bg-tint font-medium text-primary' : 'text-ink/75 hover:text-primary')}>
              <l.icon className="size-4" />{l.label}
            </NavLink>
          ))}
          <button type="button" onClick={async () => { await signOut(); nav('/'); }} className="flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-sm text-ink/75 hover:text-danger lg:rounded-xl">
            <LogOut className="size-4" />Sign out
          </button>
        </nav>
      </aside>
      <div className="min-w-0"><Outlet /></div>
    </div>
  );
}
