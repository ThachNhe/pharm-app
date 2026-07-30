# Pharm App Repository Guide

## Product Scope

Build the pharmacy-management MVP defined in `plan.md`. Keep the current work focused on authentication, store-scoped RBAC, medicines, suppliers, imports, sales, inventory, and basic reports. Do not add post-MVP modules unless the user explicitly requests them.

Treat these files as the main sources of truth:

- `plan.md` for product scope and business decisions.
- `backend/prisma/schema.prisma` and migrations for persisted data.
- Existing code and tests for current behavior.

When these sources disagree, call out the mismatch before making a broad or destructive change.

## Repository Map

- `frontend/`: React 19, TypeScript, Vite, TanStack Router, TanStack Query, React Hook Form, Zod, Zustand, Tailwind CSS 4, Radix UI, Lucide, and Sonner.
- `backend/`: Node.js, Express, TypeScript ESM, Prisma/PostgreSQL, Joi, Passport JWT, Vitest, and Supertest.
- `backend/prisma/`: Prisma schema, migrations, and seed data.
- `backend/tests/`: integration and unit tests.
- `docker-compose*.yml`: development, test, and production-oriented services.
- `env/`: environment-specific configuration. Never expose secrets in logs or committed files.

## Working Rules

- Inspect the surrounding implementation before editing and follow established patterns unless they are the source of the bug.
- Keep changes scoped to the requested behavior. Do not combine feature work with unrelated refactors.
- Preserve user changes and dirty-worktree content.
- Use TypeScript for all new frontend and backend source files.
- Avoid `any`, unchecked casts, non-null assertions, and duplicated domain types unless there is no practical typed alternative.
- Do not add a production dependency when the existing stack or platform API already solves the problem.
- Keep generated files generated. Do not manually edit `frontend/src/routeTree.gen.ts` or `backend/src/generated/prisma`.
- Keep comments short and use them only for non-obvious business rules or concurrency decisions.

## Backend Architecture

Follow this request path:

```text
route -> validation middleware -> controller -> service -> Prisma
```

- Routes compose middleware and map endpoints.
- Joi schemas validate params, query, and body before controllers run.
- Controllers handle HTTP input/output and cookies; keep business decisions out of controllers.
- Services enforce authorization, store scope, business rules, transactions, and persistence.
- Throw `ApiError` with an appropriate HTTP status for expected failures.
- Wrap async controllers with `catchAsync`.
- Keep ESM relative imports ending in `.js`, even when the source file is `.ts`; NodeNext resolves these to compiled JavaScript.
- Never return password hashes, token hashes, OTP hashes, or internal security fields.

## Authentication And Token Rules

- Login requires email/password followed by a valid email OTP challenge.
- Issue auth tokens only after OTP verification succeeds.
- Store the access token only in frontend memory.
- Store the refresh token in a Secure, HttpOnly, SameSite cookie as configured for the environment.
- Do not store either token in `localStorage` or `sessionStorage`.
- `/refresh-tokens` issues a new access token only. Do not rotate or replace the refresh token there.
- Issue a new refresh token only after a complete successful login.
- Hash persisted refresh, reset-password, verification, and OTP secrets. Never persist raw secret values.
- Make reset and OTP challenges expiring, attempt-limited where applicable, and single-use.
- Logout must invalidate the current persisted refresh token and clear its cookie.

## Store-Scoped RBAC

- A user may belong to multiple stores.
- A user has exactly one store role per store.
- Store role inheritance is `owner > manager > staff`.
- `isSystemAdmin` is a platform-level capability, separate from store roles.
- System Admin manages stores and initial owners.
- Owner may manage Manager and Staff accounts only in owned stores.
- Manager may manage Staff accounts only in managed stores.
- Staff may perform allowed operational work but may not access administrative management.
- UI checks improve navigation only. Every protected action must be authorized again in the backend service.
- Every store-owned query and mutation must be constrained by the authorized `storeId`.
- Never trust a client-provided `storeId` without verifying the actor's membership and required role.
- Add tests that prove cross-store access is denied.

The target database invariant is one `UserStoreRole` per `userId + storeId`. When implementing it, use `@@unique([userId, storeId])` and update an existing role instead of creating another role row.

## Prisma And Data Integrity

- Change `schema.prisma` and create a new migration for schema changes.
- Never edit, delete, rename, or reorder an applied migration.
- Inspect generated SQL before applying a migration that changes a constraint, relation, enum, nullable column, or data type.
- Plan a data migration before adding a unique or non-null constraint to populated data.
- Use `Decimal` for money and inventory quantities; do not use JavaScript floating-point arithmetic for persisted totals.
- Use a database transaction for every workflow that changes money, stock, and its source document.
- Do not perform stock validation in one transaction and stock deduction in another.
- Prevent negative stock under concurrent requests through transactional, atomic database operations.
- Use FEFO for sales: consume non-expired batches ordered by the nearest expiry date.
- A draft import does not affect stock. Completing it creates stock batches/movements atomically.
- A completed sale creates the sale, details, stock deductions, movements, and totals atomically.
- Do not hard-delete completed financial or inventory documents. Use status transitions and compensating records.
- Record important create, complete, cancel, refund, role, and inventory actions in audit logs.
- Add indexes for real filter, relation, and ordering paths; avoid speculative indexes.

## Frontend Architecture And UX

- Keep feature code under `frontend/src/features/<feature>`.
- Put reusable primitives under `frontend/src/components/ui`.
- Use TanStack Query for server state and mutation invalidation.
- Use Zustand only for small client/session state, including the in-memory access token.
- Use React Hook Form with Zod for non-trivial forms.
- Keep API calls in feature services or the shared API client, not directly in presentation components.
- Use separate TanStack Router routes for modules such as `/admin/medicines`; do not add new modules as query-string tabs on one page.
- Protect routes by authentication and role, while still relying on backend authorization.
- Reuse theme tokens from `frontend/src/index.css` and existing UI primitives.
- Use Lucide icons for recognizable actions and provide accessible names/tooltips for icon-only controls.
- Always implement loading, error, empty, success, disabled, and permission-denied states where relevant.
- Show field-level validation errors and a Sonner toast for server outcomes that need user attention.
- Keep submitted form values on failure. Reset or close a form only after the server confirms success.
- Password fields must support show/hide without changing their value or validation state.
- Ensure keyboard access, visible focus, associated labels, and meaningful accessible names.
- Verify layouts at narrow mobile, tablet, and desktop widths. Do not allow text, tables, dialogs, or controls to overlap or overflow.

## Verification

Run checks proportional to the change. From each package directory:

```bash
# frontend/
npm run lint
npm run build

# backend/
npm run lint
npm run prettier
npm run build
```

Backend tests reset the configured test database:

```bash
# backend/, only with the test environment/database
npm test
```

Prefer the Docker test stack when local PostgreSQL/test configuration is uncertain:

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml up --build --abort-on-container-exit
```

- Never point a reset/push test command at development or production data.
- Add or update focused Vitest/Supertest tests for backend behavior changes.
- For UI changes, verify the actual route in a browser and use Playwright when available.
- Before finishing, report which checks ran and which could not run.

## Skill Routing

- Use `$pharm-ui` for frontend pages, components, forms, responsive behavior, accessibility, and visual verification.
- Use `$pharm-backend` for API, authentication, RBAC, Prisma, migrations, inventory, money, and backend tests.
- Use `$pharm-code-review` when reviewing a diff, branch, implementation, or security-sensitive workflow.
