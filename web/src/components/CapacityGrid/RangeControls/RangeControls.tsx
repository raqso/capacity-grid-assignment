interface RangeControlsProps {
  from: string
  to: string
  onFromChange: (dateString: string) => void
  onToChange: (dateString: string) => void
  onShift: (weeksToShift: number) => void
}

export function RangeControls({
  from,
  to,
  onFromChange,
  onToChange,
  onShift,
}: RangeControlsProps) {
  return (
    <div className="range-controls">
      <button
        type="button"
        onClick={() => onShift(-1)}
        aria-label="Previous week"
      >
        ‹
      </button>
      <label>
        From
        <input
          type="date"
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={to}
          onChange={(event) => onToChange(event.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={() => onShift(1)}
        aria-label="Next week"
      >
        ›
      </button>
    </div>
  )
}
