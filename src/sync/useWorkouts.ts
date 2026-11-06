import { useCallback } from 'react'
import { loadLocalWorkouts, saveLocalWorkouts } from '../storage/localWorkoutStore'
import { workoutsDriveFile } from './driveAppData'
import { useSyncedCollection, type SyncedCollectionConfig } from './useSyncedCollection'
import type { WorkoutSession } from '../types/workout'

export type { SyncStatus } from './useSyncedCollection'

const workoutsConfig: SyncedCollectionConfig<WorkoutSession> = {
  loadLocal: loadLocalWorkouts,
  saveLocal: saveLocalWorkouts,
  remote: workoutsDriveFile,
  sort: (a, b) => b.date.localeCompare(a.date),
}

export function useWorkouts() {
  const { items: sessions, update, syncStatus, retrySync } = useSyncedCollection(workoutsConfig)

  const saveWorkout = useCallback(
    (session: WorkoutSession) => {
      update((current) => {
        const existingIndex = current.findIndex((entry) => entry.id === session.id)
        return existingIndex === -1
          ? [session, ...current]
          : current.map((entry, index) => (index === existingIndex ? session : entry))
      })
    },
    [update],
  )

  const deleteWorkout = useCallback(
    (id: string) => {
      update((current) => current.filter((entry) => entry.id !== id))
    },
    [update],
  )

  return { sessions, saveWorkout, deleteWorkout, syncStatus, retrySync }
}
