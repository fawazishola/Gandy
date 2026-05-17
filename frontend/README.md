# Gandy Frontend (decoupled copy)

This folder contains a self-contained copy of the prototype frontend (React 18 + Babel-in-browser).

## Run / view

### Option A: open directly

- Open `frontend/Gandy.html` in a browser.

### Option B: serve locally (recommended)

From the repo root:

- `python3 -m http.server 5173`
- Visit `http://localhost:5173/frontend/Gandy.html`

## Notes

- This is a prototype/demo UI. Most data is synthetic and persisted to `localStorage` (`gandy-state`).
- The verification pipeline is animated (timer-driven), not wired to the backend.

## Files

- Entry: `Gandy.html`
- App root: `app.jsx`
- Global store/context: `store.jsx`
- Core screens: `dashboard.jsx`, `pr-detail.jsx`, `repositories.jsx`, `reports.jsx`, `settings.jsx`
- Shared UI: `shared.jsx`, `modal.jsx`, `toast.jsx`, `utils.jsx`, `icons.jsx`
- Styling: `styles.css`
