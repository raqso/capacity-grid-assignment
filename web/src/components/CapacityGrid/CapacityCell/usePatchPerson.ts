import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PersonResponse } from "../../../generated/api";

interface PatchPersonBody {
	weekly_hours: number;
}

interface PatchPersonVariables {
	id: number;
	body: PatchPersonBody;
}

async function patchPerson(
	personId: number,
	requestBody: PatchPersonBody,
): Promise<PersonResponse> {
	const response = await fetch(`/api/people/${personId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`${response.status}: ${errorText.trim()}`);
	}

	return response.json() as Promise<PersonResponse>;
}

export function usePatchPerson() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, body }: PatchPersonVariables) =>
			patchPerson(id, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["capacity"] });
		},
	});
}
