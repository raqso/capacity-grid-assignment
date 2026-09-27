package main

import (
	"net/http"
	"time"
)

// WeekRow is one person's data for one ISO week.
type WeekRow struct {
	WeekStart  string  `json:"week_start"` // Monday, YYYY-MM-DD
	PersonID   int     `json:"person_id"`
	Allocated  float64 `json:"allocated_hours"`
	Capacity   float64 `json:"capacity_hours"`
}

// PersonCapacity is one row in the response: person + all weeks.
type PersonCapacity struct {
	ID          int                `json:"id"`
	Name        string             `json:"name"`
	WeeklyHours float64            `json:"weekly_hours"`
	Weeks       map[string]WeekData `json:"weeks"` // key: "YYYY-MM-DD" (week Monday)
}

type WeekData struct {
	Allocated float64 `json:"allocated_hours"`
	Capacity  float64 `json:"capacity_hours"`
}

// CapacityResponse is the top-level response.
type CapacityResponse struct {
	Weeks  []string         `json:"weeks"` // sorted Monday dates in range
	People []PersonCapacity `json:"people"`
}

// handleCapacity serves GET /api/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns for every person and every ISO week in the range:
//   - allocated_hours: sum of (hours_per_day * 8 * overlap_weekdays) across assignments
//   - capacity_hours:  weekly_hours (same each week unless edited)
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

	// Snap from to the Monday of its week so weeks are aligned.
	weekStart := mondayOf(from)
	// Snap to to the Sunday of its week so the last week is fully included.
	weekEnd := mondayOf(to).AddDate(0, 0, 6)

	// Collect all week-Monday dates in range.
	var weeks []string
	for d := weekStart; !d.After(weekEnd); d = d.AddDate(0, 0, 7) {
		weeks = append(weeks, d.Format("2006-01-02"))
	}

	// The SQL query:
	//   For each (person, week) pair, sum assigned hours on weekdays only.
	//
	//   We generate the week starts as a series, then for each assignment that
	//   overlaps a week, count the weekday overlap days and multiply by hours_per_day * 8.
	//
	//   ISODOW: 1=Mon … 7=Sun. We want days 1–5 only.
	//   Overlap: [max(assignment.start, week_monday), min(assignment.end, week_sunday)]
	//   weekday_count = count of days in that overlap that have ISODOW <= 5.
	//
	//   We do this via generate_series on the overlap days (bounded to the week),
	//   filter to weekdays, and sum hours_per_day * 8.
	const query = `
		WITH weeks AS (
			SELECT generate_series::date AS week_monday
			FROM generate_series($1::date, $2::date, '7 days'::interval)
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
								GREATEST(a.start_date, w.week_monday),
								LEAST(a.end_date, w.week_monday + 6),
								'1 day'::interval
							) AS d
							WHERE EXTRACT(ISODOW FROM d) <= 5
						) * a.hours_per_day * 8
					),
					0
				) AS allocated_hours
			FROM people p
			CROSS JOIN weeks w
			LEFT JOIN assignments a ON a.person_id = p.id
				AND a.start_date <= w.week_monday + 6
				AND a.end_date   >= w.week_monday
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
		ORDER BY p.id, wa.week_monday
	`

	rows, err := s.db.Query(r.Context(), query, weekStart.Format("2006-01-02"), weekEnd.Format("2006-01-02"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Build response. People map keyed by id preserves insertion order via slice.
	type personKey = int
	peopleMap := map[personKey]*PersonCapacity{}
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
			Allocated: allocated,
			Capacity:  weeklyHours,
		}
	}
	if err := rows.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	people := make([]PersonCapacity, 0, len(peopleOrder))
	for _, id := range peopleOrder {
		people = append(people, *peopleMap[id])
	}

	writeJSON(w, http.StatusOK, CapacityResponse{
		Weeks:  weeks,
		People: people,
	})
}

// mondayOf returns the Monday of the ISO week containing d.
func mondayOf(d time.Time) time.Time {
	wd := int(d.Weekday()) // 0=Sun, 1=Mon, …, 6=Sat
	if wd == 0 {
		wd = 7 // treat Sunday as 7 so Monday is always offset 0
	}
	return d.AddDate(0, 0, -(wd - 1))
}
