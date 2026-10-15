import { Link } from 'react-router-dom';
import { cx } from './ui';

export function Logo({ to = '/', light }: { to?: string; light?: boolean }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label="Smart Parking home">
      <span className="grid size-9 place-items-center rounded-[10px] bg-brand-600 font-display text-xl font-bold text-white shadow-sm ring-2 ring-white/20">P</span>
      <span className={cx('font-display text-lg leading-none font-bold tracking-tight', light ? 'text-white' : 'text-ink-900')}>
        Smart<span className={light ? 'text-lane-400' : 'text-brand-600'}>Parking</span>
      </span>
    </Link>
  );
}
