export interface SetEntry {
  reps: number
  weightKg: number
}

export interface ExerciseEntry {
  id: string
  exerciseId: string
  name: string
  sets: SetEntry[]
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
  sets: SetEntry[]
}

export interface WorkoutTemplate {
  id: string
  name: string
  exercises: TemplateExercise[]
  updatedAt: number
}
