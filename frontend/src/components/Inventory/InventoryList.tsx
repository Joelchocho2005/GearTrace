import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Package } from 'lucide-react';
import api from '../../api/axios';
import PartFormModal, { PartFormValues } from './PartFormModal';

interface InventoryPart {
  id: number;
  name: string;
  code: string;
  quantity: number;
  minStock: number;
  keywords: string[];
  box?: {
    id: number;
    name: string;
  };
}

const toFormValues = (part: InventoryPart): PartFormValues => ({
  id: part.id,
  name: part.name,
  code: part.code,
  quantity: part.quantity,
  boxId: part.box?.id ?? 0,
  minStock: part.minStock,
  keywords: part.keywords,
});

export default function InventoryList() {
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PartFormValues | null>(null);

  const loadParts = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<InventoryPart[]>('/inventory/parts');
      setParts(response.data);
      setError(null);
    } catch (requestError) {
      console.error('Error al cargar las piezas', requestError);
      setError('No se pudieron cargar las piezas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadParts();
  }, []);

  const filteredParts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return parts;
    }

    return parts.filter(
      (part) =>
        part.name.toLowerCase().includes(normalizedSearch) ||
        part.code.toLowerCase().includes(normalizedSearch),
    );
  }, [parts, search]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-500/10 p-3 text-brand-400">
              <Package size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Inventario</h2>
              <p className="text-sm text-slate-400">
                Gestiona las piezas almacenadas.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedPart(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          <Plus size={18} />
          Nueva Pieza
        </button>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
        <label htmlFor="inventory-search" className="sr-only">
          Buscar piezas
        </label>
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            id="inventory-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full rounded-xl border border-slate-700 bg-slate-900/70 py-2.5 pl-10 pr-4 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Cargando piezas...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">{error}</div>
        ) : filteredParts.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No se encontraron piezas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-300">Pieza</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Código</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Caja</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Stock</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/70">
                {filteredParts.map((part) => (
                  <tr key={part.id} className="transition-colors hover:bg-slate-700/30">
                    <td className="px-6 py-4 font-medium text-white">{part.name}</td>
                    <td className="px-6 py-4 text-slate-400">{part.code}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {part.box?.name ?? 'Sin caja'}
                    </td>
                    <td
                      className={`px-6 py-4 font-semibold ${
                        part.quantity <= part.minStock
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {part.quantity}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPart(toFormValues(part));
                          setIsModalOpen(true);
                        }}
                        className="font-medium text-brand-400 transition-colors hover:text-brand-300"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PartFormModal
        isOpen={isModalOpen}
        part={selectedPart}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          void loadParts();
        }}
      />
    </section>
  );
}
