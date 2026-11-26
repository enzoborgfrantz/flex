import { exercises } from '../data/exercises'
import type {
  AiCoachConfig,
  AiCoachPlanSuggestion,
  AiCoachReport,
  AiCoachSnapshot,
  AiCoachWeightSuggestion,
} from '../types/aiCoach'
import type { WorkoutSession, WorkoutTemplate } from '../types/workout'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'

// Everything here lives in a regular, visible Drive folder (not the hidden appDataFolder we use
// for device sync) so a Claude routine with its own Google Drive connector can find it too.
export const AI_COACH_FOLDER_NAME = 'Flex AI Coach'
export const AI_COACH_SNAPSHOT_FILE_NAME = 'snapshot.json'
export const AI_COACH_CONFIG_FILE_NAME = 'config.json'
// The routine's actual task logic, as plain text — kept out of the Routine's own frozen
// instructions (see aiCoachPrompt.ts) and pushed here by the app instead, so updating it is a
// normal app change (ships to every signed-in device automatically) rather than something each
// user has to re-paste a setup prompt to pick up. The Routine's own instructions just say "go
// re-read this file every time and do what it currently says."
export const AI_COACH_INSTRUCTIONS_FILE_NAME = 'instructions.md'
// Reports are *created* by the Claude routine, one per run, named "report-<date>.md" — never
// overwritten in place. Its Drive connector can only create files or edit metadata, not rewrite
// an existing file's content (and especially not one it didn't create), so a fixed, app-owned
// report file the routine was expected to overwrite was never going to work. The app instead
// reads back whichever report-*.md is newest.
export const AI_COACH_REPORT_FILE_PREFIX = 'report-'
export const AI_COACH_REPORT_FILES_TO_KEEP = 4

const FOLDER_ID_KEY = 'flex.ai-coach.folder-id'
const SNAPSHOT_FILE_ID_KEY = 'flex.ai-coach.snapshot-file-id'
const CONFIG_FILE_ID_KEY = 'flex.ai-coach.config-file-id'
const INSTRUCTIONS_FILE_ID_KEY = 'flex.ai-coach.instructions-file-id'

async function findChild(accessToken: string, name: string, parentId: string, mimeType?: string): Promise<string | null> {
  const q = [`name = '${name}'`, `'${parentId}' in parents`, 'trashed = false', mimeType && `mimeType = '${mimeType}'`]
    .filter(Boolean)
    .join(' and ')
  const params = new URLSearchParams({ q, fields: 'files(id)' })
  const res = await fetch(`${DRIVE_FILES_URL}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Drive lookup failed (${res.status})`)
  const data: { files?: { id: string }[] } = await res.json()
  return data.files?.[0]?.id ?? null
}

async function createFile(
  accessToken: string,
  name: string,
  parentId: string,
  content: string | null,
  mimeType: string,
): Promise<string> {
  const metadata: Record<string, unknown> = { name, parents: [parentId] }
  if (mimeType === 'application/vnd.google-apps.folder') metadata.mimeType = mimeType
  const createRes = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  })
  if (!createRes.ok) throw new Error(`Drive create failed (${createRes.status})`)
  const { id }: { id: string } = await createRes.json()
  if (content !== null) await writeContent(accessToken, id, content, mimeType)
  return id
}

async function writeContent(accessToken: string, fileId: string, content: string, mimeType: string): Promise<void> {
  const res = await fetch(`${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': mimeType },
    body: content,
  })
  if (!res.ok) throw new Error(`Drive upload failed (${res.status})`)
}

async function readContent(accessToken: string, fileId: string): Promise<string | null> {
  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`)
  return res.text()
}

// On first use, several resolveCachedId calls for the same key can fire before any of them has
// written the id to localStorage (e.g. pulling config and the report both resolve the parent
// folder at once) — each would otherwise search, find nothing, and create its own duplicate.
// Tracking the in-flight promise per key makes concurrent callers share one resolution.
const inFlightResolutions = new Map<string, Promise<string>>()

