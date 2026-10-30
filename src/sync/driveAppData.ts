import type { WorkoutSession } from '../types/workout'

const WORKOUTS_FILENAME = 'flex-workouts.json'
const FILE_ID_STORAGE_KEY = 'flex.drive-file-id'
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'

function getCachedFileId(): string | null {
  return localStorage.getItem(FILE_ID_STORAGE_KEY)
}

function setCachedFileId(id: string) {
  localStorage.setItem(FILE_ID_STORAGE_KEY, id)
}

async function findWorkoutsFileId(accessToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${WORKOUTS_FILENAME}' and trashed = false`,
    fields: 'files(id)',
  })
  const res = await fetch(`${DRIVE_FILES_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Drive lookup failed (${res.status})`)
  const data: { files?: { id: string }[] } = await res.json()
  return data.files?.[0]?.id ?? null
}

async function uploadWorkoutsContent(accessToken: string, fileId: string, sessions: WorkoutSession[]): Promise<void> {
  const res = await fetch(`${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(sessions),
  })
  if (!res.ok) throw new Error(`Drive upload failed (${res.status})`)
}

async function createWorkoutsFile(accessToken: string, sessions: WorkoutSession[]): Promise<string> {
  const createRes = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: WORKOUTS_FILENAME, parents: ['appDataFolder'] }),
  })
  if (!createRes.ok) throw new Error(`Drive create failed (${createRes.status})`)
  const { id }: { id: string } = await createRes.json()
  await uploadWorkoutsContent(accessToken, id, sessions)
  return id
}

async function resolveFileId(accessToken: string): Promise<string | null> {
  const cached = getCachedFileId()
  if (cached) return cached
  const found = await findWorkoutsFileId(accessToken)
  if (found) setCachedFileId(found)
  return found
}

export async function pushWorkouts(accessToken: string, sessions: WorkoutSession[]): Promise<void> {
  const fileId = await resolveFileId(accessToken)
  if (fileId) {
    await uploadWorkoutsContent(accessToken, fileId, sessions)
    return
  }
  const createdId = await createWorkoutsFile(accessToken, sessions)
  setCachedFileId(createdId)
}

export async function pullRemoteWorkouts(accessToken: string): Promise<WorkoutSession[] | null> {
  const fileId = await resolveFileId(accessToken)
  if (!fileId) return null
  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 404) {
    localStorage.removeItem(FILE_ID_STORAGE_KEY)
    return null
  }
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`)
  return res.json()
}
