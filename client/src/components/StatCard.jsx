export default function StatCard({ label, value, unit, color = 'emerald', icon: Icon }) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div className={`card p-4 flex items-center gap-4 ${colors[color]} border`}>
      {Icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color].split(' ').slice(1).join(' ')}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-100 leading-tight">
          {value}
          {unit && <span className="text-sm text-slate-400 ml-1 font-normal">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
