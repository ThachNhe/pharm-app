ALTER TABLE "medicines"
  ADD COLUMN "reference_product_id" UUID;

CREATE UNIQUE INDEX "medicines_reference_product_id_key"
  ON "medicines"("reference_product_id");

ALTER TABLE "medicines"
  ADD CONSTRAINT "medicines_reference_product_id_fkey"
  FOREIGN KEY ("reference_product_id") REFERENCES "reference_products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
