import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'

vi.mock('../CapacityGrid', () => ({
  CapacityGrid: ({ from, to }: { from: string; to: string }) => (
    <div data-testid="capacity-grid">
      Grid from {from} to {to}
    </div>
  ),
}))

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('renders heading and capacity grid with initial range', () => {
    const testQueryClient = new QueryClient()
    render(
      <QueryClientProvider client={testQueryClient}>
        <App />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Team capacity',
    )
    expect(
      screen.getByText('Grid from 2025-12-29 to 2026-01-16'),
    ).toBeDefined()
  })
})
