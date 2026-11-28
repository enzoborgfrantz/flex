import { useState } from 'react'
import {
  addRotationSlot,
  applyPlanSuggestion,
  isPlanSuggestionSatisfied,
  moveRotationSlot,
  planSuggestionKey,
  removeRotationSlot,
  setRotationSlot,
} from '../plans/plans'
import { useAiCoach } from '../sync/useAiCoach'
import type { AiCoachDeclinedSuggestion, AiCoachPlanSuggestion } from '../types/aiCoach'
import type { Equipment } from '../types/exercise'
import type { TemplateExercise, WorkoutSession, WorkoutTemplate } from '../types/workout'
import { Button, Card, Collapsible, Select } from './ui'

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

interface WorkoutPlansSectionProps {
  sessions: WorkoutSession[]
  equipment: Equipment[]
  templates: WorkoutTemplate[]
  saveTemplate: (name: string, exercises: TemplateExercise[], id?: string) => void
  deleteTemplate: (id: string) => void
  rotation: string[]
  setRotation: (next: string[]) => void
  onEditPlan: (template: WorkoutTemplate) => void
}

// Saved plans (Workout A, Workout B, ...) together with the AI coach's pending plan-change
// suggestions for each one (add an exercise, change a target) — nested right under the plan they
// apply to, since every plan suggestion names a template and so always ties to exactly one of
// these. Weight-bump nudges are a separate, in-workout thing and don't go through here.
export function CoachSuggestions({
  sessions,
  equipment,
  templates,
  saveTemplate,
  deleteTemplate,
  rotation,
  setRotation,
  onEditPlan,
}: WorkoutPlansSectionProps) {
  const { planSuggestions, config, status, declineSuggestion, undeclineSuggestion } = useAiCoach(
    sessions,
    templates,
    equipment,
  )
  const [lastApplied, setLastApplied] = useState<LastApplied | null>(null)

  const pending =
    status === 'offline'
      ? []
      : planSuggestions.filter((suggestion) => {
          const template = templates.find(
            (candidate) => candidate.name.toLowerCase() === suggestion.templateName.toLowerCase(),
          )
          if (!template) return false
          if (isPlanSuggestionSatisfied(template, suggestion)) return false
          const key = planSuggestionKey(suggestion)
          if (isHidden(config?.declinedSuggestions?.find((declined) => declined.key === key))) return false
          return true
        })

  const handleAccept = (suggestion: AiCoachPlanSuggestion, template: WorkoutTemplate) => {
    setLastApplied({
      suggestion,
      templateId: template.id,
      templateName: template.name,
      previousExercises: template.exercises,
    })
    saveTemplate(template.name, applyPlanSuggestion(template, suggestion), template.id)
    // Marks it handled for good — isPlanSuggestionSatisfied only looks at whether the template
    // currently has it, so without this, removing the exercise later (e.g. realizing you don't
    // have the equipment) would make this exact suggestion look pending again.
    declineSuggestion(suggestion, 'never')
  }

  const handleUndo = () => {
    if (!lastApplied) return
    saveTemplate(lastApplied.templateName, lastApplied.previousExercises, lastApplied.templateId)
    undeclineSuggestion(planSuggestionKey(lastApplied.suggestion))
    setLastApplied(null)
  }

  return (
    <Collapsible title="Workout plans" defaultOpen={false} className="dashboard__plan-section">
      <div className="dashboard__rotation">
        <h3>Your rotation</h3>
        {rotation.length === 0 ? (
          <p className="dashboard__plans-hint">
            No rotation yet — add a day below and the dashboard will tell you what's next.
          </p>
        ) : (
          <ol className="dashboard__rotation-list">
            {rotation.map((templateId, index) => (
              <li key={index} className="dashboard__rotation-slot">
                <Select
                  label={`Day ${index + 1}`}
                  value={templateId}
                  onChange={(e) => setRotation(setRotationSlot(rotation, index, e.target.value))}
                  options={templates.map((template) => ({ value: template.id, label: template.name }))}
                />
                <div className="dashboard__rotation-slot-actions">
                  <button
                    type="button"
                    className="dashboard__plan-icon-btn"
                    disabled={index === 0}
                    onClick={() => setRotation(moveRotationSlot(rotation, index, -1))}
                    aria-label={`Move day ${index + 1} earlier`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="dashboard__plan-icon-btn"
                    disabled={index === rotation.length - 1}
                    onClick={() => setRotation(moveRotationSlot(rotation, index, 1))}
                    aria-label={`Move day ${index + 1} later`}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="dashboard__plan-icon-btn dashboard__plan-icon-btn--delete"
                    onClick={() => setRotation(removeRotationSlot(rotation, index))}
                    aria-label={`Remove day ${index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={templates.length === 0}
          onClick={() => setRotation(addRotationSlot(rotation, templates[0].id))}
        >
          + Add day
        </Button>
      </div>
      {templates.length === 0 ? (
        <p className="dashboard__plans-hint">No saved plans yet — save one from the workout editor.</p>
      ) : (
        <ul className="dashboard__plans-list">
          {templates.map((template) => {
            const suggestionsForPlan = pending.filter(
              (suggestion) => suggestion.templateName.toLowerCase() === template.name.toLowerCase(),
            )
            const showUndo = lastApplied?.templateId === template.id

            return (
              <li key={template.id} className="dashboard__plan-group">
                <div className="dashboard__plan-row">
                  <strong>{template.name}</strong>
                  <div className="dashboard__plan-row-meta">
                    <span>
                      {template.exercises.length} exercise
                      {template.exercises.length === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      className="dashboard__plan-icon-btn dashboard__plan-icon-btn--edit"
                      onClick={() => onEditPlan(template)}
                      aria-label={`Edit plan ${template.name}`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="dashboard__plan-icon-btn dashboard__plan-icon-btn--delete"
                      onClick={() => {
                        if (window.confirm(`Delete plan "${template.name}"?`)) deleteTemplate(template.id)
                      }}
                      aria-label={`Delete plan ${template.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {(suggestionsForPlan.length > 0 || showUndo) && (
                  <ul className="dashboard__coach-suggestions-list dashboard__coach-suggestions-list--nested">
                    {showUndo && (
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
                    {suggestionsForPlan.map((suggestion) => (
                      <li key={planSuggestionKey(suggestion)}>
                        <Card className="dashboard__coach-suggestion">
                          <p>{suggestion.detail}</p>
                          <div className="dashboard__coach-suggestion-actions">
                            <Button size="sm" onClick={() => handleAccept(suggestion, template)}>
                              Accept
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => declineSuggestion(suggestion, 'snoozed')}
                            >
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
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Collapsible>
  )
}
