---
name: pharm-ui
description: Build, modify, or debug professional Pharm App frontend experiences using React, TypeScript, TanStack Router and Query, React Hook Form, Zod, Zustand, Tailwind CSS, Radix UI, Lucide, and Sonner. Use for pharmacy pages, dashboards, tables, forms, navigation, route protection, responsive layouts, accessibility, loading and error states, or visual UI verification in frontend/.
---

# Pharm UI

Build operational pharmacy interfaces that are fast to scan, predictable, accessible, and comfortable for repeated daily use.

## Gather Context

1. Read `AGENTS.md`.
2. Read the relevant MVP section in `plan.md`.
3. Inspect the target route, feature, adjacent components, feature service, validation schema, and shared primitives before editing.
4. Inspect `frontend/src/index.css` before adding colors, radii, typography, or shadows.
5. Confirm the API contract from frontend types and the backend endpoint when the UI depends on new or uncertain data.

Do not redesign unrelated screens or introduce a new design language inside one feature.

## Choose The Structure

- Place domain UI in `frontend/src/features/<feature>`.
- Place reusable low-level controls in `frontend/src/components/ui`.
- Keep API calls in a feature service or `frontend/src/services/api.ts`.
- Use TanStack Query for remote data, caching, mutations, and invalidation.
- Use Zustand only for small client/session state. Keep access tokens in memory only.
- Use React Hook Form and Zod for forms with validation or multiple fields.
- Add a dedicated TanStack Router route for each MVP module. Preserve the current page on refresh and support direct navigation.
- Treat frontend permission checks as presentation controls; backend authorization remains mandatory.

Prefer small, named feature components over a single page containing navigation, forms, dialogs, tables, and request logic together. Extract only when the component has a coherent responsibility or meaningful reuse.

## Design Operational Screens

- Favor compact page headers, clear toolbars, searchable tables, filters, forms, and detail panels.
- Keep the product work-focused. Avoid marketing heroes, oversized headings, decorative blobs, excessive gradients, and card-heavy page composition.
- Do not nest cards. Use unframed sections or full-width bands for page structure and cards only for genuinely grouped/repeated items.
- Keep card radius at 8px or less unless an existing primitive requires otherwise.
- Use semantic theme tokens from `index.css`; do not add a parallel palette.
- Preserve the current navy, teal, mint, sky, amber, and semantic status roles without making every surface one hue.
- Use Lucide icons for known actions. Prefer icons for icon-standard actions such as close, show password, edit, delete, search, refresh, and navigation.
- Give icon-only buttons an accessible name and a tooltip when the meaning is not obvious.
- Keep text sizes appropriate to dense admin surfaces. Do not use hero typography inside cards, dialogs, sidebars, or tables.
- Define stable dimensions for toolbars, icon buttons, table actions, counters, and fixed-format controls to avoid layout shift.

## Build Complete States

For every server-backed view, account for:

- Initial loading.
- Background refreshing.
- Empty data.
- Recoverable error with a retry path.
- Success feedback.
- Permission denied.
- Disabled or inactive records.

Do not replace existing content with a full-page spinner during background refetching. Keep destructive actions visually distinct and require confirmation when accidental activation has meaningful impact.

## Build Forms

- Define one Zod schema for client-side constraints and infer the form type from it.
- Keep validation messages in Vietnamese and actionable.
- Use the API as the final validator; map useful server errors to a field when possible and show a Sonner toast for request-level failures.
- Disable only controls that would cause duplicate or conflicting submissions while a mutation is pending.
- Preserve values after validation or server failure.
- Reset fields and close dialogs only in the successful mutation callback.
- Focus the first invalid field or the main field when a dialog/step opens.
- Keep password values out of logs and persisted state.
- Add an eye control to password inputs with `type="button"`, an accessible label, and unchanged form value.
- Use `inputMode`, `autoComplete`, min/max, and semantic input types where they improve mobile and browser behavior.

For multi-step auth flows, preserve the minimal challenge state required by the next step. Do not issue or persist auth tokens before the server confirms the final step.

## Handle Data And Routing

- Use stable query keys that include `storeId`, filters, pagination, and other data-shaping inputs.
- Invalidate only the affected queries after mutations.
- Debounce server-backed search when appropriate; do not debounce local filtering.
- Keep URL state for navigable filters or views that users reasonably expect to survive refresh/share.
- Use route params for resource identity and separate routes for modules.
- Prevent authenticated users from returning to login and unauthenticated users from rendering protected content while auth hydration is unresolved.
- Render navigation based on the active store role, but handle backend `401` and `403` responses explicitly.

## Meet Accessibility And Responsive Requirements

- Use semantic HTML before adding ARIA.
- Associate every input with a visible label or an accessible name.
- Preserve visible keyboard focus and logical tab order.
- Make dialogs focus-contained and restorable through Radix primitives.
- Ensure status is not communicated by color alone.
- Provide adequate contrast for text, borders, focus rings, and disabled states.
- Make tables usable on narrow screens through deliberate horizontal scrolling, responsive columns, or an alternate list layout.
- Test at approximately 360px, 768px, and 1440px widths.
- Check that Vietnamese labels, long emails, medicine names, validation messages, and prices do not overlap or overflow.

## Verify

1. Run `npm run lint` in `frontend/`.
2. Run `npm run build` in `frontend/`.
3. Open the affected route and exercise success, validation error, server error, empty, and permission states.
4. Use Playwright when available to verify desktop and mobile screenshots, console errors, route persistence after refresh, and key interactions.
5. Report checks that ran and any states that could not be exercised.

Finish only when the screen is functional, visually coherent with the application, keyboard usable, responsive, and honest about request state.
