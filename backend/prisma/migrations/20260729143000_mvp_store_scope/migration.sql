-- Keep the highest role when historical data contains more than one role
-- for the same user and store.
WITH ranked_roles AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, store_id
      ORDER BY
        CASE role
          WHEN 'owner' THEN 3
          WHEN 'manager' THEN 2
          ELSE 1
        END DESC,
        created_at ASC,
        id ASC
    ) AS role_rank
  FROM user_store_roles
)
DELETE FROM user_store_roles
WHERE id IN (
  SELECT id
  FROM ranked_roles
  WHERE role_rank > 1
);

DROP INDEX IF EXISTS user_store_roles_user_id_store_id_role_key;
CREATE UNIQUE INDEX user_store_roles_user_id_store_id_key
  ON user_store_roles(user_id, store_id);

ALTER TABLE suppliers
  ADD COLUMN store_id UUID;

UPDATE suppliers AS supplier
SET store_id = source.store_id
FROM (
  SELECT DISTINCT ON (supplier_id)
    supplier_id,
    store_id
  FROM import_receipts
  WHERE supplier_id IS NOT NULL
  ORDER BY supplier_id, created_at ASC
) AS source
WHERE supplier.id = source.supplier_id;

UPDATE suppliers
SET store_id = (
  SELECT id
  FROM stores
  ORDER BY created_at ASC, id ASC
  LIMIT 1
)
WHERE store_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM suppliers WHERE store_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot assign existing suppliers because no store exists';
  END IF;
END
$$;

ALTER TABLE suppliers
  ALTER COLUMN store_id SET NOT NULL,
  ADD CONSTRAINT suppliers_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS suppliers_code_key;
DROP INDEX IF EXISTS suppliers_name_idx;
CREATE UNIQUE INDEX suppliers_store_id_code_key ON suppliers(store_id, code);
CREATE INDEX suppliers_store_id_name_idx ON suppliers(store_id, name);

ALTER TABLE import_receipts
  ALTER COLUMN status SET DEFAULT 'draft';
