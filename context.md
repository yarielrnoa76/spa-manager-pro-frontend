# Context — spa-manager-pro-frontend

## Current feature
Fix the visual/indicator layer so a grouped sale is represented and counted as **one** sale
operation everywhere, never as N (one per product/line). Backend counterpart: see backend
`context.md` — `SaleOperationsMetricsService` now centralizes `cantidad_de_ventas =
count(sale_groups) + count(daily_logs sin sale_group_id)`. This session's frontend work consumes
that fixed backend, plus applies the equivalent dedup logic to Dashboard.tsx's own client-side
chart aggregations (a full backend re-architecture of those was judged out of scope).

## Objective and authorized scope
Same user request as the backend (see backend `context.md`). Frontend-specific asks: the Sales
list must render a `SaleGroup` as one row (id, date, client, product count, consolidated total,
consolidated status, group-level actions) with an expandable secondary view of its lines — never
duplicating the total/status/Payment-Link/actions per line; independent/historical `daily_logs`
rows keep their exact historical single-row presentation; Dashboard's "Cant. Ventas" and any other
chart that represents "ventas" (not products/lines) must apply the same counting rule; use
discriminated TypeScript types (`type` property), no `any`. Mandatory:
`test:run`/`build:qa`/`lint`/`git diff --check`, lint must not exceed the 398-problem baseline
(reintroducing zero new debt). Commits allowed, **no push** without further explicit
authorization. Branch: `feature/grouped-sales-presentation` (created off `qa` at `aa98a92`, the
just-merged/pushed grouped-sales + lint-cleanup work — see below).

## Branches
- Active: `feature/grouped-sales-presentation`
- Base: `qa` (at `aa98a92a71b5e4fa2e06d0613c575463bfc91b75` when this branch was cut)

## Previously shipped (merged into `qa` and pushed — not part of this session's diff)
Two prior features are now fully in `qa`/`origin/qa`:
1. **Grouped sales** (`feature/unifysales`, commit `020cf8a`): `CreateSaleModal`/`SaleModal`
   respect `sales_mode`, render a grouped sale's header/lines/consolidated total in the detail
   modal, single Payment Link, polling-based status refresh, per-line refund selection UI. First
   Vitest+RTL setup in this repo.
2. **Lint-debt cleanup** (commit `9744fcf`): removed 12 `no-explicit-any` in the 3 new test files
   plus 1 in `SaleModal.tsx`'s `loadPaymentRequest`, which also fixed a real
   `react-hooks/exhaustive-deps` staleness risk. `npm run lint` returned to the exact 398-problem
   baseline. Both merged into `qa` at `aa98a92` and pushed to `origin/qa`.
   At that point, **`Sales.tsx` still rendered one row per `daily_logs` line** (a grouped sale's N
   lines appeared as N separate rows, each tagged with a small "Agrupada" badge) — this was an
   explicit, deliberate choice at the time ("consolidar la lista fue rechazado"). This session's
   task explicitly reverses that decision — see below.

## Approved functional/architectural decisions (this session)
- The Sales list's row unit changes from "one `daily_logs` line" to "one sale operation" — the
  prior session's "keep the list unchanged" decision is superseded by this session's explicit,
  different instruction (not a contradiction — different requests, both honored at the time).
- `SaleModal` is reused unmodified for a group row's "view details" action: it already detects
  `sale.sale_group_id` from whichever `DailyLog` id it's opened with and fetches the full
  `SaleGroup` itself. A group row just passes one of its own lines' ids (`item.lines[0].id`)
  instead of needing a new "open by group id" code path.
- Dashboard.tsx's month/day/seller/product-bucketed chart aggregations (a large, pre-existing,
  fully client-side computation over one big `api.listSales()` fetch) are **not** re-architected
  into new backend endpoints — that was judged a "massive refactor" beyond this fix's scope.
  Instead, two small, centralized client-side helpers (`toOperations()`/`flattenToLines()`) derive
  correct "count of sales" vs. "count of products/lines" views from the same already-fetched,
  backend-authoritative `SalesListItem[]` (each item's `type`/`sale_group_id` are backend facts,
  not inferred) — every chart on that page reads from one of those two, never a third formula.

## Technical design implemented
- **`src/types/payments.ts`**: new discriminated union `SalesListItem = SalesListGroupItem |
  SalesListIndependentItem` (`type: 'group' | 'independent'`). `SalesListGroupItem extends
  SaleGroup` (+ `sale_group_id`, `lines_count`); `SalesListIndependentItem extends DailyLog`.
  `SaleGroup` gained `seller_name?`/`deleted_at?` (mirroring what the backend now actually
  returns); `SaleGroupLine` gained `professional?` (needed to render a line's professional name in
  the expanded view).
