// Types matching the GET /api/capacity response shape.

export interface WeekData {
  allocated_hours: number
  capacity_hours: number
}

export interface PersonCapacity {
  id: number
  name: string
  weekly_hours: number
  weeks: Record<string, WeekData> // key: "YYYY-MM-DD" (week Monday)
}

export interface CapacityResponse {
  weeks: string[] // sorted Monday dates
  people: PersonCapacity[]
}
