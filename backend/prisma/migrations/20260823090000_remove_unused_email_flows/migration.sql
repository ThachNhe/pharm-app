DELETE FROM tokens
WHERE type IN ('resetPassword', 'verifyEmail');

ALTER TYPE token_type RENAME TO token_type_old;
CREATE TYPE token_type AS ENUM ('refresh');
ALTER TABLE tokens
  ALTER COLUMN type TYPE token_type
  USING type::text::token_type;
DROP TYPE token_type_old;

ALTER TABLE users DROP COLUMN is_email_verified;
