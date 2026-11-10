import { Car } from 'lucide-react';
import { usersApi, vehiclesApi } from '../api/resources';
import type { CreateVehiclePayload, Vehicle } from '../api/types';
import type { FormField, FormValues } from '../components/ui/ResourceFormModal';
import type { CreateFormConfig, EditFormConfig } from '../components/ui/ResourceListPage';
import { idValue, optionalNumber, optionalText, requiredNumber, text, toOptions } from '../utils/formValues';
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

const loadClientOptions = async () =>
  toOptions(await usersApi.lookup('CLIENTE'), (client) => client.id, (client) => `${client.name} — ${client.email}`);

const vehicleFields: FormField[] = [
  { name: 'plate', label: 'Placa', type: 'text', required: true, maxLength: 20, help: 'Se guarda en mayúsculas; no puede repetirse.' },
  { name: 'ownerId', label: 'Propietario (cliente)', type: 'select', required: true, loadOptions: loadClientOptions },
  { name: 'make', label: 'Marca', type: 'text', required: true, maxLength: 80 },
  { name: 'model', label: 'Modelo', type: 'text', required: true, maxLength: 80 },
  { name: 'year', label: 'Año', type: 'number', min: 1886, step: '1' },
  { name: 'color', label: 'Color', type: 'text', maxLength: 50 },
  { name: 'vin', label: 'VIN', type: 'text', maxLength: 17, wide: true },
];

function vehiclePayload(values: FormValues): CreateVehiclePayload {
  return {
    plate: text(values, 'plate'),
    ownerId: requiredNumber(values, 'ownerId', 'Propietario'),
    make: text(values, 'make'),
    model: text(values, 'model'),
    year: optionalNumber(values, 'year', 'Año'),
    color: optionalText(values, 'color'),
    vin: optionalText(values, 'vin'),
  };
}

const createForm: CreateFormConfig = {
  title: 'Registrar vehículo',
  fields: vehicleFields,
  initialValues: { plate: '', ownerId: '', make: '', model: '', year: '', color: '', vin: '' },
  submit: (values) => vehiclesApi.create(vehiclePayload(values)),
  successMessage: 'Vehículo registrado.',
};

const editForm: EditFormConfig<Vehicle> = {
  title: (vehicle) => `Editar ${vehicle.plate}`,
  fields: () => vehicleFields,
  initialValues: (vehicle) => ({
    plate: vehicle.plate,
    ownerId: idValue(vehicle.ownerId),
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year === null ? '' : String(vehicle.year),
    color: vehicle.color ?? '',
    vin: vehicle.vin ?? '',
  }),
  submit: (vehicle, values) => vehiclesApi.update(vehicle.id, vehiclePayload(values)),
};

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
      createForm={createForm}
      editForm={editForm}
    />
  );
}
