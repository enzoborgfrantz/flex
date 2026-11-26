import { useEffect, useRef, useState } from "react";
import { useAuth, type AuthUser } from "../auth/AuthContext";
import { CoachSuggestions } from "../components/CoachSuggestions";
import { Logo } from "../components/Logo";
import { Button, Card } from "../components/ui";
import { equipmentOptions } from "../data/equipment";
import { clearWorkoutDraft, loadWorkoutDraft } from "../storage/workoutDraftStore";
import { useEquipment } from "../storage/useEquipment";
import { useTemplates } from "../sync/useTemplates";
import { useWorkouts, type SyncStatus } from "../sync/useWorkouts";
import type { WorkoutSession, WorkoutTemplate } from "../types/workout";
import { AiCoachPage } from "./AiCoachPage";
import { WorkoutDetailPage } from "./WorkoutDetailPage";
import { WorkoutEditorPage } from "./WorkoutEditorPage";

type View =
  | { name: "list" }
  | { name: "new" }
  | { name: "resume-draft" }
  | { name: "edit"; session: WorkoutSession }
  | { name: "edit-plan"; template: WorkoutTemplate }
  | { name: "detail"; session: WorkoutSession }
  | { name: "ai-coach" };

function SyncDot({
  status,
  onRetry,
}: {
  status: SyncStatus;
  onRetry: () => void;
}) {
  if (status === "idle") return null;

  if (status === "error")
    return (
      <button
        type="button"
        className="sync-dot sync-dot--error"
        onClick={onRetry}
        title="Sync failed — click to retry"
        aria-label="Sync failed — click to retry"
      />
    );

  const variant =
    status === "syncing" ? "busy" : status === "synced" ? "ok" : "saved";
  const label =
    status === "syncing"
      ? "Syncing…"
      : status === "synced"
        ? "Synced"
        : "Saved on this device";

  return (
    <span
      className={`sync-dot sync-dot--${variant}`}
      role="status"
      title={label}
      aria-label={label}
    />
  );
}

