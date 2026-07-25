CREATE TABLE login_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  consumed_at TIMESTAMPTZ(3),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT login_otps_pkey PRIMARY KEY (id)
);

CREATE INDEX login_otps_user_id_idx ON login_otps(user_id);
CREATE INDEX login_otps_expires_at_idx ON login_otps(expires_at);

ALTER TABLE login_otps
  ADD CONSTRAINT login_otps_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
