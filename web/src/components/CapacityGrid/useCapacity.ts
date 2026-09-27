import { useInfiniteQuery } from '@tanstack/react-query'
import type { CapacityResponse } from '../../generated/api'

const API_BASE = '/api'
const PAGE_SIZE = 100

async function fetchCapacityPage(
  from: string,
  to: string,
  afterId: number,
  limit: number,
): Promise<CapacityResponse> {
  const queryParameters = new URLSearchParams({
    from,
    to,
    limit: String(limit),
    after: String(afterId),
  })
  const response = await fetch(`${API_BASE}/capacity?${queryParameters}`)
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`${response.status}: ${errorText.trim()}`)
  }
  return response.json() as Promise<CapacityResponse>
}

export function useCapacity(from: string, to: string) {
  return useInfiniteQuery({
    queryKey: ['capacity', from, to],
    queryFn: ({ pageParam }) =>
      fetchCapacityPage(from, to, pageParam as number, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: Boolean(from && to),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  })
}

export function flattenCapacityPages(pages: CapacityResponse[]) {
  return pages.flatMap((page) => page.people)
}
