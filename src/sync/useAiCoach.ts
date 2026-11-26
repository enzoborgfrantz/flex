import { useCallback, useEffect, useRef, useState } from 'react'
import { planSuggestionKey } from '../plans/plans'
import { useAuth } from '../auth/AuthContext'
import type {
  AiCoachConfig,
  AiCoachDeclineStatus,
  AiCoachPlanSuggestion,
  AiCoachReport,
  AiCoachWeightSuggestion,
} from '../types/aiCoach'
import type { Equipment } from '../types/exercise'
import type { WorkoutSession, WorkoutTemplate } from '../types/workout'
import {
  buildSnapshot,
  pullConfig,
  pullLatestCoachInsights,
  pullLatestReport,
  pushConfig,
  pushInstructions,
  pushSnapshot,
  resetAiCoachDriveCache,
} from './aiCoachDrive'
import { buildAiCoachInstructions } from './aiCoachPrompt'

const SNAPSHOT_PUSH_DEBOUNCE_MS = 1500
const CACHE_KEY = 'flex.ai-coach.cache'
const SNOOZE_DAYS = 7

export type AiCoachLoadStatus = 'offline' | 'loading' | 'ready' | 'error'

interface AiCoachCache {
  report: AiCoachReport | null
  planSuggestions: AiCoachPlanSuggestion[]
  weightSuggestions: AiCoachWeightSuggestion[]
}

const EMPTY_CACHE: AiCoachCache = { report: null, planSuggestions: [], weightSuggestions: [] }

// Last-known-good only — no per-item history. The point is purely to avoid a blank/loading
// dashboard while the Drive round-trip for the real pull is still in flight.
function loadCache(): AiCoachCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? { ...EMPTY_CACHE, ...JSON.parse(raw) } : EMPTY_CACHE
  } catch {
    return EMPTY_CACHE
  }
}

function saveCache(cache: AiCoachCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Best-effort only — a full/unavailable localStorage shouldn't break the coach.
  }
}

