import { CheckCircle2, PackagePlus, XCircle } from 'lucide-react';
import { UserInputError } from '../api/errors';
import { inventoryApi, replenishmentApi, workOrdersApi } from '../api/resources';
import type { ReplenishmentRequest } from '../api/types';
import type { Column } from '../components/ui/DataTable';
import type { FormField } from '../components/ui/ResourceFormModal';
import ResourceListPage, { CreateFormConfig, ResourceRowAction } from '../components/ui/ResourceListPage';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { EMPTY, formatDateTime } from '../utils/format';
import { optionalNumber, optionalText, requiredNumber, text, toOptions } from '../utils/formValues';
import { REPLENISHMENT_STATUS } from '../utils/status';
import { OPEN_STATUSES } from '../components/WorkOrders/workOrderFlow';

const listRequests = () => replenishmentApi.list();

const columns: Column<ReplenishmentRequest>[] = [
  { key: 'createdAt', header: 'Fecha', hideOnMobile: true, render: (request) => formatDateTime(request.createdAt) },
  {
    key: 'part',
    header: 'Repuesto',
    render: (request) =>
      request.part ? (
        <div>
          <div className="text-white">{request.part.name}</div>
          <div className="text-xs text-slate-500">
            {request.part.code} · stock {request.part.quantity} / mín. {request.part.minStock}
          </div>
        </div>
      ) : (
        EMPTY
      ),
  },
  { key: 'quantity', header: 'Cant.', align: 'right', render: (request) => request.quantity },
  { key: 'workOrder', header: 'Para OT', hideOnMobile: true, render: (request) => request.workOrder?.number ?? 'Stock general' },
  { key: 'requestedBy', header: 'Solicitó', hideOnMobile: true, render: (request) => request.requestedBy?.name ?? EMPTY },
  { key: 'status', header: 'Estado', render: (request) => <StatusBadge {...REPLENISHMENT_STATUS[request.status]} /> },
  { key: 'purchaseOrder', header: 'Pedido', hideOnMobile: true, render: (request) => request.purchaseOrder?.number ?? EMPTY },
  { key: 'reason', header: 'Motivo', detailOnly: true, render: (request) => request.reason ?? EMPTY },
  {
    key: 'review',
    header: 'Revisión',
    detailOnly: true,
    render: (request) =>
      request.reviewedAt
        ? `${request.reviewedBy?.name ?? EMPTY} · ${formatDateTime(request.reviewedAt)}${request.reviewNote ? ` · ${request.reviewNote}` : ''}`
        : EMPTY,
  },
];

const loadParts = async () =>
  toOptions(
    await inventoryApi.listParts(),
    (part) => part.id,
    (part) => `${part.name} (${part.code}) · stock ${part.quantity} / mín. ${part.minStock}`,
  );

/** Solo órdenes abiertas pueden esperar repuestos (el MECANICO ve las suyas). */
const loadOpenOrders = async () =>
  toOptions(
    (await workOrdersApi.list()).filter((order) => OPEN_STATUSES.includes(order.status)),
    (order) => order.id,
    (order) => `${order.number} · ${order.vehicle?.plate ?? ''}`,
  );

function createForm(canLinkOrder: boolean): CreateFormConfig {
  const fields: FormField[] = [
    { name: 'partId', label: 'Repuesto', type: 'select', required: true, loadOptions: loadParts, wide: true },
    { name: 'quantity', label: 'Cantidad', type: 'number', required: true, min: 1, step: '1' },
  ];
  if (canLinkOrder) {
    fields.push({
      name: 'workOrderId',
      label: 'Para la orden (opcional)',
      type: 'select',
      loadOptions: loadOpenOrders,
      placeholder: 'Stock general',
      help: 'Ligada a una OT se puede pedir aunque la pieza no esté bajo su mínimo; al llegar se avisa al mecánico.',
    });
  }
  fields.push({ name: 'reason', label: 'Motivo', type: 'textarea', maxLength: 255 });
  return {
    title: 'Solicitar reposición',
    fields,
    initialValues: { partId: '', quantity: '1', workOrderId: '', reason: '' },
    submit: (values) =>
      replenishmentApi.create({
        partId: requiredNumber(values, 'partId', 'Repuesto'),
        quantity: requiredNumber(values, 'quantity', 'Cantidad'),
        workOrderId: optionalNumber(values, 'workOrderId', 'Orden'),
        reason: optionalText(values, 'reason'),
      }),
    successMessage: 'Solicitud enviada al gerente.',
  };
}

function reviewActions(request: ReplenishmentRequest): ResourceRowAction[] {
  if (request.status !== 'PENDIENTE') return [];
  const name = request.part?.name ?? 'la pieza';
  return [
    {
      key: 'approve',
      label: 'Aprobar solicitud de reposición',
      shortLabel: 'Aprobar',
      icon: CheckCircle2,
      tone: 'success',
      form: {
        title: `Aprobar ${request.quantity} u. de ${name}`,
        submitLabel: 'Aprobar',
        fields: [{ name: 'note', label: 'Nota (opcional)', type: 'textarea', maxLength: 255 }],
        initialValues: { note: '' },
      },
      run: async (values) => {
        await replenishmentApi.approve(request.id, optionalText(values, 'note'));
        return `Solicitud aprobada: el bodeguero puede incluirla en un pedido.`;
      },
    },
    {
      key: 'reject',
      label: 'Rechazar solicitud de reposición',
      shortLabel: 'Rechazar',
      icon: XCircle,
      tone: 'danger',
      form: {
        title: `Rechazar solicitud de ${name}`,
        submitLabel: 'Rechazar',
        fields: [{ name: 'note', label: 'Motivo', type: 'textarea', required: true, maxLength: 255 }],
        initialValues: { note: '' },
      },
      run: async (values) => {
        const note = text(values, 'note');
        if (note.length < 3) throw new UserInputError('Indica el motivo del rechazo.');
        await replenishmentApi.reject(request.id, note);
        return 'Solicitud rechazada.';
      },
    },
  ];
}

/**
 * /reposicion — Solicitar reposición (GERENTE, BODEGUERO, MECANICO);
 * aprobar/rechazar (GERENTE). Las aprobadas se convierten en pedido desde Compras.
 */
export default function ReposicionPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'GERENTE';
  // El BODEGUERO no consulta órdenes de trabajo: pide para stock general.
  const canLinkOrder = user?.role === 'GERENTE' || user?.role === 'MECANICO';

  return (
    <ResourceListPage
      title="Reposición"
      description={user?.role === 'MECANICO' ? 'Tus solicitudes de repuestos' : 'Solicitudes de repuestos del taller'}
      icon={PackagePlus}
      entityLabel="la solicitud"
      fetchAll={listRequests}
      columns={columns}
      emptyMessage="No hay solicitudes de reposición."
      getRowLabel={(request) => `Solicitud #${request.id}`}
      createForm={createForm(canLinkOrder)}
      rowActions={isManager ? reviewActions : undefined}
    />
  );
}