async function resolveCachedId(
  cacheKey: string,
  find: () => Promise<string | null>,
  create: () => Promise<string>,
): Promise<string> {
  const cached = localStorage.getItem(cacheKey)
  if (cached) return cached

  const pending = inFlightResolutions.get(cacheKey)
  if (pending) return pending

  const resolution = (async () => {
    try {
      const id = (await find()) ?? (await create())
      localStorage.setItem(cacheKey, id)
      return id
    } finally {
      inFlightResolutions.delete(cacheKey)
    }
  })()
  inFlightResolutions.set(cacheKey, resolution)
  return resolution
}

// Lets the app forget the Drive ids it has cached and re-discover everything by name — the
// recovery path if those ids ever end up pointing at the wrong file (e.g. after a duplicate
// folder like the above got created and manually cleaned up in Drive).
export function resetAiCoachDriveCache(): void {
  localStorage.removeItem(FOLDER_ID_KEY)
  localStorage.removeItem(SNAPSHOT_FILE_ID_KEY)
  localStorage.removeItem(CONFIG_FILE_ID_KEY)
  localStorage.removeItem(INSTRUCTIONS_FILE_ID_KEY)
}

async function resolveFolderId(accessToken: string): Promise<string> {
  return resolveCachedId(
    FOLDER_ID_KEY,
    () => findChild(accessToken, AI_COACH_FOLDER_NAME, 'root', 'application/vnd.google-apps.folder'),
    () => createFile(accessToken, AI_COACH_FOLDER_NAME, 'root', null, 'application/vnd.google-apps.folder'),
  )
}

// Ensures a file this app owns exists, creating it with `initialContent` the first time. Once
// created, our drive.file grant keeps covering it even after another app (a Claude routine)
// edits its content later — the grant is tied to who created the file, not who last wrote it.
async function resolveOwnedFileId(
  accessToken: string,
  name: string,
  cacheKey: string,
  initialContent: string,
  mimeType = 'application/json',
): Promise<string> {
  const folderId = await resolveFolderId(accessToken)
  return resolveCachedId(
    cacheKey,
    () => findChild(accessToken, name, folderId),
    () => createFile(accessToken, name, folderId, initialContent, mimeType),
  )
}

