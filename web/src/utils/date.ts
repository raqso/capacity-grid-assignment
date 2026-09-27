export function addDays(date: Date, daysToAdd: number): Date {
  const resultDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + daysToAdd))
  return resultDate
}

export function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftIsoWeek(isoDate: string, weekCount: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const shiftedDate = new Date(Date.UTC(year, month - 1, day + weekCount * 7))
  return toIsoDate(shiftedDate)
}

export function formatWeekLabel(weekIso: string): string {
  const [year, month, day] = weekIso.split('-').map(Number)
  const weekStartDate = new Date(Date.UTC(year, month - 1, day))
  const weekEndDate = new Date(Date.UTC(year, month - 1, day + 4))
  const startLabel = weekStartDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const endLabel = weekEndDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  return `${startLabel} – ${endLabel}`
}
