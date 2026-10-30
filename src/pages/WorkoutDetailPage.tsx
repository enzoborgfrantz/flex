import { Button, Card } from '../components/ui'
import type { WorkoutSession } from '../types/workout'
import './WorkoutDetailPage.css'

interface WorkoutDetailPageProps {
  session: WorkoutSession
  onEdit: () => void
  onDelete: () => void
  onBack: () => void
}

export function WorkoutDetailPage({ session, onEdit, onDelete, onBack }: WorkoutDetailPageProps) {
  return (
    <div className="workout-detail">
      <Card>
        <h2 className="workout-detail__date">{session.date}</h2>
        {session.notes && <p className="workout-detail__notes">{session.notes}</p>}
        <ul className="workout-detail__exercises">
          {session.exercises.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.name}</strong>
              <ul className="workout-detail__sets">
                {entry.sets.map((set, index) => (
                  <li key={index}>
                    <span>{set.weightKg} KG</span>
                    <span>× {set.reps}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Card>
      <div className="workout-detail__actions">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
        <Button onClick={onEdit}>Edit</Button>
      </div>
    </div>
  )
}