function AccountMenu({
  user,
  syncStatus,
  onRetrySync,
  onSignOut,
}: {
  user: AuthUser | null;
  syncStatus: SyncStatus;
  onRetrySync: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="account__menu" ref={ref}>
      <button
        type="button"
        className="account__avatar-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {user?.picture ? (
          <img
            className="account__avatar"
            src={user.picture}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="account__avatar account__avatar--fallback">
            {user?.name?.[0] ?? "?"}
          </span>
        )}
      </button>
      <SyncDot status={syncStatus} onRetry={onRetrySync} />
      {open && (
        <div className="account__dropdown">
          <span className="account__name">{user?.name}</span>
          <Button variant="secondary" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user, signOut } = useAuth();
  const { sessions, saveWorkout, deleteWorkout, syncStatus, retrySync } =
    useWorkouts();
  const { equipment, toggleEquipment } = useEquipment();
  const { templates, saveTemplate, deleteTemplate } = useTemplates();
  const [view, setView] = useState<View>({ name: "list" });
  const [draft, setDraft] = useState(() => loadWorkoutDraft());

  // The draft can change while the editor is open, so refresh it whenever
  // we land back on the list — that's the only place it's displayed. The
  // draft lives in local storage only, so a session saved elsewhere (e.g.
  // another device) can leave a stale draft behind once it syncs in here —
  // discard it rather than show a "draft" for a workout that's already saved.
  useEffect(() => {
    if (view.name !== "list") return;
    const current = loadWorkoutDraft();
    if (current && sessions.some((session) => session.date === current.date)) {
      clearWorkoutDraft();
      setDraft(null);
      return;
    }
    setDraft(current);
  }, [view, sessions]);

  const handleSave = (session: WorkoutSession) => {
    saveWorkout(session);
    setView({ name: "detail", session });
  };

  return (
    <section id="dashboard">
      <header>
        <Logo onClick={() => setView({ name: "list" })} />
        <div className="account">
          <AccountMenu
            user={user}
            syncStatus={syncStatus}
            onRetrySync={retrySync}
            onSignOut={signOut}
          />
        </div>
      </header>

      {view.name === "list" && (
        <>
          <div className="dashboard__toolbar">
            <Button variant="metal" onClick={() => setView({ name: "new" })}>
              New workout
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setView({ name: "ai-coach" })}>
              AI Coach
            </Button>
          </div>
          <Card className="dashboard__equipment">
            <h2>Your equipment</h2>
            <p className="dashboard__equipment-hint">
              What you've got access to — tap to toggle. Nothing selected means everything's assumed available.
            </p>
            <div className="dashboard__equipment-chips" role="group" aria-label="Equipment you have access to">
              {equipmentOptions.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`dashboard__equipment-chip${
                    equipment.includes(id) ? " dashboard__equipment-chip--active" : ""
                  }`}
                  aria-pressed={equipment.includes(id)}
                  onClick={() => toggleEquipment(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>
          <CoachSuggestions
            sessions={sessions}
            equipment={equipment}
            templates={templates}
            saveTemplate={saveTemplate}
            deleteTemplate={deleteTemplate}
            onEditPlan={(template) => setView({ name: "edit-plan", template })}
          />
          <h2 className="dashboard__section-heading">Past workouts</h2>
          {sessions.length === 0 && !draft ? (
            <p>No workout sessions yet — start a new one above.</p>
          ) : (
            <ul className="dashboard__sessions">
              {draft && (
                <li>
                  <Card
                    interactive
                    className="dashboard__draft-card"
                    onClick={() => setView({ name: "resume-draft" })}
                  >
                    <span className="dashboard__draft-tag-group">
                      <span className="dashboard__draft-tag">Draft</span>
                      <button
                        type="button"
                        className="dashboard__draft-delete"
                        aria-label="Discard draft"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Discard this draft workout?")) {
                            clearWorkoutDraft();
                            setDraft(null);
                          }
                        }}
                      >
                        ✕
                      </button>
                    </span>
                    <div className="dashboard__session-row">
                      <strong>{draft.date}</strong>
                      <p>
                        {draft.exercises.length} exercise
                        {draft.exercises.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </Card>
                </li>
              )}
              {sessions.map((session) => (
                <li key={session.id}>
                  <Card
                    interactive
                    onClick={() => setView({ name: "detail", session })}
                  >
                    <div className="dashboard__session-row">
                      <strong>{session.date}</strong>
                      <p>
                        {session.exercises.length} exercise
                        {session.exercises.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view.name === "new" && (
        <WorkoutEditorPage
          history={sessions}
          templates={templates}
          saveTemplate={saveTemplate}
          deleteTemplate={deleteTemplate}
          onSave={handleSave}
          onCancel={() => setView({ name: "list" })}
        />
      )}

      {view.name === "resume-draft" && (
        <WorkoutEditorPage
          startFromDraft
          history={sessions}
          templates={templates}
          saveTemplate={saveTemplate}
          deleteTemplate={deleteTemplate}
          onSave={handleSave}
          onCancel={() => setView({ name: "list" })}
        />
      )}

      {view.name === "edit" && (
        <WorkoutEditorPage
          initialSession={view.session}
          history={sessions}
          templates={templates}
          saveTemplate={saveTemplate}
          deleteTemplate={deleteTemplate}
          onSave={handleSave}
          onCancel={() => setView({ name: "detail", session: view.session })}
        />
      )}

      {view.name === "edit-plan" && (
        <WorkoutEditorPage
          initialEditingTemplate={view.template}
          history={sessions}
          templates={templates}
          saveTemplate={saveTemplate}
          deleteTemplate={deleteTemplate}
          onSave={() => setView({ name: "list" })}
          onCancel={() => setView({ name: "list" })}
        />
      )}

      {view.name === "detail" && (
        <WorkoutDetailPage
          session={view.session}
          onEdit={() => setView({ name: "edit", session: view.session })}
          onDelete={() => {
            deleteWorkout(view.session.id);
            setView({ name: "list" });
          }}
          onBack={() => setView({ name: "list" })}
        />
      )}

      {view.name === "ai-coach" && (
        <AiCoachPage sessions={sessions} templates={templates} onBack={() => setView({ name: "list" })} />
      )}
    </section>
  );
}
