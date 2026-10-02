-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('WEB', 'MARKETPLACE', 'MANUAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('NONE', 'RESERVED', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MOCKPAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "carts" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" SERIAL NOT NULL,
    "cart_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "source" "OrderSource" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "recipient_name" VARCHAR(150) NOT NULL,
    "recipient_phone" VARCHAR(20) NOT NULL,
    "shipping_address" TEXT NOT NULL,
    "district" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "reference" TEXT,
    "reservation_status" "ReservationStatus" NOT NULL DEFAULT 'NONE',
    "reservation_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MOCKPAY',
    "provider_payment_id" VARCHAR(100),
    "idempotency_key" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "checkout_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carts_customer_id_status_idx" ON "carts"("customer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_key" ON "cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_status_idx" ON "orders"("customer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_status_idx" ON "payments"("order_id", "status");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CARRITOS

-- Un cliente puede tener únicamente un carrito activo
CREATE UNIQUE INDEX "one_active_cart_per_customer"
ON "carts" ("customer_id")
WHERE "status" = 'ACTIVE';

-- Las cantidades deben ser positivas
ALTER TABLE "cart_items"
ADD CONSTRAINT "cart_items_quantity_check"
CHECK ("quantity" > 0);


-- ÓRDENES

-- El total no puede ser negativo
ALTER TABLE "orders"
ADD CONSTRAINT "orders_total_check"
CHECK ("total" >= 0);

-- Trabajaremos exclusivamente en USD
ALTER TABLE "orders"
ADD CONSTRAINT "orders_currency_check"
CHECK ("currency" = 'USD');

-- Toda reserva activa debe tener vencimiento
ALTER TABLE "orders"
ADD CONSTRAINT "orders_reservation_check"
CHECK (
  "reservation_status" <> 'RESERVED'
  OR "reservation_expires_at" IS NOT NULL
);


-- DETALLES DE ÓRDENES

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_quantity_check"
CHECK ("quantity" > 0);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_price_check"
CHECK ("unit_price" >= 0);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_cost_check"
CHECK ("unit_cost" >= 0);


-- PAGOS MOCKPAY

-- El importe solicitado debe ser positivo
ALTER TABLE "payments"
ADD CONSTRAINT "payments_amount_check"
CHECK ("amount" > 0);

ALTER TABLE "payments"
ADD CONSTRAINT "payments_currency_check"
CHECK ("currency" = 'USD');

-- Un pago exitoso debe tener fecha de confirmación
ALTER TABLE "payments"
ADD CONSTRAINT "payments_success_check"
CHECK (
  "status" <> 'SUCCEEDED'
  OR "confirmed_at" IS NOT NULL
);

-- Una orden no puede tener dos pagos exitosos
CREATE UNIQUE INDEX "one_successful_payment_per_order"
ON "payments" ("order_id")
WHERE "status" = 'SUCCEEDED';