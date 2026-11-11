import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Cpu, Lightbulb, Search, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { inventoryApi, workOrdersApi } from '../api/resources';
import {
  createHardwareSocket,
  HW_EVENTS,
  LED_DEFAULT_COLOR,
  LED_TEST_COLOR,
  type HardwareStatus,
  type LedActivatedEvent,
  type LedOffEvent,
} from '../api/socket';
import type { InventoryPart, WorkOrder } from '../api/types';
import { WORK_ORDER_STATUS } from '../utils/status';

interface Led { index: number; isActive: boolean; color?: string; partName?: string }

/** LEDs que se dibujan hasta recibir `hw:status` con el número real. */
const PLACEHOLDER_LED_COUNT = 5;

const createLeds = (count: number): Led[] =>
  Array.from({ length: count }, (_, index) => ({ index, isActive: false }));

export default function MecanicoDashboard() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [hwStatus, setHwStatus] = useState<HardwareStatus | null>(null);
  const [leds, setLeds] = useState<Led[]>(() => createLeds(PLACEHOLDER_LED_COUNT));
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<InventoryPart[]>([]);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        // El backend ya limita al MECANICO a sus órdenes asignadas (workOrderScope).
        setOrders(await workOrdersApi.list());
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar tus órdenes.'));
      }
    };
    void loadOrders();

    const nextSocket = createHardwareSocket();
    setSocket(nextSocket);
    nextSocket.on(HW_EVENTS.status, (status: HardwareStatus) => {
      setHwStatus(status);
      setLeds(createLeds(status.ledCount));
    });
    nextSocket.on(HW_EVENTS.ledActivated, (data: LedActivatedEvent) => {
      setLeds((current) => current.map((led) => led.index === data.ledIndex ? { ...led, isActive: true, partName: data.partName, color: data.colorHex || LED_DEFAULT_COLOR } : led));
    });
    nextSocket.on(HW_EVENTS.ledOff, (data: LedOffEvent) => {
      if (data.manual) toast.success(`LED ${data.ledIndex} apagado.`);
      setLeds((current) => current.map((led) => led.index === data.ledIndex ? { ...led, isActive: false, partName: undefined } : led));
    });
    return () => {
      nextSocket.disconnect();
    };
  }, []);

  const searchParts = async () => {
    const term = query.trim();
    if (!term) return;
    try {
      setParts(await inventoryApi.searchParts(term));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron buscar repuestos.'));
    }
  };

  /** Mismo efecto que pedir la pieza a Alexa: enciende el LED de su caja. */
  const locatePart = async (part: InventoryPart) => {
    try {
      const result = await inventoryApi.locatePart(part.id);
      toast.success(`${result.partName}: ${result.boxName} (LED ${result.ledIndex}).`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo encender el LED.'));
    }
  };

  const emitLedAction = (led: Led) => {
    if (led.isActive) socket?.emit(HW_EVENTS.turnOff, { ledIndex: led.index });
    else socket?.emit(HW_EVENTS.test, { ledIndex: led.index, colorHex: LED_TEST_COLOR });
  };

  return (
    <section className="space-y-6">
      <header><h2 className="text-2xl font-bold text-white">Panel del mecánico</h2><p className="text-sm text-slate-400">Operación diaria, órdenes asignadas y búsqueda de repuestos.</p></header>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass rounded-2xl p-6"><h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white"><Cpu className="text-brand-400" /> Control WS2812B {hwStatus?.simulationMode && <span className="text-xs text-amber-400">(simulación)</span>}</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{leds.map((led) => <div key={led.index} className="text-center"><div className={`h-16 rounded-lg border ${led.isActive ? 'border-white' : 'border-white/10 bg-slate-950'}`} style={led.isActive ? { backgroundColor: led.color, boxShadow: `0 0 20px ${led.color}` } : undefined} /><p className="mt-2 text-xs text-slate-400">LED {led.index}</p><button type="button" onClick={() => emitLedAction(led)} className="mt-2 rounded-lg bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600">{led.isActive ? 'Apagar' : 'Test'}</button></div>)}</div></div>
        <div className="glass rounded-2xl p-6"><h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white"><Search className="text-brand-400" /> Buscar repuesto</h3><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchParts(); }} placeholder="Nombre o código" className="min-w-0 flex-1 rounded-xl px-3 py-2 text-white glass-input" /><button type="button" onClick={() => void searchParts()} className="btn-primary rounded-xl px-3"><Search size={18} /></button></div><div className="mt-4 space-y-2">{parts.map((part) => <div key={part.id} className="flex items-center justify-between gap-3 rounded-lg p-3 text-sm text-slate-300 glass-inset"><p>{part.name} <span className="text-slate-500">({part.code}) · stock {part.quantity}{part.box ? ` · ${part.box.name}` : ''}</span></p><button type="button" onClick={() => void locatePart(part)} title="Encender el LED de su caja" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-300 hover:bg-white/5"><Lightbulb size={14} /> Ubicar</button></div>)}</div></div>
      </div>
      <div className="glass rounded-2xl p-6"><h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white"><Wrench className="text-brand-400" /> Mis órdenes asignadas</h3>{orders.length === 0 ? <p className="text-slate-400">No tienes órdenes asignadas.</p> : <div className="grid gap-4 md:grid-cols-2">{orders.map((order) => <article key={order.id} className="rounded-xl p-4 glass-inset"><p className="font-semibold text-white">{order.number} · {order.vehicle?.plate}</p><p className="text-sm text-slate-400">{order.vehicle?.make} {order.vehicle?.model}</p><p className="mt-2 text-sm text-slate-300">{order.description}</p><span className="mt-3 inline-block rounded-full bg-brand-500/10 px-3 py-1 text-xs text-brand-400">{WORK_ORDER_STATUS[order.status].label}</span></article>)}</div>}</div>
    </section>
  );
}
