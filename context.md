# Context — spa-manager-pro-frontend

## Current feature
`feature/grouped-sales-presentation`: fix the visual/indicator layer so a grouped sale is
represented and counted correctly — as **one sale operation**, but as **N products/lines sold** —
everywhere in the UI. Backend counterpart: see backend `context.md` —
`SaleOperationsMetricsService` centralizes both `countOperations()`/`sumOperationsAmount()`
("cantidad de ventas") and, as of this round, `countProductsSold()` ("productos vendidos").

This branch has gone through three rounds, each gated by explicit user review:
1. **Presentation/counting fix** (commit `624d800`): Sales list renders one row per sale operation
   (group or independent); Dashboard's "Cant. Ventas" and its charts dedupe grouped lines
   client-side.
2. **Seller-scope follow-up** (backend-only — no frontend commit; confirmed Dashboard.tsx's
   charts already inherited the fix via `api.listSales()`, so nothing needed changing here).
3. **"Productos vendidos" card** (this round): a new Sales-list KPI card, backend-authoritative,
   next to "Ventas de la Semana/Mes/Día" — never replacing it, never computed from row counts.

## Objective and authorized scope (this round)
Add a "Productos vendidos" card to the Sales page, next to the existing "Ventas de la Semana/Mes/
Día" card, showing the backend's new `products_sold_count` field from the SAME `GET /api/sales`
response `valid_count`/`total_amount` already come from (same period/branch/seller/permission
scope by construction, never a second fetch). No `any`, no `eslint-disable`, no deriving the value
from `sales.length`/the paginated `data` array. Keep the existing cards' visual style (colors,
spacing, icons, responsiveness); use an icon that reads as "products/lines," not money or sale
count. Inspect the Dashboard only for a natural, no-redesign placement — don't force one in, and
don't change what Dashboard "Cant. Ventas" means. Mandatory: `test:run`/`build:qa`/
`npx tsc --noEmit`/`lint`/`git diff --check`, lint must not exceed the 396-problem baseline set by
round 1. No push/merge/deploy without further explicit authorization; one new frontend commit,
none rewritten.

## Branches
- Active: `feature/grouped-sales-presentation`
- Base: `qa` (at `aa98a92` when this branch was originally cut)

## Previously shipped (merged into `qa` and pushed — not part of this branch's diff)
1. **Grouped sales** (`feature/unifysales`, commit `020cf8a`): `CreateSaleModal`/`SaleModal`
   respect `sales_mode`, render a grouped sale's header/lines/consolidated total in the detail
   modal, single Payment Link, polling-based status refresh, per-line refund selection UI. First
   Vitest+RTL setup in this repo.
2. **Lint-debt cleanup** (commit `9744fcf`): removed 12 `no-explicit-any` in test files + 1 in
   `SaleModal.tsx`. `npm run lint` returned to the 398-problem baseline. At that point, `Sales.tsx`
   still rendered one row per `daily_logs` line — reversed in round 1 of this branch.

## Approved functional/architectural decisions
- `products_sold_count` is read straight from the same `api.listSales()` response `validCount`/
  `totalFilteredAmount` already come from — one new state variable (`productsSoldCount`), no new
  API call, no new fetch effect. This guarantees the new card can never show a different period/
  branch/seller scope than the "Ventas de..." card beside it.
- Dashboard already has an equivalent, pre-existing "Productos" `StatCard` (`kpi.productsSold`,
  client-side, from before this branch existed) — so no new card was added to the Dashboard; see
  backend `context.md`'s "Products sold — Dashboard placement" for the full reasoning (making that
  existing card backend-authoritative would need the same out-of-scope data-fetching
  re-architecture already flagged in round 1).
- New card uses the `Package` icon (already imported, already used for the per-line product
  indicator inside table rows) and a distinct color (`sky`) from both "Ventas..." (indigo) and
  "Importe Filtrado" (green), so the three concepts (sale count / money / product count) are never
  visually confusable.

## Technical design implemented (this round)
- **`src/services/api.ts`**: `listSales()`'s response type gains `products_sold_count: number`.
- **`src/pages/Sales.tsx`**: new `productsSoldCount` state, set from
  `paginatedResult?.products_sold_count ?? 0` in the same `fetchData()` block that already sets
  `validCount`/`totalFilteredAmount`. New KPI card inserted immediately after the "Ventas de la
  Semana/Mes/Día" card in the existing `RESUMEN` grid (`lg:grid-cols-3 xl:grid-cols-6`, unchanged —
  the grid already reflows an extra card onto a new row on `lg`/`xl` and already horizontally
  scrolls on mobile, so no layout change was needed for responsiveness). Title follows the same
  period-aware pattern as the ventas card: "Productos Vendidos Hoy/Esta Semana/Este Mes".

