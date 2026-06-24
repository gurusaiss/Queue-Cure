import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, ChevronRight, Coffee, RotateCcw, Clock, Users,
  CheckCircle, Zap, Stethoscope, ArrowLeft, AlertTriangle,
  Trash2, Settings, TrendingUp, BarChart2, Info, Keyboard
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useSocket } from '../hooks/useSocket';
import ConnectionBadge from '../components/ConnectionBadge';
import TokenCard from '../components/TokenCard';
import StatCard from '../components/StatCard';

const PATIENT_URL = window.location.origin + '/patient';

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
  return (
    <span className="text-xs text-slate-600 font-normal ml-2">
      Updated {label}
    </span>
  );
}

function EtaFormula({ avgTime, callCount, configAvgTime }) {
  const blend = callCount < 3 ? '100% configured' : callCount < 6 ? '50/50 blend' : '100% real data';
  return (
    <div className="text-xs text-slate-500 space-y-1 mt-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
      <p className="font-semibold text-slate-400 mb-1">ETA Formula (live)</p>
      <p><span className="text-amber-400 font-mono">wait = position × {avgTime} min</span></p>
      <p>Effective avg: <span className="text-emerald-400 font-mono">{avgTime} min</span></p>
      <p>Source: <span className="text-blue-400">{blend}</span> ({callCount} real calls)</p>
      <p className="text-slate-600">Auto-refines every call · never hardcoded</p>
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

  const s = queueState;
  const waitingCount = s?.fullQueue?.filter(p => p.status === 'waiting').length ?? 0;
  const servingPatient = s?.fullQueue?.find(p => p.status === 'serving');
  const waitingPatients = s?.fullQueue?.filter(p => p.status === 'waiting') ?? [];

  function flash(msg, isError = false) {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 3500);
  }

  // Keyboard shortcut: Ctrl+Enter = Call Next
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (waitingCount > 0 && !loading && s?.doctorStatus !== 'break') {
        handleCallNext();
      }
    }
  }, [waitingCount, loading, s?.doctorStatus]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  async function handleAddPatient(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading('add');
    const res = await emit('add_patient', { name: form.name.trim(), phone: form.phone.trim() });
    setLoading('');
    if (res.error) { flash(res.error, true); return; }
    flash(`✓ Token ${res.token} issued to ${form.name.trim()}`);
    setForm({ name: '', phone: '' });
    // Re-focus name input for rapid entry
    setTimeout(() => document.querySelector('input[placeholder="Patient name *"]')?.focus(), 50);
  }

  async function handleCallNext() {
    if (loading === 'call') return;
    setLoading('call');
    const res = await emit('call_next', null);
    setLoading('');
    if (res.error) flash(res.error, true);
    else flash(`✓ Calling ${res.token}`);
  }

  async function handleSetAvgTime(e) {
    e.preventDefault();
    const mins = parseFloat(avgInput);
    if (isNaN(mins)) return;
    const res = await emit('set_avg_time', { minutes: mins });
    if (res.error) flash(res.error, true);
    else { flash(`✓ Set to ${mins} min`); setAvgInput(''); }
  }

  async function handleToggleBreak() {
    const res = await emit('toggle_break', null);
    if (res.status === 'break') flash('Doctor on break — queue paused');
    else flash('Doctor back — queue active');
  }

  async function handlePriorityBump(id, name) {
    const res = await emit('priority_bump', { id });
    if (res.error) flash(res.error, true);
    else flash(`⚡ ${name} moved to front`);
  }

  async function handleRemove(id, name) {
    if (!window.confirm(`Remove ${name} from queue? (no-show)`)) return;
    const res = await emit('remove_patient', { id });
    if (res.error) flash(res.error, true);
    else flash(`Removed ${name}`);
  }

  async function handleReset() {
    setShowReset(false);
    await emit('reset_queue', null);
    flash('✓ Queue reset for new day');
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/')} className="text-slate-500 hover:text-slate-300 transition-colors mr-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-none">Queue Cure</h1>
            <p className="text-xs text-slate-500">Receptionist Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge connected={connected} />
          {s?.updatedAt && <LiveAgo updatedAt={s.updatedAt} />}
          <button onClick={() => setShowQR(v => !v)} className="btn-secondary text-xs py-2 px-3">QR Code</button>
          <button
            onClick={handleToggleBreak}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${
              s?.doctorStatus === 'break'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            {s?.doctorStatus === 'break' ? 'End Break' : 'Break'}
          </button>
          <button onClick={() => setShowReset(true)} className="text-slate-500 hover:text-red-400 transition-colors" title="Reset queue (end of day)">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Break banner */}
      {s?.doctorStatus === 'break' && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 flex items-center gap-2 text-amber-400 text-sm font-medium">
          <Coffee className="w-4 h-4" />
          Doctor is on break — queue paused. Patients are being notified automatically.
        </div>
      )}

      {/* Keyboard hint */}
      <div className="border-b border-slate-800/50 px-6 py-2 flex items-center gap-2 text-slate-600 text-xs">
        <Keyboard className="w-3 h-3" />
        <span>Press <kbd className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-xs font-mono">Ctrl+Enter</kbd> to call next patient</span>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium slide-in-up border ${
          feedback.isError
            ? 'bg-red-500/20 border-red-500/40 text-red-300'
            : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
          <div className="card p-8 text-center max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white text-lg mb-1">Patient Waiting Room</h3>
            <p className="text-slate-400 text-sm mb-5">Patients scan this to see live queue & their wait time</p>
            <div className="bg-white p-4 rounded-xl inline-block mb-4">
              <QRCodeSVG value={PATIENT_URL} size={180} />
            </div>
            <p className="text-slate-500 text-xs break-all mb-4">{PATIENT_URL}</p>
            <button className="btn-secondary w-full" onClick={() => setShowQR(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Reset confirm */}
      {showReset && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
          <div className="card p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="font-bold text-white">Reset Queue?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-5">Clears all patients, resets token counter, zeroes today's stats. Use at end of clinic session.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowReset(false)}>Cancel</button>
              <button className="bg-red-500 hover:bg-red-400 text-white font-semibold px-4 py-2.5 rounded-xl flex-1 transition-colors" onClick={handleReset}>Reset</button>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-slate-600 font-mono text-6xl font-black">—</p>
                  <p className="text-slate-600 text-sm mt-2">No patient yet</p>
                </div>
              )}

              <button
                onClick={handleCallNext}
                disabled={waitingCount === 0 || loading === 'call' || s?.doctorStatus === 'break'}
                className="btn-primary w-full mt-6 flex items-center justify-center gap-2 py-4 text-base"
              >
                <ChevronRight className="w-5 h-5" />
                {loading === 'call' ? 'Calling…' : 'Call Next'}
                {waitingCount > 0 && (
                  <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                    {waitingCount} waiting
                  </span>
                )}
              </button>

              {waitingCount === 0 && (
                <p className="text-slate-600 text-xs mt-2">Queue is empty</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Waiting" value={waitingCount} icon={Users} color="blue" />
              <StatCard label="Served Today" value={s?.servedToday ?? 0} icon={CheckCircle} color="emerald" />
              <StatCard label="Avg Consult" value={s?.avgConsultMinutes ?? s?.configAvgTime ?? '—'} unit="min" icon={Clock} color="amber" />
              <StatCard label="Data Quality" value={s?.dataConfidence ?? '—'} icon={TrendingUp} color="purple" />
            </div>

            {/* Avg time config + ETA formula */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-200 text-sm">Consultation Time</h3>
                </div>
                <button onClick={() => setShowEta(v => !v)} className="text-slate-500 hover:text-slate-300 transition-colors" title="View ETA formula">
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
              {showEta && (
                <EtaFormula
                  avgTime={s?.avgConsultMinutes ?? s?.configAvgTime ?? 5}
                  callCount={s?.callHistoryCount ?? 0}
                  configAvgTime={s?.configAvgTime ?? 5}
                />
              )}
              {!showEta && (
                <p className="text-xs text-slate-600 mt-2">
                  {(s?.callHistoryCount ?? 0) >= 6
                    ? `✓ Auto-learning from ${s.callHistoryCount} real calls`
                    : `Auto-refines after 3 calls (${s?.callHistoryCount ?? 0} so far)`}
                </p>
              )}
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
                  <UserPlus className="w-4 h-4" />
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

              {/* Currently serving */}
              {servingPatient && (
                <div className="px-6 py-4 bg-emerald-500/5 border-b border-emerald-500/20 flex items-center gap-4">
                  <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
                  </div>
                  <span className="font-mono font-black text-emerald-400 text-xl w-20">{servingPatient.token}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{servingPatient.name}</p>
                    {servingPatient.phone && <p className="text-xs text-slate-500">{servingPatient.phone}</p>}
                  </div>
                  <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">In Room</span>
                </div>
              )}

              {/* Waiting patients */}
              {waitingPatients.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Queue is empty</p>
                  <p className="text-slate-600 text-sm mt-1">Add a patient above to get started</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
                  {waitingPatients.map((p, idx) => {
                    const queueEntry = s?.queue?.find(q => q.token === p.token);
                    const isNext = idx === 0;
                    return (
                      <div
                        key={p.id}
                        className={`px-6 py-4 flex items-center gap-4 transition-colors group slide-in-up ${
                          isNext ? 'bg-amber-500/5 hover:bg-amber-500/8' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <span className={`text-sm font-mono font-bold w-6 text-right shrink-0 ${isNext ? 'text-amber-400' : 'text-slate-600'}`}>
                          {idx + 1}
                        </span>
                        <span className={`font-mono font-black text-base w-20 shrink-0 ${isNext ? 'text-amber-300' : 'text-amber-400'}`}>
                          {p.token}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate flex items-center gap-2">
                            {p.name}
                            {isNext && <span className="text-xs font-normal text-amber-400/70 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">Next</span>}
                          </p>
                          {p.phone && <p className="text-xs text-slate-500">{p.phone}</p>}
                        </div>
                        <div className="text-right shrink-0 hidden sm:block min-w-[64px]">
                          {queueEntry && (
                            <p className="text-xs font-semibold text-slate-300">~{queueEntry.estimatedWaitMinutes} min</p>
                          )}
                          <p className="text-xs text-slate-600">
                            {Math.round((Date.now() - p.joinedAt) / 60000)}m wait
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {idx > 0 && (
                            <button
                              onClick={() => handlePriorityBump(p.id, p.name)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                              title="Emergency priority — move to front"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(p.id, p.name)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
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