- **`src/services/api.ts`**: `listSales()`'s `data` field retyped from `DailyLog[]` to
  `SalesListItem[]` (matches the backend's new response shape exactly).
- **`src/pages/Sales.tsx`**: `sales` state retyped to `SalesListItem[]`; new `isGroupItem()` type
  guard; new `expandedGroupIds` state + `toggleGroupExpanded()`. The table row map now branches on
  `item.type`: an independent item renders exactly as before (byte-for-byte same cells); a group
  item renders one row (seller/branch/client shared; "Servicio/Producto" cell becomes an
  expand-toggle button showing "N productos"; "Profesional"/"Precio" show "—"/"Varios" since
  they're not single-valued for a group; "Cantidad" shows `lines_count`; "Monto" shows
  `total_amount`; "Método"/status badge/cancel action work identically since `SaleGroup` has the
  same `payment_method`/`sale_status`/`payment_provider` fields) plus, when expanded, one
  secondary `<tr>` with a small nested read-only table of the group's lines (service/professional/
  price/qty/amount per line — no total, status, Payment Link, or action duplicated there).
  `handleCancelSale()` branches: a group calls `api.cancelSaleGroup(item.id)`; an independent item
  calls `api.cancelSale(item.id)` exactly as before. Clicking a group row opens the existing
  `SaleModal` with `item.lines[0].id` (see decision above); clicking an independent row is
  unchanged.
