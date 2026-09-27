import { useState } from 'react'
import { useCapacity } from './useCapacity'
import type { PersonCapacity, WeekData } from './types'

// ── date helpers ──────────────────────────────────────────────────────────────

/** Returns the Monday of the ISO week containing `d`. */
function mondayOf(d: Date): Date {
  const day = d.getDay() // 0=Sun
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
  // "29 Dec – 4 Jan"
  const start = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const end = addDays(d, 4).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${start} – ${end}`
}

// ── sub-components ────────────────────────────────────────────────────────────

interface CellProps {
  data: WeekData | undefined
}

function AllocationCell({ data }: CellProps) {
  if (!data) return <td className="cell cell--empty">—</td>

  const { allocated_hours, capacity_hours } = data
  const isOver = capacity_hours > 0 && allocated_hours > capacity_hours
  const isEmpty = allocated_hours === 0

  let pct = capacity_hours > 0 ? Math.round((allocated_hours / capacity_hours) * 100) : null

  return (
    <td
      className={[
        'cell',
        isOver ? 'cell--over' : '',
        isEmpty ? 'cell--empty' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      title={pct != null ? `${pct}% of capacity` : undefined}
    >
      <span className="cell-allocated">{allocated_hours.toFixed(1)}h</span>
      {isOver && <span className="cell-over-badge">!</span>}
    </td>
  )
}

// ── range controls ────────────────────────────────────────────────────────────

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

// ── main component ────────────────────────────────────────────────────────────

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
          {isFetching && !isLoading && (
            <p className="status status--fetching">Refreshing…</p>
          )}
          <table>
            <thead>
              <tr>
                <th className="col-name">Name</th>
                <th className="col-capacity">Cap. (h/wk)</th>
                {data.weeks.map(w => (
                  <th key={w} className="col-week">
                    {formatWeekLabel(w)}
                  </th>
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

// ── person row ────────────────────────────────────────────────────────────────

interface PersonRowProps {
  person: PersonCapacity
  weeks: string[]
}

function PersonRow({ person, weeks }: PersonRowProps) {
  const hasAnyOverallocation = weeks.some(w => {
    const d = person.weeks[w]
    return d && d.capacity_hours > 0 && d.allocated_hours > d.capacity_hours
  })

  return (
    <tr className={hasAnyOverallocation ? 'row--over' : ''}>
      <td className="col-name">{person.name}</td>
      <td className="col-capacity">{person.weekly_hours}h</td>
      {weeks.map(w => (
        <AllocationCell key={w} data={person.weeks[w]} />
      ))}
    </tr>
  )
}
