export default function ConnectionBadge({ connected }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-500 ${
      connected
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        : 'bg-red-500/10 border-red-500/30 text-red-400'
    }`}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
      {connected ? 'Live' : 'Reconnecting…'}
    </div>
  );
}
