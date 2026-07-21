CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE token_type AS ENUM ('refresh', 'resetPassword', 'verifyEmail');
CREATE TYPE store_role AS ENUM ('owner', 'manager', 'staff');
CREATE TYPE receipt_status AS ENUM ('draft', 'completed', 'cancelled');
CREATE TYPE sale_status AS ENUM ('completed', 'cancelled', 'refunded');
CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'card', 'e_wallet', 'other');
CREATE TYPE inventory_movement_type AS ENUM (
  'import',
  'sale',
  'return',
  'adjustment',
  'damage',
  'expired',
  'transfer_in',
  'transfer_out'
);
CREATE TYPE inventory_reference_type AS ENUM (
  'import_receipt',
  'sale',
  'manual_adjustment',
  'stock_transfer'
);

CREATE TABLE users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  is_system_admin BOOLEAN NOT NULL DEFAULT false,
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  token TEXT NOT NULL,
  user_id UUID NOT NULL,
  type token_type NOT NULL,
  expires TIMESTAMPTZ(3) NOT NULL,
  blacklisted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tokens_pkey PRIMARY KEY (id)
);

CREATE TABLE stores (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stores_pkey PRIMARY KEY (id)
);

CREATE TABLE user_store_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL,
  role store_role NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_store_roles_pkey PRIMARY KEY (id)
);

CREATE TABLE medicines (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  base_unit_name VARCHAR(50) NOT NULL,
  barcode VARCHAR(100),
  registration_number VARCHAR(100),
  category VARCHAR(100),
  active_ingredient VARCHAR(255),
  strength VARCHAR(100),
  dosage_form VARCHAR(100),
  manufacturer VARCHAR(255),
  requires_prescription BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT medicines_pkey PRIMARY KEY (id)
);

CREATE TABLE store_medicines (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  medicine_id UUID NOT NULL,
  selling_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT store_medicines_pkey PRIMARY KEY (id),
  CONSTRAINT store_medicines_selling_price_check CHECK (selling_price >= 0),
  CONSTRAINT store_medicines_min_stock_check CHECK (min_stock >= 0)
);

CREATE TABLE suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  tax_code VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);

CREATE TABLE import_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  created_by UUID NOT NULL,
  supplier_id UUID,
  supplier_name_snapshot VARCHAR(255),
  status receipt_status NOT NULL DEFAULT 'completed',
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  imported_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT import_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT import_receipts_total_amount_check CHECK (total_amount >= 0)
);

CREATE TABLE import_details (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  import_receipt_id UUID NOT NULL,
  store_id UUID NOT NULL,
  medicine_id UUID NOT NULL,
  batch_number VARCHAR(100) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  import_price NUMERIC(14,2) NOT NULL,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT import_details_pkey PRIMARY KEY (id),
  CONSTRAINT import_details_quantity_check CHECK (quantity > 0),
  CONSTRAINT import_details_import_price_check CHECK (import_price >= 0)
);

CREATE TABLE stock_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  medicine_id UUID NOT NULL,
  import_detail_id UUID,
  batch_number VARCHAR(100) NOT NULL,
  import_price NUMERIC(14,2) NOT NULL,
  expiry_date DATE NOT NULL,
  quantity_remaining NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stock_batches_pkey PRIMARY KEY (id),
  CONSTRAINT stock_batches_import_price_check CHECK (import_price >= 0),
  CONSTRAINT stock_batches_quantity_remaining_check CHECK (quantity_remaining >= 0)
);

CREATE TABLE inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  medicine_id UUID NOT NULL,
  stock_batch_id UUID,
  type inventory_movement_type NOT NULL,
  quantity_delta NUMERIC(12,2) NOT NULL,
  reference_type inventory_reference_type,
  reference_id UUID,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inventory_movements_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_movements_quantity_delta_check CHECK (quantity_delta <> 0)
);

CREATE TABLE sales (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  sold_by UUID NOT NULL,
  status sale_status NOT NULL DEFAULT 'completed',
  payment_method payment_method NOT NULL DEFAULT 'cash',
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  sold_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_discount_amount_check CHECK (discount_amount >= 0),
  CONSTRAINT sales_total_amount_check CHECK (total_amount >= 0)
);

CREATE TABLE sale_details (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL,
  store_id UUID NOT NULL,
  medicine_id UUID NOT NULL,
  stock_batch_id UUID NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  sale_price NUMERIC(14,2) NOT NULL,
  cost_price NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sale_details_pkey PRIMARY KEY (id),
  CONSTRAINT sale_details_quantity_check CHECK (quantity > 0),
  CONSTRAINT sale_details_sale_price_check CHECK (sale_price >= 0),
  CONSTRAINT sale_details_cost_price_check CHECK (cost_price >= 0)
);

CREATE TABLE daily_profit_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  summary_date DATE NOT NULL,
  total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT daily_profit_summary_pkey PRIMARY KEY (id),
  CONSTRAINT daily_profit_summary_total_revenue_check CHECK (total_revenue >= 0),
  CONSTRAINT daily_profit_summary_total_cost_check CHECK (total_cost >= 0),
  CONSTRAINT daily_profit_summary_total_orders_check CHECK (total_orders >= 0)
);

CREATE UNIQUE INDEX users_phone_key ON users(phone);
CREATE UNIQUE INDEX users_email_key ON users(email);
CREATE INDEX tokens_user_id_idx ON tokens(user_id);
CREATE INDEX tokens_token_type_user_id_blacklisted_idx ON tokens(token, type, user_id, blacklisted);

