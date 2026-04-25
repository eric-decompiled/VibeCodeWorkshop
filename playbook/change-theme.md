# Playbook: Change the visual theme

**Triggers:** "castle theme", "sci-fi", "change the background", "different art style", "desert level", "snow level".

## Background swap (easiest)

`demo.html`'s `drawBackground()` currently just draws clouds on the sky-blue canvas. To use a full-screen bg image:

```js
function drawBackground() {
    drawTile(ctx, IMG.bg_castle, 0, 0, canvas.width, canvas.height);  // or bg_sky / bg_scifi
}
```

Available backgrounds: `bg.sky`, `bg.castle`, `bg.scifi`.

Remove the `ctx.fillStyle = '#87CEEB'; ctx.fillRect(...)` at the top of `gameLoop()` if the bg image covers the whole canvas.

## Tile swap

The `Platform` class hardcodes grass tiles. To make tile type configurable:

```js
class Platform {
    constructor(x, y, width, tileKey = 'grass') {
        this.x = x; this.y = y; this.width = width; this.height = 40;
        this.tileKey = tileKey;
    }
    draw(ctx) {
        const tw = 40;
        const count = Math.ceil(this.width / tw);
        for (let i = 0; i < count; i++) {
            // use _left/_mid/_right variants only if they exist; fallback to _mid
            let key;
            if (i === 0)               key = `tiles_${this.tileKey}_left`;
            else if (i === count - 1)  key = `tiles_${this.tileKey}_right`;
            else                       key = `tiles_${this.tileKey}_mid`;
            const img = IMG[key] || IMG[`tiles_${this.tileKey}_mid`] || IMG[`tiles_${this.tileKey}`];
            drawTile(ctx, img, this.x + i * tw, this.y, tw, tw);
        }
    }
    checkCollision(p) { /* unchanged */ }
}
```

Now you can build themed levels:

```js
// castle level
const platforms = [
    new Platform(0,   550, 800, 'stone'),
    new Platform(350, 380, 160, 'stone'),
    new Platform(450, 150, 200, 'dirt'),
];
```

## Available tile themes in `/assets`

- `grass_mid/left/right/center` — full set with edge variants (default)
- `dirt` — mid only
- `stone` — mid only
- `sand` — mid only

If you need the castle-set edge variants (`castleMid`, `castleLeft` etc.), they exist in `/static/Art-Pack/Base pack/Tiles/` and can be copied into `/assets/tiles/` following the naming convention, then added to the manifest.

## Matching enemies to the theme

- Castle / stone → slime, fly
- Sand → snail
- Water levels → fish (see `add-enemy.md`)
- Sci-fi → the `/static/Art-Pack/Extra animations and enemies/Alien sprites/` set exists for students who want to extend the palette; not in manifest by default.

## Full scene makeover checklist

1. Pick a bg in the gallery at `/gallery.html`.
2. Pick a tile set.
3. Pick pickup colors that contrast with the tiles (e.g. gold coins on grass, gems on stone).
4. Optionally change music: `playMusic('music_ambient')` for spooky castle, `playMusic('music_retro')` for upbeat.
5. Reload, confirm nothing 404s, confirm contrast is readable.

## Verification

- Canvas background is the chosen bg image, not sky-blue.
- Platforms render with the themed tile.
- Player/pickups are still visible against the new theme.
- No 404s in Network tab.
