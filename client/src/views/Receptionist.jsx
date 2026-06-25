import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, ChevronRight, Coffee, RotateCcw, Clock, Users,
  CheckCircle, Zap, Stethoscope, ArrowLeft, AlertTriangle,
  Trash2, Settings, TrendingUp, BarChart2, Info, Keyboard,
  Play
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useSocket } from '../hooks/useSocket';
import ConnectionBadge from '../components/ConnectionBadge';
import TokenCard from '../components/TokenCard';
import StatCard from '../components/StatCard';

const PATIENT_URL = window.location.origin + '/patient';

/* ── Live "Updated Xs ago" stamp ── */
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
  return <span className="text-xs text-slate-600 font-normal ml-1">· Updated {label}</span>;
}

/* ── Toast notification ── */
function Toast({ feedback }) {
  const [exiting, setExiting] = useState(false);
  const prev = useRef(feedback);

  useEffect(() => {
    if (!feedback && prev.current) {
      setExiting(true);
      const t = setTimeout(() => setExiting(false), 180);
      return () => clearTimeout(t);
    }
    if (feedback) setExiting(false);
    prev.current = feedback;
  }, [feedback]);

  if (!feedback && !exiting) return null;

  const data = feedback || prev.current;
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border max-w-sm
      ${data.isError
        ? 'bg-red-950 border-red-500/40 text-red-300'
        : 'bg-emerald-950 border-emerald-500/40 text-emerald-300'}
      ${exiting ? 'toast-exit' : 'toast-enter'}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${data.isError ? 'bg-red-400' : 'bg-emerald-400'}`} />
      <p className="text-sm font-medium">{data.msg}</p>
    </div>
  );
}

/* ── ETA formula panel ── */
function EtaFormula({ avgTime, callCount }) {
  const blend = callCount < 3 ? '100% configured' : callCount < 6 ? '50/50 blend' : '100% real data';
  return (
    <div className="mt-3 p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1.5 slide-in-up">
      <p className="text-xs font-semibold text-slate-300">ETA Formula (live)</p>
      <p className="text-xs font-mono text-amber-400">wait = position × {avgTime} min</p>
      <p className="text-xs text-slate-400">Source: <span className="text-blue-400">{blend}</span> ({callCount} calls)</p>
      <p className="text-xs text-slate-600">Auto-refines every call · never hardcoded</p>
    </div>
  );
}

export default function Receptionist() {
  const nav = useNavigate();
  const { connected, queueState, emit } = useSocket('receptionist');

  const [form, setForm] = useState({ name: '', phone: '' });
  const [avgInput, setAvgInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showEta, setShowEta] = useState(false);
  const timerRef = useRef(null);

  const s = queueState;
  const waitingCount = s?.fullQueue?.filter(p => p.status === 'waiting').length ?? 0;
  const servingPatient = s?.fullQueue?.find(p => p.status === 'serving');
  const waitingPatients = s?.fullQueue?.filter(p => p.status === 'waiting') ?? [];
  const onBreak = s?.doctorStatus === 'break';

  function flash(msg, isError = false) {
    clearTimeout(timerRef.current);
    setFeedback({ msg, isError });
    timerRef.current = setTimeout(() => setFeedback(null), 3200);
  }

  /* Ctrl+Enter → Call Next */
  const handleCallNext = useCallback(async () => {
    if (loading === 'call') return;
    setLoading('call');
    const res = await emit('call_next', null);
    setLoading('');
    if (res.error) flash(res.error, true);
    else flash(`Calling ${res.token}`);
  }, [loading, emit]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (waitingCount > 0 && !loading && !onBreak) handleCallNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCallNext, waitingCount, loading, onBreak]);

  async function handleAddPatient(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading('add');
    const res = await emit('add_patient', { name: form.name.trim(), phone: form.phone.trim() });
    setLoading('');
    if (res.error) { flash(res.error, true); return; }
    flash(`Token ${res.token} issued to ${form.name.trim()}`);
    setForm({ name: '', phone: '' });
    setTimeout(() => document.querySelector('input[placeholder="Patient name *"]')?.focus(), 50);
  }

  async function handleSetAvgTime(e) {
    e.preventDefault();
    const mins = parseFloat(avgInput);
    if (isNaN(mins)) return;
    const res = await emit('set_avg_time', { minutes: mins });
    if (res.error) flash(res.error, true);
    else { flash(`Avg time set to ${mins} min`); setAvgInput(''); }
  }

  async function handleToggleBreak() {
    const res = await emit('toggle_break', null);
    if (res.status === 'break') flash('Doctor on break — queue paused');
    else flash('Doctor back — queue active');
  }

  async function handlePriorityBump(id, name) {
    const res = await emit('priority_bump', { id });
    if (res.error) flash(res.error, true);
    else flash(`${name} moved to front`);
  }

  async function handleRemove(id, name) {
    if (!window.confirm(`Remove ${name} from queue?`)) return;
    const res = await emit('remove_patient', { id });
    if (res.error) flash(res.error, true);
    else flash(`${name} removed`);
  }

  async function handleReset() {
    setShowReset(false);
    await emit('reset_queue', null);
    flash('Queue reset for new day');
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* Toast */}
      <Toast feedback={feedback} />

      {/* ── Header ── */}
      <header className="border-b border-slate-800 px-5 py-3 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/')} className="btn-icon mr-1" title="Home">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-none">Queue Cure</h1>
            <div className="flex items-center gap-1">
              <p className="text-xs text-slate-500">Receptionist</p>
              {s?.updatedAt && <LiveAgo updatedAt={s.updatedAt} />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ConnectionBadge connected={connected} />

          <button onClick={() => setShowQR(v => !v)} className="btn-secondary text-xs py-2 px-3">
            QR Code
          </button>

          {/* Break toggle — clear ON/OFF states */}
          <button
            onClick={handleToggleBreak}
            className={`btn-break ${onBreak ? 'on' : 'off'}`}
          >
            <Coffee className="w-3.5 h-3.5 shrink-0" />
            {onBreak ? 'On Break' : 'Break'}
            {onBreak && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </button>

          <button onClick={() => setShowReset(true)} className="btn-icon" title="Reset queue (end of day)">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Break banner */}
      {onBreak && (
        <div className="banner-in bg-amber-500/10 border-b border-amber-500/30 px-5 py-2 flex items-center gap-2 text-amber-300 text-sm font-medium">
          <Coffee className="w-4 h-4 shrink-0" />
          Doctor is on break — queue paused. Patients are being notified.
          <button onClick={handleToggleBreak} className="ml-auto text-xs underline underline-offset-2 text-amber-400 hover:text-amber-300">
            End break
          </button>
        </div>
      )}

      {/* Keyboard hint bar */}
      <div className="border-b border-slate-800/50 px-5 py-1.5 flex items-center gap-2 text-slate-600 text-xs select-none">
        <Keyboard className="w-3 h-3" />
        Press <kbd className="mx-1 bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-700">Ctrl+Enter</kbd> to call next patient
      </div>

      {/* ── QR Modal ── */}
      {showQR && (
        <div className="fixed inset-0 bg-black/75 z-40 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className="card p-8 text-center max-w-sm w-full shadow-2xl slide-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white text-lg mb-1">Patient Waiting Room</h3>
            <p className="text-slate-400 text-sm mb-5">Patients scan this to see the live queue and their wait time</p>
            <div className="bg-white p-4 rounded-xl inline-block mb-4 shadow-lg">
              <QRCodeSVG value={PATIENT_URL} size={180} />
            </div>
            <p className="text-slate-500 text-xs break-all mb-5">{PATIENT_URL}</p>
            <button className="btn-secondary w-full" onClick={() => setShowQR(false)}>Close</button>
          </div>
        </div>
      )}

      {/* ── Reset confirm ── */}
      {showReset && (
        <div className="fixed inset-0 bg-black/75 z-40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card p-6 max-w-sm w-full shadow-2xl slide-in-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <h3 className="font-bold text-white">Reset Queue?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-5 leading-relaxed">
              Clears all patients, resets token counter to T001, and zeroes today's stats. Use at end of clinic session.
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowReset(false)}>Cancel</button>
              <button
                className="flex-1 bg-red-500 hover:bg-red-400 active:bg-red-600 text-white font-semibold px-4 py-2.5 rounded-xl"
                style={{ transition: 'background-color 120ms ease, transform 80ms ease' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                onMouseUp={e => e.currentTarget.style.transform = ''}
                onMouseLeave={e => e.currentTarget.style.transform = ''}
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 p-5 max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-3 gap-5">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* Current token + Call Next */}
            <div className="card p-6 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-4 font-medium">Now Serving</p>

              {s?.currentToken ? (
                <>
                  <TokenCard token={s.currentToken} color="emerald" size="lg" />
                  {s?.currentPatient && (
                    <p className="text-slate-300 text-sm mt-3 font-medium">{s.currentPatient.name}</p>
                  )}
                </>
              ) : (
                <div className="py-4">
                  <p className="text-slate-700 font-mono text-6xl font-black">—</p>
                  <p className="text-slate-600 text-sm mt-2">No patient yet</p>
                </div>
              )}

              <button
                onClick={handleCallNext}
                disabled={waitingCount === 0 || loading === 'call' || onBreak}
                className={`btn-primary w-full mt-6 flex items-center justify-center gap-2 py-4 text-base
                  ${waitingCount > 0 && !onBreak ? 'btn-call-ready' : ''}`}
              >
                {loading === 'call'
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Calling…</>
                  : <><ChevronRight className="w-5 h-5" />Call Next</>
                }
                {waitingCount > 0 && (
                  <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                    {waitingCount}
                  </span>
                )}
              </button>

              {onBreak && (
                <p className="text-amber-500/70 text-xs mt-2">End break to resume calling</p>
              )}
              {!onBreak && waitingCount === 0 && (
                <p className="text-slate-700 text-xs mt-2">Queue is empty</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Waiting" value={waitingCount} icon={Users} color="blue" />
              <StatCard label="Served Today" value={s?.servedToday ?? 0} icon={CheckCircle} color="emerald" />
              <StatCard label="Avg Consult" value={s?.avgConsultMinutes ?? s?.configAvgTime ?? '—'} unit="min" icon={Clock} color="amber" />
              <StatCard label="Data Quality" value={s?.dataConfidence ?? '—'} icon={TrendingUp} color="purple" />
            </div>

            {/* Avg time config */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-200 text-sm">Consultation Time</h3>
                </div>
                <button
                  onClick={() => setShowEta(v => !v)}
                  className={`btn-icon ${showEta ? 'text-blue-400 bg-blue-500/10' : ''}`}
                  title="View ETA formula"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSetAvgTime} className="flex gap-2">
                <input
                  type="number" min="1" max="120" step="0.5"
                  placeholder={`Current: ${s?.configAvgTime ?? 5} min`}
                  value={avgInput}
                  onChange={e => setAvgInput(e.target.value)}
                  className="input text-sm py-2.5"
                />
                <button type="submit" className="btn-secondary shrink-0 text-sm">Set</button>
              </form>
              {showEta
                ? <EtaFormula avgTime={s?.avgConsultMinutes ?? s?.configAvgTime ?? 5} callCount={s?.callHistoryCount ?? 0} />
                : <p className="text-xs text-slate-600 mt-2">
                    {(s?.callHistoryCount ?? 0) >= 6
                      ? `Auto-learning from ${s.callHistoryCount} real calls`
                      : `Auto-refines after 3 calls (${s?.callHistoryCount ?? 0} so far)`}
                  </p>
              }
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Add patient form */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-white text-lg">Add Patient to Queue</h2>
                <span className="text-xs text-slate-500 ml-auto">Token auto-assigned</span>
              </div>
              <form onSubmit={handleAddPatient} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Patient name *"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input flex-1"
                  autoFocus
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="input sm:w-44"
                />
                <button
                  type="submit"
                  disabled={!form.name.trim() || loading === 'add'}
                  className="btn-primary shrink-0 flex items-center gap-2"
                >
                  {loading === 'add'
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <UserPlus className="w-4 h-4" />
                  }
                  {loading === 'add' ? 'Adding…' : 'Add Patient'}
                </button>
              </form>
            </div>

            {/* Queue list */}
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-slate-400" />
                  <h2 className="font-bold text-white">Live Queue</h2>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{waitingCount} waiting</span>
                  {servingPatient && <span className="text-emerald-400">· 1 in room</span>}
                </div>
              </div>

              {/* Currently serving row */}
              {servingPatient && (
                <div className="px-6 py-4 bg-emerald-500/5 border-b border-emerald-500/15 flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="absolute -inset-1 rounded-full bg-emerald-400/30 animate-ping" />
                  </div>
                  <span className="font-mono font-black text-emerald-400 text-xl w-20">{servingPatient.token}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{servingPatient.name}</p>
                    {servingPatient.phone && <p className="text-xs text-slate-500">{servingPatient.phone}</p>}
                  </div>
                  <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">In Room</span>
                </div>
              )}

              {/* Waiting list */}
              {waitingPatients.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Users className="w-10 h-10 text-slate-800 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Queue is empty</p>
                  <p className="text-slate-600 text-sm mt-1">Add a patient above to get started</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50 max-h-[500px] overflow-y-auto">
                  {waitingPatients.map((p, idx) => {
                    const qEntry = s?.queue?.find(q => q.token === p.token);
                    const isNext = idx === 0;
                    return (
                      <div
                        key={p.id}
                        className={`px-6 py-4 flex items-center gap-4 group slide-in-up
                          ${isNext ? 'bg-amber-500/5 hover:bg-amber-500/8' : 'hover:bg-slate-800/50'}
                          transition-colors duration-100`}
                      >
                        {/* Position */}
                        <span className={`text-sm font-mono font-bold w-6 text-right shrink-0
                          ${isNext ? 'text-amber-400' : 'text-slate-600'}`}>
                          {idx + 1}
                        </span>

                        {/* Token */}
                        <span className={`font-mono font-black text-lg w-20 shrink-0
                          ${isNext ? 'text-amber-300' : 'text-amber-400/80'}`}>
                          {p.token}
                        </span>

                        {/* Name + phone */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate flex items-center gap-2">
                            {p.name}
                            {isNext && (
                              <span className="text-xs font-normal text-amber-400/80 bg-amber-500/10
                                px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                                Next up
                              </span>
                            )}
                          </p>
                          {p.phone && <p className="text-xs text-slate-500 mt-0.5">{p.phone}</p>}
                        </div>

                        {/* ETA */}
                        <div className="text-right shrink-0 hidden sm:block min-w-[60px]">
                          {qEntry && <p className="text-xs font-semibold text-slate-300">~{qEntry.estimatedWaitMinutes}m</p>}
                          <p className="text-xs text-slate-600">{Math.round((Date.now() - p.joinedAt) / 60000)}m in queue</p>
                        </div>

                        {/* Actions — appear on row hover */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                          {idx > 0 && (
                            <button
                              onClick={() => handlePriorityBump(p.id, p.name)}
                              className="btn-icon priority"
                              title="Emergency priority — move to front"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(p.id, p.name)}
                            className="btn-icon danger"
                            title="Remove (no-show)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
