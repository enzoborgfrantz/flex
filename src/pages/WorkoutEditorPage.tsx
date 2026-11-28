import { useEffect, useMemo, useRef, useState } from "react";
import { RestTimer, type RestTimerState } from "../components/RestTimer";
import { Button, Card, Collapsible, NumberField, TextField } from "../components/ui";
import {
  getExerciseById,
  muscleGroups,
  searchExercises,
} from "../data/exercises";
import {
  entriesFromTemplate,
  findLastEntry,
  isReadyToIncrease,
  templateExercisesFromEntries,
} from "../plans/plans";
import {
  clearWorkoutDraft,
  loadWorkoutDraft,
  saveWorkoutDraft,
} from "../storage/workoutDraftStore";
import { useEquipment } from "../storage/useEquipment";
import { useAiCoach } from "../sync/useAiCoach";
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
const DEFAULT_REST_SEC = 90;

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6M15 6l-.72 10.1a1.5 1.5 0 0 1-1.5 1.4H7.22a1.5 1.5 0 0 1-1.5-1.4L5 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.3 9v5.2M11.7 9v5.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M4 10.3l3.7 3.7L16 5.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M3 13.5l5-5 3 3 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.5 4.5h4.5v4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
      {
        reps: lastSet?.reps ?? 8,
        weightKg: lastSet?.weightKg ?? 0,
        done: false,
      },
    ],
  };
}

type PlanDraftExercise = TemplateExercise & { key: string };

interface WorkoutEditorPageProps {
  initialSession?: WorkoutSession;
  // Resumes the saved draft, if any — used only by the dashboard's Draft
  // card. A plain "New workout" always starts blank.
  startFromDraft?: boolean;
  // Jumps straight into "Edit plan" for this template — used by the dashboard's
  // Workout Plans section, which has no "new workout" screen to fall back to.
  initialEditingTemplate?: WorkoutTemplate;
  // Pre-fills entries from this template, like picking it from "Load a plan" — used by the
  // dashboard's "Next up" card. initialPlanSlotIndex comes along with it so the saved session
  // can be stamped as having completed that rotation slot.
  initialTemplate?: WorkoutTemplate;
  initialPlanSlotIndex?: number;
  history: WorkoutSession[];
  templates: WorkoutTemplate[];
  saveTemplate: (name: string, exercises: TemplateExercise[], id?: string) => void;
  deleteTemplate: (id: string) => void;
  onSave: (session: WorkoutSession) => void;
  onCancel: () => void;
}

