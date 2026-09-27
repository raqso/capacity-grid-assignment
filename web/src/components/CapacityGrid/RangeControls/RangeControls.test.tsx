import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RangeControls } from './RangeControls'

afterEach(() => {
  cleanup()
})

describe('RangeControls', () => {
  it('renders date inputs and shifts weeks on button clicks', () => {
    const handleFromChange = vi.fn()
    const handleToChange = vi.fn()
    const handleShift = vi.fn()

    render(
      <RangeControls
        from="2025-12-29"
        to="2026-01-16"
        onFromChange={handleFromChange}
        onToChange={handleToChange}
        onShift={handleShift}
      />,
    )

    const previousButton = screen.getByRole('button', { name: /previous week/i })
    const nextButton = screen.getByRole('button', { name: /next week/i })

    fireEvent.click(previousButton)
    expect(handleShift).toHaveBeenCalledWith(-1)

    fireEvent.click(nextButton)
    expect(handleShift).toHaveBeenCalledWith(1)

    const fromInput = screen.getByLabelText(/from/i)
    fireEvent.change(fromInput, { target: { value: '2026-01-05' } })
    expect(handleFromChange).toHaveBeenCalledWith('2026-01-05')
  })
})
