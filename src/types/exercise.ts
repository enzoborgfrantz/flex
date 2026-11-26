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
  | 'pull-up-bar'
  | 'dip-bar'
  | 'bench'
  | 'squat-rack'
  | 'smith-machine'
  | 'ez-bar'
  | 'weight-belt'

export interface Exercise {
  id: string
  name: string
  category: 'compound' | 'isolation'
  // Required — the exercise can't be done without these. A "what can I do with my gear" filter
  // should gate on this field only.
  equipment: Equipment[]
  // Optional add-ons that make the exercise harder (e.g. a weight belt for a pull-up) but aren't
  // needed to perform it at all — never gates visibility, just worth surfacing as a nice-to-have.
  optionalEquipment?: Equipment[]
  targetMuscle: MuscleGroup
  secondaryMuscles: MuscleGroup[]
  // Suggested rest between sets, in seconds.
  restSec: number
}
