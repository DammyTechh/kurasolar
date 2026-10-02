import { AnimatePresence, motion } from 'motion/react';
import { Menu, ShoppingBag, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { mediaUrl } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useCart } from '@/providers/CartProvider';
import { ButtonLink } from '../ui/Button';
import { Logo } from '../ui/Misc';

const NAV = [
  { to: '/solar-calculator', label: 'Calculator' },
  { to: '/shop', label: 'Shop' },
  { to: '/packages', label: 'Packages' },
  { to: '/solar-installers', label: 'Installers' },
  { to: '/blog', label: 'Learn' },
];

export function Avatar({ name, url, size = 32 }: { name?: string | null; url?: string | null; size?: number }) {
  return url ? (
    <img src={mediaUrl(url)} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-primary text-xs font-medium text-white" style={{ width: size, height: size }}>
      {initials(name)}
    </span>
  );
}

export function Header() {
  const { user, profile } = useAuth();
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn('sticky top-0 z-50 bg-white/90 backdrop-blur-md transition-shadow', scrolled && 'shadow-[0_1px_0_var(--color-line)]')}>
      <div className="container-page flex h-16 items-center gap-6 sm:h-[4.5rem]">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => cn('rounded-full px-3.5 py-2 text-[0.95rem] transition-colors', isActive ? 'bg-tint text-primary' : 'text-ink/80 hover:text-primary')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={() => cart.setOpen(true)} className="relative grid size-10 place-items-center rounded-full text-ink hover:bg-tint" aria-label={`Cart, ${cart.count} items`}>
            <ShoppingBag className="size-5" />
            {cart.count > 0 && (
              <span className="num absolute top-0.5 right-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.7rem] font-bold text-primary-dark">{cart.count}</span>
            )}
          </button>
          {user ? (
            <Link to="/account" className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1 hover:bg-tint sm:pr-3" aria-label="My account">
              <Avatar name={profile?.full_name ?? user.email} url={profile?.avatar_url} />
              <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">{profile?.full_name?.split(' ')[0] ?? 'Account'}</span>
            </Link>
          ) : (
            <Link to="/sign-in" className="hidden items-center gap-2 rounded-full px-3 py-2 text-[0.95rem] text-ink/80 hover:text-primary sm:flex">
              <UserRound className="size-4" /> Sign in
            </Link>
          )}
          <ButtonLink to="/solar-calculator" size="sm" className="hidden md:inline-flex">Size my system</ButtonLink>
          <button type="button" onClick={() => setOpen((o) => !o)} className="grid size-10 place-items-center rounded-full hover:bg-tint lg:hidden" aria-label="Menu" aria-expanded={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-line bg-white lg:hidden"
            aria-label="Mobile"
          >
            <div className="container-page flex flex-col py-3">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('rounded-xl px-3 py-3 text-base', isActive ? 'bg-tint text-primary' : 'text-ink')}>
                  {n.label}
                </NavLink>
              ))}
              {!user && <NavLink to="/sign-in" className="rounded-xl px-3 py-3 text-base text-ink">Sign in</NavLink>}
              <ButtonLink to="/solar-calculator" className="mt-3 mb-1">Size my system</ButtonLink>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}