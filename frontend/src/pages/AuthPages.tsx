import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LogIn, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api, type Session } from '../api';
import { ApiError } from '../api/client';
import { Logo } from '../components/Logo';
import { Alert, Button, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="lane-stripes absolute inset-0" aria-hidden />
        <div className="absolute -bottom-32 -left-32 size-96 rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
        <div className="relative"><Logo light /></div>
        <div className="relative">
          <p className="font-display text-5xl leading-tight font-bold">Your bay is<br />waiting <span className="text-lane-400">for you.</span></p>
          <p className="mt-4 max-w-sm text-slate-300">Reserve a parking slot in under a minute and get a reminder before it starts.</p>
        </div>
        <p className="relative text-xs text-slate-500">Software Engineering case study · test-mode payments only</p>
      </div>
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-6 text-center text-sm text-slate-600">{footer}</p>
        </div>
      </div>
    </div>
  );
}

function useSessionRedirect() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  return (session: Session) => {
    signIn(session);
    const home = session.user.role === 'ADMIN' ? '/admin' : '/dashboard';
    // Never send a customer back to an admin page (or vice versa) they were bounced from.
    const target = from && from.startsWith('/admin') === (session.user.role === 'ADMIN') ? from : home;
    navigate(target, { replace: true });
  };
}

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginValues = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS = [
  { label: 'Demo user', email: 'user@smartparking.local', password: 'User@123' },
  { label: 'Demo admin', email: 'admin@smartparking.local', password: 'Admin@123' },
];

export function Login() {
  const redirect = useSessionRedirect();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const login = useMutation({ mutationFn: api.login, onSuccess: (s) => { toast.success(`Welcome back, ${s.user.name.split(' ')[0]}`); redirect(s); } });

  return (
    <AuthShell title="Log in" subtitle="Welcome back. Enter your details to continue." footer={<>New here? <Link to="/register" className="font-semibold text-brand-600 hover:underline">Create an account</Link></>}>
      <form onSubmit={handleSubmit((v) => login.mutate(v))} className="space-y-4" noValidate>
        {login.error && <Alert tone="red">{login.error.message}</Alert>}
        <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <Button type="submit" size="lg" className="w-full" icon={LogIn} loading={login.isPending}>Log in</Button>
      </form>
      {import.meta.env.DEV && (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600">Development demo accounts</p>
          <div className="mt-2 flex gap-2">
            {DEMO_ACCOUNTS.map((d) => (
              <Button key={d.email} variant="secondary" size="sm" className="flex-1" onClick={() => { setValue('email', d.email); setValue('password', d.password); }}>{d.label}</Button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(100),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    phone: z.string().trim().regex(/^(\+?[0-9 -]{7,15})?$/, 'Enter a valid phone number'),
    password: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type RegisterValues = z.infer<typeof registerSchema>;

export function Register() {
  const redirect = useSessionRedirect();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  const signUp = useMutation({
    mutationFn: ({ confirm: _confirm, phone, ...rest }: RegisterValues) => api.register({ ...rest, phone: phone || undefined }),
    onSuccess: (s) => { toast.success('Account created. Welcome!'); redirect(s); },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') setError('email', { message: err.message });
      if (err instanceof ApiError) err.details?.forEach((d) => setError(d.field as keyof RegisterValues, { message: d.message }));
    },
  });
  const generalError = signUp.error instanceof ApiError && (signUp.error.code === 'EMAIL_TAKEN' || signUp.error.details) ? null : signUp.error;

  return (
    <AuthShell title="Create your account" subtitle="It takes less than a minute." footer={<>Already registered? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Log in</Link></>}>
      <form onSubmit={handleSubmit((v) => signUp.mutate(v))} className="space-y-4" noValidate>
        {generalError && <Alert tone="red">{generalError.message}</Alert>}
        <Input label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone (optional)" type="tel" autoComplete="tel" placeholder="+91 98765 43210" error={errors.phone?.message} {...register('phone')} />
        <Input label="Password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number." error={errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" size="lg" className="w-full" icon={UserPlus} loading={signUp.isPending}>Create account</Button>
      </form>
    </AuthShell>
  );
}
