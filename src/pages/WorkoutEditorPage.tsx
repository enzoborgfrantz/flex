import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, TextField } from "../components/ui";
import { muscleGroups, searchExercises } from "../data/exercises";
import type { Exercise, MuscleGroup } from "../types/exercise";
import type { ExerciseEntry, WorkoutSession } from "../types/workout";
import "./WorkoutEditorPage.css";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function createEntry(exercise: Exercise): ExerciseEntry {
  return {
    id: crypto.randomUUID(),
    exerciseId: exercise.id,
    name: exercise.name,
    sets: [{ reps: 8, weightKg: 0 }],
  };
}

interface WorkoutEditorPageProps {
  initialSession?: WorkoutSession;
  onSave: (session: WorkoutSession) => void;
  onCancel: () => void;
}

export function WorkoutEditorPage({
  initialSession,
  onSave,
  onCancel,
}: WorkoutEditorPageProps) {
  const [date, setDate] = useState(initialSession?.date ?? todayIso());
  const [entries, setEntries] = useState<ExerciseEntry[]>(
    initialSession?.exercises ?? [],
  );

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
    setEntries((current) => [...current, createEntry(exercise)]);
  };

  const removeExercise = (entryId: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  };

  const addSet = (entryId: string) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? { ...entry, sets: [...entry.sets, { reps: 8, weightKg: 0 }] }
          : entry,
      ),
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
    field: "reps" | "weightKg",
    value: number,
  ) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              sets: entry.sets.map((set, index) =>
                index === setIndex ? { ...set, [field]: value } : set,
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
        Workout
      </h1>
      <Card className="workout-editor__exercises">
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="workout-editor__date-field"
        />
        <br />
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

        {entries.length === 0 ? (
          <p>No exercises added yet.</p>
        ) : (
          <ul className="workout-editor__entries">
            {entries.map((entry) => (
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
                <div className="workout-editor__sets-wrap">
                  <table className="workout-editor__sets">
                    <thead>
                      <tr>
                        <th>Set</th>
                        <th>Reps</th>
                        <th>Weight (kg)</th>
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
                                updateSet(
                                  entry.id,
                                  setIndex,
                                  "reps",
                                  Number(e.target.value),
                                )
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
                                updateSet(
                                  entry.id,
                                  setIndex,
                                  "weightKg",
                                  Number(e.target.value),
                                )
                              }
                            />
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
            ))}
          </ul>
        )}
      </Card>

      <div className="workout-editor__actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!canSave} onClick={handleSave}>
          Save workout
        </Button>
      </div>
    </div>
  );
}