export function WorkoutEditorPage({
  initialSession,
  startFromDraft,
  initialEditingTemplate,
  initialTemplate,
  initialPlanSlotIndex,
  history,
  templates,
  saveTemplate,
  deleteTemplate,
  onSave,
  onCancel,
}: WorkoutEditorPageProps) {
  const draft =
    !initialSession && startFromDraft ? loadWorkoutDraft() : null;
  const [date, setDate] = useState(
    initialSession?.date ?? draft?.date ?? todayIso(),
  );
  const [entries, setEntries] = useState<ExerciseEntry[]>(
    initialSession?.exercises ??
      draft?.exercises ??
      (initialTemplate
        ? entriesFromTemplate(initialTemplate, history, todayIso())
        : []),
  );
  // Generated once per editor instance rather than in handleSave, so that a repeat save
  // (e.g. a double-tap on "Save" before the view switches away) overwrites the same
  // session instead of a fresh random id creating a duplicate entry.
  const sessionIdRef = useRef(initialSession?.id ?? crypto.randomUUID());
  // Fixed for the life of this editor instance — only ever set by the "Next up" flow, or
  // carried over when re-editing a session that was already stamped.
  const planSlotIndex = initialPlanSlotIndex ?? initialSession?.planSlotIndex;
  // Tracks whether this session has ever held exercises, so a blank "new
  // workout" that's immediately cancelled doesn't wipe out an unrelated
  // draft that was already saved from a previous session.
  const hadEntriesRef = useRef(entries.length > 0);

  useEffect(() => {
    if (entries.length > 0) hadEntriesRef.current = true;
  }, [entries]);

  useEffect(() => {
    if (initialSession) return;
    if (entries.length === 0) {
      if (hadEntriesRef.current) clearWorkoutDraft();
      return;
    }
    saveWorkoutDraft({ date, exercises: entries });
  }, [initialSession, date, entries]);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);

  const { equipment } = useEquipment();
  const { weightSuggestions } = useAiCoach(history, templates, equipment);
  const [planName, setPlanName] = useState<string | null>(
    initialEditingTemplate?.name ?? null,
  );
  // Editing a plan works on targets, kept apart from the workout in progress.
  const [editingPlan, setEditingPlan] = useState<{
    id: string;
    exercises: PlanDraftExercise[];
  } | null>(() =>
    initialEditingTemplate
      ? {
          id: initialEditingTemplate.id,
          exercises: initialEditingTemplate.exercises.map((exercise) => ({
            ...exercise,
            target: { ...exercise.target },
            key: crypto.randomUUID(),
          })),
        }
      : null,
  );

  const lastEntryFor = (exerciseId: string) =>
    findLastEntry(history, exerciseId, date, initialSession?.id);

  const loadTemplate = (template: WorkoutTemplate) => {
    setEntries(
      entriesFromTemplate(template, history, date, initialSession?.id),
    );
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
    // Entered directly from the dashboard's Workout Plans section — there's no "pick a
    // different plan" list to fall back to here, so leave the editor entirely.
    if (initialEditingTemplate) {
      onCancel();
      return;
    }
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
          target.sets > 0 &&
          target.repsMin > 0 &&
          target.repsMin <= target.repsMax,
      )
    : entries.length > 0 && entries.every((entry) => entry.sets.length > 0);
  const canSavePlan =
    trimmedPlanName !== "" && !planNameTaken && planContentValid;

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
          exercises: current.exercises.filter(
            (exercise) => exercise.key !== key,
          ),
        },
    );
  };

  const moveExercise = (entryId: string, direction: -1 | 1) => {
    setEntries((current) => {
      const index = current.findIndex((entry) => entry.id === entryId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const movePlanExercise = (key: string, direction: -1 | 1) => {
    setEditingPlan((current) => {
      if (!current) return current;
      const index = current.exercises.findIndex(
        (exercise) => exercise.key === key,
      );
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.exercises.length) {
        return current;
      }
      const exercises = [...current.exercises];
      [exercises[index], exercises[target]] = [
        exercises[target],
        exercises[index],
      ];
      return { ...current, exercises };
    });
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

  // Changing a set's weight also carries forward to later sets that still
  // matched its old weight, so bumping set 1 updates the rest of a
  // same-weight exercise without touching sets already done or ones that
  // were deliberately set to a different weight (e.g. a pyramid).
  const updateSet = (
    entryId: string,
    setIndex: number,
    change: { reps?: number; weightKg?: number; done?: boolean },
  ) => {
    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== entryId) return entry;
        const previousWeight = entry.sets[setIndex]?.weightKg;
        return {
          ...entry,
          sets: entry.sets.map((set, index) => {
            if (index === setIndex) {
              return {
                ...set,
                reps: change.reps ?? set.reps,
                weightKg: change.weightKg ?? set.weightKg,
                done: change.done ?? set.done,
              };
            }
            const newWeight = change.weightKg;
            const shouldPropagateWeight =
              newWeight !== undefined &&
              index > setIndex &&
              !set.done &&
              set.weightKg === previousWeight;
            return shouldPropagateWeight
              ? { ...set, weightKg: newWeight }
              : set;
          }),
        };
      }),
    );
  };

  // Ticking a set done starts (or replaces) the rest timer; un-ticking the set
  // that started it cancels it.
  const toggleSetDone = (
    entry: ExerciseEntry,
    setIndex: number,
    done: boolean,
  ) => {
    updateSet(entry.id, setIndex, { done });
    if (done) {
      setRestTimer({
        id: crypto.randomUUID(),
        entryId: entry.id,
        setIndex,
        seconds: getExerciseById(entry.exerciseId)?.restSec ?? DEFAULT_REST_SEC,
        exerciseName: entry.name,
      });
    } else {
      setRestTimer((current) =>
        current && current.entryId === entry.id && current.setIndex === setIndex
          ? null
          : current,
      );
    }
  };

  const canSave =
    entries.length > 0 && entries.every((entry) => entry.sets.length > 0);

  const handleSave = () => {
    const session: WorkoutSession = {
      id: sessionIdRef.current,
      date,
      exercises: entries,
      updatedAt: Date.now(),
      ...(planSlotIndex !== undefined ? { planSlotIndex } : {}),
    };
    if (!initialSession) clearWorkoutDraft();
    onSave(session);
  };

  return (
    <div
      className={`workout-editor${restTimer ? " workout-editor--rest-timer-active" : ""}`}
    >
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
        {!initialSession && !editingPlan && !initialTemplate && templates.length > 0 && (
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
        {editingPlan ? (
          editingPlan.exercises.length === 0 ? (
            <p>No exercises in this plan yet.</p>
          ) : (
            <ul className="workout-editor__entries">
              {editingPlan.exercises.map((exercise, index) => (
                <li key={exercise.key} className="workout-editor__entry">
                  <div className="workout-editor__entry-header">
                    <div className="workout-editor__entry-title">
                      <div className="workout-editor__entry-move">
                        <button
                          type="button"
                          className="workout-editor__icon-btn workout-editor__icon-btn--move"
                          onClick={() => movePlanExercise(exercise.key, -1)}
                          disabled={index === 0}
                          aria-label="Move exercise up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="workout-editor__icon-btn workout-editor__icon-btn--move"
                          onClick={() => movePlanExercise(exercise.key, 1)}
                          disabled={index === editingPlan.exercises.length - 1}
                          aria-label="Move exercise down"
                        >
                          ↓
                        </button>
                      </div>
                      <strong>{exercise.name}</strong>
                    </div>
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
                            <NumberField
                              min={1}
                              aria-label="Target sets"
                              value={exercise.target.sets}
                              onChange={(sets) =>
                                updatePlanExercise(exercise.key, { sets })
                              }
                            />
                          </td>
                          <td className="workout-editor__rep-range">
                            <NumberField
                              min={1}
                              aria-label="Minimum reps"
                              value={exercise.target.repsMin}
                              onChange={(repsMin) =>
                                updatePlanExercise(exercise.key, { repsMin })
                              }
                            />
                            –
                            <NumberField
                              min={1}
                              aria-label="Maximum reps"
                              value={exercise.target.repsMax}
                              onChange={(repsMax) =>
                                updatePlanExercise(exercise.key, { repsMax })
                              }
                            />
                          </td>
                          <td>
                            <NumberField
                              min={0}
                              step={0.5}
                              aria-label="Starting weight in kg"
                              value={exercise.startWeightKg}
                              onChange={(startWeightKg) =>
                                updatePlanExercise(exercise.key, {
                                  startWeightKg,
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
            {entries.map((entry, index) => {
              const last = lastEntryFor(entry.exerciseId);
              const weightSuggestion = weightSuggestions.find(
                (suggestion) => suggestion.exerciseId === entry.exerciseId,
              );
              const nudgeText = weightSuggestion
                ? weightSuggestion.detail
                : entry.target && last && isReadyToIncrease(last, entry.target.repsMax)
                  ? `You hit ${entry.target.repsMax} on every set last time — time to go up in weight.`
                  : null;
              return (
                <li key={entry.id} className="workout-editor__entry">
                  <div className="workout-editor__entry-header">
                    <strong>{entry.name}</strong>
                    <div className="workout-editor__entry-actions">
                      <div className="workout-editor__entry-move">
                        <button
                          type="button"
                          className="workout-editor__icon-btn workout-editor__icon-btn--move"
                          onClick={() => moveExercise(entry.id, -1)}
                          disabled={index === 0}
                          aria-label="Move exercise up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="workout-editor__icon-btn workout-editor__icon-btn--move"
                          onClick={() => moveExercise(entry.id, 1)}
                          disabled={index === entries.length - 1}
                          aria-label="Move exercise down"
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        type="button"
                        className="workout-editor__icon-btn workout-editor__icon-btn--exercise"
                        onClick={() => removeExercise(entry.id)}
                        aria-label="Remove exercise"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  {nudgeText && (
                    <p className="workout-editor__nudge">
                      <TrendUpIcon />
                      <span>{nudgeText}</span>
                    </p>
                  )}
                  <div className="workout-editor__set-list">
                    {(() => {
                      const firstActiveIndex = entry.sets.findIndex(
                        (set) => !set.done,
                      );
                      return entry.sets.map((set, setIndex) => {
                        const rowStatus = set.done
                          ? "done"
                          : setIndex === firstActiveIndex
                            ? "current"
                            : "upcoming";
                        return (
                          <div
                            className={`workout-editor__set-row workout-editor__set-row--${rowStatus}`}
                            key={setIndex}
                          >
                            <div
                              className="workout-editor__set-step"
                              aria-hidden="true"
                            >
                              <span className="workout-editor__set-number">
                                <span className="workout-editor__set-number-text">
                                  {setIndex + 1}
                                </span>
                              </span>
                            </div>
                            <label className="workout-editor__set-field">
                              <span className="workout-editor__set-field-label">
                                <span className="workout-editor__set-field-label-text">
                                  Reps
                                </span>
                              </span>
                              <NumberField
                                min={0}
                                value={set.reps}
                                onChange={(reps) =>
                                  updateSet(entry.id, setIndex, { reps })
                                }
                              />
                            </label>
                            <label className="workout-editor__set-field">
                              <span className="workout-editor__set-field-label">
                                <span className="workout-editor__set-field-label-text">
                                  Weight (kg)
                                </span>
                              </span>
                              <NumberField
                                min={0}
                                step={0.5}
                                value={set.weightKg}
                                onChange={(weightKg) =>
                                  updateSet(entry.id, setIndex, { weightKg })
                                }
                              />
                            </label>
                            <button
                              type="button"
                              className={`workout-editor__done${
                                set.done ? " workout-editor__done--on" : ""
                              }`}
                              onClick={() =>
                                toggleSetDone(entry, setIndex, !set.done)
                              }
                              aria-pressed={!!set.done}
                              aria-label={`Set ${setIndex + 1} done`}
                            >
                              <CheckIcon />
                            </button>
                            <button
                              type="button"
                              className="workout-editor__icon-btn workout-editor__icon-btn--set"
                              onClick={() => removeSet(entry.id, setIndex)}
                              aria-label="Remove set"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="workout-editor__entry-footer">
                    <Button
                      variant="secondary"
                      className="workout-editor__add-set"
                      onClick={() => addSet(entry.id)}
                    >
                      + Add set
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Collapsible
        title="Exercises"
        defaultOpen={
          editingPlan ? editingPlan.exercises.length === 0 : entries.length === 0
        }
        className="workout-editor__library"
      >
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
      </Collapsible>

      {planName === null ? (
        <div className="workout-editor__actions">
          <div className="workout-editor__actions-row">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={entries.length === 0}
              onClick={() => setPlanName("")}
            >
              Save as plan
            </Button>
          </div>
          <Button
            className="workout-editor__save-btn"
            disabled={!canSave}
            onClick={handleSave}
          >
            Save
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
          <div className="workout-editor__actions-row">
            <Button variant="secondary" onClick={stopEditingPlan}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSavePlan}>
              Save plan
            </Button>
          </div>
          {planNameTaken && (
            <p className="workout-editor__plan-error">
              Another plan is already called “{trimmedPlanName}”.
            </p>
          )}
        </form>
      )}
      {restTimer && (
        <RestTimer timer={restTimer} onDismiss={() => setRestTimer(null)} />
      )}
    </div>
  );
}
