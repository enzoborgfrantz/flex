import { useEffect, useRef, useState } from "react";
import "./RestTimer.css";

export interface RestTimerState {
  id: string;
  entryId: string;
  setIndex: number;
  seconds: number;
  exerciseName: string;
}

interface RestTimerProps {
  timer: RestTimerState;
  onDismiss: () => void;
}

const ADJUST_STEP_SEC = 30;

function playChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const playTone = (startAt: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + startAt + 0.3,
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + 0.32);
    };
    playTone(0, 880);
    playTone(0.18, 1175);
  } catch {
    // Audio unavailable (unsupported browser, blocked autoplay) — the visual flash still fires.
  }
}

export function RestTimer({ timer, onDismiss }: RestTimerProps) {
  const [remaining, setRemaining] = useState(timer.seconds);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const chimedRef = useRef(false);
  // Wall-clock deadline rather than a decrementing counter, so a screen lock
  // (which suspends timers entirely) can't leave the display stuck — the
  // next tick or visibility change recomputes from real elapsed time.
  const endAtRef = useRef(Date.now() + timer.seconds * 1000);

  // A new timer (new id) always restarts fresh, replacing whatever was running.
  useEffect(() => {
    setRemaining(timer.seconds);
    setPaused(false);
    setFinished(false);
    chimedRef.current = false;
    endAtRef.current = Date.now() + timer.seconds * 1000;
  }, [timer.id, timer.seconds]);

  // Keep the screen awake while resting, so the browser never auto-locks
  // mid-countdown. Only covers auto-lock from inactivity, not a manual
  // power-button press — the OS honors that regardless.
  useEffect(() => {
    if (paused || finished || !("wakeLock" in navigator)) return;

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
      } catch {
        // Denied (e.g. low power mode) — timer still runs, just can't hold the screen on.
      }
    };

    acquire();
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) acquire();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [paused, finished, timer.id]);

  useEffect(() => {
    if (paused || finished) return;

    const sync = () => {
      const secsLeft = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(secsLeft);
      if (secsLeft <= 0 && !chimedRef.current) {
        chimedRef.current = true;
        setFinished(true);
        playChime();
      }
    };

    sync();
    const interval = setInterval(sync, 1000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [paused, finished, timer.id, timer.seconds]);

  const clamped = Math.max(remaining, 0);
  const minutes = Math.floor(clamped / 60);
  const secs = clamped % 60;

  return (
    <div
      className={`rest-timer${finished ? " rest-timer--finished" : ""}`}
      role="timer"
    >
      <div className="rest-timer__info">
        <span className="rest-timer__label">Resting · {timer.exerciseName}</span>
        <span className="rest-timer__clock">
          {minutes}:{secs.toString().padStart(2, "0")}
        </span>
      </div>
      <div className="rest-timer__controls">
        <button
          type="button"
          onClick={() => {
            setRemaining((current) => Math.max(0, current - ADJUST_STEP_SEC));
            endAtRef.current = Math.max(Date.now(), endAtRef.current - ADJUST_STEP_SEC * 1000);
          }}
          aria-label="Subtract 30 seconds"
        >
          −30
        </button>
        <button
          type="button"
          onClick={() => {
            setRemaining((current) => current + ADJUST_STEP_SEC);
            endAtRef.current += ADJUST_STEP_SEC * 1000;
          }}
          aria-label="Add 30 seconds"
        >
          +30
        </button>
        <button
          type="button"
          onClick={() =>
            setPaused((current) => {
              const next = !current;
              if (!next) {
                endAtRef.current = Date.now() + remaining * 1000;
              }
              return next;
            })
          }
          aria-label={paused ? "Resume rest timer" : "Pause rest timer"}
        >
          {paused ? "▶" : "⏸"}
        </button>
        <button type="button" onClick={onDismiss} aria-label="Dismiss rest timer">
          ✕
        </button>
      </div>
    </div>
  );
}
