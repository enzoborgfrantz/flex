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
  // Set only when this session was started from the dashboard's "Next up" rotation card —
  // never for a manually-picked template or a fully custom workout. See nextRotationSlot
  // in plans/plans.ts: this is the only signal the rotation pointer advances on.
  planSlotIndex?: number
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
