import { Activity, BarChart3, Bell, CalendarRange, CreditCard, ExternalLink, LayoutDashboard, LogOut, Menu, ParkingSquare, SquareParking, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { cx } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/occupancy', label: 'Occupancy', icon: Activity },
  { to: '/admin/parking', label: 'Parking areas', icon: ParkingSquare },
  { to: '/admin/slots', label: 'Slots', icon: SquareParking },
  { to: '/admin/reservations', label: 'Reservations', icon: CalendarRange },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const current = [...NAV].reverse().find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900 text-slate-300">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo to="/admin" light />
        <button type="button" className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
      </div>
      <p className="px-5 pt-2 pb-2 text-[11px] font-semibold tracking-widest text-slate-500 uppercase">Administration</p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Admin" onClick={() => setOpen(false)}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-brand-600 text-white shadow-sm' : 'hover:bg-white/5 hover:text-white')}>
            <n.icon className="size-[18px]" aria-hidden />{n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link to="/parking" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/5 hover:text-white"><ExternalLink className="size-4" />Customer site</Link>
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-lane-400 text-sm font-bold text-ink-900">{user?.name.charAt(0)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <button type="button" aria-label="Log out" title="Log out" className="rounded-lg p-1.5 hover:bg-white/10 hover:text-white" onClick={async () => { await signOut(); navigate('/login'); }}><LogOut className="size-4" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block no-print">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-rise shadow-2xl">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden no-print">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Menu className="size-5" /></button>
        <p className="font-display font-semibold text-ink-900">{current?.label ?? 'Admin'}</p>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><Outlet /></main>
    </div>
  );
}
