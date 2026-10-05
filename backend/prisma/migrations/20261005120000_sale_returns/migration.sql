-- Partial customer returns: a return record per sale, stock restored to the original batch.
-- AlterEnum
ALTER TYPE "inventory_reference_type" ADD VALUE 'sale_return';

-- AlterTable
ALTER TABLE "sale_details" ADD COLUMN     "returned_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "sale_returns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "refund_amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_details" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_return_id" UUID NOT NULL,
    "sale_detail_id" UUID NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "refund_amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sale_return_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_returns_store_id_created_at_idx" ON "sale_returns"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "sale_returns_sale_id_idx" ON "sale_returns"("sale_id");

-- CreateIndex
CREATE INDEX "sale_return_details_sale_return_id_idx" ON "sale_return_details"("sale_return_id");

-- CreateIndex
CREATE INDEX "sale_return_details_sale_detail_id_idx" ON "sale_return_details"("sale_detail_id");

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_sale_id_store_id_fkey" FOREIGN KEY ("sale_id", "store_id") REFERENCES "sales"("id", "store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_details" ADD CONSTRAINT "sale_return_details_sale_return_id_fkey" FOREIGN KEY ("sale_return_id") REFERENCES "sale_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_details" ADD CONSTRAINT "sale_return_details_sale_detail_id_fkey" FOREIGN KEY ("sale_detail_id") REFERENCES "sale_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guards that Prisma cannot express.
ALTER TABLE "sale_details"
  ADD CONSTRAINT "sale_details_returned_quantity_check" CHECK ("returned_quantity" >= 0 AND "returned_quantity" <= "quantity");
ALTER TABLE "sale_returns"
  ADD CONSTRAINT "sale_returns_refund_amount_check" CHECK ("refund_amount" >= 0);
ALTER TABLE "sale_return_details"
  ADD CONSTRAINT "sale_return_details_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "sale_return_details_refund_amount_check" CHECK ("refund_amount" >= 0);
