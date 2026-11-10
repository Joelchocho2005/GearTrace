import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Cpu, Search, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { createHardwareSocket } from '../api/socket';
import { useAuth } from '../contexts/AuthContext';

interface Led { index: number; isActive: boolean; color?: string; partName?: string }
interface HwStatus { simulationMode: boolean; ledCount: number; gpioPin: number }
interface WorkOrder { id: number; number: string; description: string; status: string; mechanic?: { id: number }; vehicle: { plate: string; make: string; model: string } }
interface Part { id: number; name: string; code: string; quantity: number }

export default function MecanicoDashboard() {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [hwStatus, setHwStatus] = useState<HwStatus | null>(null);
  const [leds, setLeds] = useState<Led[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<Part[]>([]);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const response = await api.get<WorkOrder[]>('/service/work-orders');
        setOrders(response.data.filter((order) => order.mechanic?.id === user?.id));
      } catch (error) {
        console.error('Error al cargar órdenes asignadas', error);
        toast.error('No se pudieron cargar tus órdenes.');
      }
    };
    void loadOrders();

    const nextSocket = createHardwareSocket();
    setSocket(nextSocket);
    nextSocket.on('hw:status', (status: HwStatus) => {
      setHwStatus(status);
      setLeds(Array.from({ length: status.ledCount }, (_, index) => ({ index, isActive: false })));
    });
    nextSocket.on('led:activated', (data: { ledIndex: number; partName: string; colorHex?: string }) => {
      setLeds((current) => current.map((led) => led.index === data.ledIndex ? { ...led, isActive: true, partName: data.partName, color: data.colorHex || '#F97316' } : led));
    });
    nextSocket.on('led:off', (data: { ledIndex: number; manual?: boolean }) => {
      if (data.manual) toast.success(`LED ${data.ledIndex} apagado.`);
      setLeds((current) => current.map((led) => led.index === data.ledIndex ? { ...led, isActive: false, partName: undefined } : led));
    });
    setLeds(Array.from({ length: 5 }, (_, index) => ({ index, isActive: false })));
    return () => {
      nextSocket.disconnect();
    };
  }, [user?.id]);

  const searchParts = async () => {
    if (!query.trim()) return;
    try {
      setParts((await api.get<Part[]>(`/inventory/search/${encodeURIComponent(query.trim())}`)).data);
    } catch (error) {
      console.error('Error al buscar repuestos', error);
      toast.error('No se pudieron buscar repuestos.');
    }
  };

  const emitLedAction = (led: Led) => {
    socket?.emit(led.isActive ? 'led:turnOff' : 'led:test', led.isActive ? { ledIndex: led.index } : { ledIndex: led.index, colorHex: '#38BDF8' });
  };

  return (
    <section className="space-y-6">
      <header><h2 className="text-2xl font-bold text-white">Panel del mecánico</h2><p className="text-sm text-slate-400">Operación diaria, órdenes asignadas y búsqueda de repuestos.</p></header>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass rounded-2xl p-6"><h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white"><Cpu className="text-brand-400" /> Control WS2812B {hwStatus?.simulationMode && <span className="text-xs text-amber-400">(simulación)</span>}</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{leds.map((led) => <div key={led.index} className="text-center"><div className={`h-16 rounded-lg border ${led.isActive ? 'border-white' : 'border-white/10 bg-slate-950'}`} style={led.isActive ? { backgroundColor: led.color, boxShadow: `0 0 20px ${led.color}` } : undefined} /><p className="mt-2 text-xs text-slate-400">LED {led.index}</p><button type="button" onClick={() => emitLedAction(led)} className="mt-2 rounded-lg bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600">{led.isActive ? 'Apagar' : 'Test'}</button></div>)}</div></div>
        <div className="glass rounded-2xl p-6"><h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white"><Search className="text-brand-400" /> Buscar repuesto</h3><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchParts(); }} placeholder="Nombre o código" className="min-w-0 flex-1 rounded-xl px-3 py-2 text-white glass-input" /><button type="button" onClick={() => void searchParts()} className="btn-primary rounded-xl px-3"><Search size={18} /></button></div><div className="mt-4 space-y-2">{parts.map((part) => <p key={part.id} className="rounded-lg p-3 text-sm text-slate-300 glass-inset">{part.name} <span className="text-slate-500">({part.code}) · stock {part.quantity}</span></p>)}</div></div>
      </div>
      <div className="glass rounded-2xl p-6"><h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white"><Wrench className="text-brand-400" /> Mis órdenes asignadas</h3>{orders.length === 0 ? <p className="text-slate-400">No tienes órdenes asignadas.</p> : <div className="grid gap-4 md:grid-cols-2">{orders.map((order) => <article key={order.id} className="rounded-xl p-4 glass-inset"><p className="font-semibold text-white">{order.number} · {order.vehicle.plate}</p><p className="text-sm text-slate-400">{order.vehicle.make} {order.vehicle.model}</p><p className="mt-2 text-sm text-slate-300">{order.description}</p><span className="mt-3 inline-block rounded-full bg-brand-500/10 px-3 py-1 text-xs text-brand-400">{order.status.replace('_', ' ')}</span></article>)}</div>}</div>
    </section>
  );
}
