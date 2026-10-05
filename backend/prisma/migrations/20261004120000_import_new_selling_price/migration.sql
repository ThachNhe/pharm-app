-- Optional selling price (per base unit) applied to the store medicine when the import receipt is completed.
ALTER TABLE import_details ADD COLUMN new_selling_price DECIMAL(14, 2);
ALTER TABLE import_details
  ADD CONSTRAINT import_details_new_selling_price_check CHECK (new_selling_price IS NULL OR new_selling_price >= 0);
