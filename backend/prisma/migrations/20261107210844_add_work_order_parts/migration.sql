-- CreateTable
CREATE TABLE "work_order_items" (
    "id" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "work_order_id" INTEGER NOT NULL,
    "part_id" INTEGER NOT NULL,

    CONSTRAINT "work_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_order_items_part_id_idx" ON "work_order_items"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_items_work_order_id_part_id_key" ON "work_order_items"("work_order_id", "part_id");

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
