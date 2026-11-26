import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { equipmentDriveFile } from '../sync/driveAppData'
import type { Equipment } from '../types/exercise'
import { loadEquipment, saveEquipment } from './equipmentStore'

const PUSH_DEBOUNCE_MS = 1500

export function useEquipment() {
  const { accessToken } = useAuth()
  // localStorage is just a fast-load cache here — Drive (the hidden appDataFolder, same place
  // workouts/templates live) is the real source of truth, since the app is never usable signed
  // out anyway, unlike those two which can be edited while offline.
  const [equipment, setEquipment] = useState<Equipment[]>(loadEquipment)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPulledRemote = useRef(false)

  const pushRemote = useCallback((token: string, next: Equipment[]) => {
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      equipmentDriveFile.push(token, next).catch(() => {})
    }, PUSH_DEBOUNCE_MS)
  }, [])

  // Pull once per sign-in. Remote wins when it exists — there's no "edited while signed out"
  // case to reconcile here, so unlike useSyncedCollection this doesn't need per-item merging.
  useEffect(() => {
    if (!accessToken) {
      hasPulledRemote.current = false
      return
    }
    if (hasPulledRemote.current) return
    hasPulledRemote.current = true
    equipmentDriveFile
      .pull(accessToken)
      .then((remote) => {
        if (remote) {
          setEquipment(remote)
          saveEquipment(remote)
        } else {
          // First sign-in on any device with nothing in Drive yet — seed it from local.
          equipmentDriveFile.push(accessToken, loadEquipment()).catch(() => {})
        }
      })
      .catch(() => {
        // Drive unreachable — keep showing the local cache.
      })
  }, [accessToken])

  // Toggles from `current` inside the updater, not from the `equipment` in closure scope, so two
  // toggles fired before a re-render lands (e.g. quick successive taps) each see the other's
  // change instead of clobbering it.
  const toggleEquipment = useCallback(
    (id: Equipment) => {
      setEquipment((current) => {
        const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
        saveEquipment(next)
        if (accessToken) pushRemote(accessToken, next)
        return next
      })
    },
    [accessToken, pushRemote],
  )

  return { equipment, toggleEquipment }
}
