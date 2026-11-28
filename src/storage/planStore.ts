const STORAGE_KEY = 'flex.plan'

// A fast-load local cache of the last-known rotation, not the source of truth — see usePlan.ts,
// which syncs the real value through Drive (planDriveFile in sync/driveAppData.ts).
export function loadLocalPlan(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

export function saveLocalPlan(rotation: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rotation))
}
