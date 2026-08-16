CREATE TABLE "reference_products" (
  "id" UUID NOT NULL,
  "code" VARCHAR(50),
  "name" VARCHAR(255) NOT NULL,
  "barcode" VARCHAR(100),
  "secondary_barcode" VARCHAR(100),
  "manufacturer" VARCHAR(255),
  "specification" TEXT,
  "reference_price" NUMERIC(20,2),
  "is_internal" BOOLEAN NOT NULL DEFAULT false,
  "is_national" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "synced_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reference_products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reference_products_code_idx" ON "reference_products"("code");
CREATE INDEX "reference_products_name_idx" ON "reference_products"("name");
CREATE INDEX "reference_products_barcode_idx" ON "reference_products"("barcode");
CREATE INDEX "reference_products_secondary_barcode_idx" ON "reference_products"("secondary_barcode");
