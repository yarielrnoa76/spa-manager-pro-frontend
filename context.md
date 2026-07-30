# Context — spa-manager-pro-frontend

## Current feature
Frontend counterpart to the backend grouped-sales feature: `CreateSaleModal`/`SaleModal` must
respect the tenant's `sales_mode` (grouped_sale vs independent_sales) when creating and displaying
sales, plus automatic payment-status refresh and per-line refund allocation.

## Objective and authorized scope
Same user request as the backend (see backend `context.md` for the full spec). Frontend-specific
asks: single request with `items` array in grouped mode (no more one `createSale()` call per cart
item); independent mode unchanged; header/lines/consolidated total rendered in the sale detail
modal; single Payment Link for a grouped sale; polling-based automatic status refresh
(pending/terminal/focus-refetch); visible partial and full refund flow; install Vitest + React
Testing Library (first test setup in this repo) and write the 8 specifically requested test
cases; `npm run test:run`, `npm run build:qa`, `git diff --check` must all pass before delivery.
Commits allowed, **no push** without further explicit authorization.

## Branches
- Active: `feature/unifysales`
- Base: `qa`

## Approved functional/architectural decisions
- Sales list page (`Sales.tsx`) stays structurally unchanged — one row per `daily_logs` line even
  for grouped sales, with only a small "Agrupada" badge added. Only the detail modal
  (`SaleModal.tsx`) was enriched with the full header/lines view — user's explicit choice over
  consolidating the list into one row per group.
- Install Vitest + `@testing-library/react` now rather than skip automated tests — user's
  explicit choice, given no test framework existed in this repo before.
- `CreateSaleModal` only *reads* `sales_mode` (via `api.getTenantProfile()`) to decide which
  payload shape to send; the backend is always the real authority regardless of this value.

## Technical design implemented
- `usePaymentStatusPolling(status, refetch)`: polls every ~5s while `status` is non-terminal,
  refetches on `visibilitychange`/`focus`, stops on any terminal status or after a 10-minute
  ceiling. Pure hook, no direct API knowledge — the webhook remains the sole authoritative writer.
- `CreateSaleModal`: fetches `sales_mode` on open; if `grouped_sale`, sends one
  `api.createSale({...sharedFields, items: cart.map(...)})` call; if `independent_sales` (or
  unknown), keeps the original per-item loop unchanged.
- `SaleModal`: detects a loaded line's `sale_group_id`, fetches the full `SaleGroup` via the new
  `api.getSaleGroup()`, renders a header/line-items/consolidated-total panel above the existing
  single-line detail fields (which are left as-is — they still describe the specific line this
  modal was opened for). `loadPaymentRequest()` now queries by `sale_group_id` when present,
  `sale_id` otherwise (a `PaymentRequest` only ever has one of the two). Refund form gained
  optional per-line checkboxes; when used, the entered total is split evenly across selected
  lines (remainder on the last one) into a `lines: [{daily_log_id, amount}]` payload — the
  backend independently validates the sum.
- `Sales.tsx`: added a small "Agrupada" badge next to the service name when `sale.sale_group_id`
  is set — no other change to the list/table.

## Files created/modified
- `src/hooks/usePaymentStatusPolling.ts` (new) — polling/focus-refetch hook.
- `src/components/CreateSaleModal.tsx` — `salesMode` state + `getTenantProfile()` fetch;
  `handleCreateSale` branches grouped vs independent submission.
- `src/components/SaleModal.tsx` — `saleGroup` state/effect, `loadPaymentRequest` branch,
  `handleGeneratePaymentRequest` payload branch, `usePaymentStatusPolling` wiring, refund
  line-selection UI + payload, grouped header/lines render block.
- `src/pages/Sales.tsx` — "Agrupada" badge in the service-name cell.
- `src/services/api.ts` — `createSale()` typed response (`DailyLog |
  CreateSaleGroupResponse | CreateSaleBatchResponse`); new `getSaleGroup()`/`cancelSaleGroup()`.
- `src/types.ts` — `DailyLog` gained `quantity`, `unit_price`, `sale_group_id`,
  `discount_amount`, `tax_amount`.
- `src/types/payments.ts` — `PaymentRequest`/`PaymentTransaction.sale_id` now `number | null` +
  `sale_group_id`; new `SaleGroup`, `SaleGroupLine`, `PaymentRefundLine`,
  `CreateSaleGroupResponse`, `CreateSaleBatchResponse`, `SaleCartItem` types.
- `vitest.config.ts` (new) — jsdom environment, `src/test/setup.ts`, v8 coverage. Deliberately
  separate from `vite.config.ts` (production build config untouched).
