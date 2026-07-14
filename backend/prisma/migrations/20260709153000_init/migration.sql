CREATE TYPE "Role" AS ENUM ('admin', 'user');
CREATE TYPE "TokenType" AS ENUM ('refresh', 'resetPassword', 'verifyEmail');

CREATE TABLE "Users" (
  "id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "password" VARCHAR(128) NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'user',
  "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tokens" (
  "id" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "type" "TokenType" NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,
  "blacklisted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");
CREATE INDEX "Tokens_userId_idx" ON "Tokens"("userId");
CREATE INDEX "Tokens_token_type_userId_blacklisted_idx" ON "Tokens"("token", "type", "userId", "blacklisted");

ALTER TABLE "Tokens"
  ADD CONSTRAINT "Tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "Users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
