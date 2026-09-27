import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CapacityCell } from './CapacityCell'

afterEach(() => {
  cleanup()
})

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>,
  )
}

describe('CapacityCell', () => {
  it('renders weekly hours and enters edit mode on click', () => {
    renderWithClient(<CapacityCell personId={1} weeklyHours={40} />)

    const cellButton = screen.getByRole('button', { name: '40h' })
    expect(cellButton).toBeDefined()

    fireEvent.click(cellButton)
    const input = screen.getByRole('spinbutton', { name: /weekly hours/i })
    expect(input).toBeDefined()
    expect((input as HTMLInputElement).value).toBe('40')
  })

  it('exits edit mode on Escape', () => {
    renderWithClient(<CapacityCell personId={1} weeklyHours={40} />)

    fireEvent.click(screen.getByRole('button', { name: '40h' }))
    const input = screen.getByRole('spinbutton', { name: /weekly hours/i })

    fireEvent.change(input, { target: { value: '45' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.getByRole('button', { name: '40h' })).toBeDefined()
  })

  it('shows error if negative number is entered', () => {
    renderWithClient(<CapacityCell personId={1} weeklyHours={40} />)

    fireEvent.click(screen.getByRole('button', { name: '40h' }))
    const input = screen.getByRole('spinbutton', { name: /weekly hours/i })

    fireEvent.change(input, { target: { value: '-5' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('alert').textContent).toBe('Must be ≥ 0')
  })
})
