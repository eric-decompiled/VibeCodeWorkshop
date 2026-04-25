# Asset Credits

All files under `/assets` are curated copies of items from `/static`. Originals remain in `/static` if you want access to the full packs (175 tiles, 62 items, 120+ sound effects, 9 music tracks, alien/sci-fi sets).

## Art — Kenney (CC0)

- Source: [Kenney Platformer Art Deluxe](https://kenney.nl/assets/platformer-art-deluxe) and related expansions
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) — free for any use, including commercial, no attribution required (but appreciated)
- Files: everything under `assets/player/`, `assets/tiles/`, `assets/items/`, `assets/enemies/`, `assets/hud/`, `assets/bg/sky.png`, `assets/bg/castle.png`
- Original sprite sheet coordinates for `assets/player/walk.png` are from `static/Art-Pack/Base pack/Player/p1_spritesheet.txt`

## Sci-Fi Background

- `assets/bg/scifi.jpg` — from `static/sci-fi/scifi_platform_BG1.jpg`. Check `/static/sci-fi/` for the original license if redistributing.

## Music — Ove Melaa (CC-BY-SA)

- `assets/music/retro.mp3` — *Italo Unlimited* (Retro Scores)
- `assets/music/ambient.mp3` — *Psycho Behind The Keys* (Orchestral, Ambient Style)
- Source: Ove Melaa's free music packs. Attribute as "Music by Ove Melaa."

## Music — RPG Chiptunes (CC0)

- `assets/music/town.ogg` — *Town* (rpgchip03)
- `assets/music/dungeon.ogg` — *Dungeon* (rpgchip06)
- `assets/music/game_over.ogg` — *Game Over* (rpgchip15)
- Source: ["15 Melodic RPG Chiptunes" by Aureolus_Omicron](https://opengameart.org/content/15-melodic-rpg-chiptunes) — CC0, attribution appreciated but not required.

## Sound Effects

- `assets/sfx/jump.ogg` — *Jump 1* from ["Sound effects Pack 2" by phoenix1291 / SwissArcadeGameEntertainment](https://opengameart.org/content/sound-effects-pack-2) — CC0.
- Other `assets/sfx/*.ogg` — from `static/SoundFx/Sound Effects/RandomSfx/`. These are the named, labeled subset (renamed for clarity: `gem.ogg` → `coin.ogg`, etc.).

## Adding or Swapping Assets

1. Drop the file into the right `/assets/<category>/` folder using `snake_case` with no spaces.
2. Add an entry to `assets/manifest.json` — that's the single source of truth.
3. In your game code, reference it by name via the manifest (see `demo.html` for the loading pattern).
