import { useState, useRef, useCallback, useMemo } from "react";
import {
	useReactTable,
	getCoreRowModel,
	createColumnHelper,
	flexRender,
	type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PersonCapacity } from "../../generated/api";
import { shiftIsoWeek, formatWeekLabel } from "../../utils/date";
import { CapacityCell } from "./CapacityCell/CapacityCell";
import { AllocationCell } from "./AllocationCell/AllocationCell";
import { RangeControls } from "./RangeControls/RangeControls";
import { useCapacity, flattenCapacityPages } from "./useCapacity";

interface CapacityGridProps {
	from: string;
	to: string;
}

const columnHelper = createColumnHelper<PersonCapacity>();
const ESTIMATED_ROW_HEIGHT = 36;

export function CapacityGrid({
	from: initialFrom,
	to: initialTo,
}: CapacityGridProps) {
	const [from, setFrom] = useState(initialFrom);
	const [to, setTo] = useState(initialTo);
	const tableContainerRef = useRef<HTMLDivElement>(null);

	const {
		data,
		isLoading,
		isError,
		error,
		isFetching,
		hasNextPage,
		fetchNextPage,
		isFetchingNextPage,
	} = useCapacity(from, to);

	function shiftWeeks(weekCount: number) {
		setFrom((previousFrom) => shiftIsoWeek(previousFrom, weekCount));
		setTo((previousTo) => shiftIsoWeek(previousTo, weekCount));
	}

	const weeks = useMemo(() => data?.pages[0]?.weeks ?? [], [data?.pages]);
	const allPeople = useMemo(
		() => (data ? flattenCapacityPages(data.pages) : []),
		[data],
	);

	const columns = useMemo<ColumnDef<PersonCapacity, any>[]>(
		() => [
			columnHelper.accessor("name", {
				id: "name",
				header: "Name",
				size: 220,
				cell: (info) => info.getValue(),
			}),
			columnHelper.accessor("weekly_hours", {
				id: "weekly_hours",
				header: "Cap. (h/wk)",
				size: 110,
				cell: (info) => (
					<CapacityCell
						personId={info.row.original.id}
						weeklyHours={info.getValue()}
					/>
				),
			}),
			...weeks.map((weekIso) =>
				columnHelper.accessor((row) => row.weeks[weekIso], {
					id: `week_${weekIso}`,
					header: formatWeekLabel(weekIso),
					size: 130,
					cell: (info) => <AllocationCell data={info.getValue()} />,
				}),
			),
		],
		[weeks],
	);

	const table = useReactTable({
		data: allPeople,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const { rows } = table.getRowModel();

	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => tableContainerRef.current,
		estimateSize: () => ESTIMATED_ROW_HEIGHT,
		overscan: 10,
	});

	const virtualRows = virtualizer.getVirtualItems();
	const totalHeight = virtualizer.getTotalSize();
	const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
	const paddingBottom =
		virtualRows.length > 0
			? totalHeight - (virtualRows[virtualRows.length - 1].end ?? 0)
			: 0;

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			if (!hasNextPage || isFetchingNextPage) return;
			const scrollContainer = event.currentTarget;
			if (
				scrollContainer.scrollHeight -
					scrollContainer.scrollTop -
					scrollContainer.clientHeight <
				200
			) {
				fetchNextPage();
			}
		},
		[hasNextPage, isFetchingNextPage, fetchNextPage],
	);

	return (
		<div className="capacity-grid-wrapper">
			<RangeControls
				from={from}
				to={to}
				onFromChange={setFrom}
				onToChange={setTo}
				onShift={shiftWeeks}
			/>

			{isLoading && <p className="status">Loading…</p>}
			{isError && (
				<p className="status status--error">
					Failed to load:{" "}
					{error instanceof Error ? error.message : "unknown error"}
				</p>
			)}

			{data && (
				<>
					{isFetching && !isLoading && !isFetchingNextPage && (
						<p className="status status--fetching">Refreshing…</p>
					)}

					<div
						ref={tableContainerRef}
						className="table-scroll"
						onScroll={handleScroll}
					>
						<table>
							<thead>
								{table.getHeaderGroups().map((headerGroup) => (
									<tr key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<th
												key={header.id}
												style={{
													width: header.getSize(),
													minWidth: header.getSize(),
												}}
												className={
													header.id === "name"
														? "col-name"
														: ""
												}
											>
												{flexRender(
													header.column.columnDef
														.header,
													header.getContext(),
												)}
											</th>
										))}
									</tr>
								))}
							</thead>
							<tbody>
								{paddingTop > 0 && (
									<tr>
										<td
											style={{ height: paddingTop }}
											colSpan={columns.length}
										/>
									</tr>
								)}
								{virtualRows.map((virtualRow) => {
									const row = rows[virtualRow.index];
									const hasOverAllocation = weeks.some(
										(weekIso) => {
											const weekData =
												row.original.weeks[weekIso];
											return (
												weekData &&
												weekData.capacity_hours > 0 &&
												weekData.allocated_hours >
													weekData.capacity_hours
											);
										},
									);
									return (
										<tr
											key={row.id}
											className={
												hasOverAllocation
													? "row--over"
													: ""
											}
										>
											{row
												.getVisibleCells()
												.map((cell) => (
													<td
														key={cell.id}
														style={{
															width: cell.column.getSize(),
															minWidth:
																cell.column.getSize(),
														}}
														className={[
															cell.column.id ===
															"name"
																? "col-name"
																: "",
															cell.column.id.startsWith(
																"week_",
															)
																? "cell"
																: "",
														]
															.filter(Boolean)
															.join(" ")}
													>
														{flexRender(
															cell.column
																.columnDef.cell,
															cell.getContext(),
														)}
													</td>
												))}
										</tr>
									);
								})}
								{paddingBottom > 0 && (
									<tr>
										<td
											style={{ height: paddingBottom }}
											colSpan={columns.length}
										/>
									</tr>
								)}
							</tbody>
						</table>

						{isFetchingNextPage && (
							<p className="status status--fetching">
								Loading more…
							</p>
						)}
					</div>
					<p className="status">
						Showing {allPeople.length} people
						{hasNextPage ? " — scroll for more" : ""}
					</p>
				</>
			)}
		</div>
	);
}
