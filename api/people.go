package main

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type updatePersonRequest struct {
	WeeklyHours float64 `json:"weekly_hours"`
}

// PersonResponse is the shape returned by PATCH /api/people/{id}.
type PersonResponse struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	WeeklyHours float64 `json:"weekly_hours"`
}

// handleUpdatePerson serves PATCH /api/people/{id}
//
// Body: { "weekly_hours": <number> }
// Returns the updated person.
// weekly_hours must be >= 0.
func (s *server) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var body updatePersonRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if body.WeeklyHours < 0 {
		http.Error(w, "weekly_hours must be >= 0", http.StatusUnprocessableEntity)
		return
	}

	var resp PersonResponse
	err = s.db.QueryRow(
		r.Context(),
		`UPDATE people SET weekly_hours = $1 WHERE id = $2
		 RETURNING id, name, weekly_hours`,
		body.WeeklyHours,
		id,
	).Scan(&resp.ID, &resp.Name, &resp.WeeklyHours)
	if err != nil {
		// pgx returns no-rows as an error; distinguish not-found from server errors
		if err.Error() == "no rows in result set" {
			http.Error(w, "person not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}
