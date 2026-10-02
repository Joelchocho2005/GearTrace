-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GERENTE', 'MECANICO', 'CLIENTE');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENTE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boxes" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "led_index" INTEGER NOT NULL,
    "location" VARCHAR(150),
    "color_hex" VARCHAR(7) NOT NULL DEFAULT '#FF6600',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "photo_url" VARCHAR(500),
    "description" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "min_stock" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "box_id" INTEGER NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_logs" (
    "id" SERIAL NOT NULL,
    "query" VARCHAR(255) NOT NULL,
    "part_id" INTEGER,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "alexa_response" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "boxes_led_index_key" ON "boxes"("led_index");

-- CreateIndex
CREATE UNIQUE INDEX "parts_code_key" ON "parts"("code");

-- CreateIndex
CREATE INDEX "parts_name_idx" ON "parts"("name");

-- CreateIndex
CREATE INDEX "parts_box_id_idx" ON "parts"("box_id");

-- CreateIndex
CREATE INDEX "search_logs_query_idx" ON "search_logs"("query");

-- CreateIndex
CREATE INDEX "search_logs_user_id_idx" ON "search_logs"("user_id");

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_box_id_fkey" FOREIGN KEY ("box_id") REFERENCES "boxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
