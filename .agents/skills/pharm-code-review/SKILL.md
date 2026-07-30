---
name: pharm-code-review
description: Review Pharm App code, diffs, branches, migrations, APIs, frontend flows, or security-sensitive changes for correctness and regression risk. Use when asked to review, audit, inspect, or assess implementation quality, especially authentication, OTP and tokens, store-scoped RBAC, Prisma migrations, inventory, sales, money, React state, route protection, accessibility, or missing tests.
---

# Pharm Code Review

Find concrete correctness, security, data-integrity, and regression risks. Prioritize behavior over style.

## Establish Scope

1. Read `AGENTS.md` and the relevant part of `plan.md`.
2. Inspect the requested diff or changed files.
3. Read enough surrounding route, validation, controller, service, Prisma schema/migrations, frontend consumer, and tests to understand the full contract.
4. Check the working tree so user changes are not mistaken for review fixes.
5. Run focused non-destructive checks when they materially confirm or reject a suspected issue.

Do not modify code during a review unless the user also asks for fixes.

## Review By Risk

Use these priorities:

- **Critical**: likely credential compromise, broad unauthorized access, irreversible corruption, or production-destructive behavior.
- **High**: cross-store data exposure, authentication bypass, negative/incorrect stock, incorrect financial records, unsafe migration, or a core flow that fails.
- **Medium**: meaningful edge-case failure, stale authorization, broken recovery path, inconsistent API/UI contract, accessibility blocker, or missing validation that causes bad state.
- **Low**: smaller maintainability or UX risk with a concrete future failure mode.

Do not report formatting preferences already enforced by tools. Avoid speculative findings without a reachable failure scenario.

## Authentication And Secret Checklist

- Verify tokens are issued only after successful OTP verification.
- Verify access tokens remain in frontend memory and refresh tokens remain in HttpOnly cookies.
- Verify refresh does not rotate the refresh token.
- Verify logout invalidates the persisted current refresh token.
- Verify reset, verification, refresh, and OTP values are hashed at rest and never logged/returned.
- Verify OTPs expire, count failed attempts, are consumed atomically, and cannot be replayed.
- Check cookie Secure/SameSite/domain/path behavior by environment.
- Check recovery and login responses for user enumeration or sensitive detail.
- Check password hashing, validation, invite, and reset flows.
- Check API retry logic for refresh loops and requests that should not be retried.

## Authorization And Tenant-Isolation Checklist

- Distinguish System Admin from store roles.
- Confirm one role per user/store and inheritance `owner > manager > staff`.
- Confirm the actor has the required role in the exact target store.
- Look for `findUnique`, `update`, `delete`, count, aggregate, and relation queries that omit authorized store scope.
- Check list endpoints and reports for cross-store leakage.
- Check Manager cannot create/promote Manager or Owner.
- Check Owner cannot manage another owner's store.
- Check inactive users and stores are rejected.
- Treat frontend route guards and hidden buttons as UX only; require backend enforcement.
- Require tests proving same-store access and cross-store denial.

## Money And Inventory Checklist

- Verify persisted money/quantity uses Decimal and totals do not rely on binary floating point.
- Verify stock and money changes happen in one transaction with their source document.
- Look for read-check-write races that allow overselling.
- Confirm FEFO selects non-expired available batches in deterministic order.
- Confirm draft imports do not affect stock and repeated completion cannot double-increment.
- Confirm sales cannot create partial details/movements or negative stock.
- Confirm completed documents are not hard-deleted or silently edited.
- Reconcile document details, totals, batches, inventory movements, summaries, and audit logs.
- Check cancellation/refund/return behavior uses explicit compensating operations.

## Prisma And Migration Checklist

- Compare `schema.prisma`, generated migration SQL, services, tests, and seed data.
- Flag edits to old applied migrations.
- Check new unique/non-null/foreign-key/enum constraints against existing rows.
- Check destructive column/table changes and missing data backfills.
- Check relation delete/update actions for accidental cascades.
- Check uniqueness and indexes match business and query invariants.
- Ensure generated Prisma files were not manually edited.
- Ensure test reset commands cannot accidentally target dev or production configuration.

## API And Backend Checklist

- Verify Joi validation covers params, query, body, bounds, enums, dates, UUIDs, and unknown fields as intended.
- Keep controllers thin and business authorization in services.
- Check status codes and public error behavior.
- Check raw Prisma records do not expose password/hash/security fields.
- Check pagination, filtering, ordering, N+1 queries, and unbounded responses.
- Check external email failures and transaction boundaries produce an intentional state.
- Check ESM `.js` import specifiers remain valid under NodeNext.
- Check tests assert database state as well as response shape.

## Frontend Checklist

- Check route persistence on refresh and protection during auth hydration.
- Check access tokens are not persisted.
- Check query keys contain store, filters, and pagination inputs.
- Check mutation success invalidates affected queries.
- Check loading, empty, error, retry, success, disabled, and permission states.
- Check forms preserve values on failure and reset only after success.
- Check server validation reaches field errors or a visible Sonner toast.
- Check pending state cannot remain stuck after rejection.
- Check password visibility controls preserve value and have accessible labels.
- Check keyboard focus, dialog behavior, labels, contrast, responsive overflow, and long Vietnamese content.
- Check dense pharmacy workflows remain efficient and are not replaced by decorative layouts.

## Validate Findings

For each potential finding:

1. Identify the exact code path and user/data preconditions.
2. Trace the resulting behavior through callers and persistence.
3. Check whether middleware, service checks, a database constraint, or tests already prevent it.
4. Run a focused test or static check when practical.
5. Drop the finding if the failure is not reachable or material.

## Report

Lead with findings ordered by severity. For each finding include:

- Severity and concise title.
- Clickable file and line reference.
- The reachable failure scenario and impact.
- The smallest safe remediation direction.

Then list open questions or assumptions. End with a brief verification/test-gap note. If no findings remain, say so clearly and name any residual risk or untested area.

Keep summaries secondary. Do not bury findings under a walkthrough of the code.
