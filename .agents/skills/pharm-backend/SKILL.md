---
name: pharm-backend
description: Design, implement, migrate, test, or debug Pharm App backend behavior using TypeScript ESM, Express, Joi, Prisma, PostgreSQL, Passport JWT, Vitest, and Supertest. Use for APIs, services, authentication, OTP and tokens, store-scoped RBAC, Prisma schema or migrations, imports, sales, inventory, money calculations, audit logs, email flows, or backend tests in backend/.
---

# Pharm Backend

Implement backend behavior with store isolation, explicit authorization, transactional integrity, and testable service boundaries.

## Gather Context

1. Read `AGENTS.md`.
2. Read the relevant business flow and MVP boundary in `plan.md`.
3. Inspect the Prisma models and all migrations touching the relevant tables.
4. Trace the existing route, validation, controller, service, middleware, and tests before changing behavior.
5. Confirm whether the development database already contains data before proposing a constraint or destructive migration.

Keep established TypeScript ESM imports ending in `.js`. Do not edit generated Prisma client files.

## Follow The Request Boundary

Implement the normal path as:

```text
route -> validate -> authenticate/authorize -> controller -> service -> Prisma
```

- Define params, query, and body constraints in Joi.
- Compose middleware in the route.
- Keep controllers limited to HTTP concerns: extracting validated input, invoking services, setting cookies, selecting status codes, and sending public response data.
- Put business rules, store scope, transactions, and narrow action authorization in services.
- Throw `ApiError` for expected client, authentication, authorization, conflict, and not-found failures.
- Wrap controllers with `catchAsync`.
- Return explicit public DTO-shaped objects. Never serialize raw user/token/OTP records by accident.

Do not add a repository abstraction over Prisma unless repeated domain behavior genuinely needs it.

## Enforce Authentication And Secret Handling

- Require email/password and then a valid OTP challenge before issuing tokens.
- Identify OTP verification by an opaque `challengeId` plus the submitted code.
- Expire OTPs, limit attempts, consume them atomically, and reject reuse.
- Generate refresh tokens only after full login.
- Keep refresh tokens in HttpOnly cookies and access tokens in response memory state.
- Refresh only the access token at `/refresh-tokens`; do not rotate the refresh token there.
- Hash persisted refresh/reset/verification tokens with a keyed cryptographic hash suitable for high-entropy tokens.
- Hash passwords with the project's password hasher; never use fast hashes for passwords.
- Avoid user enumeration in authentication and recovery responses.
- Remove secret values from errors, logs, audit metadata, and API responses.
- Invalidate the current refresh token on logout and clear the cookie.

## Enforce Store-Scoped RBAC

Apply both platform-level and store-level checks:

- Treat `isSystemAdmin` as platform authority.
- Load the actor's role for the target `storeId`.
- Reject inactive users, inactive stores, missing membership, and insufficient role.
- Apply role inheritance as `owner > manager > staff`.
- Allow Owner to manage Manager and Staff only in an owned store.
- Allow Manager to manage Staff only in a managed store.
- Never authorize using an arbitrary role from another store.
- Scope every relation, count, aggregate, list, update, and delete to authorized store IDs.
- Re-check narrow actions in the service even when route middleware restricts general module access.

Use one role row per `userId + storeId`. Changing a role updates that row. Before adding `@@unique([userId, storeId])`, detect and resolve duplicate production/development rows deliberately.

Test same-store success, insufficient role, and cross-store denial for every protected workflow.

## Protect Money And Inventory

Represent persisted prices, costs, totals, and quantities with Prisma/PostgreSQL `Decimal`.

For import completion:

1. Validate the draft and all details.
2. Verify actor and store scope.
3. In one transaction, transition the receipt, create/update batches, create inventory movements, and persist totals.
4. Make repeated completion safe by rejecting an already completed/cancelled receipt.

For sales:

1. Validate the cart, prices, quantities, payment method, actor, and store.
2. Select only non-expired batches with available quantity in FEFO order.
3. In one transaction, create the sale/details, deduct batches atomically, create movements, and persist totals.
4. Reject insufficient stock without leaving partial writes.
5. Prevent concurrent requests from producing negative inventory; avoid read-then-write checks outside the transaction.

Do not hard-delete completed documents. Model cancellation, refund, return, and later adjustments as explicit status transitions and compensating records. Write audit entries for sensitive state transitions without exposing secrets.

## Change Prisma Safely

1. Edit `backend/prisma/schema.prisma`.
2. Determine how existing rows will satisfy new unique, relation, enum, or non-null constraints.
3. Create a new named development migration.
4. Inspect its SQL.
5. Generate Prisma Client.
6. Update seed data and code using the changed shape.
7. Add tests for the new invariant.
8. Apply with `prisma migrate deploy` outside development.

Never rewrite an applied migration. Do not use `db push --force-reset` on development or production data. Treat Prisma's generated client directory as read-only.

## Design APIs And Queries

- Use resource-oriented endpoints and appropriate HTTP status codes.
- Validate pagination bounds, filters, dates, enums, UUIDs, and sort choices.
- Include `storeId` in data-shaping inputs where store context is not securely derived elsewhere.
- Return paginated metadata consistently with existing helpers.
- Use select/include intentionally; avoid returning large relations or security fields.
- Prevent N+1 queries and unbounded lists.
- Add indexes only for demonstrated relation, filter, uniqueness, and ordering paths.
- Normalize empty optional input consistently before persistence.
- Keep error messages useful without leaking whether protected records exist outside the actor's scope.

## Test Behavior

Use Vitest and Supertest with the existing test database setup.

Cover:

- Valid requests and persisted outcomes.
- Joi-invalid requests.
- Missing/invalid authentication.
- Each role boundary.
- Cross-store access.
- Inactive user/store behavior.
- Duplicate and idempotency-sensitive requests.
- Transaction rollback when a middle step fails.
- Decimal totals and inventory movement consistency.
- FEFO, expired batches, insufficient stock, and concurrency-sensitive deductions.
- Token, OTP, reset, and refresh lifecycle rules.
- Public responses not containing hashes or raw secrets.

Mock external email transport, not the business service under test. Assert both the HTTP response and resulting database state.

## Verify

Run from `backend/`:

```bash
npm run lint
npm run prettier
npm run build
```

Run `npm test` only with the test database because the script performs a forced reset. Prefer the Docker test compose stack when environment separation is uncertain.

Inspect migration status and SQL when schema changes are involved. Report all checks that ran and any database-dependent checks that could not run.
