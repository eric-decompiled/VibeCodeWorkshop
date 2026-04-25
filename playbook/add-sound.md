# Playbook: Add sound (SFX or music)

**Triggers:** "jump sound", "sound effect on X", "background music", "music toggle", "play a sound when Y".

`demo.html` already wires up sound loading. You just need to call `play('sfx_<key>')` at the right moment, or for music use the existing `toggleMusic()` pattern.

## Available sounds (manifest keys)

**SFX** (one-shot): `jump`, `coin`, `key`, `door`, `win`, `levelup`, `click`, `pickup`

**Music** (looping): `retro`, `ambient`

## Pattern A: play an SFX on an event

Look up the right key, then call `play('sfx_' + key)` inside the event handler.

Examples (all go in `demo.html`):

```js
// player jump — already wired in Player.update()
play('sfx_jump');

// collecting a coin — already wired in Coin.tryPickup()
play('sfx_coin');

// enemy defeated (see add-enemy.md)
play('sfx_pickup');

// door opened
play('sfx_door');

// level complete
play('sfx_win');
```

The `play()` helper handles `currentTime = 0` and silently catches autoplay rejections.

## Pattern B: add a second music track / switch tracks

The default demo plays `music_retro`. To add the ambient track as an alternative:

```js
let currentMusic = null;
function playMusic(key) {
    // key = 'music_retro' or 'music_ambient'
    if (currentMusic && currentMusic !== SND[key]) {
        currentMusic.pause();
        currentMusic.currentTime = 0;
    }
    currentMusic = SND[key];
    currentMusic.volume = 0.4;
    currentMusic.play().catch(() => {});
    musicOn = true;
}
function stopMusic() {
    if (currentMusic) currentMusic.pause();
    musicOn = false;
}
```

Replace the existing `toggleMusic()` body to call `playMusic('music_retro')` / `stopMusic()`.

## Pattern C: play music on a level transition

Call `playMusic('music_ambient')` from inside a level-load function — e.g. when the player reaches the end flag and the scene changes. Pair with `play('sfx_win')` for the transition stinger.

## Adding a brand-new sound file

1. Drop the `.ogg` or `.mp3` into `assets/sfx/` or `assets/music/` with a `snake_case` name (no spaces, no capital letters).
2. Add an entry to `assets/manifest.json` under `sfx` or `music`.
3. Restart the local server (`python3 -m http.server`). Reload the page.
4. Call `play('sfx_<yourkey>')` in code.

If the user wants more variety than the 8 named SFX in `/assets`, point them at `/static/SoundFx/Sound Effects/RandomSfx/` (more named oggs) or `/static/SoundFx/Sound Effects/AbstractPackSFX/Files/AbstractSfx/` (111 numbered, unlabeled). They'd need to preview them in a player, pick, then follow step 1 above.

## Browser autoplay gotcha

Browsers block audio that starts before any user interaction. The code catches the rejection silently — music starts working after the first click/keypress. This is expected, not a bug.

## Verification

- DevTools Network tab shows the `.ogg` / `.mp3` loads (status 200).
- Console has no errors about `play()` failing for reasons other than autoplay.
- Sound plays when the triggering action happens.
