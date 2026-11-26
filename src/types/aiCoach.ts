import type { MuscleGroup } from './exercise'

// What we export for the AI coach to read — not the app's own workout/template
// shapes verbatim, just enough to analyze training without re-deriving exercise metadata.
export interface AiCoachSnapshot {
  generatedAt: string
  // The full exercise catalog (not just ones the user has logged), so the coach has a stable id
  // for anything it might want to newly recommend, e.g. a muscle group never trained before.
  exercises: Record<string, { name: string; category: 'compound' | 'isolation'; targetMuscle: MuscleGroup; secondaryMuscles: MuscleGroup[] }>
  workouts: Array<{
    date: string
    notes?: string
    exercises: Array<{ exerciseId: string; name: string; sets: Array<{ reps: number; weightKg: number }> }>
  }>
  templates: Array<{
    name: string
    exercises: Array<{ exerciseId: string; name: string; sets: number; repsMin: number; repsMax: number }>
  }>
}

export type AiCoachDeclineStatus = 'snoozed' | 'never'

export interface AiCoachDeclinedSuggestion {
  key: string
  summary: string
  status: AiCoachDeclineStatus
  decidedAt: number
  // ISO date (YYYY-MM-DD), only present when status === 'snoozed'.
  snoozedUntil?: string
}

// Written by the app, read by the Claude routine on every run.
export interface AiCoachConfig {
  notes: string
  updatedAt: number
  // Suggestions (see AiCoachPlanSuggestion) the user has dismissed — the routine should not
  // propose the same one (same `key`) again. Accepted suggestions need no entry here: applying
  // one edits the template directly, and the coach sees that reflected in the next snapshot.
  declinedSuggestions?: AiCoachDeclinedSuggestion[]
}

// Read back from the newest "report-*.md" file the Claude routine created — it never edits an
// existing one, see src/sync/aiCoachDrive.ts. generatedAt is that file's Drive createdTime.
export interface AiCoachReport {
  content: string
  generatedAt: string
}

export type AiCoachSuggestionAction = 'add_exercise' | 'change_target'

// Read back from the newest "report-*.json" file, alongside the markdown report — structural
// plan edits only (never a weight-only bump, that stays in the markdown). `key` isn't part of
// this shape: identity is derived client-side via planSuggestionKey in src/plans/plans.ts rather
// than trusted from the routine's output.
export interface AiCoachPlanSuggestion {
  templateName: string
  exerciseId: string
  action: AiCoachSuggestionAction
  target: { sets: number; repsMin: number; repsMax: number }
  // Only meaningful for 'add_exercise'.
  startWeightKg?: number
  detail: string
}

// Ephemeral, in-workout nudges — unlike AiCoachPlanSuggestion these are never accepted/declined
// or persisted anywhere: today's number is simply superseded by tomorrow's report.
export interface AiCoachWeightSuggestion {
  exerciseId: string
  suggestedWeightKg: number
  // A complete, display-ready sentence — shown verbatim during the workout.
  detail: string
}
