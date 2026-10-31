-- Batches are identified by import detail and expiry date; the supplier batch number is no longer tracked.
ALTER TABLE import_details DROP COLUMN batch_number;
ALTER TABLE stock_batches DROP COLUMN batch_number;
