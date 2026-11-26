import type { Equipment } from '../types/exercise'

const STORAGE_KEY = 'flex.equipment'

// A fast-load local cache of the last-known value, not the source of truth — see useEquipment.ts,
// which syncs the real value through Drive (equipmentDriveFile in sync/driveAppData.ts).
export function loadEquipment(): Equipment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Equipment[]
  } catch {
    return []
  }
}

export function saveEquipment(equipment: Equipment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(equipment))
}