export function buildSnapshot(sessions: WorkoutSession[], templates: WorkoutTemplate[]): AiCoachSnapshot {
  // The full catalog, not just logged exercises — so the coach has a stable id for anything it
  // might want to newly recommend (e.g. a muscle group the user has never trained).
  const exerciseCatalog: AiCoachSnapshot['exercises'] = {}
  for (const exercise of exercises) {
    exerciseCatalog[exercise.id] = {
      name: exercise.name,
      category: exercise.category,
      targetMuscle: exercise.targetMuscle,
      secondaryMuscles: exercise.secondaryMuscles,
      equipment: exercise.equipment,
      ...(exercise.optionalEquipment ? { optionalEquipment: exercise.optionalEquipment } : {}),
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    exercises: exerciseCatalog,
    workouts: sessions.map((session) => ({
      date: session.date,
      notes: session.notes,
      exercises: session.exercises.map((entry) => ({
        exerciseId: entry.exerciseId,
        name: entry.name,
        sets: entry.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
      })),
    })),
    templates: templates.map((template) => ({
      name: template.name,
      exercises: template.exercises.map((entry) => ({
        exerciseId: entry.exerciseId,
        name: entry.name,
        sets: entry.target.sets,
        repsMin: entry.target.repsMin,
        repsMax: entry.target.repsMax,
      })),
    })),
  }
}

export async function pushSnapshot(accessToken: string, snapshot: AiCoachSnapshot): Promise<void> {
  const content = JSON.stringify(snapshot, null, 2)
  const fileId = await resolveOwnedFileId(accessToken, AI_COACH_SNAPSHOT_FILE_NAME, SNAPSHOT_FILE_ID_KEY, content)
  await writeContent(accessToken, fileId, content, 'application/json')
}

const EMPTY_CONFIG: AiCoachConfig = { notes: '', updatedAt: 0 }

export async function pullConfig(accessToken: string): Promise<AiCoachConfig> {
  const content = JSON.stringify(EMPTY_CONFIG)
  const fileId = await resolveOwnedFileId(accessToken, AI_COACH_CONFIG_FILE_NAME, CONFIG_FILE_ID_KEY, content)
  const raw = await readContent(accessToken, fileId)
  if (!raw) return EMPTY_CONFIG
  try {
    return JSON.parse(raw) as AiCoachConfig
  } catch {
    return EMPTY_CONFIG
  }
}

export async function pushConfig(accessToken: string, config: AiCoachConfig): Promise<void> {
  const content = JSON.stringify(config, null, 2)
  const fileId = await resolveOwnedFileId(accessToken, AI_COACH_CONFIG_FILE_NAME, CONFIG_FILE_ID_KEY, content)
  await writeContent(accessToken, fileId, content, 'application/json')
}

// Refreshes the routine's actual task logic to whatever this build of the app currently says
// (see buildAiCoachInstructions in aiCoachPrompt.ts) — called on every sign-in (see useAiCoach),
// so opening the app on an updated build is all it takes for existing routines to pick up new
// behavior on their next run, no re-setup needed.
export async function pushInstructions(accessToken: string, content: string): Promise<void> {
  const fileId = await resolveOwnedFileId(
    accessToken,
    AI_COACH_INSTRUCTIONS_FILE_NAME,
    INSTRUCTIONS_FILE_ID_KEY,
    content,
    'text/markdown',
  )
  await writeContent(accessToken, fileId, content, 'text/markdown')
}

// Newest first, since that's the one the app should read. The routine writes both a
// "report-<date>.md" and a "report-<date>.json" per run (same create-only prefix), so the
// extension has to be part of the query — otherwise the newer of the two files could shadow the
// other one regardless of type.
async function findReportFiles(
  accessToken: string,
  folderId: string,
  extension: 'md' | 'json',
): Promise<{ id: string; createdTime: string }[]> {
  const q = [
    `name contains '${AI_COACH_REPORT_FILE_PREFIX}'`,
    `name contains '.${extension}'`,
    `'${folderId}' in parents`,
    'trashed = false',
  ].join(' and ')
  const params = new URLSearchParams({ q, orderBy: 'createdTime desc', fields: 'files(id,createdTime)' })
  const res = await fetch(`${DRIVE_FILES_URL}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Drive lookup failed (${res.status})`)
  const data: { files?: { id: string; createdTime: string }[] } = await res.json()
  return data.files ?? []
}

// Null means the routine hasn't written one yet — distinct from a report with empty content.
export async function pullLatestReport(accessToken: string): Promise<AiCoachReport | null> {
  const folderId = await resolveFolderId(accessToken)
  const [latest] = await findReportFiles(accessToken, folderId, 'md')
  if (!latest) return null
  const content = await readContent(accessToken, latest.id)
  if (content === null) return null
  return { content, generatedAt: latest.createdTime }
}

export interface AiCoachInsights {
  planSuggestions: AiCoachPlanSuggestion[]
  weightSuggestions: AiCoachWeightSuggestion[]
  generatedAt: string
}

// Same create-only pattern as pullLatestReport, but for the structured-suggestions sibling file.
// Malformed or missing content degrades to null rather than throwing into the UI — a bad run of
// the routine shouldn't be able to break the dashboard or the workout editor.
export async function pullLatestCoachInsights(accessToken: string): Promise<AiCoachInsights | null> {
  const folderId = await resolveFolderId(accessToken)
  const [latest] = await findReportFiles(accessToken, folderId, 'json')
  if (!latest) return null
  const content = await readContent(accessToken, latest.id)
  if (content === null) return null
  try {
    const parsed = JSON.parse(content) as { planSuggestions?: unknown; weightSuggestions?: unknown }
    if (typeof parsed !== 'object' || parsed === null) return null
    return {
      planSuggestions: Array.isArray(parsed.planSuggestions) ? (parsed.planSuggestions as AiCoachPlanSuggestion[]) : [],
      weightSuggestions: Array.isArray(parsed.weightSuggestions)
        ? (parsed.weightSuggestions as AiCoachWeightSuggestion[])
        : [],
      generatedAt: latest.createdTime,
    }
  } catch {
    return null
  }
}
