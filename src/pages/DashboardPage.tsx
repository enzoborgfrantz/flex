import { useEffect, useRef, useState } from 'react'
import { useAuth, type AuthUser } from '../auth/AuthContext'
import { Button, Card } from '../components/ui'
import { Logo } from '../components/Logo'
import { useWorkouts, type SyncStatus } from '../sync/useWorkouts'
import type { WorkoutSession } from '../types/workout'
import { WorkoutDetailPage } from './WorkoutDetailPage'
import { WorkoutEditorPage } from './WorkoutEditorPage'

type View = { name: 'list' } | { name: 'new' } | { name: 'edit'; session: WorkoutSession } | { name: 'detail'; session: WorkoutSession }

function SyncBadge({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  if (status === 'idle') return null
  if (status === 'syncing') return <span className="sync-badge sync-badge--busy">Syncing…</span>
  if (status === 'synced') return <span className="sync-badge sync-badge--ok">Synced to Drive</span>
  if (status === 'error')
    return (
      <button type="button" className="sync-badge sync-badge--error" onClick={onRetry}>
        Sync failed — retry
      </button>
    )
  return <span className="sync-badge">Saved on this device</span>
}

function AccountMenu({ user, onSignOut }: { user: AuthUser | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="account__menu" ref={ref}>
      <button
        type="button"
        className="account__avatar-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {user?.picture ? (
          <img className="account__avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="account__avatar account__avatar--fallback">{user?.name?.[0] ?? '?'}</span>
        )}
      </button>
      {open && (
        <div className="account__dropdown">
          <span className="account__name">{user?.name}</span>
          <Button variant="secondary" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      )}
    </div>
  )
}

export function DashboardPage() {
  const { user, signOut } = useAuth()
  const { sessions, saveWorkout, deleteWorkout, syncStatus, retrySync } = useWorkouts()
  const [view, setView] = useState<View>({ name: 'list' })

  const handleSave = (session: WorkoutSession) => {
    saveWorkout(session)
    setView({ name: 'detail', session })
  }

  return (
    <section id="dashboard">
      <header>
        <Logo onClick={() => setView({ name: 'list' })} />
        <div className="account">
          <SyncBadge status={syncStatus} onRetry={retrySync} />
          <AccountMenu user={user} onSignOut={signOut} />
        </div>
      </header>

      {view.name === 'list' && (
        <>
          <div className="dashboard__toolbar">
            <h1>Workouts</h1>
            <Button variant="ivory" onClick={() => setView({ name: 'new' })}>New workout</Button>
          </div>
          {sessions.length === 0 ? (
            <p>No workout sessions yet — start a new one above.</p>
          ) : (
            <ul className="dashboard__sessions">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Card interactive onClick={() => setView({ name: 'detail', session })}>
                    <strong>{session.date}</strong>
                    <p>{session.exercises.length} exercise{session.exercises.length === 1 ? '' : 's'}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view.name === 'new' && (
        <WorkoutEditorPage onSave={handleSave} onCancel={() => setView({ name: 'list' })} />
      )}

      {view.name === 'edit' && (
        <WorkoutEditorPage
          initialSession={view.session}
          onSave={handleSave}
          onCancel={() => setView({ name: 'detail', session: view.session })}
        />
      )}

      {view.name === 'detail' && (
        <WorkoutDetailPage
          session={view.session}
          onEdit={() => setView({ name: 'edit', session: view.session })}
          onDelete={() => {
            deleteWorkout(view.session.id)
            setView({ name: 'list' })
          }}
          onBack={() => setView({ name: 'list' })}
        />
      )}
    </section>
  )
}
