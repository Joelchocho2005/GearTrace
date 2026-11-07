-- Migración escrita a mano: conserva datos (Prisma generaba DROP/CREATE).

-- 1. WorkOrderStatus: PENDIENTE/EN_DIAGNOSTICO/EN_PROGRESO/CERRADA
--    → EN_DIAGNOSTICO/EN_PROCESO/ESPERA_REPUESTOS/CONCLUIDO
ALTER TABLE "work_orders" ALTER COLUMN "status" DROP DEFAULT;
CREATE TYPE "WorkOrderStatus_new" AS ENUM ('EN_DIAGNOSTICO', 'EN_PROCESO', 'ESPERA_REPUESTOS', 'CONCLUIDO');
ALTER TABLE "work_orders" ALTER COLUMN "status" TYPE "WorkOrderStatus_new" USING (
  CASE "status"::text
    WHEN 'PENDIENTE'   THEN 'EN_DIAGNOSTICO'
    WHEN 'EN_PROGRESO' THEN 'EN_PROCESO'
    WHEN 'CERRADA'     THEN 'CONCLUIDO'
    ELSE "status"::text
  END
)::"WorkOrderStatus_new";
DROP TYPE "WorkOrderStatus";
ALTER TYPE "WorkOrderStatus_new" RENAME TO "WorkOrderStatus";
ALTER TABLE "work_orders" ALTER COLUMN "status" SET DEFAULT 'EN_DIAGNOSTICO';

-- 2. Kilometraje de ingreso
ALTER TABLE "work_orders" ADD COLUMN "mileage" INTEGER;

-- 3. WorkOrderItem → UsedPart: renombrar tabla y objetos asociados
ALTER TABLE "work_order_items" RENAME TO "used_parts";
ALTER SEQUENCE "work_order_items_id_seq" RENAME TO "used_parts_id_seq";
ALTER TABLE "used_parts" RENAME CONSTRAINT "work_order_items_pkey" TO "used_parts_pkey";
ALTER TABLE "used_parts" RENAME CONSTRAINT "work_order_items_work_order_id_fkey" TO "used_parts_work_order_id_fkey";
ALTER TABLE "used_parts" RENAME CONSTRAINT "work_order_items_part_id_fkey" TO "used_parts_part_id_fkey";
ALTER INDEX "work_order_items_part_id_idx" RENAME TO "used_parts_part_id_idx";
ALTER INDEX "work_order_items_work_order_id_part_id_key" RENAME TO "used_parts_work_order_id_part_id_key";
