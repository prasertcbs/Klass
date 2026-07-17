// app.js — view wiring
//
// Ports the Avalonia view layer (MainWindow.axaml.cs + CompactWindow behavior):
// binds the TimerEngine to the DOM, wires commands & keyboard shortcuts, and
// implements the three view modes (normal / focus / compact). Klass edition:
// theme state lives in Klass's theme.js (html.dark + localStorage 'klass-theme');
// this module only mirrors it into the engine's urgency colors.

import { TimerEngine, State, PRESETS } from "./timer.js";
import { ChimePlayer } from "./audio.js";

const STORAGE_KEY = "ktempo.settings.v1";

const engine = new TimerEngine();
const chime = new ChimePlayer("chime.mp3");

// ── DOM refs ───────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const els = {
  html: document.documentElement,
  titlebar: $("titlebar"),
  chimeBtn: $("chimeBtn"),
  themeBtn: $("themeBtn"),
  focusBtn: $("focusBtn"),
  compactBtn: $("compactBtn"),
  sidebarBtn: $("sidebarBtn"),

  stage: $("stage"),
  timerCard: $("timerCard"),
  timerLine: $("timerLine"),
  timerText: $("timerText"),
  alarmIcon: $("alarmIcon"),
  stageActions: $("stageActions"),
  pauseBtn: $("pauseBtn"),
  stopBtn: $("stopBtn"),

  sidebar: $("sidebar"),
  deadlineHour: $("deadlineHour"),
  deadlineMinute: $("deadlineMinute"),
  ampmBtn: $("ampmBtn"),
  startDeadlineBtn: $("startDeadlineBtn"),
  clockBtn: $("clockBtn"),
  quickMinutes: $("quickMinutes"),
  quickBtn: $("quickBtn"),
  presets: $("presets"),
  errorMessage: $("errorMessage"),

  focusOverlay: $("focusOverlay"),
  focusTimerLine: $("focusTimerLine"),
  focusTimerText: $("focusTimerText"),
  focusAlarmIcon: $("focusAlarmIcon"),
  exitFocusBtn: $("exitFocusBtn"),
  focusActions: $("focusActions"),
  focusPauseBtn: $("focusPauseBtn"),
  focusStopBtn: $("focusStopBtn"),

  compactTemplate: $("compactTemplate"),
};

// ── View mode state (kept here, not in the engine — mirrors code-behind) ─
let isFocusMode = false;
let isCompactMode = false;
let isSidebarOpen = true;
let ampm = "AM";
let pipWindow = null;       // Document Picture-in-Picture window
let compactOverlay = null;  // in-page fallback element
let compactEls = null;      // { line, text, root } inside PiP/overlay

// ── Persistence ────────────────────────────────────────────────────────
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (typeof s.chimeEnabled === "boolean") chime.enabled = s.chimeEnabled;
    if (typeof s.quickMinutes === "string") els.quickMinutes.value = s.quickMinutes;
    if (typeof s.deadlineHour === "string") els.deadlineHour.value = s.deadlineHour;
    if (typeof s.deadlineMinute === "string") els.deadlineMinute.value = s.deadlineMinute;
    if (typeof s.ampm === "string") ampm = s.ampm;
    if (typeof s.sidebarOpen === "boolean") isSidebarOpen = s.sidebarOpen;
  } catch { /* ignore corrupt settings */ }
}
function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      chimeEnabled: chime.enabled,
      quickMinutes: els.quickMinutes.value,
      deadlineHour: els.deadlineHour.value,
      deadlineMinute: els.deadlineMinute.value,
      ampm,
      sidebarOpen: isSidebarOpen,
    }));
  } catch { /* ignore */ }
}

// ── Default deadline: next whole hour (TimerViewModel constructor) ───────
function initDefaultDeadline() {
  if (els.deadlineHour.value && els.deadlineMinute.value) return;
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  let h12 = next.getHours() % 12;
  if (h12 === 0) h12 = 12;
  els.deadlineHour.value = String(h12);
  els.deadlineMinute.value = "0";
  ampm = next.getHours() >= 12 ? "PM" : "AM";
}

// ── Presets ────────────────────────────────────────────────────────────
function buildPresets() {
  const frag = document.createDocumentFragment();
  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.className = "preset";
    b.textContent = p.label;
    b.addEventListener("click", () => {
      chime.unlock();
      engine.startPreset(p.seconds);
    });
    frag.appendChild(b);
  }
  els.presets.appendChild(frag);
}

