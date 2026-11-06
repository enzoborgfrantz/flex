export interface SetEntry {
  reps: number
  weightKg: number
  // Ticked off during the session. Sets logged before this existed have no flag.
  done?: boolean
}

export interface ExerciseTarget {
  sets: number
  repsMin: number
  repsMax: number
}

export interface ExerciseEntry {
  id: string
  exerciseId: string
  name: string
  sets: SetEntry[]
  // Present when the exercise came from a plan.
  target?: ExerciseTarget
}

export interface WorkoutSession {
  id: string
  date: string
  exercises: ExerciseEntry[]
  notes?: string
  updatedAt: number
}

export interface TemplateExercise {
  exerciseId: string
  name: string
  target: ExerciseTarget
  // Only used until the exercise has been logged; after that weight follows history.
  startWeightKg: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  exercises: TemplateExercise[]
  updatedAt: number
}
