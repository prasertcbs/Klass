// timer.js — TimerEngine
//
// Framework-agnostic port of the Avalonia TimerViewModel. Holds no DOM refs:
// it owns the timer state machine and emits a "change" event whenever any
// observable state changes, so app.js can render. Mirrors the original's
// [ObservableProperty]/event separation (logic here, view interaction in app.js).

// ── State machine (Models/TimerState.cs) ────────────────────────────────
export const State = Object.freeze({
  Idle: "Idle",
  Countdown: "Countdown",
  Clock: "Clock",
  Paused: "Paused",
  Expired: "Expired",
});

// ── Quick-timer presets (TimerViewModel.Presets) ────────────────────────
export const PRESETS = [
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "3m", seconds: 180 },
  { label: "5m", seconds: 300 },
  { label: "7m", seconds: 420 },
  { label: "10m", seconds: 600 },
  { label: "15m", seconds: 900 },
  { label: "20m", seconds: 1200 },
  { label: "25m", seconds: 1500 },
  { label: "30m", seconds: 1800 },
  { label: "1h", seconds: 3600 },
  { label: "1h30m", seconds: 5400 },
  { label: "2h", seconds: 7200 },
  { label: "2h30m", seconds: 9000 },
  { label: "3h", seconds: 10800 },
];

// ── Tunables (TimerViewModel constants) ─────────────────────────────────
const WARNING_THRESHOLD_SECONDS = 60;
const ALERT_THRESHOLD_SECONDS = 10;
const CLOCK_FORMAT_24H = true;
const EXPIRED_TEXT = "TIME'S UP";
const EXPIRED_TEXT_COLOR = "#FFFFFF";
const TICK_MS = 50;

export class TimerEngine extends EventTarget {
  constructor() {
    super();

    // Observable-ish state (rendered by app.js on "change").
    this.state = State.Idle;
    this.displayText = "00:00";
    this.displayColorHex = "#2563eb";
    this.isAlerting = false;
    this.showCountdown = true;
    this.errorMessage = "";
    this.isDarkTheme = false; // Klass defaults to light; app.js syncs from html.dark

    // Timer internals.
    this._endTime = null; // epoch ms
    this._pausedRemainingSeconds = 0;
    this._intervalId = null;

    this.displayColorHex = this._colorNormal();
  }

  // ── Theme-aware urgency colors (color-blind conscious; normal = KTempo blue) ──
  _colorNormal() { return this.isDarkTheme ? "#60a5fa" : "#2563eb"; }
  _colorWarning() { return this.isDarkTheme ? "#F59E0B" : "#D97706"; }
  _colorAlert() { return this.isDarkTheme ? "#EF4444" : "#DC2626"; }
  _colorClock() { return this.isDarkTheme ? "#8B5CF6" : "#7C3AED"; }

  _colorForRemaining(seconds) {
    if (seconds > WARNING_THRESHOLD_SECONDS) return this._colorNormal();
    if (seconds > ALERT_THRESHOLD_SECONDS) return this._colorWarning();
    return this._colorAlert();
  }

  // ── Computed helpers (mirror read-only VM properties) ─────────────────
  get isRunning() {
    return this.state === State.Countdown
      || this.state === State.Paused
      || this.state === State.Clock;
  }
  get isExpired() { return this.state === State.Expired; }
  get pauseButtonVisible() {
    return this.state === State.Countdown || this.state === State.Paused;
  }
  get pauseButtonText() {
    return this.state === State.Paused ? "▶  Resume" : "⏸  Pause";
  }
  get stopButtonVisible() {
    return this.state === State.Countdown
      || this.state === State.Paused
      || this.state === State.Expired;
  }

  // ── Change notification ───────────────────────────────────────────────
  _emit(extra = {}) {
    this.dispatchEvent(new CustomEvent("change", { detail: extra }));
  }

  // ── Public commands (RelayCommands) ───────────────────────────────────

  setTheme(isDark) {
    this.isDarkTheme = isDark;
    this._updateDisplayColor();
    this._emit();
  }

  startDeadline(hourStr, minuteStr, ampm) {
    this.errorMessage = "";

    const hour = parseInt(hourStr, 10);
    if (!Number.isInteger(hour) || hour < 1 || hour > 12) {
      this.errorMessage = "Hour must be 1–12.";
      this._emit();
      return false;
    }
    const minute = parseInt(minuteStr, 10);
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      this.errorMessage = "Minute must be 0–59.";
      this._emit();
      return false;
    }

