import { useEffect, useRef, useState } from 'react';

export default function TokenCard({ token, label, color = 'emerald', size = 'lg' }) {
  const [animating, setAnimating] = useState(false);
  const prevToken = useRef(token);

  useEffect(() => {
    if (token !== prevToken.current) {
      setAnimating(true);
      prevToken.current = token;
      const t = setTimeout(() => setAnimating(false), 700);
      return () => clearTimeout(t);
    }
  }, [token]);

  const colors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    slate: 'text-slate-400',
  };

  const sizes = {
    lg: 'text-8xl md:text-9xl',
    md: 'text-5xl md:text-6xl',
    sm: 'text-3xl md:text-4xl',
  };

  return (
    <div className="text-center select-none">
      {label && (
        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-3">{label}</p>
      )}
      <div
        className={`font-mono font-black tracking-wider ${sizes[size]} ${colors[color]} ${animating ? 'token-flip' : ''}`}
        style={{ textShadow: `0 0 40px currentColor` }}
      >
        {token || '—'}
      </div>
    </div>
  );
}
