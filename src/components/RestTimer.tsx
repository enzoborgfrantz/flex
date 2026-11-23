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

  // A new timer (new id) always restarts fresh, replacing whatever was running.
  useEffect(() => {
    setRemaining(timer.seconds);
    setPaused(false);
    setFinished(false);
    chimedRef.current = false;
  }, [timer.id, timer.seconds]);

  useEffect(() => {
    if (paused || finished) return;
    if (remaining <= 0) {
      if (!chimedRef.current) {
        chimedRef.current = true;
        setFinished(true);
        playChime();
      }
      return;
    }
    const timeout = setTimeout(() => setRemaining((current) => current - 1), 1000);
    return () => clearTimeout(timeout);
  }, [remaining, paused, finished]);

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
          onClick={() => setRemaining((current) => Math.max(0, current - ADJUST_STEP_SEC))}
          aria-label="Subtract 30 seconds"
        >
          −30
        </button>
        <button
          type="button"
          onClick={() => setRemaining((current) => current + ADJUST_STEP_SEC)}
          aria-label="Add 30 seconds"
        >
          +30
        </button>
        <button
          type="button"
          onClick={() => setPaused((current) => !current)}
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