    let hour24 = hour % 12;
    if (String(ampm).toUpperCase() === "PM") hour24 += 12;

    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour24, minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    const totalSeconds = Math.ceil((target.getTime() - now.getTime()) / 1000);
    return this._startDuration(totalSeconds);
  }

  startQuickTimer(minutesStr) {
    this.errorMessage = "";
    const mins = parseFloat(minutesStr);
    if (!Number.isFinite(mins) || mins <= 0 || mins > 999) {
      this.errorMessage = "Enter a value between 1 and 999.";
      this._emit();
      return false;
    }
    return this._startDuration(Math.ceil(mins * 60));
  }

  startPreset(seconds) {
    this.errorMessage = "";
    if (seconds > 0) return this._startDuration(seconds);
    return false;
  }

  stopReset() {
    this._stopInterval();
    this._endTime = null;
    this._pausedRemainingSeconds = 0;

    this.state = State.Idle;
    this.displayText = "00:00";
    this.displayColorHex = this._colorNormal();
    this.isAlerting = false;
    this.showCountdown = true;
    this.errorMessage = "";
    this._emit();
  }

  toggleClock() {
    if (this.state === State.Countdown) {
      this.showCountdown = !this.showCountdown;
      this._emit();
      return;
    }
    if (this.state === State.Idle) {
      this.state = State.Clock;
      this.displayColorHex = this._colorClock();
      this._startInterval();
      this._emit();
    }
  }

  pauseResume() {
    if (this.state === State.Countdown) {
      this._stopInterval();
      if (this._endTime != null) {
        this._pausedRemainingSeconds = (this._endTime - Date.now()) / 1000;
      }
      this.state = State.Paused;
      this._emit();
    } else if (this.state === State.Paused) {
      if (this._pausedRemainingSeconds > 0) {
        this._endTime = Date.now() + this._pausedRemainingSeconds * 1000;
        this.state = State.Countdown;
        this._startInterval();
        this._emit();
      }
    }
  }

  // ── Core logic ────────────────────────────────────────────────────────

  _startDuration(totalSeconds) {
    if (totalSeconds <= 0) return false;

    this._endTime = Date.now() + totalSeconds * 1000;
    this.state = State.Countdown;
    this.showCountdown = true;
    this.isAlerting = false;
    this.errorMessage = "";

    this._updateCountdownDisplay(totalSeconds);
    this._startInterval();
    this._emit();
    return true;
  }

  // Called every tick and on visibilitychange — derives everything from the
  // absolute end timestamp so background-tab throttling can't drift the clock.
  tick() {
    if (this.state === State.Clock) {
      this.displayText = this._formatClock();
      this.displayColorHex = this._colorClock();
      this._emit();
      return;
    }

    if (this.state === State.Countdown && this._endTime != null) {
      const remaining = (this._endTime - Date.now()) / 1000;

      if (remaining <= 0) {
        this._stopInterval();
        this._endTime = null;
        this.displayText = EXPIRED_TEXT;
        this.displayColorHex = EXPIRED_TEXT_COLOR;
        this.isAlerting = true;
        this.state = State.Expired;
        this._emit({ expired: true });
        return;
      }

      if (this.showCountdown) {
        this._updateCountdownDisplay(Math.ceil(remaining));
      } else {
        this.displayText = this._formatClock();
        this.displayColorHex = this._colorClock();
        this.isAlerting = false;
      }
      this._emit();
    }
  }

  _updateCountdownDisplay(totalSeconds) {
    this.displayText = TimerEngine.formatDuration(totalSeconds);
    this.displayColorHex = this._colorForRemaining(totalSeconds);
    this.isAlerting = totalSeconds <= ALERT_THRESHOLD_SECONDS;
  }

  _updateDisplayColor() {
    const remaining = this._currentRemainingSeconds();
    switch (this.state) {
      case State.Expired:
        this.displayColorHex = EXPIRED_TEXT_COLOR; break;
      case State.Clock:
        this.displayColorHex = this._colorClock(); break;
      case State.Countdown:
      case State.Paused:
        this.displayColorHex = remaining > 0
          ? (this.showCountdown ? this._colorForRemaining(Math.ceil(remaining)) : this._colorClock())
          : this._colorNormal();
        break;
      default:
        this.displayColorHex = this._colorNormal();
    }
  }

  _currentRemainingSeconds() {
    if (this.state === State.Paused) return this._pausedRemainingSeconds;
    if (this.state === State.Countdown && this._endTime != null) {
      return (this._endTime - Date.now()) / 1000;
    }
    return 0;
  }

  // ── Interval management ───────────────────────────────────────────────
  _startInterval() {
    this._stopInterval();
    this._intervalId = setInterval(() => this.tick(), TICK_MS);
  }
  _stopInterval() {
    if (this._intervalId != null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  // ── Formatting ────────────────────────────────────────────────────────
  static formatDuration(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const p = (n) => String(n).padStart(2, "0");
    return hours > 0
      ? `${p(hours)}:${p(minutes)}:${p(seconds)}`
      : `${p(minutes)}:${p(seconds)}`;
  }

  _formatClock() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    if (CLOCK_FORMAT_24H) {
      return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
    let h = d.getHours() % 12;
    if (h === 0) h = 12;
    return `${p(h)}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}
