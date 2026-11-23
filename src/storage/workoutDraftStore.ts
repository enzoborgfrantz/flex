import type { ExerciseEntry } from '../types/workout'

const STORAGE_KEY = 'flex.workout-draft'

export interface WorkoutDraft {
  date: string
  exercises: ExerciseEntry[]
}

export function loadWorkoutDraft(): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WorkoutDraft
  } catch {
    return null
  }
}

export function saveWorkoutDraft(draft: WorkoutDraft) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
}

export function clearWorkoutDraft() {
  localStorage.removeItem(STORAGE_KEY)
}
