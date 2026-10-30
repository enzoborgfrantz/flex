import { useMemo, useState } from 'react'
import { Badge, Button, Card, Select, TextField } from '../components/ui'
import { equipmentTypes, muscleGroups, searchExercises } from '../data/exercises'
import type { Equipment, Exercise, MuscleGroup } from '../types/exercise'
import type { ExerciseEntry, WorkoutSession } from '../types/workout'
import './WorkoutEditorPage.css'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function createEntry(exercise: Exercise): ExerciseEntry {
  return {
    id: crypto.randomUUID(),
    exerciseId: exercise.id,
    name: exercise.name,
    sets: [{ reps: 8, weightKg: 0 }],
  }
}

interface WorkoutEditorPageProps {
  initialSession?: WorkoutSession
  onSave: (session: WorkoutSession) => void
  onCancel: () => void
}

export function WorkoutEditorPage({ initialSession, onSave, onCancel }: WorkoutEditorPageProps) {
  const [date, setDate] = useState(initialSession?.date ?? todayIso())
  const [notes, setNotes] = useState(initialSession?.notes ?? '')
  const [entries, setEntries] = useState<ExerciseEntry[]>(initialSession?.exercises ?? [])

  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all')

  const matches = useMemo(() => searchExercises({ query, muscle, equipment }), [query, muscle, equipment])

  const addExercise = (exercise: Exercise) => {
    setEntries((current) => [...current, createEntry(exercise)])
  }

  const removeExercise = (entryId: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId))
  }

  const addSet = (entryId: string) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId ? { ...entry, sets: [...entry.sets, { reps: 8, weightKg: 0 }] } : entry,
      ),
    )
  }

  const removeSet = (entryId: string, setIndex: number) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId ? { ...entry, sets: entry.sets.filter((_, index) => index !== setIndex) } : entry,
      ),
    )
  }

  const updateSet = (entryId: string, setIndex: number, field: 'reps' | 'weightKg', value: number) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              sets: entry.sets.map((set, index) => (index === setIndex ? { ...set, [field]: value } : set)),
            }
          : entry,
      ),
    )
  }

  const canSave = entries.length > 0 && entries.every((entry) => entry.sets.length > 0)

  const handleSave = () => {
    const session: WorkoutSession = {
      id: initialSession?.id ?? crypto.randomUUID(),
      date,
      notes: notes.trim() || undefined,
      exercises: entries,
      updatedAt: Date.now(),
    }
    onSave(session)
  }

  return (
    <div className="workout-editor">
      <Card className="workout-editor__details">
        <h2>Workout details</h2>
        <div className="workout-editor__row">
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField
            label="Notes"
            placeholder="How did it feel?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </Card>

      <Card className="workout-editor__added">
        <h2>Exercises in this workout</h2>
        {entries.length === 0 ? (
          <p>No exercises added yet — pick some from the library below.</p>
        ) : (
          <ul className="workout-editor__entries">
            {entries.map((entry) => (
              <li key={entry.id} className="workout-editor__entry">
                <div className="workout-editor__entry-header">
                  <strong>{entry.name}</strong>
                  <Button variant="secondary" size="sm" onClick={() => removeExercise(entry.id)}>
                    Remove
                  </Button>
                </div>
                <div className="workout-editor__sets-wrap">
                  <table className="workout-editor__sets">
                    <thead>
                      <tr>
                        <th>Set</th>
                        <th>Reps</th>
                        <th>Weight (kg)</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {entry.sets.map((set, setIndex) => (
                        <tr key={setIndex}>
                          <td>{setIndex + 1}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              value={set.reps}
                              onChange={(e) => updateSet(entry.id, setIndex, 'reps', Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={set.weightKg}
                              onChange={(e) => updateSet(entry.id, setIndex, 'weightKg', Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <Button variant="secondary" size="sm" onClick={() => removeSet(entry.id, setIndex)}>
                              ✕
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="secondary" size="sm" onClick={() => addSet(entry.id)}>
                  + Add set
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="workout-editor__library">
        <h2>Exercise library</h2>
        <div className="workout-editor__filters">
          <TextField label="Search" placeholder="e.g. squat" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select
            label="Muscle group"
            value={muscle}
            onChange={(e) => setMuscle(e.target.value as MuscleGroup | 'all')}
            options={[{ value: 'all', label: 'All' }, ...muscleGroups.map((m) => ({ value: m, label: m }))]}
          />
          <Select
            label="Equipment"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as Equipment | 'all')}
            options={[{ value: 'all', label: 'All' }, ...equipmentTypes.map((eq) => ({ value: eq, label: eq }))]}
          />
        </div>
        <ul className="workout-editor__library-list">
          {matches.map((exercise) => (
            <li key={exercise.id} className="workout-editor__library-item">
              <div>
                <strong>{exercise.name}</strong>
                <div className="workout-editor__badges">
                  <Badge>{exercise.targetMuscle}</Badge>
                  {exercise.equipment.map((eq) => (
                    <Badge key={eq} tone="neutral">
                      {eq}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button size="sm" onClick={() => addExercise(exercise)}>
                Add
              </Button>
            </li>
          ))}
          {matches.length === 0 && <p>No exercises match those filters.</p>}
        </ul>
      </Card>

      <div className="workout-editor__actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!canSave} onClick={handleSave}>
          Save workout
        </Button>
      </div>
    </div>
  )
}
