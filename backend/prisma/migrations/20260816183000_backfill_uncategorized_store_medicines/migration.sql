INSERT INTO "product_categories" ("store_id", "name")
SELECT DISTINCT "store_id", 'Chưa phân loại'
FROM "store_medicines"
WHERE "category_id" IS NULL
ON CONFLICT DO NOTHING;

UPDATE "store_medicines" sm
SET "category_id" = pc."id"
FROM "product_categories" pc
WHERE sm."category_id" IS NULL
  AND pc."store_id" = sm."store_id"
  AND pc."name" = 'Chưa phân loại';
