import { getExerciseById } from '../data/exercises'
import type { AiCoachPlanSuggestion } from '../types/aiCoach'
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

// Every set reached the top of the range, at the same weight. Unticked sets don't count,
// otherwise the pre-filled reps would trigger this on a bad day; sets logged before ticking
// existed (no flag) do count. Mixed weights (e.g. a ramp-up) mean the lift wasn't actually
// maxed out across the board, so it shouldn't suggest going up.
export function isReadyToIncrease(last: ExerciseEntry, repsMax: number): boolean {
  if (last.sets.length === 0) return false
  const weightKg = last.sets[0].weightKg
  return last.sets.every(
    (set) => set.done !== false && set.reps >= repsMax && set.weightKg === weightKg,
  )
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

// Deterministic identity for a plan suggestion, computed client-side rather than trusted from
// the routine's JSON — this is what lets both the UI and config.json's declinedSuggestions agree
// on "is this the same suggestion" without any LLM-generated id.
export function planSuggestionKey(suggestion: AiCoachPlanSuggestion): string {
  return `${suggestion.action}:${suggestion.templateName}:${suggestion.exerciseId}`
}

function findTemplateExercise(template: WorkoutTemplate | undefined, exerciseId: string): TemplateExercise | undefined {
  return template?.exercises.find((exercise) => exercise.exerciseId === exerciseId)
}

// True once the template already reflects the suggestion. Note this flips back to false if the
// exercise is later removed again — accepting now also writes a permanent 'never' decline (see
// CoachSuggestions' handleAccept) specifically so that case doesn't make the suggestion resurface
// as if it were new.
export function isPlanSuggestionSatisfied(template: WorkoutTemplate | undefined, suggestion: AiCoachPlanSuggestion): boolean {
  const existing = findTemplateExercise(template, suggestion.exerciseId)
  if (suggestion.action === 'add_exercise') return Boolean(existing)
  return Boolean(
    existing &&
      existing.target.sets === suggestion.target.sets &&
      existing.target.repsMin === suggestion.target.repsMin &&
      existing.target.repsMax === suggestion.target.repsMax,
  )
}

// Idempotency guard baked in: applying 'add_exercise' twice (e.g. two tabs racing) never
// duplicates the exercise, independent of how fast device sync catches up.
export function applyPlanSuggestion(template: WorkoutTemplate, suggestion: AiCoachPlanSuggestion): TemplateExercise[] {
  if (suggestion.action === 'add_exercise') {
    if (findTemplateExercise(template, suggestion.exerciseId)) return template.exercises
    const exercise = getExerciseById(suggestion.exerciseId)
    return [
      ...template.exercises,
      {
        exerciseId: suggestion.exerciseId,
        name: exercise?.name ?? suggestion.exerciseId,
        target: suggestion.target,
        startWeightKg: suggestion.startWeightKg ?? 0,
      },
    ]
  }
  return template.exercises.map((exercise) =>
    exercise.exerciseId === suggestion.exerciseId ? { ...exercise, target: suggestion.target } : exercise,
  )
}
