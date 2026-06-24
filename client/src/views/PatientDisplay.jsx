import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Users, Search, ArrowLeft, Coffee, TrendingUp, Bell, Info, ChevronRight } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import ConnectionBadge from '../components/ConnectionBadge';
import TokenCard from '../components/TokenCard';
import TokenAlert from '../components/TokenAlert';

function formatWait(mins) {
  if (!mins || mins <= 0) return 'Almost your turn!';
  if (mins < 1) return '< 1 min';
  const m = Math.round(mins);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `~${m} min`;
}

function LiveAgo({ updatedAt }) {
  const [label, setLabel] = useState('just now');
  useEffect(() => {
    if (!updatedAt) return;
    const tick = () => {
      const s = Math.round((Date.now() - updatedAt) / 1000);
      setLabel(s < 2 ? 'just now' : `${s}s ago`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [updatedAt]);
  return <span className="text-slate-600 text-xs">Updated {label}</span>;
}

function ProgressRing({ position, total }) {
  const pct = total > 0 ? Math.max(0.05, (total - position + 1) / (total + 1)) : 1;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
      <circle cx="64" cy="64" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
      <circle
        cx="64" cy="64" r={r} fill="none"
        stroke="url(#ring-grad)" strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function PatientDisplay() {
  const nav = useNavigate();
  const { connected, queueState: s, lastCalled } = useSocket('patient');

  const [myToken, setMyToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [myInfo, setMyInfo] = useState(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [showEtaInfo, setShowEtaInfo] = useState(false);
  const prevCurrentToken = useRef(null);

  // Flash tab title when token changes
  useEffect(() => {
    if (!s?.currentToken || s.currentToken === prevCurrentToken.current) return;
    prevCurrentToken.current = s.currentToken;
    document.title = `🔔 Now: ${s.currentToken} — Queue Cure`;
    const t = setTimeout(() => { document.title = 'Queue Cure — Smart Clinic Queue'; }, 5000);
    return () => clearTimeout(t);
  }, [s?.currentToken]);

  // Find this patient's queue entry
  useEffect(() => {
    if (!myToken || !s?.queue) { setMyInfo(null); return; }
    const found = s.queue.find(q => q.token.toUpperCase() === myToken.toUpperCase());
    setMyInfo(found || null);
  }, [myToken, s?.queue]);

  function handleSearch(e) {
    e.preventDefault();
    setMyToken(tokenInput.trim().toUpperCase());
  }

  async function requestNotifications() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === 'granted');
  }

  useEffect(() => {
    if (!lastCalled || !notifEnabled) return;
    const isMe = myToken && lastCalled.token === myToken;
    new Notification(isMe ? '🏥 Your Turn!' : '🔔 Queue Update', {
      body: isMe ? "Please proceed to the doctor's room." : `Now serving: ${lastCalled.token}`,
      icon: '/favicon.svg',
    });
  }, [lastCalled]);

  const doctorOnBreak = s?.doctorStatus === 'break';
  const isMyTurn = myInfo && myInfo.position === 1;
  const isAlmostMyTurn = myInfo && myInfo.position <= 2;

  const confidenceColor = {
    high: 'text-emerald-400', medium: 'text-amber-400', low: 'text-slate-500'
  }[s?.dataConfidence ?? 'low'];
  const confidenceLabel = {
    high: '● High accuracy (real data)', medium: '● Building accuracy', low: '● Estimate (few calls)'
  }[s?.dataConfidence ?? 'low'];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <TokenAlert lastCalled={lastCalled} myToken={myToken} />

      {/* Header */}
      <header className="border-b border-slate-800 px-4 py-3.5 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/')} className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-bold text-white">Queue Cure</h1>
            <p className="text-xs text-slate-500">Patient Waiting Room</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!notifEnabled && 'Notification' in window && (
            <button onClick={requestNotifications} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              Notify me
            </button>
          )}
          <ConnectionBadge connected={connected} />
        </div>
      </header>

      {/* Break banner */}
      {doctorOnBreak && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-center gap-2 text-amber-400 text-sm font-medium">
          <Coffee className="w-4 h-4" />
          Doctor is on a short break — queue will resume shortly
        </div>
      )}

      <div className="flex-1 flex flex-col items-center px-4 py-6 max-w-xl mx-auto w-full gap-5">

        {/* Hero: Current Token */}
        <div className="card w-full p-7 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-radial from-emerald-500/5 to-transparent pointer-events-none" />

          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-5">NOW SERVING</p>

          {s?.currentToken ? (
            <div className="glow-pulse inline-block">
              <TokenCard token={s.currentToken} color="emerald" size="lg" />
            </div>
          ) : (
            <div className="py-4">
              <p className="font-mono font-black text-slate-700" style={{ fontSize: 'clamp(3rem,14vw,8rem)' }}>—</p>
              <p className="text-slate-600 mt-2 text-sm">Waiting for first patient to be called</p>
            </div>
          )}

          {s?.currentPatient && (
            <p className="text-slate-400 text-sm mt-3">
              {s.currentPatient.name} — please proceed to the consultation room
            </p>
          )}

          {/* Live stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{s?.waitingCount ?? 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">Waiting</p>
            </div>
            <div className="text-center border-x border-slate-800">
              <p className="text-2xl font-bold text-white">
                {s?.avgConsultMinutes ?? '—'}
                {s?.avgConsultMinutes && <span className="text-sm text-slate-400 font-normal ml-0.5">m</span>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Avg consult</p>
            </div>
            <div className="text-center">
              <p className={`text-xs font-semibold ${confidenceColor} mt-1`}>{confidenceLabel}</p>
              <p className="text-xs text-slate-500 mt-0.5">ETA quality</p>
            </div>
          </div>

          {/* Live sync proof */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {s?.updatedAt && <LiveAgo updatedAt={s.updatedAt} />}
          </div>
        </div>

        {/* "You're next!" urgent card */}
        {isAlmostMyTurn && (
          <div className={`w-full card p-4 border-2 flex items-center gap-4 slide-in-up ${
            isMyTurn
              ? 'border-emerald-500/60 bg-emerald-500/10'
              : 'border-amber-500/40 bg-amber-500/5'
          }`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isMyTurn ? 'bg-emerald-500/20' : 'bg-amber-500/15'
            }`}>
              <ChevronRight className={`w-6 h-6 ${isMyTurn ? 'text-emerald-400' : 'text-amber-400'}`} />
            </div>
            <div>
              <p className={`font-bold text-lg ${isMyTurn ? 'text-emerald-300' : 'text-amber-300'}`}>
                {isMyTurn ? 'You are NEXT!' : 'Almost your turn!'}
              </p>
              <p className="text-sm text-slate-400">
                {isMyTurn ? 'Please make your way to the consultation room.' : 'One patient ahead of you. Stay nearby.'}
              </p>
            </div>
          </div>
        )}

        {/* Token lookup */}
        <div className="card w-full p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-white">Check My Wait Time</h2>
          </div>
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              placeholder="Enter your token e.g. T003"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value.toUpperCase())}
              className="input font-mono uppercase tracking-wider"
              maxLength={5}
            />
            <button type="submit" className="btn-primary shrink-0">Track</button>
          </form>

          {myToken && (
            <div className="mt-5">
              {myInfo ? (
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  {/* Progress ring */}
                  <div className="relative shrink-0">
                    <ProgressRing position={myInfo.position} total={s?.waitingCount ?? 1} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono font-black text-emerald-400 text-lg leading-none">{myInfo.token}</span>
                      <span className="text-xs text-slate-500 mt-1">your token</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2.5 w-full">
                    <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl p-3">
                      <Users className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500">Patients ahead</p>
                        <p className="font-bold text-white text-xl leading-tight">{myInfo.position - 1}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl p-3">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-500">Estimated wait</p>
                          <button onClick={() => setShowEtaInfo(v => !v)} className="text-slate-600 hover:text-slate-400">
                            <Info className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="font-bold text-white text-xl leading-tight">{formatWait(myInfo.estimatedWaitMinutes)}</p>
                        {showEtaInfo && (
                          <div className="mt-2 text-xs text-slate-500 bg-slate-900 p-2 rounded-lg border border-slate-700">
                            <p><span className="text-amber-400 font-mono">wait = {myInfo.position - 1} × {s?.avgConsultMinutes}min = {myInfo.estimatedWaitMinutes}min</span></p>
                            <p className="mt-1">Avg from {
                              s?.dataConfidence === 'high' ? 'real call history (6+ calls)' :
                              s?.dataConfidence === 'medium' ? 'blend of real + config data' :
                              'receptionist\'s configured time'
                            }</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl p-3">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500">Your position</p>
                        <p className="font-bold text-white text-xl leading-tight">#{myInfo.position}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl p-4 text-slate-400 text-sm">
                  Token <span className="font-mono font-bold text-white mx-1">{myToken}</span> is not in the current waiting queue — you may have already been called, or this token hasn't been created yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full queue preview */}
        {s?.queue && s.queue.length > 0 && (
          <div className="card w-full overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">Full Queue Preview</h3>
              <span className="text-xs text-slate-500">{s.waitingCount} waiting</span>
            </div>
            <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
              {s.queue.map((p) => {
                const isMe = myToken && p.token === myToken;
                const pct = Math.max(8, 100 - ((p.position - 1) / Math.max(s.waitingCount, 1)) * 90);
                return (
                  <div key={p.token} className={`flex items-center gap-4 px-5 py-3 ${isMe ? 'bg-emerald-500/5' : ''}`}>
                    <span className="text-slate-600 text-sm w-5 text-right shrink-0">{p.position}</span>
                    <span className={`font-mono font-bold text-sm w-16 shrink-0 ${isMe ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {p.token}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-emerald-500">◀</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isMe ? 'bg-emerald-500' : 'bg-amber-500/60'}`}
                          style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0 min-w-[48px] text-right">{formatWait(p.estimatedWaitMinutes)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-slate-700 text-xs text-center pb-2">
          All updates are live · No refresh needed ever
        </p>
      </div>
    </div>
  );
}
