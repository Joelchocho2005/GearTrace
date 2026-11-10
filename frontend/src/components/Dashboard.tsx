import { useAuth } from '../contexts/AuthContext';
import ClienteDashboard from './ClienteDashboard';
import GerenteDashboard from './GerenteDashboard';
import MecanicoDashboard from './MecanicoDashboard';

export default function Dashboard() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'GERENTE':
      return <GerenteDashboard />;
    case 'MECANICO':
      return <MecanicoDashboard />;
    case 'BODEGUERO':
      return <p className="text-slate-400">Selecciona un módulo del menú.</p>;
    case 'CONTADOR':
    case 'PROVEEDOR':
      return <p className="text-slate-400">Selecciona un módulo del menú.</p>;
    case 'CLIENTE':
      return <ClienteDashboard />;
    default:
      return <p className="text-slate-400">No se pudo determinar el rol del usuario.</p>;
  }
}
