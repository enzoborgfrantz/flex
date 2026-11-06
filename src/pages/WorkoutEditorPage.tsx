import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, TextField } from "../components/ui";
import { muscleGroups, searchExercises } from "../data/exercises";
import {
  entriesFromTemplate,
  findLastEntry,
  formatEntry,
  formatTarget,
  isReadyToIncrease,
  templateExercisesFromEntries,
} from "../plans/plans";
import { useTemplates } from "../sync/useTemplates";
import type { Exercise, MuscleGroup } from "../types/exercise";
import type {
  ExerciseEntry,
  ExerciseTarget,
  TemplateExercise,
  WorkoutSession,
  WorkoutTemplate,
} from "../types/workout";
import "./WorkoutEditorPage.css";

const DEFAULT_TARGET: ExerciseTarget = { sets: 3, repsMin: 8, repsMax: 12 };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// A manually added exercise starts from its most recent logged set, if any.
function createEntry(exercise: Exercise, last?: ExerciseEntry): ExerciseEntry {
  const lastSet = last?.sets.at(-1);
  return {
    id: crypto.randomUUID(),
    exerciseId: exercise.id,
    name: exercise.name,
    sets: [
      { reps: lastSet?.reps ?? 8, weightKg: lastSet?.weightKg ?? 0, done: false },
    ],
  };
}

type PlanDraftExercise = TemplateExercise & { key: string };

interface WorkoutEditorPageProps {
  initialSession?: WorkoutSession;
  history: WorkoutSession[];
  onSave: (session: WorkoutSession) => void;
  onCancel: () => void;
}

