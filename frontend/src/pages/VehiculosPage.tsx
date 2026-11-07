import { Car } from 'lucide-react';
import { vehiclesApi } from '../api/resources';
import type { Vehicle } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage from '../components/ui/ResourceListPage';
import { useAuth } from '../contexts/AuthContext';
import { EMPTY } from '../utils/format';

const columns: Column<Vehicle>[] = [
  {
    key: 'plate',
    header: 'Placa',
    render: (vehicle) => <span className="font-mono font-semibold text-white">{vehicle.plate}</span>,
  },
  { key: 'model', header: 'Vehículo', render: (vehicle) => `${vehicle.make} ${vehicle.model}` },
  { key: 'year', header: 'Año', hideOnMobile: true, render: (vehicle) => vehicle.year ?? EMPTY },
  { key: 'color', header: 'Color', hideOnMobile: true, render: (vehicle) => vehicle.color ?? EMPTY },
  {
    key: 'owner',
    header: 'Propietario',
    hideOnMobile: true,
    render: (vehicle) =>
      vehicle.owner ? (
        <div>
          <div className="text-slate-200">{vehicle.owner.name}</div>
          <div className="text-xs text-slate-500">{vehicle.owner.email}</div>
        </div>
      ) : (
        EMPTY
      ),
  },
];

/** /vehiculos — GERENTE, MECANICO. */
export default function VehiculosPage() {
  const { user } = useAuth();

  return (
    <ResourceListPage
      title="Vehículos"
      description="Vehículos registrados de los clientes"
      icon={Car}
      entityLabel="el vehículo"
      fetchAll={vehiclesApi.list}
      columns={columns}
      emptyMessage="No hay vehículos registrados."
      getRowLabel={(vehicle) => vehicle.plate}
      onDelete={user?.role === 'GERENTE' ? vehiclesApi.remove : undefined}
    />
  );
}
