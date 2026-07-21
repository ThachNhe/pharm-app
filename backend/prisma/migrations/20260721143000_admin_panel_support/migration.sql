CREATE TABLE medicine_units (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL,
  name VARCHAR(50) NOT NULL,
  conversion_rate NUMERIC(12,4) NOT NULL,
  is_base_unit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT medicine_units_pkey PRIMARY KEY (id),
  CONSTRAINT medicine_units_conversion_rate_check CHECK (conversion_rate > 0)
);

CREATE TABLE audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  actor_id UUID,
  store_id UUID,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX medicine_units_medicine_id_name_key ON medicine_units(medicine_id, name);
CREATE UNIQUE INDEX medicine_units_one_base_unit_key ON medicine_units(medicine_id) WHERE is_base_unit;
CREATE INDEX medicine_units_medicine_id_idx ON medicine_units(medicine_id);

CREATE INDEX audit_logs_actor_id_created_at_idx ON audit_logs(actor_id, created_at);
CREATE INDEX audit_logs_store_id_created_at_idx ON audit_logs(store_id, created_at);
CREATE INDEX audit_logs_target_type_target_id_idx ON audit_logs(target_type, target_id);

ALTER TABLE medicine_units
  ADD CONSTRAINT medicine_units_medicine_id_fkey
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT audit_logs_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER trg_medicine_units_updated_at
  BEFORE UPDATE ON medicine_units
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
