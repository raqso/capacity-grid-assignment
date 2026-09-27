import { useMutation, useQueryClient } from '@tanstack/react-query'

interface PatchPersonBody {
  weekly_hours: number
}

interface PatchPersonResult {
  id: number
  name: string
  weekly_hours: number
}

async function patchPerson(id: number, body: PatchPersonBody): Promise<PatchPersonResult> {
  const res = await fetch(`/api/people/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text.trim()}`)
  }
  return res.json() as Promise<PatchPersonResult>
}

/**
 * Mutation hook for updating a person's weekly hours.
 * On success, invalidates all capacity queries so the grid refetches.
 */
export function usePatchPerson() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PatchPersonBody }) =>
      patchPerson(id, body),
    onSuccess: () => {
      // Invalidate all capacity queries — simplest correct approach.
      // The alternative (optimistically patching cached data for every cached range)
      // would be faster but more complex; not worth it at 90-min scope.
      queryClient.invalidateQueries({ queryKey: ['capacity'] })
    },
  })
}
