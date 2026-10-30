import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { loadLocalWorkouts, saveLocalWorkouts } from '../storage/localWorkoutStore'
import { pullRemoteWorkouts, pushWorkouts } from './driveAppData'
import type { WorkoutSession } from '../types/workout'

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'synced' | 'error'

const SYNC_DEBOUNCE_MS = 1500
const MAX_RETRIES = 5
const BASE_RETRY_DELAY_MS = 1000

function mergeByLatest(local: WorkoutSession[], remote: WorkoutSession[]): WorkoutSession[] {
  const byId = new Map(local.map((session) => [session.id, session]))
  for (const remoteSession of remote) {
    const localSession = byId.get(remoteSession.id)
    if (!localSession || remoteSession.updatedAt > localSession.updatedAt) {
      byId.set(remoteSession.id, remoteSession)
    }
  }
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date))
}

async function syncWithRetry(
  token: string,
  data: WorkoutSession[],
  setSyncStatus: (status: SyncStatus) => void,
  retryTimer: { current: ReturnType<typeof setTimeout> | null },
  attempt = 0,
): Promise<void> {
  setSyncStatus('syncing')
  try {
    await pushWorkouts(token, data)
    setSyncStatus('synced')
  } catch {
    if (attempt >= MAX_RETRIES) {
      setSyncStatus('error')
      return
    }
    const delay = BASE_RETRY_DELAY_MS * 2 ** attempt
    retryTimer.current = setTimeout(() => syncWithRetry(token, data, setSyncStatus, retryTimer, attempt + 1), delay)
  }
}

export function useWorkouts() {
  const { accessToken } = useAuth()
  const [sessions, setSessions] = useState<WorkoutSession[]>(() => loadLocalWorkouts())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(accessToken ? 'idle' : 'offline')
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPulledRemote = useRef(false)

  const pushWithRetry = useCallback(
    (token: string, data: WorkoutSession[]) => syncWithRetry(token, data, setSyncStatus, retryTimer),
    [],
  )

  const scheduleSync = useCallback(
    (data: WorkoutSession[]) => {
      if (!accessToken) {
        setSyncStatus('offline')
        return
      }
      if (syncTimer.current) clearTimeout(syncTimer.current)
      if (retryTimer.current) clearTimeout(retryTimer.current)
      syncTimer.current = setTimeout(() => pushWithRetry(accessToken, data), SYNC_DEBOUNCE_MS)
    },
    [accessToken, pushWithRetry],
  )

  // Pull once per sign-in and fold in anything saved locally while signed out.
  useEffect(() => {
    if (!accessToken) {
      hasPulledRemote.current = false
      return
    }
    if (hasPulledRemote.current) return
    hasPulledRemote.current = true

    pullRemoteWorkouts(accessToken)
      .then((remote) => {
        if (!remote) return
        setSessions((current) => {
          const merged = mergeByLatest(current, remote)
          saveLocalWorkouts(merged)
          return merged
        })
      })
      .catch(() => {
        // No network / Drive unavailable — keep working off local storage.
      })
  }, [accessToken])

  const saveWorkout = useCallback(
    (session: WorkoutSession) => {
      setSessions((current) => {
        const existingIndex = current.findIndex((entry) => entry.id === session.id)
        const next =
          existingIndex === -1
            ? [session, ...current]
            : current.map((entry, index) => (index === existingIndex ? session : entry))
        saveLocalWorkouts(next)
        scheduleSync(next)
        return next
      })
    },
    [scheduleSync],
  )

  const deleteWorkout = useCallback(
    (id: string) => {
      setSessions((current) => {
        const next = current.filter((entry) => entry.id !== id)
        saveLocalWorkouts(next)
        scheduleSync(next)
        return next
      })
    },
    [scheduleSync],
  )

  const retrySync = useCallback(() => {
    if (accessToken) pushWithRetry(accessToken, sessions)
  }, [accessToken, sessions, pushWithRetry])

  return { sessions, saveWorkout, deleteWorkout, syncStatus, retrySync }
}
