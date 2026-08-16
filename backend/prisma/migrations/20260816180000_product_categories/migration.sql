-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "store_medicines" ADD COLUMN "category_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_store_id_name_key" ON "product_categories"("store_id", "name");

-- CreateIndex
CREATE INDEX "product_categories_store_id_is_active_name_idx" ON "product_categories"("store_id", "is_active", "name");

-- Seed the initial catalog for existing stores.
INSERT INTO "product_categories" ("store_id", "name")
SELECT stores."id", categories."name"
FROM "stores"
CROSS JOIN (
    VALUES
        ('Dược phẩm'),
        ('Thực phẩm chức năng'),
        ('Thuốc dùng ngoài'),
        ('Thuốc kê đơn'),
        ('Thuốc không kê đơn')
) AS categories("name");

-- Preserve legacy free-text medicine categories before switching the UI to category IDs.
INSERT INTO "product_categories" ("store_id", "name")
SELECT DISTINCT sm."store_id", trim(m."category")
FROM "store_medicines" sm
JOIN "medicines" m ON m."id" = sm."medicine_id"
WHERE m."category" IS NOT NULL
  AND trim(m."category") <> ''
ON CONFLICT DO NOTHING;

UPDATE "store_medicines" sm
SET "category_id" = pc."id"
FROM "medicines" m, "product_categories" pc
WHERE m."id" = sm."medicine_id"
  AND pc."store_id" = sm."store_id"
  AND pc."name" = trim(m."category");

-- CreateIndex
CREATE INDEX "store_medicines_category_id_idx" ON "store_medicines"("category_id");

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_medicines" ADD CONSTRAINT "store_medicines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
