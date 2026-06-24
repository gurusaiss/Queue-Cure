import { useNavigate } from 'react-router-dom';
import { Stethoscope, Monitor, Users } from 'lucide-react';

export default function Home() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <Stethoscope className="w-7 h-7 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Queue Cure</h1>
          <p className="text-emerald-400 text-sm font-medium">Smart Clinic Queue System</p>
        </div>
      </div>

      <p className="text-slate-400 text-center max-w-md mb-12 leading-relaxed">
        Eliminating 2–3 hour waits with real-time queue management.
        Choose your view to get started.
      </p>

      <div className="grid sm:grid-cols-2 gap-6 w-full max-w-xl">
        <button
          onClick={() => nav('/receptionist')}
          className="card p-8 text-left hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all duration-200 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Monitor className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Receptionist</h2>
          <p className="text-slate-400 text-sm">Manage the queue, add patients, call next token</p>
          <div className="mt-4 text-emerald-400 text-sm font-semibold flex items-center gap-1">
            Open dashboard →
          </div>
        </button>

        <button
          onClick={() => nav('/patient')}
          className="card p-8 text-left hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-200 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Patient View</h2>
          <p className="text-slate-400 text-sm">See your queue position and estimated wait time</p>
          <div className="mt-4 text-blue-400 text-sm font-semibold flex items-center gap-1">
            Check my wait →
          </div>
        </button>
      </div>

      <p className="mt-12 text-slate-600 text-xs">Queue Cure '26 · Built for Wooble Hackathon</p>
    </div>
  );
}