- `src/test/setup.ts` (new) — `@testing-library/jest-dom/vitest` import (works without
  `globals: true`) + explicit `afterEach(cleanup)` registration (required since `globals` is off).
- `tsconfig.json` — added `exclude` for `src/test`/`*.test.ts(x)` so `tsc -b` (used by
  `build`/`build:qa`) never type-checks test files. Note: this project's root `tsconfig.json` has
  no `references` array, so `tsc -b` actually builds directly off the root config, not
  `tsconfig.app.json` — the exclude had to go on the root file to take effect (tried
  `tsconfig.app.json` first, confirmed via `--listFilesOnly` that it had no effect there).
- `package.json` — added `test`/`test:run`/`test:coverage` scripts;
  devDependencies: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`, `@testing-library/user-event`.
- `src/hooks/__tests__/usePaymentStatusPolling.test.tsx` (new, 4 tests).
- `src/components/__tests__/CreateSaleModal.test.tsx` (new, 2 tests).
- `src/components/__tests__/SaleModal.grouped.test.tsx` (new, 2 tests).
- `src/components/__tests__/SaleModal.refund.test.tsx` (new, 2 tests).
- `src/components/SaleModal.tsx` (lint cleanup, 2026-07-30) — `loadPaymentRequest` re-signatured
  from `(currentSale: any)` to `(saleId: string, saleGroupId?: number | null)`, its 3 call sites
  updated to pass the two primitive fields instead of the whole `sale` object. This incidentally
  fixed a real `react-hooks/exhaustive-deps` warning this feature had introduced (the effect at
  ~line 336 referenced the whole `sale` object without listing it as a dependency) — not just the
  lint error, an actual staleness risk if `sale`'s other fields changed without id/provider/
  sale_group_id changing.
- `src/components/__tests__/CreateSaleModal.test.tsx`,
  `src/components/__tests__/SaleModal.grouped.test.tsx`,
  `src/components/__tests__/SaleModal.refund.test.tsx` (lint cleanup, 2026-07-30) — all 12
  `no-explicit-any` usages replaced with real types (`Tenant`, `TenantSalesMode`,
  `CreateSaleGroupResponse`, `PaymentRequest`, `PaymentTransaction`, or a small local `SalePayload`
  interface for values whose real type is `unknown`), using `as unknown as X` only where a fixture
  deliberately omits fields the test doesn't assert on — never a bare `as any`.

## API contracts and payloads
Consumes the backend contracts documented in the backend `context.md` (`POST /api/sales` with
optional `items`, `POST /api/payment-requests` with `sale_id` XOR `sale_group_id`, `POST
/api/payment-refunds` with optional `lines`, `GET/POST /api/sale-groups/{id}(/cancel)`).

## Historical compatibility
`independent_sales` submission path is untouched code (same loop, same per-item payload shape).
The legacy single-item `POST /api/sales` response shape is read identically to before — grouped
handling is purely additive branching in the modal components.

## External integrations affected
None directly (Stripe interaction is entirely backend-side); the frontend only reflects
`PaymentRequest`/`PaymentTransaction` state already computed by the backend.

## Tests executed
- Command: `npm run test:run` (after the lint cleanup) → Result: **4 test files passed, 10 tests
  passed**, 0 failures — same coverage as before, no behavior change.
- Command: `npm run build:qa` (`tsc -b && vite build --mode qa`) → Result: succeeded (one
  pre-existing, unrelated chunk-size warning from Rollup, not an error).
- Command: `npm run lint` → Result: **398 problems (380 errors, 18 warnings)** — back to the exact
  pre-feature baseline. Root cause of the prior +14 delta and its fix are recorded below.
- Command: `git diff --check` → clean (exit 0).

## Problems found and solutions applied
- `@testing-library/jest-dom`'s default import auto-extends a global `expect`, which doesn't
  exist since `vitest.config.ts` doesn't set `globals: true` — fixed by importing
  `@testing-library/jest-dom/vitest` instead (extends Vitest's own imported `expect`).
- Without `globals: true`, `@testing-library/react`'s automatic `afterEach(cleanup)` never
  registers (it only self-registers when it detects a global `afterEach`) — DOM from one test
  leaked into the next, causing "found multiple elements" failures. Fixed by explicitly
  registering `afterEach(() => cleanup())` in `src/test/setup.ts`.
- A test asserting sequential partial refunds mocked `$this->mock()`-equivalent
  (`vi.mocked(api.createSale).mockResolvedValue(...)`) without `vi.clearAllMocks()` in
  `beforeEach`, so call counts leaked across tests in the same file — fixed by adding
  `vi.clearAllMocks()` at the top of `beforeEach`.
- `usePaymentStatusPolling` originally wrote `refetchRef.current = refetch` directly in the
  render body — ESLint's React Compiler rule flagged "Cannot access refs during render." Fixed by
  moving the assignment into a bare `useEffect(() => { refetchRef.current = refetch; })` (no
  dependency array, runs after every render).
- Two labels/inputs in `SaleModal.tsx`/`CreateSaleModal.tsx` aren't associated via
  `htmlFor`/`id`, so `getByLabelText` doesn't work in tests — worked around in tests with a
  `label.parentElement.querySelector('input'|'select')` helper rather than changing the
  component markup (out of scope for this task).
- 2026-07-30 lint cleanup — root cause of the +14 delta: 12 `no-explicit-any` in the 3 new test
  files (loosely-typed API mocks/payload casts) plus 1 in production code
  (`SaleModal.tsx`'s `loadPaymentRequest(currentSale: any)`) plus 1 `react-hooks/exhaustive-deps`
  warning that same production change had introduced (see Files above). Fixed by typing every mock
  against its real API return type (`Tenant`, `PaymentRequest`, `PaymentTransaction`,
  `CreateSaleGroupResponse`) or a small local interface, and by re-signaturing
  `loadPaymentRequest` to take primitive fields instead of the whole `sale` object — both the type
  error and the dependency-array warning trace back to that one signature. `npm run lint` now
  matches the pre-feature baseline exactly (398 problems).

## Discarded decisions and why
- Consolidating the Sales list into one row per grouped sale: rejected by explicit user choice —
  kept the existing one-row-per-line list, enriched only the detail modal.
- A dedicated per-line amount editor for refund allocation: rejected as over-scoped for what was
  asked — an even split of the entered total across selected lines was used instead, still
  validated server-side.

## Completed
- All frontend component/hook/type/api changes for grouped-sale creation, display, checkout-link
  generation, polling, and refund line-selection — verified via the 10 passing tests and a
  successful `build:qa`.
- Vitest + RTL installed and configured (first test setup in this repo).
- Committed: `020cf8a` "feat(sales): implement grouped sales controlled by tenant sales_mode".
- 2026-07-30: lint delta fully resolved — `npm run lint` back to the exact 398-problem baseline,
  `npm run test:run` still 10/10, `npm run build:qa` still succeeds, `git diff --check` clean.

## Pending (priority order)
1. Nothing outstanding in this repo for the grouped-sales feature itself — awaiting explicit
   authorization to push `feature/unifysales` and/or merge into `qa` (not yet requested).
2. Optional, not requested: associating form labels with their inputs via `htmlFor`/`id` (would
   simplify future tests but touches component markup beyond this task's scope).

## Open risks or unresolved questions
- None specific to this feature.

## Pending review — remaining items (reverified 2026-07-30, informational only)
1. **Lint delta**: resolved this session — see Tests executed and Problems found above. No longer
   pending.
2. The `POST /api/sales` discriminated response this UI consumes (`DailyLog` | `{type:'batch',...}`
   | `{type:'group',...}`) was reverified directly against
   `backend/app/Http/Controllers/Api/SalesController.php` — matches what
   `CreateSaleModal.tsx`/`SaleModal.tsx` expect, no drift found. See backend `context.md`.
3. Per-line accumulated-refund-balance validation is backend-only, and is now backed by real
   validation (no longer advisory-only) — see backend `context.md`'s "Per-line refund balance
   guard" section. No client-side equivalent exists or is needed: the existing generic
   `getPaymentErrorMessage()` in `SaleModal.tsx` already surfaces the backend's 422 message
   verbatim without any frontend change.
4. This `context.md` contains no passwords, API keys, tokens, or other secrets. `.claude/
   settings.json` in this repo was not modified this session (only the backend repo's copy has a
   pending, unrelated local change) — not referenced here.

## Last commit
Prior: `020cf8a6808974c607d9fbe8063bd2a18e8bf26f` — "feat(sales): implement grouped sales
controlled by tenant sales_mode". This session's lint-debt cleanup (`SaleModal.tsx`'s
`loadPaymentRequest` re-signature + the 3 test files' `any` removal, plus this file) is committed
as a new commit on top of it in the same request — run `git log -1` for its exact hash rather than
trusting a hash written before the commit existed.

## Working tree state
Clean (the only other change this session, `tsconfig.tsbuildinfo`, is a routine build artifact
already tracked by this repo's existing convention — included in the same commit). Nothing
pushed; `qa`/`main` untouched.

## Exact recommended next step
No code work is pending here. If asked to proceed, the next action would be to confirm with the
user whether to push `feature/unifysales` (frontend) — do not push without that explicit
authorization.
