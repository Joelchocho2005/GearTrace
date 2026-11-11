import { useState } from 'react';
import { Boxes, Package, Warehouse } from 'lucide-react';
import { inventoryApi } from '../api/resources';
import type { InventoryBox } from '../api/types';
import InventoryList from '../components/Inventory/InventoryList';
import type { Column } from '../components/ui/DataTable';
import type { FormField, FormValues } from '../components/ui/ResourceFormModal';
import ResourceListPage, { CreateFormConfig, EditFormConfig } from '../components/ui/ResourceListPage';
import ViewTabs, { ViewTab } from '../components/ui/ViewTabs';
import { UserInputError } from '../api/errors';
import { EMPTY } from '../utils/format';
import { optionalText, requiredNumber, text } from '../utils/formValues';

type View = 'parts' | 'boxes';

const tabs: ViewTab<View>[] = [
  { key: 'parts', label: 'Piezas', icon: Package },
  { key: 'boxes', label: 'Cajas', icon: Boxes },
];

/** Color por defecto de una caja (mismo default que Prisma: `Box.colorHex`). */
const DEFAULT_BOX_COLOR = '#FF6600';
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const columns: Column<InventoryBox>[] = [
  { key: 'name', header: 'Caja', render: (box) => <span className="font-semibold text-white">{box.name}</span> },
  {
    key: 'led',
    header: 'LED',
    render: (box) => (
      <span className="inline-flex items-center gap-2 text-slate-200">
        <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: box.colorHex }} />
        #{box.ledIndex}
      </span>
    ),
  },
  { key: 'location', header: 'Ubicación', hideOnMobile: true, render: (box) => box.location ?? EMPTY },
  { key: 'description', header: 'Descripción', hideOnMobile: true, render: (box) => box.description ?? EMPTY },
  { key: 'parts', header: 'Piezas', align: 'right', render: (box) => box.parts?.length ?? 0 },
];

const boxFields: FormField[] = [
  { name: 'name', label: 'Nombre', type: 'text', required: true, maxLength: 100 },
  {
    name: 'ledIndex',
    label: 'Índice de LED',
    type: 'number',
    required: true,
    min: 0,
    step: '1',
    help: 'Posición en la tira WS2812B. Cada LED se asigna a una sola caja.',
  },
  { name: 'colorHex', label: 'Color (#RRGGBB)', type: 'text', maxLength: 7, help: `Vacío = ${DEFAULT_BOX_COLOR}.` },
  { name: 'location', label: 'Ubicación', type: 'text', maxLength: 150 },
  { name: 'description', label: 'Descripción', type: 'textarea', maxLength: 255, wide: true },
];

function boxPayload(values: FormValues) {
  const colorHex = text(values, 'colorHex');
  if (colorHex && !HEX_COLOR.test(colorHex)) {
    throw new UserInputError('El color debe tener el formato #RRGGBB (ej.: #FF6600).');
  }
  return {
    name: text(values, 'name'),
    ledIndex: requiredNumber(values, 'ledIndex', 'Índice de LED'),
    colorHex: colorHex || undefined,
    location: optionalText(values, 'location'),
    description: optionalText(values, 'description'),
  };
}

const createForm: CreateFormConfig = {
  title: 'Nueva caja',
  fields: boxFields,
  initialValues: { name: '', ledIndex: '', colorHex: DEFAULT_BOX_COLOR, location: '', description: '' },
  submit: (values) => inventoryApi.createBox(boxPayload(values)),
  successMessage: 'Caja creada.',
};

const editForm: EditFormConfig<InventoryBox> = {
  title: (box) => `Editar ${box.name}`,
  fields: () => boxFields,
  initialValues: (box) => ({
    name: box.name,
    ledIndex: String(box.ledIndex),
    colorHex: box.colorHex,
    location: box.location ?? '',
    description: box.description ?? '',
  }),
  submit: (box, values) => inventoryApi.updateBox(box.id, boxPayload(values)),
};

/** /inventory — GERENTE y BODEGUERO: piezas (vista operativa) y cajas (CRUD). */
export default function InventarioPage() {
  const [view, setView] = useState<View>('parts');
  const toolbar = <ViewTabs tabs={tabs} active={view} onChange={setView} />;

  if (view === 'parts') {
    return (
      <div className="space-y-6">
        {toolbar}
        <InventoryList />
      </div>
    );
  }

  return (
    <ResourceListPage
      toolbar={toolbar}
      title="Cajas"
      description="Ubicaciones físicas del almacén y su LED indicador"
      icon={Warehouse}
      entityLabel="la caja"
      fetchAll={inventoryApi.listBoxes}
      columns={columns}
      emptyMessage="No hay cajas registradas."
      getRowLabel={(box) => box.name}
      onDelete={inventoryApi.removeBox}
      createForm={createForm}
      editForm={editForm}
    />
  );
}
