# Playbook

Premade plans for common workshop tasks. Each entry is self-contained: what to read, what to edit, exact code to paste, and how to verify.

## When to use a playbook entry

If the user's request matches the **Triggers** section of an entry, **skip plan mode** — open the entry, follow its steps directly. The plan is already done. Save plan-mode for genuinely novel work.

If the request is close but not exact (e.g. user wants a patrolling enemy and there's only an "add-enemy" entry that walks straight), still start from the closest playbook entry as a base, then diverge.

## Index

| Entry | Triggers |
|---|---|
| [add-enemy.md](add-enemy.md) | "add an enemy", "slime that walks", "bad guy", "something that hurts the player" |
| [extend-level.md](extend-level.md) | "more platforms", "bigger level", "scrolling world", "second level", "add a room" |
| [add-collectible.md](add-collectible.md) | "add coins", "gems", "score counter", "pickups" |
| [add-sound.md](add-sound.md) | "jump sound", "background music", "sound effects", "play a sound when X" |
| [change-theme.md](change-theme.md) | "castle theme", "sci-fi", "change the background", "different art style" |
| [add-win-state.md](add-win-state.md) | "win condition", "flag at the end", "game over", "lives", "restart" |
| [helpers.md](helpers.md) | "common utils", "collision helper", "math helpers", "level format", "asset loader", "input handling" |

## Conventions across all entries

- **Default edit target is `demo.html`** (sprite-based). If a user asks about "the game" without specifying, ask which file — but assume `demo.html` for anything using sprites/sound.
- **Never reference `/static/*` paths** in game code. Every asset goes through `assets/manifest.json`.
- **Add new assets before coding against them.** Drop file → add manifest entry → restart server → then write the code. Stale manifests cause silent load failures.
- **Run the gallery at `/gallery.html` to pick assets by sight** instead of guessing at names.
- **Verify by opening the page in a browser** with DevTools Network tab open. Zero 404s means the manifest is consistent.
