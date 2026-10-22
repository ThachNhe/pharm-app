-- Import lines now always record the selling price in effect after the import.
-- Older lines that kept the price stored NULL; the price at that time was not recorded, so the current store price is the best available value.
UPDATE "import_details" d
SET "new_selling_price" = sm."selling_price"
FROM "store_medicines" sm
WHERE d."new_selling_price" IS NULL
  AND sm."store_id" = d."store_id"
  AND sm."medicine_id" = d."medicine_id";
