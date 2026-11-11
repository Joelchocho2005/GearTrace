import { CalendarCheck, CalendarDays, CalendarX, ClipboardPlus } from 'lucide-react';
import { appointmentActionsApi, appointmentsApi, clientApi, vehiclesApi } from '../api/resources';
import type { Appointment, AppointmentStatus, Vehicle } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import type { FormField, FormValues, SelectOption } from '../components/ui/ResourceFormModal';
import ResourceListPage, {
  CreateFormConfig,
  EditFormConfig,
  ResourceRowAction,
} from '../components/ui/ResourceListPage';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { EMPTY, formatDateTime } from '../utils/format';
import { fromDateTimeLocal, optionalText, requiredNumber, text, toDateTimeLocal, toOptions } from '../utils/formValues';
import { APPOINTMENT_STATUS, WORK_ORDER_STATUS } from '../utils/status';

const OPEN_STATUSES: AppointmentStatus[] = ['AGENDADA', 'CONFIRMADA'];
const isOpen = (appointment: Appointment) => OPEN_STATUSES.includes(appointment.status);

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
  {
    key: 'workOrder',
    header: 'Orden',
    hideOnMobile: true,
    render: (appointment) =>
      appointment.workOrder ? (
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold text-white">{appointment.workOrder.number}</span>
          <StatusBadge {...WORK_ORDER_STATUS[appointment.workOrder.status]} />
        </span>
      ) : (
        EMPTY
      ),
  },
];

const ownerColumn: Column<Appointment> = {
  key: 'owner',
  header: 'Cliente',
  hideOnMobile: true,
  render: (appointment) => appointment.vehicle?.owner?.name ?? EMPTY,
};

const staffColumns: Column<Appointment>[] = [...baseColumns.slice(0, 2), ownerColumn, ...baseColumns.slice(2)];

const vehicleLabel = (vehicle: Vehicle) =>
  `${vehicle.plate} · ${vehicle.make} ${vehicle.model}${vehicle.owner ? ` — ${vehicle.owner.name}` : ''}`;

function appointmentFields(loadVehicles: () => Promise<SelectOption[]>): FormField[] {
  return [
    { name: 'vehicleId', label: 'Vehículo', type: 'select', required: true, loadOptions: loadVehicles, wide: true },
    { name: 'scheduledAt', label: 'Fecha y hora', type: 'datetime', required: true, help: 'Debe ser una fecha futura.' },
    { name: 'reason', label: 'Motivo', type: 'textarea', maxLength: 255 },
  ];
}

const emptyAppointment: FormValues = { vehicleId: '', scheduledAt: '', reason: '' };

const appointmentPayload = (values: FormValues) => ({
  vehicleId: requiredNumber(values, 'vehicleId', 'Vehículo'),
  scheduledAt: fromDateTimeLocal(text(values, 'scheduledAt')),
  reason: optionalText(values, 'reason'),
});

const staffCreateForm: CreateFormConfig = {
  title: 'Agendar cita',
  fields: appointmentFields(async () => toOptions(await vehiclesApi.list(), (vehicle) => vehicle.id, vehicleLabel)),
  initialValues: emptyAppointment,
  submit: (values) => appointmentsApi.create(appointmentPayload(values)),
  successMessage: 'Cita agendada.',
};

const clientCreateForm: CreateFormConfig = {
  title: 'Solicitar cita',
  fields: appointmentFields(async () => toOptions(await clientApi.myVehicles(), (vehicle) => vehicle.id, vehicleLabel)),
  initialValues: emptyAppointment,
  submit: (values) => clientApi.createAppointment(appointmentPayload(values)),
  successMessage: 'Cita solicitada. El taller la confirmará.',
};

/** La cita se completa al generar su OT; aquí solo se agenda, confirma o cancela. */
const EDITABLE_STATUSES: AppointmentStatus[] = ['AGENDADA', 'CONFIRMADA', 'CANCELADA'];
const editableStatusOptions: SelectOption[] = EDITABLE_STATUSES.map((status) => ({
  value: status,
  label: APPOINTMENT_STATUS[status].label,
}));

