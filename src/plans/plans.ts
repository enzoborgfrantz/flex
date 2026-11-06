import type {
  ExerciseEntry,
  ExerciseTarget,
  SetEntry,
  TemplateExercise,
  WorkoutSession,
  WorkoutTemplate,
} from '../types/workout'

// Plans saved before targets existed stored logged-style sets; turn those into targets.
export function normalizeTemplate(template: WorkoutTemplate): WorkoutTemplate {
  return {
    ...template,
    exercises: template.exercises.map((exercise) => {
      const legacySets = (exercise as unknown as { sets?: SetEntry[] }).sets
      if (exercise.target || !Array.isArray(legacySets)) return exercise
      const topReps = Math.max(0, ...legacySets.map((set) => set.reps))
      return {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        target: { sets: legacySets.length, repsMin: topReps, repsMax: topReps },
        startWeightKg: Math.max(0, ...legacySets.map((set) => set.weightKg)),
      }
    }),
  }
}

// The most recent logged entry for an exercise, on or before `date`, ignoring the session being edited.
export function findLastEntry(
  history: WorkoutSession[],
  exerciseId: string,
  date: string,
  excludeSessionId?: string,
): ExerciseEntry | undefined {
  let latest: { date: string; entry: ExerciseEntry } | undefined
  for (const session of history) {
    if (session.id === excludeSessionId || session.date > date) continue
    if (latest && session.date <= latest.date) continue
    const entry = session.exercises.find((candidate) => candidate.exerciseId === exerciseId)
    if (entry) latest = { date: session.date, entry }
  }
  return latest?.entry
}

// Reps start at the top of the target range; weight carries over from last time, set by set.
export function entriesFromTemplate(
  template: WorkoutTemplate,
  history: WorkoutSession[],
  date: string,
  excludeSessionId?: string,
): ExerciseEntry[] {
  return template.exercises.map((exercise) => {
    const last = findLastEntry(history, exercise.exerciseId, date, excludeSessionId)
    const sets = Array.from({ length: exercise.target.sets }, (_, index) => ({
      reps: exercise.target.repsMax,
      weightKg: last?.sets.length
        ? last.sets[Math.min(index, last.sets.length - 1)].weightKg
        : exercise.startWeightKg,
      done: false,
    }))
    return {
      id: crypto.randomUUID(),
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      sets,
      target: { ...exercise.target },
    }
  })
}

export function templateExercisesFromEntries(entries: ExerciseEntry[]): TemplateExercise[] {
  return entries.map((entry) => {
    const topReps = Math.max(0, ...entry.sets.map((set) => set.reps))
    return {
      exerciseId: entry.exerciseId,
      name: entry.name,
      target: entry.target ?? { sets: entry.sets.length, repsMin: topReps, repsMax: topReps },
      startWeightKg: Math.max(0, ...entry.sets.map((set) => set.weightKg)),
    }
  })
}

// Every set reached the top of the range. Unticked sets don't count, otherwise the pre-filled
// reps would trigger this on a bad day; sets logged before ticking existed (no flag) do count.
export function isReadyToIncrease(last: ExerciseEntry, repsMax: number): boolean {
  return last.sets.length > 0 && last.sets.every((set) => set.done !== false && set.reps >= repsMax)
}

export function formatTarget({ sets, repsMin, repsMax }: ExerciseTarget): string {
  return `${sets} × ${repsMin === repsMax ? repsMin : `${repsMin}–${repsMax}`}`
}

export function formatEntry(entry: ExerciseEntry): string {
  const weights = new Set(entry.sets.map((set) => set.weightKg))
  if (weights.size === 1) {
    return `${entry.sets.map((set) => set.reps).join(', ')} @ ${entry.sets[0].weightKg} kg`
  }
  return entry.sets.map((set) => `${set.weightKg} kg × ${set.reps}`).join(', ')
}
