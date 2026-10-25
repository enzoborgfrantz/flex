export interface SetEntry {
  reps: number
  weightKg: number
}

export interface ExerciseEntry {
  id: string
  name: string
  sets: SetEntry[]
}

export interface WorkoutSession {
  id: string
  date: string
  exercises: ExerciseEntry[]
  notes?: string
}
