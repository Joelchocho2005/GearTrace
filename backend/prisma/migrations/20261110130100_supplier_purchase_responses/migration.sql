ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMADA';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'RECHAZADA';

ALTER TABLE "purchase_orders"
ADD COLUMN "expected_delivery_at" TIMESTAMP(3);
