import { useQuery } from "@tanstack/react-query";
import type { CapacityResponse } from "./types";

async function fetchCapacity(
	from: string,
	to: string,
): Promise<CapacityResponse> {
	const url = `/api/capacity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
	const response = await fetch(url);
	if (!response.ok) {
		const text = await response.text();

		throw new Error(`${response.status}: ${text.trim()}`);
	}
	return response.json() as Promise<CapacityResponse>;
}

/**
 * Fetches capacity data for a date range.
 * The API snaps from/to to ISO week boundaries, so weeks in the
 * response may extend slightly beyond the requested range.
 */
export function useCapacity(from: string, to: string) {
	return useQuery({
		queryKey: ["capacity", from, to],
		queryFn: () => fetchCapacity(from, to),
		enabled: Boolean(from && to),
	});
}
