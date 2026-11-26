import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card } from '../components/ui'
import { SimpleMarkdown } from '../components/SimpleMarkdown'
import { buildAiCoachSetupPrompt } from '../sync/aiCoachPrompt'
import { useAiCoach } from '../sync/useAiCoach'
import { useTemplates } from '../sync/useTemplates'
import type { WorkoutSession } from '../types/workout'
import './AiCoachPage.css'

const STALE_AFTER_MS = 10 * 24 * 60 * 60 * 1000

function isReportStale(generatedAt: string): boolean {
  return Date.now() - new Date(generatedAt).getTime() > STALE_AFTER_MS
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`
}

interface AiCoachPageProps {
  sessions: WorkoutSession[]
  onBack: () => void
}

export function AiCoachPage({ sessions, onBack }: AiCoachPageProps) {
  const { templates } = useTemplates()
  const { config, report, status, saveNotes, refreshReport, resetConnection } = useAiCoach(sessions, templates)
  const [notesDraft, setNotesDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [setupExpanded, setSetupExpanded] = useState(false)
  const [showPromptText, setShowPromptText] = useState(false)
  const prompt = useMemo(() => buildAiCoachSetupPrompt(), [])

  useEffect(() => {
    if (config) setNotesDraft(config.notes)
  }, [config])

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(prompt)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  const hasReport = Boolean(report)
  const isStale = hasReport && isReportStale(report!.generatedAt)
  const notesDirty = notesDraft !== (config?.notes ?? '')

  return (
    <div className="ai-coach">
      <div className="ai-coach__header">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <h1>AI Coach</h1>
      </div>

      {status === 'offline' && (
        <Card>
          <p>Sign in to set up your AI coach.</p>
        </Card>
      )}

      {status !== 'offline' && (
        <>
          <Card className="ai-coach__report">
            <div className="ai-coach__report-header">
              <h2>Daily review</h2>
              {hasReport && (
                <div className="ai-coach__report-meta">
                  {isStale && <Badge tone="neutral">Hasn't run in a while</Badge>}
                  <span className="ai-coach__updated">Updated {timeAgo(report!.generatedAt)}</span>
                  <Button variant="secondary" size="sm" onClick={refreshReport}>
                    Refresh
                  </Button>
                </div>
              )}
            </div>
            {status === 'loading' && <p>Loading…</p>}
            {status === 'error' && <p>Couldn't reach Google Drive — try again shortly.</p>}
            {status === 'ready' && !hasReport && (
              <p>No review yet — set it up below and it'll write its first one right away.</p>
            )}
            {status === 'ready' && hasReport && <SimpleMarkdown content={report!.content} />}
          </Card>

          <Card className="ai-coach__notes">
            <h2>Notes for your coach</h2>
            <p className="ai-coach__hint">
              Goals, injuries, current focus — anything you want it to keep in mind. It re-reads this every day, so
              there's no need to redo setup when it changes.
            </p>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="e.g. Bulking right now, focus on bench press progress, go easy on my left shoulder."
              rows={4}
            />
            <div className="ai-coach__notes-actions">
              <Button size="sm" disabled={!notesDirty} onClick={() => saveNotes(notesDraft)}>
                Save
              </Button>
            </div>
          </Card>

          <Card className="ai-coach__setup">
            {hasReport && !setupExpanded ? (
              <p className="ai-coach__hint ai-coach__setup-summary">
                Already set up.{' '}
                <button type="button" className="ai-coach__link-button" onClick={() => setSetupExpanded(true)}>
                  Edit setup
                </button>
              </p>
            ) : (
              <>
                <h2>{hasReport ? 'Setup' : 'One-time setup'}</h2>
                <ol className="ai-coach__steps">
                  <li>Copy the prompt.</li>
                  <li>Paste it into Claude (claude.ai or Claude Code) and send it.</li>
                  <li>If it asks to approve Google Drive access for scheduled runs, allow it for all future runs.</li>
                </ol>
                <div className="ai-coach__setup-actions">
                  <Button onClick={handleCopy}>{copied ? 'Copied!' : 'Copy prompt'}</Button>
                  <button
                    type="button"
                    className="ai-coach__link-button"
                    onClick={() => setShowPromptText((v) => !v)}
                  >
                    {showPromptText ? 'Hide prompt text' : 'Show prompt text'}
                  </button>
                </div>
                {showPromptText && (
                  <textarea
                    className="ai-coach__prompt"
                    value={prompt}
                    readOnly
                    rows={6}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                )}
                {hasReport && (
                  <p className="ai-coach__hint">
                    Re-running this prompt is safe — it updates the existing routine instead of duplicating it.
                  </p>
                )}
              </>
            )}
            <button
              type="button"
              className="ai-coach__reset-link"
              onClick={() => {
                if (window.confirm("Forget this device's cached Drive folder/file links and re-find them by name?")) {
                  resetConnection()
                }
              }}
            >
              Trouble connecting? Reset the Drive link.
            </button>
          </Card>
        </>
      )}
    </div>
  )
}
