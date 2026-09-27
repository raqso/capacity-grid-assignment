import { describe, it, expect } from 'vitest'
import { flattenCapacityPages } from './useCapacity'

describe('useCapacity helpers', () => {
  it('flattens people from all pages', () => {
    const pages = [
      {
        weeks: ['2025-12-29'],
        people: [
          { id: 1, name: 'Person A', weekly_hours: 40, weeks: {} },
          { id: 2, name: 'Person B', weekly_hours: 35, weeks: {} },
        ],
        next_cursor: 2,
      },
      {
        weeks: ['2025-12-29'],
        people: [
          { id: 3, name: 'Person C', weekly_hours: 20, weeks: {} },
        ],
      },
    ]

    const allPeople = flattenCapacityPages(pages)
    expect(allPeople).toHaveLength(3)
    expect(allPeople.map((person) => person.name)).toEqual([
      'Person A',
      'Person B',
      'Person C',
    ])
  })
})
