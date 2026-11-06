import { useCallback } from 'react'
import { normalizeTemplate } from '../plans/plans'
import { loadLocalTemplates, saveLocalTemplates } from '../storage/localTemplateStore'
import { templatesDriveFile } from './driveAppData'
import { useSyncedCollection, type SyncedCollectionConfig } from './useSyncedCollection'
import type { WorkoutTemplate } from '../types/workout'

const templatesConfig: SyncedCollectionConfig<WorkoutTemplate> = {
  loadLocal: loadLocalTemplates,
  saveLocal: saveLocalTemplates,
  remote: templatesDriveFile,
  sort: (a, b) => a.name.localeCompare(b.name),
  normalize: normalizeTemplate,
}

export function useTemplates() {
  const { items: templates, update } = useSyncedCollection(templatesConfig)

  // With an id, that plan is updated (and may be renamed). Without one, saving under an existing
  // name overwrites that plan, so re-saving "Workout A" updates it in place.
  const saveTemplate = useCallback(
    (name: string, exercises: WorkoutTemplate['exercises'], id?: string) => {
      update((current) => {
        const existing = id
          ? current.find((template) => template.id === id)
          : current.find((template) => template.name.toLowerCase() === name.toLowerCase())
        const template: WorkoutTemplate = {
          id: existing?.id ?? crypto.randomUUID(),
          name,
          exercises,
          updatedAt: Date.now(),
        }
        const next = existing
          ? current.map((entry) => (entry.id === existing.id ? template : entry))
          : [...current, template]
        return next.sort(templatesConfig.sort)
      })
    },
    [update],
  )

  const deleteTemplate = useCallback(
    (id: string) => {
      update((current) => current.filter((template) => template.id !== id))
    },
    [update],
  )

  return { templates, saveTemplate, deleteTemplate }
}
