-- Low-stock alerts now use one fixed threshold in the application, so the per-product minimum is dropped.
ALTER TABLE store_medicines DROP CONSTRAINT store_medicines_min_stock_check;
ALTER TABLE store_medicines DROP COLUMN min_stock;
