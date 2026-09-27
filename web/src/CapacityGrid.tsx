import { useState, useRef, useEffect } from 'react'
import { useCapacity } from './useCapacity'
import { usePatchPerson } from './usePatchPerson'
import type { PersonCapacity, WeekData } from './types'

// ── date helpers ──────────────────────────────────────────────────────────────

function mondayOf(d: Date): Date {
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + offset)
  return m
}

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

// ── AllocationCell ────────────────────────────────────────────────────────────

interface CellProps {
  data: WeekData | undefined
}

function AllocationCell({ data }: CellProps) {
  if (!data) return <td className="cell cell--empty">—</td>

  const { allocated_hours, capacity_hours } = data
  const isOver = capacity_hours > 0 && allocated_hours > capacity_hours
  const isEmpty = allocated_hours === 0
  const pct = capacity_hours > 0 ? Math.round((allocated_hours / capacity_hours) * 100) : null

  return (
    <td
      className={['cell', isOver && 'cell--over', isEmpty && 'cell--empty']
        .filter(Boolean)
        .join(' ')}
      title={pct != null ? `${pct}% of capacity` : undefined}
    >
      <span className="cell-allocated">{allocated_hours.toFixed(1)}h</span>
      {isOver && <span className="cell-over-badge">!</span>}
    </td>
  )
}

// ── CapacityCell (editable) ───────────────────────────────────────────────────

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

  // Reset draft whenever the prop changes (after a successful save + refetch).
  useEffect(() => {
    setDraft(String(weeklyHours))
  }, [weeklyHours])

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
      setSaveError('Must be a number ≥ 0')
      return
    }
    if (parsed === weeklyHours) {
      setEditing(false)
      return
    }

    mutate(
      { id: personId, body: { weekly_hours: parsed } },
      {
        onSuccess: () => {
          setEditing(false)
          setSaveError(null)
        },
        onError: err => {
          setSaveError(err instanceof Error ? err.message : 'Save failed')
        },
      },
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') cancel()
  }

  // Focus input when edit starts.
  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  if (editing) {
    return (
      <td className="col-capacity col-capacity--editing">
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
      </td>
    )
  }

  return (
    <td
      className="col-capacity col-capacity--clickable"
      title="Click to edit weekly hours"
      onClick={startEdit}
    >
      {weeklyHours}h
    </td>
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

// ── PersonRow ─────────────────────────────────────────────────────────────────

interface PersonRowProps {
  person: PersonCapacity
  weeks: string[]
}

function PersonRow({ person, weeks }: PersonRowProps) {
  const hasAnyOver = weeks.some(w => {
    const d = person.weeks[w]
    return d && d.capacity_hours > 0 && d.allocated_hours > d.capacity_hours
  })

  return (
    <tr className={hasAnyOver ? 'row--over' : ''}>
      <td className="col-name">{person.name}</td>
      <CapacityCell personId={person.id} weeklyHours={person.weekly_hours} />
      {weeks.map(w => (
        <AllocationCell key={w} data={person.weeks[w]} />
      ))}
    </tr>
  )
}

// ── CapacityGrid ──────────────────────────────────────────────────────────────

interface Props {
  from: string
  to: string
}

export function CapacityGrid({ from: initialFrom, to: initialTo }: Props) {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)

  const { data, isLoading, isError, error, isFetching } = useCapacity(from, to)

  function shiftWeeks(weeks: number) {
    setFrom(prev => toISODate(addDays(mondayOf(new Date(prev + 'T00:00:00')), weeks * 7)))
    setTo(prev => toISODate(addDays(mondayOf(new Date(prev + 'T00:00:00')), weeks * 7 + 6)))
  }

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
        <div className="table-scroll">
          {isFetching && !isLoading && <p className="status status--fetching">Refreshing…</p>}
          <table>
            <thead>
              <tr>
                <th className="col-name">Name</th>
                <th className="col-capacity">Cap. (h/wk)</th>
                {data.weeks.map(w => (
                  <th key={w} className="col-week">{formatWeekLabel(w)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.people.map(person => (
                <PersonRow key={person.id} person={person} weeks={data.weeks} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