CREATE UNIQUE INDEX user_store_roles_user_id_store_id_role_key ON user_store_roles(user_id, store_id, role);
CREATE INDEX user_store_roles_user_id_idx ON user_store_roles(user_id);
CREATE INDEX user_store_roles_store_id_idx ON user_store_roles(store_id);

CREATE UNIQUE INDEX medicines_barcode_key ON medicines(barcode);
CREATE UNIQUE INDEX medicines_registration_number_key ON medicines(registration_number);
CREATE INDEX medicines_name_idx ON medicines(name);
CREATE INDEX medicines_barcode_idx ON medicines(barcode);

CREATE UNIQUE INDEX store_medicines_store_id_medicine_id_key ON store_medicines(store_id, medicine_id);
CREATE INDEX store_medicines_medicine_id_idx ON store_medicines(medicine_id);

CREATE UNIQUE INDEX suppliers_code_key ON suppliers(code);
CREATE INDEX suppliers_name_idx ON suppliers(name);

CREATE INDEX import_receipts_store_id_imported_at_idx ON import_receipts(store_id, imported_at);
CREATE INDEX import_receipts_created_by_idx ON import_receipts(created_by);
CREATE INDEX import_receipts_supplier_id_idx ON import_receipts(supplier_id);

CREATE INDEX import_details_import_receipt_id_idx ON import_details(import_receipt_id);
CREATE INDEX import_details_medicine_id_idx ON import_details(medicine_id);
CREATE INDEX import_details_store_id_medicine_id_expiry_date_idx ON import_details(store_id, medicine_id, expiry_date);

CREATE UNIQUE INDEX stock_batches_id_store_id_medicine_id_key ON stock_batches(id, store_id, medicine_id);
CREATE INDEX stock_batches_store_id_medicine_id_idx ON stock_batches(store_id, medicine_id);
CREATE INDEX stock_batches_store_id_medicine_id_expiry_date_idx ON stock_batches(store_id, medicine_id, expiry_date);
CREATE INDEX stock_batches_expiry_date_idx ON stock_batches(expiry_date);

CREATE INDEX inventory_movements_store_id_medicine_id_created_at_idx ON inventory_movements(store_id, medicine_id, created_at);
CREATE INDEX inventory_movements_stock_batch_id_idx ON inventory_movements(stock_batch_id);
CREATE INDEX inventory_movements_reference_type_reference_id_idx ON inventory_movements(reference_type, reference_id);

CREATE UNIQUE INDEX sales_id_store_id_key ON sales(id, store_id);
CREATE INDEX sales_store_id_sold_at_idx ON sales(store_id, sold_at);
CREATE INDEX sales_sold_by_idx ON sales(sold_by);

CREATE INDEX sale_details_sale_id_idx ON sale_details(sale_id);
CREATE INDEX sale_details_medicine_id_idx ON sale_details(medicine_id);
CREATE INDEX sale_details_stock_batch_id_idx ON sale_details(stock_batch_id);

CREATE UNIQUE INDEX daily_profit_summary_store_id_summary_date_key ON daily_profit_summary(store_id, summary_date);
CREATE INDEX daily_profit_summary_store_id_summary_date_idx ON daily_profit_summary(store_id, summary_date);

ALTER TABLE tokens
  ADD CONSTRAINT tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE user_store_roles
  ADD CONSTRAINT user_store_roles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT user_store_roles_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE store_medicines
  ADD CONSTRAINT store_medicines_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT store_medicines_medicine_id_fkey
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE import_receipts
  ADD CONSTRAINT import_receipts_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT import_receipts_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT import_receipts_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE import_details
  ADD CONSTRAINT import_details_import_receipt_id_fkey
  FOREIGN KEY (import_receipt_id) REFERENCES import_receipts(id)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT import_details_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT import_details_medicine_id_fkey
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE stock_batches
  ADD CONSTRAINT stock_batches_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT stock_batches_medicine_id_fkey
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT stock_batches_import_detail_id_fkey
  FOREIGN KEY (import_detail_id) REFERENCES import_details(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT inventory_movements_medicine_id_fkey
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT inventory_movements_stock_batch_id_fkey
  FOREIGN KEY (stock_batch_id) REFERENCES stock_batches(id)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT inventory_movements_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE sales
  ADD CONSTRAINT sales_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT sales_sold_by_fkey
  FOREIGN KEY (sold_by) REFERENCES users(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE sale_details
  ADD CONSTRAINT sale_details_sale_id_store_id_fkey
  FOREIGN KEY (sale_id, store_id) REFERENCES sales(id, store_id)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT sale_details_medicine_id_fkey
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT sale_details_stock_batch_id_store_id_medicine_id_fkey
  FOREIGN KEY (stock_batch_id, store_id, medicine_id) REFERENCES stock_batches(id, store_id, medicine_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE daily_profit_summary
  ADD CONSTRAINT daily_profit_summary_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tokens_updated_at
  BEFORE UPDATE ON tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_medicines_updated_at
  BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_store_medicines_updated_at
  BEFORE UPDATE ON store_medicines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_import_receipts_updated_at
  BEFORE UPDATE ON import_receipts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_daily_profit_summary_updated_at
  BEFORE UPDATE ON daily_profit_summary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
