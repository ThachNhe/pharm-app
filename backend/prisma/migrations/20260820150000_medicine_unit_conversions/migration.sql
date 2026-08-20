ALTER TABLE import_details
  ALTER COLUMN import_price TYPE NUMERIC(18,4),
  ADD COLUMN entered_quantity NUMERIC(12,2),
  ADD COLUMN entered_import_price NUMERIC(14,2),
  ADD COLUMN unit_name_snapshot VARCHAR(50),
  ADD COLUMN conversion_rate_snapshot NUMERIC(12,4);

UPDATE import_details AS detail
SET
  entered_quantity = detail.quantity,
  entered_import_price = detail.import_price,
  unit_name_snapshot = medicine.base_unit_name,
  conversion_rate_snapshot = 1
FROM medicines AS medicine
WHERE medicine.id = detail.medicine_id;

ALTER TABLE import_details
  ALTER COLUMN entered_quantity SET NOT NULL,
  ALTER COLUMN entered_import_price SET NOT NULL,
  ALTER COLUMN unit_name_snapshot SET NOT NULL,
  ALTER COLUMN conversion_rate_snapshot SET NOT NULL,
  ADD CONSTRAINT import_details_conversion_rate_snapshot_check CHECK (conversion_rate_snapshot > 0);

ALTER TABLE stock_batches
  ALTER COLUMN import_price TYPE NUMERIC(18,4);

ALTER TABLE sale_details
  ALTER COLUMN cost_price TYPE NUMERIC(18,4),
  ADD COLUMN unit_name_snapshot VARCHAR(50),
  ADD COLUMN conversion_rate_snapshot NUMERIC(12,4);

UPDATE sale_details AS detail
SET
  unit_name_snapshot = medicine.base_unit_name,
  conversion_rate_snapshot = 1
FROM medicines AS medicine
WHERE medicine.id = detail.medicine_id;

ALTER TABLE sale_details
  ALTER COLUMN unit_name_snapshot SET NOT NULL,
  ALTER COLUMN conversion_rate_snapshot SET NOT NULL,
  ADD CONSTRAINT sale_details_conversion_rate_snapshot_check CHECK (conversion_rate_snapshot > 0);
