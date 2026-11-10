import type { LucideIcon } from 'lucide-react';

export interface ViewTab<TKey extends string> {
  key: TKey;
  label: string;
  icon: LucideIcon;
}

interface ViewTabsProps<TKey extends string> {
  tabs: ViewTab<TKey>[];
  active: TKey;
  onChange: (key: TKey) => void;
}

/** Alterna entre el listado CRUD y una vista operativa existente del módulo. */
export default function ViewTabs<TKey extends string>({ tabs, active, onChange }: ViewTabsProps<TKey>) {
  return (
    <div role="tablist" className="glass inline-flex rounded-xl p-1">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={active === key}
          onClick={() => onChange(key)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active === key
              ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_6px_18px_-8px_rgba(249,115,22,0.8)]'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Icon size={16} /> {label}
        </button>
      ))}
    </div>
  );
}
