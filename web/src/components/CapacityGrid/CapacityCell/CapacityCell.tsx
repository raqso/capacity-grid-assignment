import { useState, useRef, useEffect } from 'react'
import { usePatchPerson } from './usePatchPerson'

interface CapacityCellProps {
  personId: number
  weeklyHours: number
}

export function CapacityCell({ personId, weeklyHours }: CapacityCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftHours, setDraftHours] = useState(String(weeklyHours))
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { mutate, isPending } = usePatchPerson()

  useEffect(() => {
    setDraftHours(String(weeklyHours))
  }, [weeklyHours])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.select()
    }
  }, [isEditing])

  function handleStartEdit() {
    setSaveErrorMessage(null)
    setDraftHours(String(weeklyHours))
    setIsEditing(true)
  }

  function handleCancel() {
    setIsEditing(false)
    setSaveErrorMessage(null)
    setDraftHours(String(weeklyHours))
  }

  function handleCommit() {
    const parsedHours = parseFloat(draftHours)
    if (isNaN(parsedHours) || parsedHours < 0) {
      setSaveErrorMessage('Must be ≥ 0')
      return
    }
    if (parsedHours === weeklyHours) {
      setIsEditing(false)
      return
    }
    mutate(
      { id: personId, body: { weekly_hours: parsedHours } },
      {
        onSuccess: () => {
          setIsEditing(false)
          setSaveErrorMessage(null)
        },
        onError: (mutationError) =>
          setSaveErrorMessage(
            mutationError instanceof Error ? mutationError.message : 'Save failed',
          ),
      },
    )
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      handleCommit()
    } else if (event.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="col-capacity--editing">
        <input
          ref={inputRef}
          className="edit-input"
          type="number"
          min={0}
          step={1}
          value={draftHours}
          disabled={isPending}
          onChange={(event) => setDraftHours(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleCommit}
          aria-label="Weekly hours"
        />
        {isPending && <span className="edit-saving">saving…</span>}
        {saveErrorMessage && (
          <span className="edit-error" role="alert">
            {saveErrorMessage}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className="col-capacity--clickable"
      title="Click to edit"
      onClick={handleStartEdit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleStartEdit()
        }
      }}
    >
      {weeklyHours}h
    </div>
  )
}
