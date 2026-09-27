import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CapacityGrid } from './CapacityGrid'
import * as useCapacityModule from './useCapacity'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [
      {
        index: 0,
        key: 0,
        start: 0,
        end: 36,
        size: 36,
        lane: 0,
      },
    ],
    getTotalSize: () => 36,
    scrollToIndex: vi.fn(),
    scrollToOffset: vi.fn(),
  }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>,
  )
}

describe('CapacityGrid', () => {
  it('renders loading status when fetching data', () => {
    vi.spyOn(useCapacityModule, 'useCapacity').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      isFetching: true,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    } as any)

    renderWithClient(<CapacityGrid from="2025-12-29" to="2026-01-16" />)
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  it('renders table headers and rows when data is loaded', () => {
    vi.spyOn(useCapacityModule, 'useCapacity').mockReturnValue({
      data: {
        pages: [
          {
            weeks: ['2025-12-29'],
            people: [
              {
                id: 1,
                name: 'Alice Cooper',
                weekly_hours: 40,
                weeks: {
                  '2025-12-29': {
                    allocated_hours: 20,
                    capacity_hours: 40,
                  },
                },
              },
            ],
            next_cursor: null,
          },
        ],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    } as any)

    renderWithClient(<CapacityGrid from="2025-12-29" to="2026-01-16" />)
    expect(screen.getByText('Alice Cooper')).toBeDefined()
    expect(screen.getByText('40h')).toBeDefined()
    expect(screen.getByText('20.0h')).toBeDefined()
  })
})
