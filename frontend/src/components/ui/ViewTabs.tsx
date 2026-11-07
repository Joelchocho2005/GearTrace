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
    <div role="tablist" className="inline-flex rounded-xl border border-slate-700 bg-slate-800/60 p-1">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={active === key}
          onClick={() => onChange(key)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active === key ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Icon size={16} /> {label}
        </button>
      ))}
    </div>
  );
}
