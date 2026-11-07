import { CalendarDays } from 'lucide-react';
import { appointmentsApi, clientApi } from '../api/resources';
import type { Appointment } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import ResourceListPage from '../components/ui/ResourceListPage';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { EMPTY, formatDateTime } from '../utils/format';
import { APPOINTMENT_STATUS } from '../utils/status';

const baseColumns: Column<Appointment>[] = [
  {
    key: 'scheduledAt',
    header: 'Fecha',
    render: (appointment) => (
      <span className="whitespace-nowrap text-slate-200">{formatDateTime(appointment.scheduledAt)}</span>
    ),
  },
  {
    key: 'vehicle',
    header: 'Vehículo',
    render: (appointment) =>
      appointment.vehicle ? (
        <div>
          <div className="font-mono text-slate-200">{appointment.vehicle.plate}</div>
          <div className="text-xs text-slate-500">
            {appointment.vehicle.make} {appointment.vehicle.model}
          </div>
        </div>
      ) : (
        EMPTY
      ),
  },
  {
    key: 'reason',
    header: 'Motivo',
    hideOnMobile: true,
    render: (appointment) => appointment.reason ?? EMPTY,
  },
  {
    key: 'status',
    header: 'Estado',
    render: (appointment) => <StatusBadge {...APPOINTMENT_STATUS[appointment.status]} />,
  },
];

const ownerColumn: Column<Appointment> = {
  key: 'owner',
  header: 'Cliente',
  hideOnMobile: true,
  render: (appointment) => appointment.vehicle?.owner?.name ?? EMPTY,
};

const staffColumns: Column<Appointment>[] = [...baseColumns.slice(0, 2), ownerColumn, ...baseColumns.slice(2)];

/**
 * /citas — GERENTE y MECANICO ven la agenda completa (/api/appointments);
 * el CLIENTE solo sus citas (/api/client/appointments).
 */
export default function CitasPage() {
  const { user } = useAuth();
  const isClient = user?.role === 'CLIENTE';

  return (
    <ResourceListPage
      title={isClient ? 'Mis citas' : 'Agenda de citas'}
      description={isClient ? 'Citas solicitadas para tus vehículos' : 'Citas programadas en el taller'}
      icon={CalendarDays}
      entityLabel="la cita"
      fetchAll={isClient ? clientApi.myAppointments : appointmentsApi.list}
      columns={isClient ? baseColumns : staffColumns}
      emptyMessage={isClient ? 'Aún no has solicitado citas.' : 'No hay citas programadas.'}
      getRowLabel={(appointment) => formatDateTime(appointment.scheduledAt)}
      canEdit={!isClient}
      onDelete={user?.role === 'GERENTE' ? appointmentsApi.remove : undefined}
    />
  );
}
