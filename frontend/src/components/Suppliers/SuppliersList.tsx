import { useEffect, useState } from 'react';
import { AlertTriangle, PackageCheck, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

interface Supplier { id: number; name: string; email?: string; phone?: string }
interface LowStockPart { id: number; name: string; code: string; quantity: number; minStock: number }

export default function SuppliersList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lowStock, setLowStock] = useState<LowStockPart[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [supplierResponse, stockResponse] = await Promise.all([
        api.get<Supplier[]>('/suppliers'),
        api.get<LowStockPart[]>('/suppliers/low-stock'),
      ]);
      setSuppliers(supplierResponse.data);
      setLowStock(stockResponse.data);
      if (!supplierId && supplierResponse.data[0]) setSupplierId(String(supplierResponse.data[0].id));
    } catch (error) {
      console.error('Error al cargar abastecimiento', error);
      toast.error('No se pudo cargar la información de proveedores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const requestRestock = async (part: LowStockPart) => {
    if (!supplierId) {
      toast.error('Selecciona un proveedor.');
      return;
    }
    try {
      await api.post('/suppliers/purchase-orders', {
        number: `AUTO-${part.code}-${Date.now()}`,
        supplierId: Number(supplierId),
        items: [{ partId: part.id, quantity: Math.max(part.minStock * 2 - part.quantity, 1) }],
      });
      toast.success(`Reposición solicitada para ${part.name}.`);
      setLowStock((current) => current.filter((item) => item.id !== part.id));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'No se pudo registrar la reposición.');
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3"><div className="rounded-xl bg-brand-500/10 p-3 text-brand-400"><Truck size={24} /></div><div><h2 className="text-2xl font-bold text-white">Proveedores y abastecimiento</h2><p className="text-sm text-slate-400">Solicita reposiciones cuando el stock esté bajo.</p></div></header>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5"><label className="mb-2 block text-sm text-slate-400">Proveedor para nuevas solicitudes</label><select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
      <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-800/60">
        <div className="flex items-center gap-2 border-b border-slate-700 p-5 text-amber-400"><AlertTriangle size={20} /><h3 className="font-semibold">Alertas de stock mínimo</h3></div>
        {loading ? <p className="p-6 text-slate-400">Cargando alertas...</p> : lowStock.length === 0 ? <p className="p-6 text-emerald-400">No hay piezas bajo el mínimo.</p> : <div className="divide-y divide-slate-700">{lowStock.map((part) => <div key={part.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-white">{part.name}</p><p className="text-sm text-slate-400">{part.code} · Stock: <span className="text-amber-400">{part.quantity}</span> / mínimo {part.minStock}</p></div><button type="button" onClick={() => void requestRestock(part)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-600"><PackageCheck size={17} /> Solicitar reposición</button></div>)}</div>}
      </div>
    </section>
  );
}
