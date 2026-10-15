import { LayoutDashboard } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { ButtonLink } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

export function PublicLayout() {
  const { user, isAdmin } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo light />
          <nav className="flex items-center gap-2" aria-label="Main">
            <ButtonLink to="/parking" variant="ghost" className="hidden !text-slate-200 hover:!bg-white/10 sm:inline-flex">Find parking</ButtonLink>
            {user ? (
              <ButtonLink to={isAdmin ? '/admin' : '/dashboard'} variant="accent" icon={LayoutDashboard}>Dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="ghost" className="!text-white hover:!bg-white/10">Login</ButtonLink>
                <ButtonLink to="/register" variant="accent">Sign up</ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
