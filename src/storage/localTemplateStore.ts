import type { WorkoutTemplate } from '../types/workout'

const STORAGE_KEY = 'flex.templates'

export function loadLocalTemplates(): WorkoutTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WorkoutTemplate[]
  } catch {
    return []
  }
}

export function saveLocalTemplates(templates: WorkoutTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}
