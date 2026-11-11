import type { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Clase de color del ícono, p. ej. `text-emerald-400`. */
  color: string;
}

/** Métrica de los dashboards por rol (ícono + etiqueta + valor). */
export default function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="glass flex items-center gap-4 rounded-2xl p-6">
      <div className={`glass-inset rounded-xl p-4 ${color}`}><Icon size={28} /></div>
      <div><p className="text-sm text-slate-400">{label}</p><p className="text-3xl font-bold text-white">{value}</p></div>
    </div>
  );
}

/** Rejilla responsive para un grupo de StatCard. */
export function StatGrid({ cards }: { cards: StatCardProps[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => <StatCard key={card.label} {...card} />)}
    </div>
  );
}
