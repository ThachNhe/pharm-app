ALTER TABLE "store_medicines"
ALTER COLUMN "category_id" SET NOT NULL;

ALTER TABLE "store_medicines"
DROP CONSTRAINT "store_medicines_category_id_fkey";

ALTER TABLE "store_medicines"
ADD CONSTRAINT "store_medicines_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "product_categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
