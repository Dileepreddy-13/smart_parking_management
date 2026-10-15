import { CalendarCheck, LayoutDashboard, LogOut, MapPinned, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { NotificationBell } from '../components/NotificationBell';
import { ButtonLink, cx } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, auth: true },
  { to: '/parking', label: 'Find parking', icon: MapPinned, auth: false },
  { to: '/bookings', label: 'My bookings', icon: CalendarCheck, auth: true },
];

export function UserLayout() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = NAV.filter((l) => user || !l.auth);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors', isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white');

  const logout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-ink-900 shadow-md no-print">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Logo to={user ? '/dashboard' : '/'} light />
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((l) => <NavLink key={l.to} to={l.to} className={linkClass}><l.icon className="size-4" />{l.label}</NavLink>)}
            {isAdmin && <NavLink to="/admin" className={linkClass}><ShieldCheck className="size-4" />Admin</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {user ? (
              <>
                <NotificationBell dark />
                <NavLink to="/profile" className={({ isActive }) => cx('hidden items-center gap-2 rounded-lg py-1.5 pr-3 pl-1.5 text-sm font-semibold sm:inline-flex', isActive ? 'bg-white/10 text-white' : 'text-slate-200 hover:bg-white/5')}>
                  <span className="grid size-7 place-items-center rounded-full bg-lane-400 text-xs font-bold text-ink-900">{user.name.charAt(0).toUpperCase()}</span>
                  {user.name.split(' ')[0]}
                </NavLink>
                <button type="button" onClick={logout} className="hidden rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white md:block" aria-label="Log out" title="Log out"><LogOut className="size-5" /></button>
              </>
            ) : (
              <>
                <ButtonLink to="/login" variant="ghost" className="!text-white hover:!bg-white/10">Login</ButtonLink>
                <ButtonLink to="/register" variant="accent" className="hidden sm:inline-flex">Sign up</ButtonLink>
              </>
            )}
            <button type="button" className="rounded-lg p-2 text-slate-200 hover:bg-white/10 md:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-white/10 px-4 py-3 md:hidden" aria-label="Mobile">
            <div className="flex flex-col gap-1" onClick={() => setMenuOpen(false)}>
              {links.map((l) => <NavLink key={l.to} to={l.to} className={linkClass}><l.icon className="size-4" />{l.label}</NavLink>)}
              {user && <NavLink to="/profile" className={linkClass}><UserRound className="size-4" />Profile</NavLink>}
              {isAdmin && <NavLink to="/admin" className={linkClass}><ShieldCheck className="size-4" />Admin</NavLink>}
              {user && <button type="button" onClick={logout} className={linkClass({ isActive: false })}><LogOut className="size-4" />Log out</button>}
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><Outlet /></main>
    </div>
  );
}
