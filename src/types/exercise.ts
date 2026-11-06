export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'forearms'
  | 'neck'

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'bands'
  | 'harness'

export interface Exercise {
  id: string
  name: string
  category: 'compound' | 'isolation'
  equipment: Equipment[]
  targetMuscle: MuscleGroup
  secondaryMuscles: MuscleGroup[]
}