// ── Rendering (engine "change" → DOM) ────────────────────────────────────
function render() {
  const color = engine.displayColorHex;
  const expired = engine.isExpired;

  // Timer text + color (both normal + focus mirrors).
  els.timerText.textContent = engine.displayText;
  els.focusTimerText.textContent = engine.displayText;
  els.html.style.setProperty("--display-color", color);

  // Alarm icon only on expiry. Use toggleAttribute (not .hidden) because these
  // are SVGElements — the `hidden` IDL property lives on HTMLElement and won't
  // reflect to the attribute here.
  els.alarmIcon.toggleAttribute("hidden", !expired);
  els.focusAlarmIcon.toggleAttribute("hidden", !expired);

  // Pulsing when alerting (≤10s or expired).
  els.timerLine.classList.toggle("pulsing", engine.isAlerting);
  els.focusTimerLine.classList.toggle("pulsing", engine.isAlerting);

  // Expired background.
  els.timerCard.classList.toggle("expired", expired);
  els.focusOverlay.classList.toggle("expired", expired);

  // Action buttons.
  els.stageActions.hidden = !engine.stopButtonVisible;
  els.focusActions.hidden = !engine.stopButtonVisible;
  const pv = engine.pauseButtonVisible;
  els.pauseBtn.hidden = !pv;
  els.focusPauseBtn.hidden = !pv;
  els.pauseBtn.textContent = engine.pauseButtonText;
  els.focusPauseBtn.textContent = engine.pauseButtonText;

  // Inputs disabled while running.
  const running = engine.isRunning;
  for (const el of [els.deadlineHour, els.deadlineMinute, els.ampmBtn,
    els.startDeadlineBtn, els.quickMinutes, els.quickBtn]) {
    el.disabled = running;
  }

  // Error message.
  els.errorMessage.textContent = engine.errorMessage;
  els.errorMessage.hidden = !engine.errorMessage;

  els.ampmBtn.textContent = ampm;

  // Compact mirror.
  if (compactEls) {
    compactEls.text.textContent = engine.displayText;
    compactEls.line.classList.toggle("pulsing", engine.isAlerting);
    compactEls.root.classList.toggle("expired", expired);
    if (compactEls.doc) {
      compactEls.doc.documentElement.style.setProperty("--display-color", color);
    }
  }
}

engine.addEventListener("change", (e) => {
  render();
  if (e.detail && e.detail.expired) chime.play();
});

// ── Commands ─────────────────────────────────────────────────────────────
els.startDeadlineBtn.addEventListener("click", () => {
  chime.unlock();
  if (engine.startDeadline(els.deadlineHour.value, els.deadlineMinute.value, ampm)) saveSettings();
});
els.quickBtn.addEventListener("click", () => {
  chime.unlock();
  if (engine.startQuickTimer(els.quickMinutes.value)) saveSettings();
});
els.pauseBtn.addEventListener("click", () => engine.pauseResume());
els.focusPauseBtn.addEventListener("click", () => engine.pauseResume());
els.stopBtn.addEventListener("click", () => engine.stopReset());
els.focusStopBtn.addEventListener("click", () => engine.stopReset());
els.clockBtn.addEventListener("click", () => { chime.unlock(); engine.toggleClock(); });
els.ampmBtn.addEventListener("click", () => {
  ampm = ampm === "AM" ? "PM" : "AM";
  saveSettings();
  render();
});
els.quickMinutes.addEventListener("change", saveSettings);
els.deadlineHour.addEventListener("change", saveSettings);
els.deadlineMinute.addEventListener("change", saveSettings);

// Toolbar
els.chimeBtn.addEventListener("click", () => {
  chime.setEnabled(!chime.enabled);
  els.chimeBtn.setAttribute("aria-pressed", String(chime.enabled));
  els.chimeBtn.textContent = chime.enabled ? "🔔" : "🔕";
  saveSettings();
});
els.themeBtn.addEventListener("click", toggleTheme);
els.focusBtn.addEventListener("click", toggleFocusMode);
els.compactBtn.addEventListener("click", toggleCompactMode);
els.sidebarBtn.addEventListener("click", toggleSidebar);
els.exitFocusBtn.addEventListener("click", toggleFocusMode);

// Double-tap timer toggles focus (OnTimerDoubleTapped).
els.timerLine.addEventListener("dblclick", toggleFocusMode);
els.focusTimerLine.addEventListener("dblclick", toggleFocusMode);

// ── Theme (delegated to Klass theme.js: html.dark + 'klass-theme' key) ────
// The engine only needs dark vs light for its urgency colors; a
// MutationObserver keeps it in sync no matter who flips the class.
function syncThemeFromKlass() {
  const isDark = els.html.classList.contains("dark");
  els.themeBtn.textContent = isDark ? "🌙" : "☀️";
  if (compactEls && compactEls.doc) {
    compactEls.doc.documentElement.classList.toggle("dark", isDark);
  }
  if (engine.isDarkTheme !== isDark) engine.setTheme(isDark);
}
new MutationObserver(syncThemeFromKlass)
  .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
function toggleTheme() {
  if (window.KlassTheme) window.KlassTheme.toggle();
}

