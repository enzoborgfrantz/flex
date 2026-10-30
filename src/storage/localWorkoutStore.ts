import type { WorkoutSession } from '../types/workout'

const STORAGE_KEY = 'flex.workouts'

export function loadLocalWorkouts(): WorkoutSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WorkoutSession[]
  } catch {
    return []
  }
}

export function saveLocalWorkouts(sessions: WorkoutSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}
