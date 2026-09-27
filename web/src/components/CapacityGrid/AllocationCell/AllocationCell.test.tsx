import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AllocationCell } from './AllocationCell'

afterEach(() => {
  cleanup()
})

describe('AllocationCell', () => {
  it('renders empty placeholder when data is undefined', () => {
    const { container } = render(<AllocationCell data={undefined} />)
    expect(container.textContent).toBe('—')
    expect(container.querySelector('.cell--empty')).not.toBeNull()
  })

  it('renders allocation hours without over-allocation badge when under capacity', () => {
    render(
      <AllocationCell
        data={{
          allocated_hours: 30,
          capacity_hours: 40,
        }}
      />,
    )
    expect(screen.getByText('30.0h')).toBeDefined()
    expect(screen.queryByLabelText(/over capacity/i)).toBeNull()
  })

  it('renders over-allocation badge and warning class when allocated exceeds capacity', () => {
    const { container } = render(
      <AllocationCell
        data={{
          allocated_hours: 50,
          capacity_hours: 40,
        }}
      />,
    )
    expect(screen.getByText('50.0h')).toBeDefined()
    expect(screen.getByLabelText(/over capacity/i)).toBeDefined()
    expect(container.querySelector('.cell-value--over')).not.toBeNull()
  })
})
