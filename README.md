# Klass – Classroom Tools

An installable, offline-capable PWA with four classroom tools sharing one design system (light/dark, single indigo accent):

- **KRandom** – random name picker for classroom participation
- **KAssignTeam** – balanced random team assignment from a list or CSV
- **KPresenter** – team → member roulette for fair presentation rotation
- **KSeatingChart** – randomized seating charts that maximize spacing

All dependencies (Tailwind, Font Awesome, Inter font) are vendored under `assets/` — no CDN, fully offline after first visit.

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