export function useAiCoach(sessions: WorkoutSession[], templates: WorkoutTemplate[], equipment: Equipment[]) {
  const { accessToken } = useAuth()
  const [config, setConfig] = useState<AiCoachConfig | null>(null)
  const [report, setReport] = useState<AiCoachReport | null>(() => loadCache().report)
  const [planSuggestions, setPlanSuggestions] = useState<AiCoachPlanSuggestion[]>(() => loadCache().planSuggestions)
  const [weightSuggestions, setWeightSuggestions] = useState<AiCoachWeightSuggestion[]>(
    () => loadCache().weightSuggestions,
  )
  const [status, setStatus] = useState<AiCoachLoadStatus>(accessToken ? 'loading' : 'offline')
  const [reloadToken, setReloadToken] = useState(0)
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshReport = useCallback(() => {
    if (!accessToken) return
    Promise.all([pullLatestReport(accessToken), pullLatestCoachInsights(accessToken)])
      .then(([loadedReport, insights]) => {
        setReport(loadedReport)
        setPlanSuggestions(insights?.planSuggestions ?? [])
        setWeightSuggestions(insights?.weightSuggestions ?? [])
        saveCache({
          report: loadedReport,
          planSuggestions: insights?.planSuggestions ?? [],
          weightSuggestions: insights?.weightSuggestions ?? [],
        })
      })
      .catch(() => {})
  }, [accessToken])

  // Forgets the cached Drive file/folder ids and re-resolves everything by name — the recovery
  // path if they ever end up pointing at the wrong thing (e.g. a duplicate folder got created
  // and cleaned up manually in Drive).
  const resetConnection = useCallback(() => {
    resetAiCoachDriveCache()
    setReloadToken((token) => token + 1)
  }, [])

  // Load config + report + plan suggestions on sign-in, and again on an explicit
  // resetConnection(). report/planSuggestions already show cached values from the first render,
  // so this just revalidates them in the background.
  useEffect(() => {
    if (!accessToken) {
      setStatus('offline')
      return
    }
    setStatus('loading')
    Promise.all([pullConfig(accessToken), pullLatestReport(accessToken), pullLatestCoachInsights(accessToken)])
      .then(([loadedConfig, loadedReport, insights]) => {
        setConfig(loadedConfig)
        setReport(loadedReport)
        setPlanSuggestions(insights?.planSuggestions ?? [])
        setWeightSuggestions(insights?.weightSuggestions ?? [])
        saveCache({
          report: loadedReport,
          planSuggestions: insights?.planSuggestions ?? [],
          weightSuggestions: insights?.weightSuggestions ?? [],
        })
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
    // Refreshes the routine's task logic to whatever this build says (see aiCoachPrompt.ts) —
    // the whole point is that opening the app on a newer build is enough to update already-set-up
    // routines by their next scheduled run, with nobody re-pasting a setup prompt.
    pushInstructions(accessToken, buildAiCoachInstructions()).catch(() => {})
  }, [accessToken, reloadToken])

  // Keep the Drive snapshot in sync with local workout/template data so the routine always
  // reads current data — debounced the same way the core workout/template sync is.
  useEffect(() => {
    if (!accessToken) return
    if (snapshotTimer.current) clearTimeout(snapshotTimer.current)
    snapshotTimer.current = setTimeout(() => {
      pushSnapshot(accessToken, buildSnapshot(sessions, templates)).catch(() => {})
    }, SNAPSHOT_PUSH_DEBOUNCE_MS)
    return () => {
      if (snapshotTimer.current) clearTimeout(snapshotTimer.current)
    }
  }, [accessToken, sessions, templates, reloadToken])

  // Mirrors the real equipment selection (synced separately via useEquipment/equipmentDriveFile,
  // in the hidden appDataFolder the coach's own Drive connector can't see) into config.json so
  // the routine can read it. One-way, and only once config has loaded — otherwise this would
  // fire before the real notes/declinedSuggestions arrive and push a blank config over them.
  useEffect(() => {
    if (!accessToken || !config) return
    const current = config.equipment ?? []
    const same = current.length === equipment.length && current.every((id) => equipment.includes(id))
    if (same) return
    const next: AiCoachConfig = { ...config, equipment, updatedAt: Date.now() }
    setConfig(next)
    pushConfig(accessToken, next).catch(() => {})
  }, [accessToken, config, equipment])

  const saveNotes = useCallback(
    (notes: string) => {
      if (!accessToken) return
      setConfig((current) => {
        const next: AiCoachConfig = { ...current, notes, updatedAt: Date.now() }
        pushConfig(accessToken, next).catch(() => {})
        return next
      })
    },
    [accessToken],
  )

  // Declines go to config.json (not applied anywhere locally) so the routine itself stops
  // proposing the same suggestion. Also used to mark an *accepted* suggestion as handled for
  // good (status 'never') — isPlanSuggestionSatisfied only reflects whether the template
  // currently has it, so without this, manually removing an exercise you'd previously accepted
  // (e.g. after realizing you don't have the equipment for it) makes it look "pending" again and
  // resurface as if it were a brand new suggestion.
  const declineSuggestion = useCallback(
    (suggestion: AiCoachPlanSuggestion, status: AiCoachDeclineStatus) => {
      if (!accessToken) return
      const key = planSuggestionKey(suggestion)
      const decidedAt = Date.now()
      setConfig((current) => {
        const next: AiCoachConfig = {
          ...current,
          notes: current?.notes ?? '',
          updatedAt: decidedAt,
          declinedSuggestions: [
            ...(current?.declinedSuggestions ?? []).filter((declined) => declined.key !== key),
            {
              key,
              summary: suggestion.detail,
              status,
              decidedAt,
              ...(status === 'snoozed'
                ? { snoozedUntil: new Date(decidedAt + SNOOZE_DAYS * 86_400_000).toISOString().slice(0, 10) }
                : {}),
            },
          ],
        }
        pushConfig(accessToken, next).catch(() => {})
        return next
      })
    },
    [accessToken],
  )

  // Reverses declineSuggestion — used to undo the implicit 'never' it's given alongside an
  // Accept, so clicking Undo really does put things back as if Accept had never happened.
  const undeclineSuggestion = useCallback(
    (key: string) => {
      if (!accessToken) return
      setConfig((current) => {
        const next: AiCoachConfig = {
          ...current,
          notes: current?.notes ?? '',
          updatedAt: Date.now(),
          declinedSuggestions: (current?.declinedSuggestions ?? []).filter((declined) => declined.key !== key),
        }
        pushConfig(accessToken, next).catch(() => {})
        return next
      })
    },
    [accessToken],
  )

  return {
    config,
    report,
    planSuggestions,
    weightSuggestions,
    status,
    saveNotes,
    declineSuggestion,
    undeclineSuggestion,
    refreshReport,
    resetConnection,
  }
}
