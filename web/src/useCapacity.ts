import { useQuery } from '@tanstack/react-query'
import type { CapacityResponse } from './types'

async function fetchCapacity(from: string, to: string): Promise<CapacityResponse> {
  const url = `/api/capacity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text.trim()}`)
  }
  return res.json() as Promise<CapacityResponse>
}

/**
 * Fetches capacity data for a date range.
 * The API snaps from/to to ISO week boundaries, so weeks in the
 * response may extend slightly beyond the requested range.
 */
export function useCapacity(from: string, to: string) {
  return useQuery({
    queryKey: ['capacity', from, to],
    queryFn: () => fetchCapacity(from, to),
    enabled: Boolean(from && to),
  })
}
