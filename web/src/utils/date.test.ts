import { describe, it, expect } from 'vitest'
import { addDays, toIsoDate, formatWeekLabel, shiftIsoWeek } from './date'

describe('date utils', () => {
  it('adds days correctly in UTC', () => {
    const baseDate = new Date(Date.UTC(2026, 0, 1))
    const nextDate = addDays(baseDate, 5)
    expect(toIsoDate(nextDate)).toBe('2026-01-06')
  })

  it('formats ISO date string properly', () => {
    const baseDate = new Date(Date.UTC(2026, 0, 15, 12))
    expect(toIsoDate(baseDate)).toBe('2026-01-15')
  })

  it('shifts ISO weeks back and forth preserving exact identity', () => {
    const initial = '2025-12-29'
    const forward = shiftIsoWeek(initial, 1)
    expect(forward).toBe('2026-01-05')
    const back = shiftIsoWeek(forward, -1)
    expect(back).toBe(initial)
  })

  it('formats week label from Monday to Friday', () => {
    const formatted = formatWeekLabel('2025-12-29')
    expect(formatted).toContain('29 Dec')
    expect(formatted).toContain('2 Jan')
  })
})
