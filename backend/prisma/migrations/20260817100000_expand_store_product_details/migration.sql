-- Add global medicine details present in the reference catalog.
ALTER TABLE "reference_products"
ADD COLUMN "country_of_origin" VARCHAR(100),
ADD COLUMN "importer_name" VARCHAR(255);

ALTER TABLE "medicines"
ADD COLUMN "secondary_barcode" VARCHAR(100),
ADD COLUMN "country_of_origin" VARCHAR(100),
ADD COLUMN "importer_name" VARCHAR(255),
ADD COLUMN "specification" TEXT,
ADD COLUMN "usage_instructions" TEXT;

CREATE UNIQUE INDEX "medicines_secondary_barcode_key" ON "medicines"("secondary_barcode");

-- Product codes and shelf positions belong to a store, not the shared medicine.
ALTER TABLE "store_medicines"
ADD COLUMN "code" VARCHAR(50),
ADD COLUMN "position_name" VARCHAR(255);

WITH assignment_details AS (
  SELECT
    sm."id",
    rp."code" AS "reference_code",
    rp."position_name",
    ROW_NUMBER() OVER (
      PARTITION BY sm."store_id", rp."code"
      ORDER BY sm."created_at", sm."id"
    ) AS "code_occurrence"
  FROM "store_medicines" sm
  JOIN "medicines" m ON m."id" = sm."medicine_id"
  LEFT JOIN "reference_products" rp ON rp."id" = m."reference_product_id"
)
UPDATE "store_medicines" sm
SET
  "code" = CASE
    WHEN NULLIF(TRIM(details."reference_code"), '') IS NOT NULL
      AND details."code_occurrence" = 1
      THEN UPPER(TRIM(details."reference_code"))
    ELSE 'SP-' || UPPER(REPLACE(sm."id"::TEXT, '-', ''))
  END,
  "position_name" = details."position_name"
FROM assignment_details details
WHERE details."id" = sm."id";

ALTER TABLE "store_medicines" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "store_medicines_store_id_code_key" ON "store_medicines"("store_id", "code");

-- Preserve structured reference details for medicines linked before this migration.
UPDATE "medicines" m
SET
  "specification" = rp."specification",
  "usage_instructions" = rp."usage_instructions"
FROM "reference_products" rp
WHERE rp."id" = m."reference_product_id";
