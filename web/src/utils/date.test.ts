import { describe, it, expect } from 'vitest'
import { addDays, toIsoDate, formatWeekLabel } from './date'

describe('date utils', () => {
  it('adds days correctly', () => {
    const baseDate = new Date('2026-01-01T00:00:00')
    const nextDate = addDays(baseDate, 5)
    expect(toIsoDate(nextDate)).toBe('2026-01-06')
  })

  it('formats ISO date string properly', () => {
    const baseDate = new Date('2026-01-15T12:00:00Z')
    expect(toIsoDate(baseDate)).toBe('2026-01-15')
  })

  it('formats week label from Monday to Friday', () => {
    const formatted = formatWeekLabel('2025-12-29')
    expect(formatted).toContain('29 Dec')
    expect(formatted).toContain('2 Jan')
  })
})
