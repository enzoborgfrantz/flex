import exercisesJson from './exercises.json'
import type { Equipment, Exercise, MuscleGroup } from '../types/exercise'

export const exercises: Exercise[] = exercisesJson as Exercise[]

export function getExerciseById(id: string): Exercise | undefined {
  return exercises.find((exercise) => exercise.id === id)
}

export interface ExerciseFilter {
  query?: string
  muscle?: MuscleGroup | 'all'
  equipment?: Equipment | 'all'
}

export function searchExercises({ query, muscle, equipment }: ExerciseFilter): Exercise[] {
  const normalizedQuery = query?.trim().toLowerCase()
  return exercises.filter((exercise) => {
    if (muscle && muscle !== 'all' && exercise.targetMuscle !== muscle) return false
    if (equipment && equipment !== 'all' && !exercise.equipment.includes(equipment)) return false
    if (normalizedQuery && !exercise.name.toLowerCase().includes(normalizedQuery)) return false
    return true
  })
}

export const muscleGroups: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'forearms',
]

export const equipmentTypes: Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'bands',
]
