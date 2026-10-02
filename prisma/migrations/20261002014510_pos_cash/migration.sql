-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PosSaleStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER_QR');

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" SERIAL NOT NULL,
    "cashier_id" INTEGER NOT NULL,
    "opening_amount" DECIMAL(12,2) NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "expected_amount" DECIMAL(12,2),
    "counted_amount" DECIMAL(12,2),
    "difference" DECIMAL(12,2),

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sales" (
    "id" SERIAL NOT NULL,
    "cash_session_id" INTEGER NOT NULL,
    "cashier_id" INTEGER NOT NULL,
    "status" "PosSaleStatus" NOT NULL DEFAULT 'OPEN',
    "payment_method" "PaymentMethod",
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(3),

    CONSTRAINT "pos_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sale_items" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "pos_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_sale_items_sale_id_product_id_key" ON "pos_sale_items"("sale_id", "product_id");

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "pos_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Los importes de apertura y conciliación no pueden ser negativos
ALTER TABLE "cash_sessions"
ADD CONSTRAINT "cash_opening_amount_check"
CHECK ("opening_amount" >= 0);

ALTER TABLE "cash_sessions"
ADD CONSTRAINT "cash_expected_amount_check"
CHECK ("expected_amount" >= 0);

ALTER TABLE "cash_sessions"
ADD CONSTRAINT "cash_counted_amount_check"
CHECK ("counted_amount" >= 0);

-- Un cajero puede tener solamente una sesión abierta
CREATE UNIQUE INDEX "cash_one_open_session_per_cashier"
ON "cash_sessions" ("cashier_id")
WHERE "status" = 'OPEN';

-- Validaciones del POS
ALTER TABLE "pos_sales"
ADD CONSTRAINT "pos_sales_total_check"
CHECK ("total" >= 0);

ALTER TABLE "pos_sales"
ADD CONSTRAINT "pos_sales_paid_check"
CHECK (
  "status" <> 'PAID'
  OR (
    "payment_method" IS NOT NULL
    AND "paid_at" IS NOT NULL
  )
);

-- Restricciones del detalle de venta
ALTER TABLE "pos_sale_items"
ADD CONSTRAINT "pos_items_quantity_check"
CHECK ("quantity" > 0);

ALTER TABLE "pos_sale_items"
ADD CONSTRAINT "pos_items_unit_price_check"
CHECK ("unit_price" >= 0);

ALTER TABLE "pos_sale_items"
ADD CONSTRAINT "pos_items_unit_cost_check"
CHECK ("unit_cost" >= 0);