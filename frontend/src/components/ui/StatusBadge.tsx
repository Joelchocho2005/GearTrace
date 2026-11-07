export type BadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'brand';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-slate-700/50 text-slate-300 border-slate-600',
  info: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  danger: 'bg-red-500/10 text-red-300 border-red-500/30',
  brand: 'bg-brand-500/10 text-brand-300 border-brand-500/30',
};

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
}

export default function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
