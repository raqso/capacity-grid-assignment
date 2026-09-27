export interface WeekData {
  allocated_hours: number
  capacity_hours: number
}

export interface PersonCapacity {
  id: number
  name: string
  weekly_hours: number
  weeks: Record<string, WeekData>
}

export interface CapacityResponse {
  weeks: string[]
  people: PersonCapacity[]
}
