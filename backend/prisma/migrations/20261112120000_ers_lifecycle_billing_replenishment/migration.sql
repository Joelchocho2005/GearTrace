-- ERS: ciclo de vida completo de OT, mano de obra, facturación con líneas y
-- pagos, kardex de stock, solicitudes de reposición, catálogo de proveedor,
-- notificaciones y auditoría. Migración aditiva: no elimina datos.

-- CreateEnum
CREATE TYPE "InvoiceLineType" AS ENUM ('MANO_OBRA', 'REPUESTO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('INVENTARIO_INICIAL', 'ENTRADA_COMPRA', 'SALIDA_OT', 'DEVOLUCION_OT', 'AJUSTE', 'DEVOLUCION_PROVEEDOR');

-- CreateEnum
CREATE TYPE "ReplenishmentStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ATENDIDA');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'NO_ASISTIO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvoiceStatus" ADD VALUE 'PARCIAL';
ALTER TYPE "InvoiceStatus" ADD VALUE 'ANULADA';

-- AlterEnum
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'RECIBIDA_PARCIAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkOrderStatus" ADD VALUE 'ESPERA_APROBACION';
ALTER TYPE "WorkOrderStatus" ADD VALUE 'ENTREGADA';
ALTER TYPE "WorkOrderStatus" ADD VALUE 'CANCELADA';

-- DropIndex
DROP INDEX "invoices_work_order_id_key";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "notes" VARCHAR(255),
ADD COLUMN     "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "void_reason" VARCHAR(255),
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by_id" INTEGER;

-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "cost_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "received_quantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "cancel_reason" VARCHAR(255),
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "quote_approved" BOOLEAN,
ADD COLUMN     "quote_decided_at" TIMESTAMP(3),
ADD COLUMN     "quote_sent_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "service_activities" (
    "id" SERIAL NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "labor_rate" DECIMAL(10,2) NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "work_order_id" INTEGER NOT NULL,
    "mechanic_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "labor_rate_per_hour" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "appointment_slot_minutes" INTEGER NOT NULL DEFAULT 60,
    "appointments_per_slot" INTEGER NOT NULL DEFAULT 2,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" VARCHAR(255),
    "part_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "work_order_id" INTEGER,
    "purchase_order_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replenishment_requests" (
    "id" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" VARCHAR(255),
    "status" "ReplenishmentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "review_note" VARCHAR(255),
    "reviewed_at" TIMESTAMP(3),
    "part_id" INTEGER NOT NULL,
    "requested_by_id" INTEGER NOT NULL,
    "reviewed_by_id" INTEGER,
    "work_order_id" INTEGER,
    "purchase_order_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replenishment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_parts" (
    "id" SERIAL NOT NULL,
    "supplier_code" VARCHAR(50),
    "price" DECIMAL(10,2) NOT NULL,
    "lead_time_days" INTEGER,
    "supplier_id" INTEGER NOT NULL,
    "part_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" SERIAL NOT NULL,
    "type" "InvoiceLineType" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "invoice_id" INTEGER NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(100),
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoice_id" INTEGER NOT NULL,
    "received_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "link" VARCHAR(255),
    "read_at" TIMESTAMP(3),
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER,
    "detail" JSONB,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_activities_work_order_id_idx" ON "service_activities"("work_order_id");

-- CreateIndex
CREATE INDEX "service_activities_mechanic_id_idx" ON "service_activities"("mechanic_id");

-- CreateIndex
CREATE INDEX "stock_movements_part_id_created_at_idx" ON "stock_movements"("part_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_work_order_id_idx" ON "stock_movements"("work_order_id");

-- CreateIndex
CREATE INDEX "stock_movements_purchase_order_id_idx" ON "stock_movements"("purchase_order_id");

-- CreateIndex
CREATE INDEX "replenishment_requests_status_idx" ON "replenishment_requests"("status");

-- CreateIndex
CREATE INDEX "replenishment_requests_part_id_idx" ON "replenishment_requests"("part_id");

-- CreateIndex
CREATE INDEX "replenishment_requests_purchase_order_id_idx" ON "replenishment_requests"("purchase_order_id");

-- CreateIndex
CREATE INDEX "supplier_parts_part_id_idx" ON "supplier_parts"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_parts_supplier_id_part_id_key" ON "supplier_parts"("supplier_id", "part_id");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "invoices_work_order_id_idx" ON "invoices"("work_order_id");

-- AddForeignKey
ALTER TABLE "service_activities" ADD CONSTRAINT "service_activities_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_activities" ADD CONSTRAINT "service_activities_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_parts" ADD CONSTRAINT "supplier_parts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_parts" ADD CONSTRAINT "supplier_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Datos existentes ─────────────────────────────────────────────────────
-- Parámetros del taller (fila única).
INSERT INTO "workshop_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Kardex: saldo inicial de cada pieza para que balance_after cuadre con el stock.
INSERT INTO "stock_movements" ("type", "quantity", "balance_after", "reason", "part_id")
SELECT 'INVENTARIO_INICIAL', p."quantity", p."quantity", 'Saldo inicial (migración)', p."id"
FROM "parts" p;

-- Facturas previas: una línea consolidada (Σ líneas = subtotal) y el monto
-- pagado de las ya cobradas.
INSERT INTO "invoice_lines" ("type", "description", "quantity", "unit_price", "amount", "invoice_id")
SELECT 'MANO_OBRA', 'Servicio facturado (registro previo a líneas de detalle)', 1, i."subtotal", i."subtotal", i."id"
FROM "invoices" i;

UPDATE "invoices" SET "paid_amount" = "total" WHERE "status" = 'PAGADA';

-- Pedidos ya recibidos: todas sus unidades cuentan como recibidas.
UPDATE "purchase_order_items" poi SET "received_quantity" = poi."quantity"
FROM "purchase_orders" po
WHERE po."id" = poi."purchase_order_id" AND po."status" = 'RECIBIDA';
