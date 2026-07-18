# Klass – Classroom Tools

An installable, offline-capable PWA with nine classroom tools sharing one design system (light/dark, single indigo accent):

- **KRandom** – random name picker for classroom participation
- **KWheel** – spinning prize wheel: the celebratory, projector-friendly way to pick a name
- **KAssignTeam** – balanced random team assignment from a list or CSV
- **KPresenter** – team → member roulette for fair presentation rotation
- **KSeatingChart** – randomized seating charts that maximize spacing
- **KTempo** – countdown timer (deadline / quick / presets), clock mode, focus & compact (PiP) modes, time's-up chime
- **KPomodoro** – repeating work/break study cycle with session tracking and daily stats
- **KQR** – giant projector-sized QR code for sharing links with the room
- **KNoise** – live classroom noise meter with warning/alert thresholds and focus mode

All dependencies (Tailwind, Font Awesome, Inter font) are vendored under `assets/` — no CDN, fully offline after first visit.

Office-suite-style identity: each app has its own accent color (KRandom emerald, KAssignTeam rose, KPresenter orange, KSeatingChart cyan, KTempo blue, KQR purple, KNoise teal, KWheel amber, KPomodoro fuchsia) defined in `assets/accents.css` via a `data-app` attribute on `<html>`, while the chrome stays neutral and the Klass logo stays indigo.

## Run locally

PWAs require HTTP(S); `file://` won't work. From this folder:

```
python -m http.server 8000
```

then open <http://localhost:8000>.

## Updating after changes

The service worker (`sw.js`) precaches everything under a versioned cache name.
**Whenever you change any file, bump `CACHE_VERSION` in `sw.js`** (e.g. `klass-v1` → `klass-v2`) so installed clients pick up the update on next reload.

## Structure

- `index.html` – launcher hub with install button
- `assets/klass.css` – design tokens (light/dark CSS variables) + shared components
- `assets/theme.js` – shared Tailwind config + theme toggle (default light, remembered in `localStorage`)
- `assets/app.js` – service worker registration + install prompt
- `manifest.webmanifest`, `sw.js`, `icons/` – PWA plumbing
