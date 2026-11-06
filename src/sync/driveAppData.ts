import type { WorkoutSession, WorkoutTemplate } from '../types/workout'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'

export interface DriveAppDataFile<T> {
  push: (accessToken: string, data: T[]) => Promise<void>
  pull: (accessToken: string) => Promise<T[] | null>
}

// One JSON array per file in the hidden appDataFolder. The file id is cached in localStorage so
// we only search Drive by name once per device.
export function createDriveAppDataFile<T>(filename: string, fileIdStorageKey: string): DriveAppDataFile<T> {
  function getCachedFileId(): string | null {
    return localStorage.getItem(fileIdStorageKey)
  }

  function setCachedFileId(id: string) {
    localStorage.setItem(fileIdStorageKey, id)
  }

  async function findFileId(accessToken: string): Promise<string | null> {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q: `name = '${filename}' and trashed = false`,
      fields: 'files(id)',
    })
    const res = await fetch(`${DRIVE_FILES_URL}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Drive lookup failed (${res.status})`)
    const data: { files?: { id: string }[] } = await res.json()
    return data.files?.[0]?.id ?? null
  }

  async function uploadContent(accessToken: string, fileId: string, data: T[]): Promise<void> {
    const res = await fetch(`${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`Drive upload failed (${res.status})`)
  }

  async function createFile(accessToken: string, data: T[]): Promise<string> {
    const createRes = await fetch(DRIVE_FILES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: filename, parents: ['appDataFolder'] }),
    })
    if (!createRes.ok) throw new Error(`Drive create failed (${createRes.status})`)
    const { id }: { id: string } = await createRes.json()
    await uploadContent(accessToken, id, data)
    return id
  }

  async function resolveFileId(accessToken: string): Promise<string | null> {
    const cached = getCachedFileId()
    if (cached) return cached
    const found = await findFileId(accessToken)
    if (found) setCachedFileId(found)
    return found
  }

  return {
    async push(accessToken, data) {
      const fileId = await resolveFileId(accessToken)
      if (fileId) {
        await uploadContent(accessToken, fileId, data)
        return
      }
      const createdId = await createFile(accessToken, data)
      setCachedFileId(createdId)
    },

    async pull(accessToken) {
      const fileId = await resolveFileId(accessToken)
      if (!fileId) return null
      const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.status === 404) {
        localStorage.removeItem(fileIdStorageKey)
        return null
      }
      if (!res.ok) throw new Error(`Drive download failed (${res.status})`)
      return res.json()
    },
  }
}

// The workouts key predates templates; keep it so existing devices don't re-search Drive.
export const workoutsDriveFile = createDriveAppDataFile<WorkoutSession>('flex-workouts.json', 'flex.drive-file-id')

export const templatesDriveFile = createDriveAppDataFile<WorkoutTemplate>(
  'flex-templates.json',
  'flex.drive-templates-file-id',
)
