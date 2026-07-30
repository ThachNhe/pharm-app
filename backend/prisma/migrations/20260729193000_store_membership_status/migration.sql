ALTER TABLE user_store_roles
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX user_store_roles_store_id_is_active_idx
  ON user_store_roles(store_id, is_active);
