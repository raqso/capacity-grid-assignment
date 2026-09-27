package main

import (
	"net/http"
	"strconv"
	"time"
)

// PersonCapacity is one row in the response: person + all weeks.
type PersonCapacity struct {
	ID          int                  `json:"id"`
	Name        string               `json:"name"`
	WeeklyHours float64              `json:"weekly_hours"`
	Weeks       map[string]WeekData  `json:"weeks"` // key: "YYYY-MM-DD" (week Monday)
}

// WeekData holds allocation vs capacity for one person for one ISO week.
type WeekData struct {
	AllocatedHours float64 `json:"allocated_hours"`
	CapacityHours  float64 `json:"capacity_hours"`
}

// CapacityResponse is the top-level response for GET /api/capacity.
type CapacityResponse struct {
	Weeks      []string         `json:"weeks"`       // sorted Monday dates in range
	People     []PersonCapacity `json:"people"`
	NextCursor *int             `json:"next_cursor"` // null when no further pages; use as ?after= on next request
}

// handleCapacity serves GET /api/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD[&limit=N][&after=ID]
//
// Returns for every person (paginated) and every ISO week in the range:
//   - allocated_hours: sum of (hours_per_day * 8 * overlap_weekdays) across assignments
//   - capacity_hours:  weekly_hours (same each week unless edited)
//
// Pagination: cursor-based on person id (ascending).
//   - limit: page size (default 100, max 500)
//   - after: last person id seen (default 0 = start from beginning)
//
// hours_per_day is a fraction of a working day (0–1), so multiply by 8 to get hours.
// Only weekdays (Mon–Fri) count — assignments spanning weekends don't accrue hours on Sat/Sun.
func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	fromStr := q.Get("from")
	toStr := q.Get("to")

	if fromStr == "" || toStr == "" {
		http.Error(w, "from and to are required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}

	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		http.Error(w, "invalid from date", http.StatusBadRequest)
		return
	}
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		http.Error(w, "invalid to date", http.StatusBadRequest)
		return
	}
	if to.Before(from) {
		http.Error(w, "to must be >= from", http.StatusBadRequest)
		return
	}

	// Pagination params.
	limit := 100
	afterID := 0
	if s := q.Get("limit"); s != "" {
		if v, err2 := strconv.Atoi(s); err2 == nil && v > 0 {
			if v > 500 {
				v = 500
			}
			limit = v
		}
	}
	if s := q.Get("after"); s != "" {
		if v, err2 := strconv.Atoi(s); err2 == nil && v >= 0 {
			afterID = v
		}
	}

	// Snap from to Monday of its week; snap to to Sunday of its week.
	weekStart := mondayOf(from)
	weekEnd := mondayOf(to).AddDate(0, 0, 6)

	// Collect all week-Monday dates in range.
	var weeks []string
	for d := weekStart; !d.After(weekEnd); d = d.AddDate(0, 0, 7) {
		weeks = append(weeks, d.Format("2006-01-02"))
	}

	// Cursor-based query: fetch limit+1 rows to detect whether a next page exists.
	// CTE distinct_assignments deduplicates duplicate rows from the seed per (person_id, project_id, start_date, end_date).
	// Inner correlated subquery counts weekday overlap days for each (person, week, assignment).
	// hours_per_day is a fraction of a standard 8-hour workday (0.125 = 1h/day, 0.5 = 4h/day, 1.0 = 8h/day).
	const query = `
		WITH weeks AS (
			SELECT generate_series::date AS week_monday
			FROM generate_series($1::date, $2::date, '7 days'::interval)
		),
		distinct_assignments AS (
			SELECT
				person_id,
				project_id,
				start_date,
				end_date,
				MIN(hours_per_day) AS hours_per_day
			FROM assignments
			GROUP BY person_id, project_id, start_date, end_date
		),
		week_allocations AS (
			SELECT
				p.id          AS person_id,
				w.week_monday AS week_monday,
				COALESCE(
					SUM(
						(
							SELECT COUNT(*)
							FROM generate_series(
								GREATEST(da.start_date, w.week_monday),
								LEAST(da.end_date, w.week_monday + 6),
								'1 day'::interval
							) AS d
							WHERE EXTRACT(ISODOW FROM d) <= 5
						) * da.hours_per_day * 8
					),
					0
				) AS allocated_hours
			FROM people p
			CROSS JOIN weeks w
			LEFT JOIN distinct_assignments da ON da.person_id = p.id
				AND da.start_date <= w.week_monday + 6
				AND da.end_date   >= w.week_monday
			WHERE p.id > $3
			GROUP BY p.id, w.week_monday
		)
		SELECT
			p.id,
			p.name,
			p.weekly_hours,
			wa.week_monday::text,
			wa.allocated_hours
		FROM people p
		JOIN week_allocations wa ON wa.person_id = p.id
		WHERE p.id > $3
		ORDER BY p.id, wa.week_monday
		LIMIT $4
	`

	// Fetch limit*weeks + 1 rows to detect next page. One person spans len(weeks) rows,
	// so we ask for (limit+1)*len(weeks) rows and see if we got more than limit people.
	fetchRows := (limit + 1) * len(weeks)

	rows, err := s.db.Query(r.Context(), query, weekStart.Format("2006-01-02"), weekEnd.Format("2006-01-02"), afterID, fetchRows)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	peopleMap := map[int]*PersonCapacity{}
	var peopleOrder []int

	for rows.Next() {
		var (
			id          int
			name        string
			weeklyHours float64
			weekMonday  string
			allocated   float64
		)
		if err := rows.Scan(&id, &name, &weeklyHours, &weekMonday, &allocated); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if _, ok := peopleMap[id]; !ok {
			peopleMap[id] = &PersonCapacity{
				ID:          id,
				Name:        name,
				WeeklyHours: weeklyHours,
				Weeks:       make(map[string]WeekData),
			}
			peopleOrder = append(peopleOrder, id)
		}
		pc := peopleMap[id]
		pc.Weeks[weekMonday] = WeekData{
			AllocatedHours: allocated,
			CapacityHours:  weeklyHours,
		}
	}
	if err := rows.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Detect next page: if we collected more than limit people, there's a next cursor.
	var nextCursor *int
	if len(peopleOrder) > limit {
		cursor := peopleOrder[limit-1]
		nextCursor = &cursor
		peopleOrder = peopleOrder[:limit]
	}

	people := make([]PersonCapacity, 0, len(peopleOrder))
	for _, id := range peopleOrder {
		people = append(people, *peopleMap[id])
	}

	writeJSON(w, http.StatusOK, CapacityResponse{
		Weeks:      weeks,
		People:     people,
		NextCursor: nextCursor,
	})
}

// mondayOf returns the Monday of the ISO week containing d.
func mondayOf(d time.Time) time.Time {
	wd := int(d.Weekday()) // 0=Sun, 1=Mon, …, 6=Sat
	if wd == 0 {
		wd = 7
	}
	return d.AddDate(0, 0, -(wd - 1))
}