export function WorkoutEditorPage({
  initialSession,
  history,
  onSave,
  onCancel,
}: WorkoutEditorPageProps) {
  const [date, setDate] = useState(initialSession?.date ?? todayIso());
  const [entries, setEntries] = useState<ExerciseEntry[]>(
    initialSession?.exercises ?? [],
  );

  const { templates, saveTemplate, deleteTemplate } = useTemplates();
  const [planName, setPlanName] = useState<string | null>(null);
  // Editing a plan works on targets, kept apart from the workout in progress.
  const [editingPlan, setEditingPlan] = useState<{
    id: string;
    exercises: PlanDraftExercise[];
  } | null>(null);

  const lastEntryFor = (exerciseId: string) =>
    findLastEntry(history, exerciseId, date, initialSession?.id);

  const loadTemplate = (template: WorkoutTemplate) => {
    setEntries(entriesFromTemplate(template, history, date, initialSession?.id));
  };

  const startEditingPlan = (template: WorkoutTemplate) => {
    setEditingPlan({
      id: template.id,
      exercises: template.exercises.map((exercise) => ({
        ...exercise,
        target: { ...exercise.target },
        key: crypto.randomUUID(),
      })),
    });
    setPlanName(template.name);
  };

  const stopEditingPlan = () => {
    setEditingPlan(null);
    setPlanName(null);
  };

  const updatePlanExercise = (
    key: string,
    change: Partial<ExerciseTarget> & { startWeightKg?: number },
  ) => {
    setEditingPlan(
      (current) =>
        current && {
          ...current,
          exercises: current.exercises.map((exercise) =>
            exercise.key === key
              ? {
                  ...exercise,
                  startWeightKg: change.startWeightKg ?? exercise.startWeightKg,
                  target: {
                    sets: change.sets ?? exercise.target.sets,
                    repsMin: change.repsMin ?? exercise.target.repsMin,
                    repsMax: change.repsMax ?? exercise.target.repsMax,
                  },
                }
              : exercise,
          ),
        },
    );
  };

  const trimmedPlanName = planName?.trim() ?? "";
  const planNameTaken = templates.some(
    (template) =>
      editingPlan &&
      template.id !== editingPlan.id &&
      template.name.toLowerCase() === trimmedPlanName.toLowerCase(),
  );
  const planContentValid = editingPlan
    ? editingPlan.exercises.length > 0 &&
      editingPlan.exercises.every(
        ({ target }) =>
          target.sets > 0 && target.repsMin > 0 && target.repsMin <= target.repsMax,
      )
    : entries.length > 0 && entries.every((entry) => entry.sets.length > 0);
  const canSavePlan = trimmedPlanName !== "" && !planNameTaken && planContentValid;

  const handleSavePlan = () => {
    if (!canSavePlan) return;
    if (editingPlan) {
      saveTemplate(
        trimmedPlanName,
        editingPlan.exercises.map(({ key: _key, ...exercise }) => exercise),
        editingPlan.id,
      );
      stopEditingPlan();
    } else {
      saveTemplate(trimmedPlanName, templateExercisesFromEntries(entries));
      setPlanName(null);
    }
  };

  const [query, setQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | "all">(
    "all",
  );

  const matches = useMemo(
    () => searchExercises({ query, muscle: selectedMuscle, equipment: "all" }),
    [query, selectedMuscle],
  );

  const libraryListRef = useRef<HTMLUListElement>(null);
  const [showScrollFade, setShowScrollFade] = useState(false);

  useEffect(() => {
    const list = libraryListRef.current;
    if (!list) return;

    const updateFade = () => {
      const hasMore =
        list.scrollHeight - list.scrollTop - list.clientHeight > 1;
      setShowScrollFade(hasMore);
    };

    updateFade();
    list.addEventListener("scroll", updateFade);
    window.addEventListener("resize", updateFade);
    return () => {
      list.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", updateFade);
    };
  }, [matches]);

  const addExercise = (exercise: Exercise) => {
    if (editingPlan) {
      setEditingPlan({
        ...editingPlan,
        exercises: [
          ...editingPlan.exercises,
          {
            key: crypto.randomUUID(),
            exerciseId: exercise.id,
            name: exercise.name,
            target: { ...DEFAULT_TARGET },
            startWeightKg: 0,
          },
        ],
      });
      return;
    }
    setEntries((current) => [
      ...current,
      createEntry(exercise, lastEntryFor(exercise.id)),
    ]);
  };

  const removeExercise = (entryId: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  };

  const removePlanExercise = (key: string) => {
    setEditingPlan(
      (current) =>
        current && {
          ...current,
          exercises: current.exercises.filter((exercise) => exercise.key !== key),
        },
    );
  };

  // A new set copies the one before it, unticked.
  const addSet = (entryId: string) => {
    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== entryId) return entry;
        const previous = entry.sets.at(-1);
        return {
          ...entry,
          sets: [
            ...entry.sets,
            {
              reps: previous?.reps ?? 8,
              weightKg: previous?.weightKg ?? 0,
              done: false,
            },
          ],
        };
      }),
    );
  };

  const removeSet = (entryId: string, setIndex: number) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              sets: entry.sets.filter((_, index) => index !== setIndex),
            }
          : entry,
      ),
    );
  };

  const updateSet = (
    entryId: string,
    setIndex: number,
    change: { reps?: number; weightKg?: number; done?: boolean },
  ) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              sets: entry.sets.map((set, index) =>
                index === setIndex ? { ...set, ...change } : set,
              ),
            }
          : entry,
      ),
    );
  };

  const canSave =
    entries.length > 0 && entries.every((entry) => entry.sets.length > 0);

  const handleSave = () => {
    const session: WorkoutSession = {
      id: initialSession?.id ?? crypto.randomUUID(),
      date,
      exercises: entries,
      updatedAt: Date.now(),
    };
    onSave(session);
  };

  return (
    <div className="workout-editor">
      <h1
        style={{
          margin: "0",
          textAlign: "left",
        }}
      >
        {editingPlan ? "Edit plan" : "Workout"}
      </h1>
      <Card className="workout-editor__exercises">
        {!editingPlan && (
          <>
            <TextField
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="workout-editor__date-field"
            />
            <br />
          </>
        )}
        {!initialSession && !editingPlan && templates.length > 0 && (
          <>
            <h2>Load a plan</h2>
            <ul className="workout-editor__plans">
              {templates.map((template) => (
                <li key={template.id} className="workout-editor__plan">
                  <button
                    type="button"
                    className="workout-editor__plan-load"
                    onClick={() => loadTemplate(template)}
                  >
                    <strong>{template.name}</strong>
                    <span>
                      {template.exercises.length} exercise
                      {template.exercises.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="workout-editor__icon-btn workout-editor__icon-btn--edit"
                    onClick={() => startEditingPlan(template)}
                    aria-label={`Edit plan ${template.name}`}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="workout-editor__icon-btn workout-editor__icon-btn--set"
                    onClick={() => {
                      if (window.confirm(`Delete plan "${template.name}"?`))
                        deleteTemplate(template.id);
                    }}
                    aria-label={`Delete plan ${template.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <hr className="workout-editor__divider" />
          </>
        )}
        <h2>Exercises</h2>
        <div className="workout-editor__filters">
          <TextField
            aria-label="Exercise library"
            placeholder="Search, e.g. squat"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div
          className="workout-editor__muscle-chips"
          role="group"
          aria-label="Filter by target muscle"
        >
          <button
            type="button"
            className={`workout-editor__muscle-chip${
              selectedMuscle === "all"
                ? " workout-editor__muscle-chip--active"
                : ""
            }`}
            onClick={() => setSelectedMuscle("all")}
          >
            All
          </button>
          {muscleGroups.map((muscle) => (
            <button
              key={muscle}
              type="button"
              className={`workout-editor__muscle-chip${
                selectedMuscle === muscle
                  ? " workout-editor__muscle-chip--active"
                  : ""
              }`}
              onClick={() => setSelectedMuscle(muscle)}
            >
              {muscle.charAt(0).toUpperCase() + muscle.slice(1)}
            </button>
          ))}
        </div>
        <div className="workout-editor__library-list-wrap">
          <ul className="workout-editor__library-list" ref={libraryListRef}>
            {matches.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  className="workout-editor__library-item"
                  onClick={() => addExercise(exercise)}
                >
                  <strong>{exercise.name}</strong>
                  <span
                    className="workout-editor__library-add"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && <p>No exercises match those filters.</p>}
          </ul>
          <div
            className={`workout-editor__library-fade${
              showScrollFade ? " workout-editor__library-fade--visible" : ""
            }`}
            aria-hidden="true"
          />
        </div>

        <hr className="workout-editor__divider" />

        {editingPlan ? (
          editingPlan.exercises.length === 0 ? (
            <p>No exercises in this plan yet.</p>
          ) : (
            <ul className="workout-editor__entries">
              {editingPlan.exercises.map((exercise) => (
                <li key={exercise.key} className="workout-editor__entry">
                  <div className="workout-editor__entry-header">
                    <strong>{exercise.name}</strong>
                    <button
                      type="button"
                      className="workout-editor__icon-btn workout-editor__icon-btn--exercise"
                      onClick={() => removePlanExercise(exercise.key)}
                      aria-label="Remove exercise"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="workout-editor__sets-wrap">
                    <table className="workout-editor__sets">
                      <thead>
                        <tr>
                          <th>Sets</th>
                          <th>Reps</th>
                          <th>Start (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <input
                              type="number"
                              min={1}
                              aria-label="Target sets"
                              value={exercise.target.sets}
                              onChange={(e) =>
                                updatePlanExercise(exercise.key, {
                                  sets: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td className="workout-editor__rep-range">
                            <input
                              type="number"
                              min={1}
                              aria-label="Minimum reps"
                              value={exercise.target.repsMin}
                              onChange={(e) =>
                                updatePlanExercise(exercise.key, {
                                  repsMin: Number(e.target.value),
                                })
                              }
                            />
                            –
                            <input
                              type="number"
                              min={1}
                              aria-label="Maximum reps"
                              value={exercise.target.repsMax}
                              onChange={(e) =>
                                updatePlanExercise(exercise.key, {
                                  repsMax: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              aria-label="Starting weight in kg"
                              value={exercise.startWeightKg}
                              onChange={(e) =>
                                updatePlanExercise(exercise.key, {
                                  startWeightKg: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {exercise.target.repsMin > exercise.target.repsMax && (
                    <p className="workout-editor__plan-error">
                      Minimum reps can't be above maximum reps.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : entries.length === 0 ? (
          <p>No exercises added yet.</p>
        ) : (
          <ul className="workout-editor__entries">
            {entries.map((entry) => {
              const last = lastEntryFor(entry.exerciseId);
              return (
                <li key={entry.id} className="workout-editor__entry">
                  <div className="workout-editor__entry-header">
                    <strong>{entry.name}</strong>
                    <button
                      type="button"
                      className="workout-editor__icon-btn workout-editor__icon-btn--exercise"
                      onClick={() => removeExercise(entry.id)}
                      aria-label="Remove exercise"
                    >
                      ✕
                    </button>
                  </div>
                  {(entry.target || last) && (
                    <div className="workout-editor__entry-meta">
                      {entry.target && (
                        <span>Target {formatTarget(entry.target)}</span>
                      )}
                      {last && <span>Last: {formatEntry(last)}</span>}
                    </div>
                  )}
                  {entry.target &&
                    last &&
                    isReadyToIncrease(last, entry.target.repsMax) && (
                      <p className="workout-editor__nudge">
                        ↑ You hit {entry.target.repsMax} on every set last time
                        — time to go up in weight.
                      </p>
                    )}
                  <div className="workout-editor__sets-wrap">
                    <table className="workout-editor__sets">
                      <thead>
                        <tr>
                          <th>Set</th>
                          <th>Reps</th>
                          <th>Weight (kg)</th>
                          <th>Done</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {entry.sets.map((set, setIndex) => (
                          <tr key={setIndex}>
                            <td>{setIndex + 1}</td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                value={set.reps}
                                onChange={(e) =>
                                  updateSet(entry.id, setIndex, {
                                    reps: Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={set.weightKg}
                                onChange={(e) =>
                                  updateSet(entry.id, setIndex, {
                                    weightKg: Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`workout-editor__done${
                                  set.done ? " workout-editor__done--on" : ""
                                }`}
                                onClick={() =>
                                  updateSet(entry.id, setIndex, {
                                    done: !set.done,
                                  })
                                }
                                aria-pressed={!!set.done}
                                aria-label={`Set ${setIndex + 1} done`}
                              >
                                ✓
                              </button>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="workout-editor__icon-btn workout-editor__icon-btn--set"
                                onClick={() => removeSet(entry.id, setIndex)}
                                aria-label="Remove set"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => addSet(entry.id)}
                  >
                    + Add set
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {planName === null ? (
        <div className="workout-editor__actions">
          <Button
            variant="secondary"
            className="workout-editor__save-plan-btn"
            disabled={entries.length === 0}
            onClick={() => setPlanName("")}
          >
            Save as plan
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={handleSave}>
            Save workout
          </Button>
        </div>
      ) : (
        <form
          className="workout-editor__actions workout-editor__save-plan"
          onSubmit={(e) => {
            e.preventDefault();
            handleSavePlan();
          }}
        >
          <TextField
            aria-label="Plan name"
            placeholder="Plan name, e.g. Workout A"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            list={editingPlan ? undefined : "workout-editor-plan-names"}
            autoFocus
          />
          {!editingPlan && (
            <datalist id="workout-editor-plan-names">
              {templates.map((template) => (
                <option key={template.id} value={template.name} />
              ))}
            </datalist>
          )}
          <Button variant="secondary" onClick={stopEditingPlan}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSavePlan}>
            Save plan
          </Button>
          {planNameTaken && (
            <p className="workout-editor__plan-error">
              Another plan is already called “{trimmedPlanName}”.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
