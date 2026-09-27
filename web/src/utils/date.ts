export function addDays(date: Date, daysToAdd: number): Date {
  const resultDate = new Date(date)
  resultDate.setDate(resultDate.getDate() + daysToAdd)
  return resultDate
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function formatWeekLabel(weekIso: string): string {
  const weekStartDate = new Date(weekIso + 'T00:00:00')
  const startLabel = weekStartDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
  const endLabel = addDays(weekStartDate, 4).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
  return `${startLabel} – ${endLabel}`
}
