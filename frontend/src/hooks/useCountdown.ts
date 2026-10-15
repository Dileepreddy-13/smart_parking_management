import { useEffect, useState } from 'react';

/** Seconds remaining until `target` (never negative), re-evaluated every second. */
export function useCountdown(target: string | null | undefined) {
  const remaining = () => (target ? Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 1000)) : 0);
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    setSeconds(remaining());
    if (!target) return;
    const id = setInterval(() => setSeconds(remaining()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return { seconds, label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` };
}
