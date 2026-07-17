// audio.js — ChimePlayer
//
// Web replacement for the Avalonia AudioService (which spawned PowerShell/winmm
// on Windows and afplay on macOS). Here it's just an <audio> element whose
// volume ramps 0.30 → 0.90, replaying on each "ended" event until silenced —
// exactly mirroring PlayChime / OnChimeEnded / DismissChime in TimerViewModel.
//
// Browser autoplay policy: audio may only start after a user gesture. unlock()
// primes the element on the first Start/preset click so the later time's-up
// chime is allowed to play.

const CHIME_START_VOLUME = 0.30;
const CHIME_MAX_VOLUME = 0.90;
const CHIME_VOLUME_STEP = 0.10;

export class ChimePlayer {
  constructor(src = "assets/chime.mp3") {
    this.enabled = true;
    this._unlocked = false;
    this._silenced = false;
    this._currentVolume = CHIME_START_VOLUME;

    this._audio = new Audio(src);
    this._audio.preload = "auto";
    this._audio.loop = false;

    // Volume-ramp loop: on each natural end, bump volume and replay, unless
    // dismissed (Esc) or the timer left the Expired state.
    this._audio.addEventListener("ended", () => {
      if (this._silenced) return;
      this._currentVolume = Math.min(this._currentVolume + CHIME_VOLUME_STEP, CHIME_MAX_VOLUME);
      this._audio.volume = this._currentVolume;
      this._audio.currentTime = 0;
      this._audio.play().catch(() => {});
    });
  }

  // Prime playback during a user gesture so the expiry chime can fire later.
  unlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    const a = this._audio;
    const prevVol = a.volume;
    a.volume = 0;
    a.play()
      .then(() => { a.pause(); a.currentTime = 0; a.volume = prevVol; })
      .catch(() => { a.volume = prevVol; });
  }

  // Start the ramping chime from the base volume (called on timer expiry).
  play() {
    if (!this.enabled) return;
    try {
      this.stop();
      this._silenced = false;
      this._currentVolume = CHIME_START_VOLUME;
      this._audio.volume = this._currentVolume;
      this._audio.currentTime = 0;
      this._audio.play().catch(() => {}); // ignore audio errors, never crash
    } catch { /* ignore */ }
  }

  // Silence but leave the expired display on screen (Esc / DismissChime).
  dismiss() {
    this._silenced = true;
    this.stop();
  }

  stop() {
    try {
      this._audio.pause();
      this._audio.currentTime = 0;
    } catch { /* ignore */ }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }
}
