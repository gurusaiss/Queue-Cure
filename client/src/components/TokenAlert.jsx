import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';

function beep(freq = 880, duration = 0.15, times = 3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * (duration + 0.05));
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * (duration + 0.05) + duration);
      osc.start(ctx.currentTime + i * (duration + 0.05));
      osc.stop(ctx.currentTime + i * (duration + 0.05) + duration);
    }
    setTimeout(() => ctx.close(), 2000);
  } catch (e) {
    // AudioContext not available
  }
}

export default function TokenAlert({ lastCalled, myToken }) {
  const [visible, setVisible] = useState(false);
  const [isMyToken, setIsMyToken] = useState(false);

  useEffect(() => {
    if (!lastCalled) return;
    const mine = myToken && lastCalled.token === myToken;
    setIsMyToken(mine);
    setVisible(true);
    beep(mine ? 660 : 880, 0.15, mine ? 5 : 3);
    const t = setTimeout(() => setVisible(false), mine ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [lastCalled]);

  if (!visible || !lastCalled) return null;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl slide-in-up
      ${isMyToken
        ? 'bg-emerald-500 text-white border border-emerald-400'
        : 'bg-slate-800 text-slate-100 border border-slate-700'
      }`}>
      <Volume2 className="w-5 h-5 shrink-0" />
      <div>
        {isMyToken ? (
          <p className="font-bold text-lg">Your turn! Please proceed to the doctor.</p>
        ) : (
          <p className="font-semibold">
            Now calling: <span className="font-mono font-black text-emerald-400">{lastCalled.token}</span>
          </p>
        )}
      </div>
    </div>
  );
}
