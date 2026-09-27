# Worklog

## 2026-09-27

**GET /api/capacity implemented.**

SQL: CTE generates ISO week Mondays in range, cross-joins people, left-joins assignments on overlap, inner correlated subquery counts weekday overlap days (ISODOW ≤ 5), multiplies by `hours_per_day × 8`. `generate_series` returns `timestamptz` not `date` — had to cast `::date` in the CTE to avoid type errors on `+ 6` (integer addition fails on timestamptz, works on date).

Allocation numbers look enormous (Ana Ferreira: 320h week of Dec 29). Verified in psql: person 1 has 15 overlapping assignments that week (14 × 0.5 + 1 × 1.0 h/d). Numbers correct, data is heavily over-allocated by design — the seed is testing over-commitment detection.

Assumption: `hours_per_day` is fraction of an 8-hour day (0–1), so `hours_per_day × 8 = hours`. Confirmed by user.

**CapacityGrid implemented** with `useCapacity` (TanStack Query), week nav (‹ ›), date pickers, loading/error/refetching states, sticky name column, per-cell over-allocation highlight.

**Inline editing**: click capacity cell → input → Enter/blur to save, Escape to cancel. Disabled during save, inline error on failure. On success: invalidate all `['capacity']` queries so any cached range refetches. Chose refetch over optimistic update — optimistic update would need to patch every cached range permutation; not worth the complexity at this scope. Worth revisiting if save latency becomes noticeable.

**Not done yet:** tests (vitest).

