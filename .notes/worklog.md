# Worklog

## 2026-09-27

**GET /api/capacity implemented.**

SQL: CTE generates ISO week Mondays in range, cross-joins people, left-joins assignments on overlap, inner correlated subquery counts weekday overlap days (ISODOW ≤ 5), multiplies by `hours_per_day × 8`. `generate_series` returns `timestamptz` not `date` — had to cast `::date` in the CTE to avoid type errors on `+ 6` (integer addition fails on timestamptz, works on date).

Allocation numbers look enormous (Ana Ferreira: 320h week of Dec 29). Verified in psql: person 1 has 15 overlapping assignments that week (14 × 0.5 + 1 × 1.0 h/d). Numbers correct, data is heavily over-allocated by design — the seed is testing over-commitment detection.

Assumption: `hours_per_day` is fraction of an 8-hour day (0–1), so `hours_per_day × 8 = hours`. Confirmed by user.

**CapacityGrid implemented** with `useCapacity` (TanStack Query), week nav (‹ ›), date pickers, loading/error/refetching states, sticky name column, per-cell over-allocation highlight.

**Inline editing**: click capacity cell → input → Enter/blur to save, Escape to cancel. Disabled during save, inline error on failure. On success: invalidate all `['capacity']` queries so any cached range refetches. Chose refetch over optimistic update — optimistic update would need to patch every cached range permutation; not worth the complexity at this scope. Worth revisiting if save latency becomes noticeable.

**Tygo type generation**: Go structs are single source of truth. TypeScript types in `web/src/generated/api.ts` are generated from Go via `tygo`. Regenerate command in the file header comment. Had to rename `updatePersonResponse` → `PersonResponse` (exported) for tygo to pick it up. No host Go needed — runs inside api container via `go run`.

**Cache fix**: `shiftWeeks` was computing `to`'s new value from its own Monday rather than shifting by a fixed N×7. This caused the dates to drift each shift, so navigating back produced a different query key → cache miss → extra request. Fix: both `from` and `to` shift by exactly `N×7` days. Also added `placeholderData: prev => prev` to `useCapacity` so navigation shows stale data instead of blank while the new range loads.

**Cursor pagination**: `GET /api/capacity?limit=N&after=ID` — cursor is the last person id seen. Returns `next_cursor: null` on last page. Default 100 people/page, max 500. `useCapacity` uses `useInfiniteQuery`; next page loads on scroll near bottom (within 200px). `flattenCapacityPages` helper flattens all pages for the table.

**TanStack Table v8 + Virtual**: TanStack Table (`@tanstack/react-table@^8`) for column definitions and row model; `@tanstack/react-virtual` for windowed row rendering. v9 was installed by default — incompatible API, pinned to v8. Column array typed `ColumnDef<PersonCapacity, any>[]` since we mix string/number/WeekData accessor value types in one array.

**Frontend refactor & test suite:**
Refactored monolithic `CapacityGrid.tsx` into isolated component directories (`CapacityGrid`, `CapacityCell`, `AllocationCell`, `RangeControls`, `App`) with colocated hooks (`useCapacity`, `usePatchPerson`) and pure date helpers in `src/utils/date.ts`. Replaced 1-letter variables with self-describing names, removed noise comments, improved keyboard/screen-reader accessibility on editable capacity cells, and added comprehensive Vitest + React Testing Library test suites alongside each component.

**Assignment deduplication and stable allocation (Option B):**
Discovered that `db/seed.sql` contained 15 identical duplicate rows for each assignment on the same `(person_id, project_id, start_date, end_date)`. This caused every person's allocations to appear 15x over-allocated (e.g. Ana Ferreira having 15 duplicates of Project 1 Atlas totaling 320h). Implemented deduplication in `api/capacity.go` using a CTE `distinct_assignments` grouping by `(person_id, project_id, start_date, end_date)`.
Allocated hours are calculated as `overlap_weekdays * hours_per_day * 8` (where `hours_per_day` is fraction of standard 8h workday: 0.5 = 4h/d = 20h/wk). This cleanly decouples allocated work hours from person capacity: when a manager edits a person's `weekly_hours`, their assigned project work remains stable and independent, correctly reflecting increased or decreased available capacity headroom.

