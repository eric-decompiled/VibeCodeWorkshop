# Playbook: Extend the level

**Triggers:** "more platforms", "bigger level", "add a second room", "scrolling world", "side-scrolling camera", "longer level".

## Pattern A: more platforms in the existing 800×600 area

Just add `new Platform(x, y, width)` entries to the `platforms` array in `demo.html`. Check the gallery for available tile keys if you want variety (e.g. `stone_mid`, `dirt` — you'd extend `Platform.draw()` to accept a tile key).

## Pattern B: side-scrolling camera over a wider level

Use this when the user wants "a bigger world" or "the player walks to the end and reaches a flag."

### 1. Define world width and camera offset

At the top of the script (after `MANIFEST = null`):

```js
const WORLD_WIDTH = 2400;   // 3 screens wide
let cameraX = 0;
```

### 2. Replace canvas width clamp in `Player.update()`

Change:
```js
if (this.x + this.width > 800) this.x = 800 - this.width;
```
to:
```js
if (this.x + this.width > WORLD_WIDTH) this.x = WORLD_WIDTH - this.width;
```

### 3. Update camera each frame

In `gameLoop()`, before drawing:

```js
cameraX = player.x + player.width / 2 - canvas.width / 2;
if (cameraX < 0) cameraX = 0;
if (cameraX > WORLD_WIDTH - canvas.width) cameraX = WORLD_WIDTH - canvas.width;
```

### 4. Translate the canvas before drawing world objects

Wrap the world-drawing portion of `gameLoop()` in a save/translate/restore:

```js
ctx.save();
ctx.translate(-cameraX, 0);

// --- world space ---
for (const plat of platforms) plat.draw(ctx);
for (const coin of coins)     coin.draw(ctx);
player.draw(ctx);
// (and enemies, items, etc.)

ctx.restore();

// --- screen space (HUD) ---
drawHud(ctx, player);
```

### 5. Extend the platforms array

```js
const platforms = [
    new Platform(0,    550, 800),
    new Platform(800,  550, 800),       // ground continues
    new Platform(1600, 550, 800),
    new Platform(100,  450, 160),
    new Platform(350,  380, 160),
    new Platform(900,  420, 160),
    new Platform(1200, 340, 160),
    new Platform(1500, 260, 200),
    new Platform(1900, 400, 200),
    new Platform(2200, 300, 180),
];
```

### 6. Optionally: parallax background

```js
function drawBackground() {
    const parallax = cameraX * 0.3;
    drawTile(ctx, IMG.items_cloud, 80  - parallax, 60, 120, 60);
    drawTile(ctx, IMG.items_cloud, 520 - parallax, 40, 140, 70);
    drawTile(ctx, IMG.items_cloud, 960 - parallax, 80, 120, 60);
}
```

Call `drawBackground()` in screen space (before the `ctx.save/translate`), not world space.

## Pattern C: multiple levels (rooms)

Keep levels as data, swap on trigger:

```js
const LEVELS = [
    { platforms: [...], coins: [...], enemies: [...] },
    { platforms: [...], coins: [...], enemies: [...] },
];
let levelIndex = 0;
function loadLevel(i) {
    platforms.length = 0; platforms.push(...LEVELS[i].platforms);
    coins.length = 0;     coins.push(...LEVELS[i].coins.map(c => new Coin(c.x, c.y)));
    // etc.
    player.x = 100; player.y = 500; player.vy = 0;
}
```

Trigger next level from a flag collision (see `add-win-state.md`).

## Verification

- Player can walk past 800px on the right if scrolling is enabled.
- Camera keeps player centered but stops at world edges.
- Clouds / HUD stay fixed relative to screen, not world.
- No 404s.