## Files created/modified (this round)
- `src/services/api.ts` — `listSales()` response type gains `products_sold_count`.
- `src/pages/Sales.tsx` — `productsSoldCount` state + its `fetchData()` wiring; new KPI card.
- `src/pages/__tests__/Sales.presentation.test.tsx` — `mockListSalesResponse()` helper extended
  with a computed `products_sold_count` (test data realism only, not a production change).
- `src/pages/__tests__/Sales.productsSoldCard.test.tsx` (new, 6 tests).

## API contracts and payloads
`GET /api/sales`'s response gains `products_sold_count: number` (see backend `context.md`).
Consumed by `Sales.tsx` only, alongside the already-consumed `valid_count`/`total_amount`.

## Historical compatibility
Purely additive — no existing field, component, or behavior changed. The grouped-sale expandable
row (round 1) is unaffected, verified by a dedicated test in this round.

## External integrations affected
None.

## Tests executed (this round)
- Command: `npm run test:run` → Result: **7 test files passed, 20 tests passed**, 0 failures.
- Command: `npm run build:qa` (`tsc -b && vite build --mode qa`) → succeeded (same pre-existing,
  unrelated Rollup chunk-size warning as always).
- Command: `npx tsc -b tsconfig.json --noEmit` → 0 errors.
- Command: `npm run lint` → Result: **396 problems (378 errors, 18 warnings)** — exactly matches
  the baseline set at the end of round 1, zero new debt.
- Command: `git diff --check` → clean (exit 0).

## Problems found and solutions applied
- None new this round — the card reuses an already-fetched, already-scoped response field; no
  edge case required a fix beyond what round 1 already established.

## Discarded decisions and why
- Adding a new card to the Dashboard: rejected — an equivalent card already exists there (see
  backend `context.md`); adding a second, differently-sourced one would risk confusing which is
  authoritative.
- A dedicated period-selector for the new card: explicitly rejected by the task — it must always
  mirror whatever period the "Ventas de..." card is currently showing, via the same response.

## Completed
- Round 1 (presentation/counting) — commit `624d800`.
- Round 2 (seller-scope) — no frontend change needed, confirmed and documented.
- Round 3 ("Productos vendidos" card): implemented and verified — `test:run` 20/20, `build:qa`
  succeeds, `tsc --noEmit` 0 errors, `lint` 396 (matches baseline exactly), `git diff --check`
  clean.

## Pending (priority order)
1. Nothing outstanding in this repo for this round — awaiting explicit authorization to push
   `feature/grouped-sales-presentation` and/or merge into `qa` (not yet requested).
2. Optional, not requested: making Dashboard's existing "Productos" card backend-authoritative
   (see Open risks) — a separate, not-yet-authorized piece of work.

## Open risks or unresolved questions
- Dashboard.tsx's pre-existing "Productos" card remains client-side, not backed by the new
  `products_sold_count` field — a deliberate, documented choice this round (see backend
  `context.md`), not a regression.
- See backend `context.md`'s Open risks for the pre-existing Dashboard "Resumen de Actividad" tab
  data-volume cap (unrelated to and not worsened by this round).

## Last commit
Prior: `624d800a48d305fa4e520e33da45be748993bbe4` — the grouped-sale presentation fix (NOT
rewritten — per explicit instruction; no frontend commit was made for round 2's backend-only
seller-scope fix). This round's "Productos vendidos" card (`src/services/api.ts`,
`src/pages/Sales.tsx`, the new test file, the extended existing test file, plus this file) is
committed as a new commit on top of it in the same request — run `git log -1` for its exact hash
rather than trusting a hash written before the commit existed.

## Working tree state
Completely clean. Nothing pushed; `qa`/`main` untouched beyond the prior, already-authorized
merge+push of `feature/unifysales`.

## Exact recommended next step
No code work is pending here. If asked to proceed, the next action would be to confirm with the
user whether to push `feature/grouped-sales-presentation` — do not push without that explicit
authorization.
