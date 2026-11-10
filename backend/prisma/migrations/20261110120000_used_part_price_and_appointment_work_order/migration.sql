-- Aditiva: precio congelado del repuesto y vínculo cita → OT.
-- AlterTable
ALTER TABLE "used_parts" ADD COLUMN     "unit_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "appointment_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_appointment_id_key" ON "work_orders"("appointment_id");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Repuestos ya registrados: toman el precio actual de su pieza.
UPDATE "used_parts" u SET "unit_price" = p."unit_price" FROM "parts" p WHERE p."id" = u."part_id" AND u."unit_price" IS NULL;
