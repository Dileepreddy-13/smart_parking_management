import { Compass, ShieldAlert } from 'lucide-react';
import { ButtonLink } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

function Shell({ icon: Icon, code, title, text }: { icon: typeof Compass; code: string; title: string; text: string }) {
  const { user, isAdmin } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-ink-900 text-lane-400"><Icon className="size-8" aria-hidden /></div>
        <p className="mt-6 font-mono text-sm font-bold text-brand-600">{code}</p>
        <h1 className="mt-1 text-3xl font-bold">{title}</h1>
        <p className="mt-3 text-slate-600">{text}</p>
        <ButtonLink to={user ? (isAdmin ? '/admin' : '/dashboard') : '/'} className="mt-6">{user ? 'Back to dashboard' : 'Back to home'}</ButtonLink>
      </div>
    </div>
  );
}

export const NotFound = () => <Shell icon={Compass} code="404" title="This page took a wrong turn" text="The page you are looking for does not exist or has moved." />;
export const Forbidden = () => <Shell icon={ShieldAlert} code="403" title="Access denied" text="This area is for parking administrators only." />;
