import { useAuth } from '../contexts/AuthContext';
import BodegueroDashboard from './BodegueroDashboard';
import ClienteDashboard from './ClienteDashboard';
import ContadorDashboard from './ContadorDashboard';
import GerenteDashboard from './GerenteDashboard';
import MecanicoDashboard from './MecanicoDashboard';
import ProveedorDashboard from './ProveedorDashboard';

/** Orquestador: cada rol tiene su panel. */
export default function Dashboard() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'GERENTE':
      return <GerenteDashboard />;
    case 'MECANICO':
      return <MecanicoDashboard />;
    case 'BODEGUERO':
      return <BodegueroDashboard />;
    case 'CONTADOR':
      return <ContadorDashboard />;
    case 'PROVEEDOR':
      return <ProveedorDashboard />;
    case 'CLIENTE':
      return <ClienteDashboard />;
    default:
      return <p className="text-slate-400">No se pudo determinar el rol del usuario.</p>;
  }
}
