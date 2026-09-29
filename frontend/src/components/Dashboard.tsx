import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import { Lightbulb, Cpu, Package, Server, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface HwStatus {
  simulationMode: boolean;
  ledCount: number;
  gpioPin: number;
}

interface LedState {
  index: number;
  isActive: boolean;
  color?: string;
  partName?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [hwStatus, setHwStatus] = useState<HwStatus | null>(null);
  const [leds, setLeds] = useState<LedState[]>(Array.from({ length: 5 }, (_, i) => ({ index: i, isActive: false })));
  const [stats, setStats] = useState({ boxes: 0, parts: 0, lowStock: 0 });

  useEffect(() => {
    // 1. Cargar estadísticas iniciales
    const loadStats = async () => {
      try {
        const [boxesRes, partsRes, lowStockRes] = await Promise.all([
          api.get('/inventory/boxes'),
          api.get('/inventory/parts'),
          api.get('/inventory/parts/low-stock')
        ]);
        setStats({
          boxes: boxesRes.data.length,
          parts: partsRes.data.length,
          lowStock: lowStockRes.data.length
        });
      } catch (error) {
        console.error("Error al cargar estadísticas", error);
      }
    };
    loadStats();

    // 2. Conectar a Socket.io
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Conectado al Socket de GearTrace');
    });

    newSocket.on('hw:status', (status: HwStatus) => {
      setHwStatus(status);
      // Ajustar cantidad de LEDs según el hardware
      setLeds(Array.from({ length: status.ledCount }, (_, i) => ({ index: i, isActive: false })));
    });

    newSocket.on('led:activated', (data: { ledIndex: number, partName: string, color?: string }) => {
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-800 shadow-[0_0_20px_rgba(249,115,22,0.3)] rounded-xl pointer-events-auto flex ring-1 ring-brand-500/50`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="h-10 w-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-500 animate-pulse-slow">
                  <Lightbulb size={24} />
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-white">
                  Alexa activó LED {data.ledIndex}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Encontró: <span className="text-brand-400 font-semibold">{data.partName}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      ));

      setLeds(prev => prev.map(l => 
        l.index === data.ledIndex ? { ...l, isActive: true, partName: data.partName, color: data.color || '#F97316' } : l
      ));
    });

    newSocket.on('led:off', (data: { ledIndex: number, manual?: boolean }) => {
      if (data.manual) {
        toast.success(`LED ${data.ledIndex} apagado manualmente`);
      }
      setLeds(prev => prev.map(l => 
        l.index === data.ledIndex ? { ...l, isActive: false, partName: undefined } : l
      ));
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleTurnOffLed = (index: number) => {
    if (socket) {
      socket.emit('led:turnOff', { ledIndex: index });
    }
  };

  const handleTestLed = (index: number) => {
    if (socket) {
      socket.emit('led:test', { ledIndex: index, colorHex: '#38BDF8' });
    }
  };

  const isOperative = user?.role === 'GERENTE' || user?.role === 'MECANICO';

  return (
    <div className="space-y-6">
      {/* Cards de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4 hover:border-brand-500/50 transition-colors">
          <div className="p-4 bg-blue-500/10 text-blue-400 rounded-xl">
            <Package size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Total Cajas</p>
            <p className="text-3xl font-bold">{stats.boxes}</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4 hover:border-brand-500/50 transition-colors">
          <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Server size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Tipos de Piezas</p>
            <p className="text-3xl font-bold">{stats.parts}</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4 hover:border-brand-500/50 transition-colors">
          <div className="p-4 bg-rose-500/10 text-rose-400 rounded-xl">
            <AlertCircle size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium">Stock Bajo</p>
            <p className="text-3xl font-bold">{stats.lowStock}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de LEDs */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Lightbulb className="text-brand-500" /> Control de LEDs WS2812B
            </h2>
            {hwStatus?.simulationMode && (
              <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-xs font-semibold rounded-full border border-amber-500/20 flex items-center gap-1.5">
                <Cpu size={12} /> MODO SIMULACIÓN
              </span>
            )}
          </div>
          
          <div className="p-8 flex-1 flex flex-col justify-center">
            <div className="flex justify-center flex-wrap gap-8">
              {leds.map((led) => (
                <div key={led.index} className="flex flex-col items-center gap-4 group">
                  {/* El foco del LED */}
                  <div className="relative">
                    {/* Resplandor (glow) de fondo cuando está activo */}
                    {led.isActive && (
                      <div 
                        className="absolute inset-0 rounded-full blur-[20px] opacity-70 animate-pulse-slow"
                        style={{ backgroundColor: led.color }}
                      ></div>
                    )}
                    {/* Círculo físico del LED */}
                    <div 
                      className={`relative w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 z-10 ${
                        led.isActive 
                          ? 'border-white bg-white shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]' 
                          : 'border-slate-700 bg-slate-800'
                      }`}
                      style={led.isActive ? { 
                        boxShadow: `0 0 30px ${led.color}, inset 0 0 10px rgba(0,0,0,0.2)`
                      } : {}}
                    >
                      <Lightbulb 
                        size={32} 
                        className={`transition-colors ${led.isActive ? 'text-slate-900' : 'text-slate-600'}`} 
                      />
                    </div>
                  </div>

                  {/* Info y Controles del LED */}
                  <div className="text-center w-32">
                    <div className="text-sm font-semibold text-slate-300">LED {led.index}</div>
                    
                    {led.isActive && led.partName ? (
                      <div className="text-xs text-brand-400 truncate mt-1 animate-pulse" title={led.partName}>
                        {led.partName}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 mt-1">Inactivo</div>
                    )}

                    {isOperative && (
                      <div className="mt-3 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {led.isActive ? (
                          <button 
                            onClick={() => handleTurnOffLed(led.index)}
                            className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/40 text-xs font-medium rounded-lg transition-colors border border-red-500/30"
                          >
                            Apagar
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleTestLed(led.index)}
                            className="px-3 py-1 bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs font-medium rounded-lg transition-colors"
                          >
                            Test
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel de Info Hardware */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
            <Cpu className="text-slate-400" /> Estado del Hardware
          </h2>
          
          {hwStatus ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span className="text-slate-400 text-sm">Modo de Operación</span>
                {hwStatus.simulationMode ? (
                  <span className="text-amber-400 text-sm font-semibold flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Software (Simulado)</span>
                ) : (
                  <span className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> GPIO Real Activo</span>
                )}
              </div>
              
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span className="text-slate-400 text-sm">LEDs Configurados</span>
                <span className="text-white font-medium">{hwStatus.ledCount} (WS2812B)</span>
              </div>
              
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 flex justify-between items-center">
                <span className="text-slate-400 text-sm">Pin GPIO</span>
                <span className="text-white font-medium">Pin {hwStatus.gpioPin}</span>
              </div>
              
              <div className="mt-8 p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                <h3 className="text-brand-400 text-sm font-semibold mb-2">Simulación de Alexa</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Puedes probar la integración enviando un POST a <code className="bg-slate-900 px-1 py-0.5 rounded text-brand-300">/api/webhook/alexa</code> simulando el payload de Amazon.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-500"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
