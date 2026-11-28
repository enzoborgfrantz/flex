import { getExerciseById } from '../data/exercises'
import type { AiCoachPlanSuggestion } from '../types/aiCoach'
import type {
  ExerciseEntry,
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

// The active rotation: an ordered sequence of slots, each naming a template id. Slots may repeat
// a template (e.g. A-B-B-A) — that's why the sequence is tracked by slot position rather than by
// deduplicated membership.
export function addRotationSlot(rotation: string[], templateId: string): string[] {
  return [...rotation, templateId]
}

export function removeRotationSlot(rotation: string[], index: number): string[] {
  return rotation.filter((_, i) => i !== index)
}

export function setRotationSlot(rotation: string[], index: number, templateId: string): string[] {
  return rotation.map((id, i) => (i === index ? templateId : id))
}

export function moveRotationSlot(rotation: string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction
  if (target < 0 || target >= rotation.length) return rotation
  const next = [...rotation]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

// Called when a template is deleted so any rotation slots pointing at it don't dangle.
export function removeTemplateFromRotation(rotation: string[], templateId: string): string[] {
  return rotation.filter((id) => id !== templateId)
}

// "Next" = the slot after whichever one was last actually completed through the rotation
// (sessions.planSlotIndex), independent of plain custom/manually-picked workouts logged since —
// those never carry planSlotIndex, so they're invisible here. Falls back to slot 0 if nothing's
// been logged through the rotation yet, or if the stamped index no longer fits a shortened
// rotation.
export function nextRotationSlot(
  rotation: string[],
  sessions: WorkoutSession[],
): { templateId: string; slotIndex: number } | null {
  if (rotation.length === 0) return null
  const last = sessions.find((session) => session.planSlotIndex !== undefined)
  const lastIndex = last?.planSlotIndex
  const slotIndex =
    lastIndex !== undefined && lastIndex >= 0 && lastIndex < rotation.length
      ? (lastIndex + 1) % rotation.length
      : 0
  return { templateId: rotation[slotIndex], slotIndex }
}
