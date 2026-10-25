import { useAuth } from '../auth/AuthContext'
import type { WorkoutSession } from '../types/workout'

const sessions: WorkoutSession[] = []

export function DashboardPage() {
  const { user, signOut } = useAuth()

  return (
    <section id="dashboard">
      <header>
        <span>{user?.name}</span>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </header>
      <h1>Your sessions</h1>
      {sessions.length === 0 ? (
        <p>No workout sessions yet.</p>
      ) : (
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>{session.date}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
