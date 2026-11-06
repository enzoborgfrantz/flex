import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { DriveAppDataFile } from './driveAppData'

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'synced' | 'error'

const SYNC_DEBOUNCE_MS = 1500
const MAX_RETRIES = 5
const BASE_RETRY_DELAY_MS = 1000

interface Syncable {
  id: string
  updatedAt: number
}

// Pass a module-level constant: the hook's callbacks depend on the config's identity.
export interface SyncedCollectionConfig<T extends Syncable> {
  loadLocal: () => T[]
  saveLocal: (items: T[]) => void
  remote: DriveAppDataFile<T>
  sort?: (a: T, b: T) => number
  // Upgrades items stored in an older shape, whether they come from this device or Drive.
  normalize?: (item: T) => T
}

function mergeByLatest<T extends Syncable>(local: T[], remote: T[], sort?: (a: T, b: T) => number): T[] {
  const byId = new Map(local.map((item) => [item.id, item]))
  for (const remoteItem of remote) {
    const localItem = byId.get(remoteItem.id)
    if (!localItem || remoteItem.updatedAt > localItem.updatedAt) {
      byId.set(remoteItem.id, remoteItem)
    }
  }
  const merged = [...byId.values()]
  return sort ? merged.sort(sort) : merged
}

async function syncWithRetry<T>(
  remote: DriveAppDataFile<T>,
  token: string,
  data: T[],
  setSyncStatus: (status: SyncStatus) => void,
  retryTimer: { current: ReturnType<typeof setTimeout> | null },
  attempt = 0,
): Promise<void> {
  setSyncStatus('syncing')
  try {
    await remote.push(token, data)
    setSyncStatus('synced')
  } catch {
    if (attempt >= MAX_RETRIES) {
      setSyncStatus('error')
      return
    }
    const delay = BASE_RETRY_DELAY_MS * 2 ** attempt
    retryTimer.current = setTimeout(
      () => syncWithRetry(remote, token, data, setSyncStatus, retryTimer, attempt + 1),
      delay,
    )
  }
}

export function useSyncedCollection<T extends Syncable>(config: SyncedCollectionConfig<T>) {
  const { loadLocal, saveLocal, remote, sort, normalize } = config
  const { accessToken } = useAuth()
  const [items, setItems] = useState<T[]>(() => {
    const local = loadLocal()
    return normalize ? local.map(normalize) : local
  })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(accessToken ? 'idle' : 'offline')
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPulledRemote = useRef(false)

  const pushWithRetry = useCallback(
    (token: string, data: T[]) => syncWithRetry(remote, token, data, setSyncStatus, retryTimer),
    [remote],
  )

  const scheduleSync = useCallback(
    (data: T[]) => {
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

    remote
      .pull(accessToken)
      .then((remoteItems) => {
        if (!remoteItems) return
        const upgraded = normalize ? remoteItems.map(normalize) : remoteItems
        setItems((current) => {
          const merged = mergeByLatest(current, upgraded, sort)
          saveLocal(merged)
          return merged
        })
      })
      .catch(() => {
        // No network / Drive unavailable — keep working off local storage.
      })
  }, [accessToken, remote, saveLocal, sort, normalize])

  // Every local change goes through here: persist to this device, then debounce a push to Drive.
  const update = useCallback(
    (change: (current: T[]) => T[]) => {
      setItems((current) => {
        const next = change(current)
        saveLocal(next)
        scheduleSync(next)
        return next
      })
    },
    [saveLocal, scheduleSync],
  )

  const retrySync = useCallback(() => {
    if (accessToken) pushWithRetry(accessToken, items)
  }, [accessToken, items, pushWithRetry])

  return { items, update, syncStatus, retrySync }
}
