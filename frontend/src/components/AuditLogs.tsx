import { useEffect, useState } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

interface AuditLog {
  id: number;
  query: string;
  found: boolean;
  alexaResponse: string | null;
  createdAt: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const response = await api.get<AuditLog[]>('/logs');
        setLogs(response.data);
      } catch (error) {
        console.error('Error al cargar los logs de auditoría', error);
        toast.error('No se pudieron cargar los registros de auditoría.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadLogs();
  }, []);

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-3 text-brand-400">
          <ClipboardList size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Auditoría de búsquedas</h2>
          <p className="text-sm text-slate-400">
            Últimas búsquedas realizadas mediante Alexa.
          </p>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/50">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-brand-400" size={28} />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No hay registros de búsquedas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-300">Fecha</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">
                    Query pronunciado
                  </th>
                  <th className="px-6 py-4 font-semibold text-slate-300">Estado</th>
                  <th className="px-6 py-4 font-semibold text-slate-300">
                    Respuesta de Alexa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/70">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-slate-700/30">
                    <td className="whitespace-nowrap px-6 py-4 text-slate-400">
                      {new Date(log.createdAt).toLocaleString('es-ES')}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">{log.query}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          log.found
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {log.found ? 'Encontrado' : 'No Encontrado'}
                      </span>
                    </td>
                    <td className="max-w-md px-6 py-4 text-slate-400">
                      {log.alexaResponse ?? 'Sin respuesta registrada'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