- **`src/pages/Dashboard.tsx`**: `sales` state retyped to `SalesListItem[]`. New
  `toOperations(items): Sale[]` (one entry per `SaleGroup`, collapsing its lines into a single
  synthetic row using the header's own `total_amount`/`lines_count`, + one entry per independent
  line) and `flattenToLines(items): Sale[]` (one entry per product/line, including every line
  inside a group). `periodSales` (feeds `totalSales`/`salesCount`/the day-month-seller "Ventas"
  bar charts/the weekly breakdown/the day-and-seller drill-down modals) now derives from
  `toOperations()`. New `periodLines` (feeds `productsSold`, `topProducts`, `profitDisplay` — all
  genuinely per-product/line concepts) derives from `flattenToLines()`. The "Resumen Anual y
  Cierre" tab's `annualSummary` (a revenue/"visits" closing report, always inherently a per-line
  concept historically) now reads from `lines` (the unfiltered flattened array) instead of raw
  `sales`, preserving its exact historical per-line semantics with zero risk of regression (dollar
  sums are invariant either way; only its `visitsYTD` count could have diverged, and now can't).

## Files created/modified (this session)
- `src/types/payments.ts` — `SalesListItem`/`SalesListGroupItem`/`SalesListIndependentItem`;
  `SaleGroup.seller_name?`/`.deleted_at?`; `SaleGroupLine.professional?`.
- `src/types.ts` — `DailyLog.deleted_at?` added (was read at runtime via `isSaleCancelled()` but
  never declared on the type — a pre-existing gap, now closed since stricter typing surfaced it).
- `src/services/api.ts` — `listSales()`'s `data` field retyped to `SalesListItem[]`.
- `src/pages/Sales.tsx` — `isGroupItem()` guard, expand state, full row-render branch for
  `type: 'group'` vs `'independent'`, `handleCancelSale()` branch, `DailyLog` import removed
  (no longer used directly).
- `src/pages/Dashboard.tsx` — `toOperations()`/`flattenToLines()`, `periodSales`/`periodLines`
  split, `annualSummary` switched to `lines`, `Sale.id` widened to `number | string` (matches
  `DailyLog.id: string` reality), `Sale` gained `sale_status?`/`payment_status?`.
- `src/pages/__tests__/Sales.presentation.test.tsx` (new, 3 tests).
- `src/pages/__tests__/Dashboard.presentation.test.tsx` (new, 1 test).

## API contracts and payloads
Consumes the backend's now-discriminated `GET /api/sales` `data` array (`type: 'group' |
'independent'`) and the corrected `valid_count`/`total_amount`/`cancelled_count`/
`cancelled_amount`/`GET /api/dashboard/stats`'s `salesCount` — see backend `context.md` for the
exact shapes. `export_all=1` (CSV export) is unchanged (`DailyLog[]`, no `type` field) —
`api.exportSales()` untouched.

## Historical compatibility
An independent/historical `daily_logs` row renders exactly as before (same cells, same actions,
same click-to-open behavior) — verified by
`Sales.presentation.test.tsx`'s "keeps its historical single-row presentation" test.
`CreateSaleModal`/refund flows/polling are untouched by this session.

## External integrations affected
None. This session only touches list/dashboard presentation and counting.

## Tests executed
- Command: `npm run test:run` → Result: **6 test files passed, 14 tests passed**, 0 failures.
- Command: `npm run build:qa` (`tsc -b && vite build --mode qa`) → succeeded (same pre-existing,
  unrelated Rollup chunk-size warning as always).
- Command: `npx tsc -b tsconfig.json --noEmit` (the actual config the real build uses — confirmed
  distinct from the stricter, unused `tsconfig.app.json`) → 0 errors.
- Command: `npm run lint` → Result: **396 problems (378 errors, 18 warnings)** — 2 *below* the
  398-problem baseline (this session's edits incidentally removed 2 pre-existing issues, e.g. the
  now-unused `DailyLog` import in `Sales.tsx`), and 0 new debt: the 6 `any` usages my 2 new test
  files initially introduced were all fixed by typing mocks against their real API return shapes
  (`Branch`, `SaleGroup`, `api.me()`'s inline type, etc.) before this final count.
- Command: `git diff --check` → clean (exit 0).

## Problems found and solutions applied
- `api.listSales()`'s return type changing from `DailyLog[]` to `SalesListItem[]` rippled into
  `Dashboard.tsx`, which had been consuming that same endpoint's raw array directly for its own
  per-line/per-day/per-seller/per-product client-side aggregations — every one of those would have
  silently kept the OLD (buggy) per-line counting semantics, or broken type-wise, without the
  `toOperations()`/`flattenToLines()` split described above.
- `SaleGroup.date` (backend) is a Carbon-cast datetime; comparing it as a raw string (as
  `DailyLog.date` already was) required explicit formatting — handled entirely backend-side (see
  backend `context.md`), transparent to the frontend.
- Local `Sale.id` in `Dashboard.tsx` was declared `number`, but `DailyLog.id` (and hence a real
  independent item) is `string` — surfaced only once `sales` was retyped away from a loose `any[]`
  cast; fixed by widening `Sale.id` to `number | string`.
- Two new test files initially introduced 6 `no-explicit-any` (loosely-typed API mocks) — fixed by
  constructing fixtures against the real `Branch`/`SaleGroup`/inline `api.me()` return shapes
  instead of casting.

## Discarded decisions and why
- Re-fetching Dashboard's charts via new backend endpoints keyed by day/seller/month: rejected as
  out-of-scope massive refactor (see backend `context.md`'s matching discarded-decision entry).
- Passing a dedicated "group id" prop into `SaleModal`: rejected — unnecessary, since it already
  auto-detects `sale_group_id` from any one of a group's line ids, which the list already has
  available (`item.lines[0].id`).

## Completed
- Sales list renders one row per sale operation (group or independent), verified via 3 new tests.
- Dashboard "Cant. Ventas" and every other "ventas" chart on that page dedupe grouped lines,
  verified via 1 new test plus the underlying `toOperations()`/`flattenToLines()` split.
- `npm run test:run` (14/14), `npm run build:qa`, `npx tsc --noEmit` (0 errors), `npm run lint`
  (396, below the 398 baseline), `git diff --check` — all clean.

## Pending (priority order)
1. Nothing outstanding in this repo for this fix — awaiting explicit authorization to push
   `feature/grouped-sales-presentation` and/or merge into `qa` (not yet requested).
2. Optional, not requested: Dashboard's "Resumen de Actividad" tab still fetches its full dataset
   via one client-side `api.listSales()` call capped at `per_page` (max 1000) — a pre-existing
   limitation, unrelated to and not worsened by this fix, that a future backend-aggregation
   endpoint could remove if ever prioritized.

## Open risks or unresolved questions
- None new. See backend `context.md`'s Open risks for the pre-existing `DashboardController`
  seller-permission gap (not a frontend concern, not fixed this session).

## Last commit
Prior: `9744fcf9f25a0d25a20a159e3b2c50b289783420` — the lint-debt cleanup, now merged into `qa` at
`aa98a92` and pushed. This session's grouped-sale list/Dashboard presentation fix
(`src/types/payments.ts`, `src/types.ts`, `src/services/api.ts`, `src/pages/Sales.tsx`,
`src/pages/Dashboard.tsx`, the 2 new test files, plus this file) is committed as a new commit on
top of it in the same request — run `git log -1` for its exact hash rather than trusting a hash
written before the commit existed.

## Working tree state
Completely clean. Nothing pushed; `qa`/`main` untouched beyond the prior, already-authorized
merge+push of `feature/unifysales`.

## Exact recommended next step
No code work is pending here. If asked to proceed, the next action would be to confirm with the
user whether to push `feature/grouped-sales-presentation` — do not push without that explicit
authorization.