// ── Sidebar ──────────────────────────────────────────────────────────────
function applySidebar() {
  els.sidebar.classList.toggle("collapsed", !isSidebarOpen);
}
function toggleSidebar() {
  isSidebarOpen = !isSidebarOpen;
  applySidebar();
  saveSettings();
}

// ── Focus mode (Fullscreen API) ──────────────────────────────────────────
function toggleFocusMode() {
  if (isCompactMode) closeCompact();
  isFocusMode = !isFocusMode;
  els.focusOverlay.hidden = !isFocusMode;
  if (isFocusMode) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  }
  render();
}
// Sync when the user leaves fullscreen via Esc/F11 handled by the browser.
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && isFocusMode) {
    isFocusMode = false;
    els.focusOverlay.hidden = true;
    render();
  }
});

// ── Compact mode (Document Picture-in-Picture, with in-page fallback) ─────
function makeCompactContent() {
  const node = els.compactTemplate.content.firstElementChild.cloneNode(true);
  const line = node.querySelector("#compactTimerLine");
  const text = node.querySelector("#compactTimerText");
  const closeBtn = node.querySelector("#compactCloseBtn");
  closeBtn.addEventListener("click", closeCompact);
  return { node, line, text, root: node, closeBtn };
}

async function toggleCompactMode() {
  if (isCompactMode) { closeCompact(); return; }
  if (isFocusMode) toggleFocusMode();

  const content = makeCompactContent();

  if (window.documentPictureInPicture) {
    try {
      pipWindow = await window.documentPictureInPicture.requestWindow({ width: 320, height: 110 });
      // Copy our stylesheet into the PiP document so tokens/fonts resolve.
      copyStyles(pipWindow.document);
      pipWindow.document.documentElement.classList.toggle("dark", engine.isDarkTheme);
      pipWindow.document.body.style.margin = "0";
      pipWindow.document.body.appendChild(content.node);
      compactEls = { line: content.line, text: content.text, root: content.root, doc: pipWindow.document };
      isCompactMode = true;
      pipWindow.addEventListener("pagehide", onPipClosed, { once: true });
      render();
      return;
    } catch { pipWindow = null; /* fall through to overlay */ }
  }

  // Fallback: in-page floating overlay.
  compactOverlay = document.createElement("div");
  compactOverlay.className = "compact-overlay";
  compactOverlay.appendChild(content.node);
  document.body.appendChild(compactOverlay);
  compactEls = { line: content.line, text: content.text, root: content.root, doc: null };
  isCompactMode = true;
  render();
}

function copyStyles(doc) {
  for (const sheet of document.styleSheets) {
    try {
      const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      const style = doc.createElement("style");
      style.textContent = rules;
      doc.head.appendChild(style);
    } catch {
      // Cross-origin sheet: re-link by href instead.
      if (sheet.href) {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        doc.head.appendChild(link);
      }
    }
  }
}

function onPipClosed() {
  pipWindow = null;
  compactEls = null;
  isCompactMode = false;
  render();
}

function closeCompact() {
  if (pipWindow) { pipWindow.close(); pipWindow = null; }
  if (compactOverlay) { compactOverlay.remove(); compactOverlay = null; }
  compactEls = null;
  isCompactMode = false;
  render();
}

// ── Keyboard shortcuts (MainWindow.axaml.cs OnKeyDown) ────────────────────
window.addEventListener("keydown", (e) => {
  // Don't fire shortcuts while typing in an input.
  const t = document.activeElement;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;

  switch (e.key) {
    case "Escape":
      if (engine.state === State.Expired) { chime.dismiss(); e.preventDefault(); }
      else if (isFocusMode) { toggleFocusMode(); e.preventDefault(); }
      else if (isCompactMode) { closeCompact(); e.preventDefault(); }
      break;
    case "F11":
      toggleFocusMode(); e.preventDefault(); break;
    case "f": case "F":
      toggleFocusMode(); e.preventDefault(); break;
    case "F9":
      toggleCompactMode(); e.preventDefault(); break;
    case "c": case "C":
      toggleCompactMode(); e.preventDefault(); break;
    case " ": // Space → pause/resume
      if (engine.pauseButtonVisible) { engine.pauseResume(); e.preventDefault(); }
      break;
  }
});

// Recompute against the wall clock when the tab regains focus (background
// throttling can freeze setInterval; the engine derives from an absolute end
// time so a single tick resyncs it).
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) engine.tick();
});

// Service worker registration is handled by Klass's assets/app.js.

// ── Boot ─────────────────────────────────────────────────────────────────
loadSettings();
initDefaultDeadline();
buildPresets();
syncThemeFromKlass();
applySidebar();
els.chimeBtn.setAttribute("aria-pressed", String(chime.enabled));
els.chimeBtn.textContent = chime.enabled ? "🔔" : "🔕";
render();
