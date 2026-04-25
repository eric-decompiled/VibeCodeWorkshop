# GameWorkShop — Claude Primer

A vanilla-JS canvas platformer workshop. Deployed at **https://vibe.tbaytech.club** via GitHub Pages (flat static hosting — every file in the repo is served from its relative path). No build step, no bundler, no framework.

## Files that matter

| Path | What it is |
|---|---|
| `index.html` | **Student starter.** Single-file canvas platformer with plain-rectangle graphics. This is what students extend. Keep pristine unless asked. |
| `demo.html` | **Playable adventure showcase.** Side-scrolling 4000px world with HP, enemies, music, win/lose states. Used to keep students occupied during workshop setup. **Do NOT modify** — patterns to copy live in `/playbook/` and `playbook/helpers.md`, not here. |
| `gallery.html` | **Visual asset index** — renders everything in `/assets/manifest.json` with play buttons for sounds. Use this to pick assets by sight. |
| `assets/manifest.json` | **Single source of truth.** Every sprite/sound has an entry here keyed by short name. Do not hardcode paths — look them up via the manifest. |
| `assets/CREDITS.md` | Attribution (Kenney CC0, Ove Melaa). |
| `playbook/` | **Premade plans for common workshop tasks.** Read this *before* entering plan mode. |
| `/static/` | Full untouched asset library (175 tiles, 120+ SFX, alien/sci-fi sets). Leave alone — `/assets` is the curated subset. |
| `server.js` | **Unrelated** chat/admin side-project. Not the asset server. Deployment is GH Pages; static files are served from repo root. |

## Rules

1. **Always use `/assets` via the manifest.** Never reference `/static/*` URLs directly from game code — paths contain spaces and production doesn't depend on them.
2. **Add an asset**: drop file into `/assets/<category>/` with `snake_case` no-spaces name, add an entry to `manifest.json`. Update `assets/CREDITS.md` if the source needs attribution.
3. **Sprite loading pattern**: `fetch('assets/manifest.json') → new Image() per path → wait for all onload → draw with 9-arg drawImage for atlases, 5-arg for full sprites`. Canonical copy in `playbook/helpers.md` (Section 2).
4. **Do not touch**: `index.html` (student baseline), `demo.html` (workshop showcase), `/static/**`, `server.js`, `CNAME`. Only modify these when the user explicitly asks.
5. **Common workshop tasks live in `/playbook/`.** Before planning from scratch, check if the task has a playbook entry — it already has file paths, code snippets, and verification steps.
6. **Keep edits small.** Students read this code in class. Avoid premature abstractions, frameworks, or reorganization.

## When a user asks for a common task

Check `playbook/README.md` first. If a matching entry exists, follow it directly — no need for a full plan-mode pass. The playbook entries are self-contained: context, exact edits, verification.

Current playbook entries:
- `add-enemy.md` — walking/flying enemy with collision
- `extend-level.md` — more platforms, scrolling, multiple rooms
- `add-collectible.md` — coins / gems / stars with score
- `add-sound.md` — SFX on events + music toggle
- `change-theme.md` — swap art set (castle / sci-fi / candy)
- `add-win-state.md` — flag at end + game-over / restart
- `helpers.md` — copy/paste utility snippets (aabb, math, asset loading, input, level format)

## Local dev

```sh
npm install        # one-time
npm run dev        # live-server on :8000 with auto-reload on file save
# then open http://localhost:8000/demo.html  (or /index.html, /gallery.html)
```

Fallback (no Node): `python3 -m http.server 8000` — same URLs, no auto-reload.

Do **not** run `node server.js` for the game — that only serves the chat side-project.
