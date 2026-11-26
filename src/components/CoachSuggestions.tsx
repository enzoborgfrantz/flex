import { useState } from 'react'
import { applyPlanSuggestion, isPlanSuggestionSatisfied, planSuggestionKey } from '../plans/plans'
import { useAiCoach } from '../sync/useAiCoach'
import { useTemplates } from '../sync/useTemplates'
import type { AiCoachDeclinedSuggestion, AiCoachPlanSuggestion } from '../types/aiCoach'
import type { TemplateExercise, WorkoutSession, WorkoutTemplate } from '../types/workout'
import { Button, Card } from './ui'

function findTemplateByName(templates: WorkoutTemplate[], name: string): WorkoutTemplate | undefined {
  return templates.find((template) => template.name.toLowerCase() === name.toLowerCase())
}

function isHidden(declined: AiCoachDeclinedSuggestion | undefined): boolean {
  if (!declined) return false
  if (declined.status === 'never') return true
  if (!declined.snoozedUntil) return false
  return Date.now() < new Date(declined.snoozedUntil).getTime()
}

interface LastApplied {
  suggestion: AiCoachPlanSuggestion
  templateId: string
  templateName: string
  previousExercises: TemplateExercise[]
}

interface CoachSuggestionsProps {
  sessions: WorkoutSession[]
}

// A card per pending plan-change suggestion from the AI coach (add an exercise, change a
// target) — weight-bump nudges are a separate, in-workout thing and don't go through here.
// Renders nothing when there's nothing pending, so it adds no clutter for users who haven't set
// up the coach or who are already caught up.
export function CoachSuggestions({ sessions }: CoachSuggestionsProps) {
  const { templates, saveTemplate } = useTemplates()
  const { planSuggestions, config, status, declineSuggestion } = useAiCoach(sessions, templates)
  const [lastApplied, setLastApplied] = useState<LastApplied | null>(null)

  if (status === 'offline') return null

  const pending = planSuggestions.filter((suggestion) => {
    const template = findTemplateByName(templates, suggestion.templateName)
    if (!template) return false
    if (isPlanSuggestionSatisfied(template, suggestion)) return false
    const key = planSuggestionKey(suggestion)
    if (isHidden(config?.declinedSuggestions?.find((declined) => declined.key === key))) return false
    return true
  })

  if (pending.length === 0 && !lastApplied) return null

  const handleAccept = (suggestion: AiCoachPlanSuggestion) => {
    const template = findTemplateByName(templates, suggestion.templateName)
    if (!template) return
    setLastApplied({
      suggestion,
      templateId: template.id,
      templateName: template.name,
      previousExercises: template.exercises,
    })
    saveTemplate(template.name, applyPlanSuggestion(template, suggestion), template.id)
  }

  const handleUndo = () => {
    if (!lastApplied) return
    saveTemplate(lastApplied.templateName, lastApplied.previousExercises, lastApplied.templateId)
    setLastApplied(null)
  }

  return (
    <section className="dashboard__coach-suggestions">
      <h2>Coach suggestions</h2>
      <ul className="dashboard__coach-suggestions-list">
        {lastApplied && (
          <li>
            <Card className="dashboard__coach-suggestion">
              <p>Added to {lastApplied.templateName}.</p>
              <div className="dashboard__coach-suggestion-actions">
                <Button variant="secondary" size="sm" onClick={handleUndo}>
                  Undo
                </Button>
              </div>
            </Card>
          </li>
        )}
        {pending.map((suggestion) => (
          <li key={planSuggestionKey(suggestion)}>
            <Card className="dashboard__coach-suggestion">
              <p>{suggestion.detail}</p>
              <div className="dashboard__coach-suggestion-actions">
                <Button size="sm" onClick={() => handleAccept(suggestion)}>
                  Accept
                </Button>
                <Button variant="secondary" size="sm" onClick={() => declineSuggestion(suggestion, 'snoozed')}>
                  Snooze
                </Button>
                <Button variant="secondary" size="sm" onClick={() => declineSuggestion(suggestion, 'never')}>
                  Never
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
