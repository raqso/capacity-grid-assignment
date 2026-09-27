import { useInfiniteQuery } from '@tanstack/react-query'
import type { CapacityResponse } from './generated/api'

const API_BASE = '/api'

async function fetchCapacityPage(
  from: string,
  to: string,
  afterID: number,
  limit: number,
): Promise<CapacityResponse> {
  const params = new URLSearchParams({ from, to, limit: String(limit), after: String(afterID) })
  const res = await fetch(`${API_BASE}/capacity?${params}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text.trim()}`)
  }
  return res.json() as Promise<CapacityResponse>
}

const PAGE_SIZE = 100

/**
 * Infinite query for capacity data.
 * Each page fetches PAGE_SIZE people; the API returns next_cursor to fetch the next page.
 * staleTime of 60s means navigating back to a seen range is instant (no re-fetch).
 */
export function useCapacity(from: string, to: string) {
  return useInfiniteQuery({
    queryKey: ['capacity', from, to],
    queryFn: ({ pageParam }) => fetchCapacityPage(from, to, pageParam as number, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.next_cursor ?? undefined,
    enabled: Boolean(from && to),
    staleTime: 60_000,
    // Show previous data while new range loads — avoids blank grid during week nav.
    placeholderData: previousData => previousData,
  })
}

/** Flatten all pages of people into a single array. */
export function flattenCapacityPages(pages: CapacityResponse[]) {
  return pages.flatMap(p => p.people)
}
