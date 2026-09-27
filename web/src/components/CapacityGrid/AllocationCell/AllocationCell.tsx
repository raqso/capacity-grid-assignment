import type { WeekData } from "../../../generated/api";

interface AllocationCellProps {
	data: WeekData | undefined;
}

export function AllocationCell({ data }: AllocationCellProps) {
	if (!data) {
		return <span className="cell--empty">—</span>;
	}

	const { allocated_hours: allocatedHours, capacity_hours: capacityHours } =
		data;
	const isOverAllocated = capacityHours > 0 && allocatedHours > capacityHours;
	const isZeroAllocation = allocatedHours === 0;
	const capacityPercentage =
		capacityHours > 0
			? Math.round((allocatedHours / capacityHours) * 100)
			: null;

	const classNames = [
		"cell-value",
		isOverAllocated && "cell-value--over",
		isZeroAllocation && "cell--empty",
	]
		.filter(Boolean)
		.join(" ");

	const tooltipTitle =
		capacityPercentage !== null
			? `${capacityPercentage}% of capacity`
			: undefined;

	return (
		<span className={classNames} title={tooltipTitle}>
			{allocatedHours.toFixed(1)}h
			{isOverAllocated && (
				<span className="cell-over-badge" aria-label="Over capacity">
					!
				</span>
			)}
		</span>
	);
}
