ALTER TABLE "reference_products"
  ADD COLUMN "unit_name" VARCHAR(50),
  ADD COLUMN "registration_number" VARCHAR(100),
  ADD COLUMN "active_ingredient" VARCHAR(255),
  ADD COLUMN "usage_instructions" TEXT,
  ADD COLUMN "category_name" VARCHAR(100),
  ADD COLUMN "position_name" VARCHAR(255),
  ADD COLUMN "supplier_name" VARCHAR(255),
  ADD COLUMN "input_price" NUMERIC(20,2),
  ADD COLUMN "wholesale_price" NUMERIC(20,2),
  ADD COLUMN "doctor_discount_percent" NUMERIC(7,2),
  ADD COLUMN "employee_discount_percent" NUMERIC(7,2),
  ADD COLUMN "min_inventory" NUMERIC(12,2);