const staffEditForm: EditFormConfig<Appointment> = {
  title: (appointment) => `Editar cita del ${formatDateTime(appointment.scheduledAt)}`,
  fields: () => [
    { name: 'scheduledAt', label: 'Fecha y hora', type: 'datetime', required: true },
    { name: 'status', label: 'Estado', type: 'select', required: true, options: editableStatusOptions },
    { name: 'reason', label: 'Motivo', type: 'textarea', maxLength: 255 },
  ],
  initialValues: (appointment) => ({
    scheduledAt: toDateTimeLocal(appointment.scheduledAt),
    status: appointment.status,
    reason: appointment.reason ?? '',
  }),
  submit: (appointment, values) => {
    const scheduledAt = text(values, 'scheduledAt');
    const status = EDITABLE_STATUSES.find((option) => option === text(values, 'status'));
    return appointmentsApi.update(appointment.id, {
      // Solo se envía si cambió: el backend exige fecha futura al reprogramar.
      scheduledAt: scheduledAt !== toDateTimeLocal(appointment.scheduledAt) ? fromDateTimeLocal(scheduledAt) : undefined,
      status,
      reason: optionalText(values, 'reason'),
    });
  },
  isEditable: isOpen,
};

/** El cliente reprograma su cita abierta; vuelve a AGENDADA hasta que el taller confirme. */
const clientEditForm: EditFormConfig<Appointment> = {
  title: (appointment) => `Reprogramar cita del ${formatDateTime(appointment.scheduledAt)}`,
  fields: () => [
    { name: 'scheduledAt', label: 'Nueva fecha y hora', type: 'datetime', required: true, help: 'Debe ser una fecha futura. El taller volverá a confirmarla.' },
    { name: 'reason', label: 'Motivo', type: 'textarea', maxLength: 255 },
  ],
  initialValues: (appointment) => ({
    scheduledAt: toDateTimeLocal(appointment.scheduledAt),
    reason: appointment.reason ?? '',
  }),
  submit: (appointment, values) =>
    clientApi.rescheduleAppointment(appointment.id, {
      scheduledAt: fromDateTimeLocal(text(values, 'scheduledAt')),
      reason: optionalText(values, 'reason'),
    }),
  isEditable: isOpen,
};

function clientRowActions(appointment: Appointment): ResourceRowAction[] {
  if (!isOpen(appointment)) return [];
  return [
    {
      key: 'cancel',
      label: 'Cancelar cita',
      shortLabel: 'Cancelar',
      icon: CalendarX,
      tone: 'danger',
      confirm: `¿Cancelar tu cita del ${formatDateTime(appointment.scheduledAt)}?`,
      run: async () => {
        await clientApi.cancelAppointment(appointment.id);
        return 'Cita cancelada.';
      },
    },
  ];
}

function staffRowActions(appointment: Appointment): ResourceRowAction[] {
  if (!isOpen(appointment) || appointment.workOrder) return [];
  const actions: ResourceRowAction[] = [
    {
      key: 'work-order',
      label: 'Generar orden de trabajo',
      shortLabel: 'Generar OT',
      icon: ClipboardPlus,
      confirm: `¿Generar la orden de trabajo para ${appointment.vehicle?.plate ?? 'esta cita'}? La cita quedará completada.`,
      run: async () => {
        const order = await appointmentActionsApi.createWorkOrder(appointment.id);
        return `Orden ${order.number} creada desde la cita.`;
      },
    },
  ];
  if (appointment.status === 'AGENDADA') {
    actions.unshift({
      key: 'confirm',
      label: 'Confirmar cita',
      shortLabel: 'Confirmar',
      icon: CalendarCheck,
      tone: 'success',
      run: async () => {
        await appointmentsApi.update(appointment.id, { status: 'CONFIRMADA' });
        return 'Cita confirmada.';
      },
    });
  }
  return actions;
}

/**
 * /citas — GERENTE y MECANICO gestionan la agenda (/api/appointments) y
 * generan la OT desde la cita; el CLIENTE ve, solicita, reprograma y cancela
 * sus citas (/api/client/appointments).
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
      createForm={isClient ? clientCreateForm : staffCreateForm}
      editForm={isClient ? clientEditForm : staffEditForm}
      rowActions={isClient ? clientRowActions : staffRowActions}
      onDelete={user?.role === 'GERENTE' ? appointmentsApi.remove : undefined}
    />
  );
}
