import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { loadLocalPlan, saveLocalPlan } from '../storage/planStore'
import { planDriveFile } from './driveAppData'

const PUSH_DEBOUNCE_MS = 1500

// Mirrors useEquipment.ts: a single flat, whole-array value synced through Drive, not a
// collection of independently-timestamped records, so there's no per-item merge to do.
export function usePlan() {
  const { accessToken } = useAuth()
  const [rotation, setRotationState] = useState<string[]>(loadLocalPlan)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPulledRemote = useRef(false)

  const pushRemote = useCallback((token: string, next: string[]) => {
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      planDriveFile.push(token, next).catch(() => {})
    }, PUSH_DEBOUNCE_MS)
  }, [])

  // Pull once per sign-in. Remote wins when it exists — same reasoning as useEquipment: there's
  // no "edited while signed out" case worth reconciling for a single flat value.
  useEffect(() => {
    if (!accessToken) {
      hasPulledRemote.current = false
      return
    }
    if (hasPulledRemote.current) return
    hasPulledRemote.current = true
    planDriveFile
      .pull(accessToken)
      .then((remote) => {
        if (remote) {
          setRotationState(remote)
          saveLocalPlan(remote)
        } else {
          // First sign-in on any device with nothing in Drive yet — seed it from local.
          planDriveFile.push(accessToken, loadLocalPlan()).catch(() => {})
        }
      })
      .catch(() => {
        // Drive unreachable — keep showing the local cache.
      })
  }, [accessToken])

  const setRotation = useCallback(
    (next: string[]) => {
      setRotationState(next)
      saveLocalPlan(next)
      if (accessToken) pushRemote(accessToken, next)
    },
    [accessToken, pushRemote],
  )

  return { rotation, setRotation }
}
