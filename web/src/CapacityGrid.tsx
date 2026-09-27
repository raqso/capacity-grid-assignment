import { useState, useRef, useEffect, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCapacity, flattenCapacityPages } from './useCapacity'
import { usePatchPerson } from './usePatchPerson'
import type { PersonCapacity, WeekData } from './generated/api'

// ── date helpers ──────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const start = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const end = addDays(d, 4).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${start} – ${end}`
}

// ── CapacityCell (editable weekly hours) ─────────────────────────────────────

interface CapacityCellProps {
  personId: number
  weeklyHours: number
}

function CapacityCell({ personId, weeklyHours }: CapacityCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(weeklyHours))
  const [saveError, setSaveError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { mutate, isPending } = usePatchPerson()

  useEffect(() => {
    setDraft(String(weeklyHours))
  }, [weeklyHours])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function startEdit() {
    setSaveError(null)
    setDraft(String(weeklyHours))
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setSaveError(null)
    setDraft(String(weeklyHours))
  }

  function commit() {
    const parsed = parseFloat(draft)
    if (isNaN(parsed) || parsed < 0) {
      setSaveError('Must be ≥ 0')
      return
    }
    if (parsed === weeklyHours) {
      setEditing(false)
      return
    }
    mutate(
      { id: personId, body: { weekly_hours: parsed } },
      {
        onSuccess: () => { setEditing(false); setSaveError(null) },
        onError: err => setSaveError(err instanceof Error ? err.message : 'Save failed'),
      },
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') cancel()
  }

  if (editing) {
    return (
      <div className="col-capacity--editing">
        <input
          ref={inputRef}
          className="edit-input"
          type="number"
          min={0}
          step={1}
          value={draft}
          disabled={isPending}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          aria-label="Weekly hours"
        />
        {isPending && <span className="edit-saving">saving…</span>}
        {saveError && <span className="edit-error" role="alert">{saveError}</span>}
      </div>
    )
  }

  return (
    <div
      className="col-capacity--clickable"
      title="Click to edit"
      onClick={startEdit}
    >
      {weeklyHours}h
    </div>
  )
}

// ── AllocationCell ────────────────────────────────────────────────────────────

function AllocationCell({ data }: { data: WeekData | undefined }) {
  if (!data) return <span className="cell--empty">—</span>
  const { allocated_hours, capacity_hours } = data
  const isOver = capacity_hours > 0 && allocated_hours > capacity_hours
  const isEmpty = allocated_hours === 0
  const pct = capacity_hours > 0 ? Math.round((allocated_hours / capacity_hours) * 100) : null

  return (
    <span
      className={['cell-value', isOver && 'cell-value--over', isEmpty && 'cell--empty']
        .filter(Boolean).join(' ')}
      title={pct != null ? `${pct}% of capacity` : undefined}
    >
      {allocated_hours.toFixed(1)}h
      {isOver && <span className="cell-over-badge">!</span>}
    </span>
  )
}

// ── RangeControls ─────────────────────────────────────────────────────────────

interface RangeControlsProps {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onShift: (weeks: number) => void
}

function RangeControls({ from, to, onFromChange, onToChange, onShift }: RangeControlsProps) {
  return (
    <div className="range-controls">
      <button onClick={() => onShift(-1)} aria-label="Previous week">‹</button>
      <label>
        From
        <input type="date" value={from} onChange={e => onFromChange(e.target.value)} />
      </label>
      <label>
        To
        <input type="date" value={to} onChange={e => onToChange(e.target.value)} />
      </label>
      <button onClick={() => onShift(1)} aria-label="Next week">›</button>
    </div>
  )
}

// ── CapacityGrid ──────────────────────────────────────────────────────────────

interface Props {
  from: string
  to: string
}

const columnHelper = createColumnHelper<PersonCapacity>()

const ESTIMATED_ROW_HEIGHT = 36

export function CapacityGrid({ from: initialFrom, to: initialTo }: Props) {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useCapacity(from, to)

  // Fix: shift both dates by exactly N*7 days — keeps from/to in sync so
  // navigating back produces the same cache key (no extra request).
  function shiftWeeks(n: number) {
    const days = n * 7
    setFrom(prev => toISODate(addDays(new Date(prev + 'T00:00:00'), days)))
    setTo(prev => toISODate(addDays(new Date(prev + 'T00:00:00'), days)))
  }

  const weeks = data?.pages[0]?.weeks ?? []
  const allPeople = data ? flattenCapacityPages(data.pages) : []

  // Build columns dynamically from the weeks in the response.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: ColumnDef<PersonCapacity, any>[] = [
    columnHelper.accessor('name', {
      id: 'name',
      header: 'Name',
      size: 220,
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('weekly_hours', {
      id: 'weekly_hours',
      header: 'Cap. (h/wk)',
      size: 110,
      cell: info => (
        <CapacityCell
          personId={info.row.original.id}
          weeklyHours={info.getValue()}
        />
      ),
    }),
    ...weeks.map(w =>
      columnHelper.accessor(row => row.weeks[w], {
        id: `week_${w}`,
        header: formatWeekLabel(w),
        size: 130,
        cell: info => <AllocationCell data={info.getValue()} />,
      }),
    ),
  ]

  const table = useReactTable({
    data: allPeople,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const { rows } = table.getRowModel()

  // Virtualizer for tbody rows.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 10,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0
      ? totalHeight - (virtualRows[virtualRows.length - 1].end ?? 0)
      : 0

  // Load next page when user scrolls near the bottom.
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!hasNextPage || isFetchingNextPage) return
      const el = e.currentTarget
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )

  return (
    <div className="capacity-grid-wrapper">
      <RangeControls
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onShift={shiftWeeks}
      />

      {isLoading && <p className="status">Loading…</p>}
      {isError && (
        <p className="status status--error">
          Failed to load: {error instanceof Error ? error.message : 'unknown error'}
        </p>
      )}

      {data && (
        <>
          {isFetching && !isLoading && !isFetchingNextPage && (
            <p className="status status--fetching">Refreshing…</p>
          )}

          <div
            ref={tableContainerRef}
            className="table-scroll"
            onScroll={handleScroll}
          >
            <table>
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        style={{ width: header.getSize(), minWidth: header.getSize() }}
                        className={header.id === 'name' ? 'col-name' : ''}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {paddingTop > 0 && (
                  <tr><td style={{ height: paddingTop }} colSpan={columns.length} /></tr>
                )}
                {virtualRows.map(vRow => {
                  const row = rows[vRow.index]
                  const hasOver = weeks.some(w => {
                    const d = row.original.weeks[w]
                    return d && d.capacity_hours > 0 && d.allocated_hours > d.capacity_hours
                  })
                  return (
                    <tr key={row.id} className={hasOver ? 'row--over' : ''}>
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}
                          className={[
                            cell.column.id === 'name' ? 'col-name' : '',
                            cell.column.id.startsWith('week_') ? 'cell' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {paddingBottom > 0 && (
                  <tr><td style={{ height: paddingBottom }} colSpan={columns.length} /></tr>
                )}
              </tbody>
            </table>

            {isFetchingNextPage && (
              <p className="status status--fetching">Loading more…</p>
            )}
          </div>
          <p className="status">
            Showing {allPeople.length} people
            {hasNextPage ? ' — scroll for more' : ''}
          </p>
        </>
      )}
    </div>
  )
}
