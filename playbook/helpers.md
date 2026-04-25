# Workshop Helpers — Copy/Paste Snippets

Common utilities students reach for again and again: AABB collision, math, asset loading, input wiring, and a shared level-data shape. Every helper here is a small pure function — paste only what you need.

**Triggers:** "collision helper", "common utils", "math helpers", "level format", "asset loader", "input handling"

These do **not** replace gravity, the game loop, or class definitions. Those stay yours. The helpers replace boilerplate, not the parts you came to write.

Drop snippets near the top of your `<script>` block, above where you use them.

---

## 1. Core — collision + math

```js
// Axis-aligned bounding box hit test. a, b each need {x, y, width, height}.
function aabb(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}

const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp    = (a, b, t)   => a + (b - a) * t;
const rand    = (lo, hi)    => lo + Math.random() * (hi - lo);
const randInt = (lo, hi)    => Math.floor(rand(lo, hi + 1));
```

Use `aabb` anywhere you currently inline a four-clause `&&` collision check (player vs platform, player vs coin, player vs enemy, player vs flag).

---

## 2. Assets + drawing

Lifted from `demo.html` so a bare `index.html` can graduate to sprites without re-deriving the loaders.

```js
let MANIFEST = null;
const IMG = {};   // name -> HTMLImageElement
const SND = {};   // name -> HTMLAudioElement

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('image failed: ' + src));
    img.src = src;
  });
}

async function loadAllImages(manifest) {
  const jobs = [];
  jobs.push(loadImage(manifest.player.spritesheet).then(i => IMG['player_sheet'] = i));
  for (const [k, p] of Object.entries(manifest.player.poses))
    jobs.push(loadImage(p).then(i => IMG['player_' + k] = i));
  for (const group of ['tiles', 'items', 'hud', 'bg']) {
    for (const [k, p] of Object.entries(manifest[group]))
      jobs.push(loadImage(p).then(i => IMG[group + '_' + k] = i));
  }
  for (const [name, frames] of Object.entries(manifest.enemies)) {
    (frames.walk || []).forEach((p, i) =>
      jobs.push(loadImage(p).then(img => IMG[`enemy_${name}_walk${i+1}`] = img)));
    if (frames.dead)
      jobs.push(loadImage(frames.dead).then(img => IMG[`enemy_${name}_dead`] = img));
  }
  await Promise.all(jobs);
}

function loadSound(src, loop = false) {
  const a = new Audio(src);
  a.loop = loop;
  return a;
}

function loadAllSounds(manifest) {
  for (const [k, p] of Object.entries(manifest.sfx))   SND['sfx_'   + k] = loadSound(p);
  for (const [k, p] of Object.entries(manifest.music)) SND['music_' + k] = loadSound(p, true);
}

function play(key) {
  const s = SND[key];
  if (!s) return;
  s.currentTime = 0;
  s.play().catch(() => {}); // ignore autoplay rejections
}
```

Drawing helpers — atlas frame, full sprite, and a tile-variant picker for multi-segment platforms:

```js
// 9-arg drawImage: cut a frame out of a spritesheet.
function drawSheetFrame(ctx, img, frame, dx, dy, dw, dh) {
  ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
}

// 5-arg drawImage: draw a single full-image sprite.
function drawTile(ctx, img, x, y, w, h) {
  ctx.drawImage(img, x, y, w, h);
}

// Tile a platform across `w` pixels using left / mid / right edge sprites.
// Width=1 tile collapses to mid only. tileSize defaults to 40 (the workshop default).
function drawTiledPlatform(ctx, x, y, w, leftImg, midImg, rightImg, tileSize = 40) {
  const count = Math.max(1, Math.floor(w / tileSize));
  for (let i = 0; i < count; i++) {
    const img = count === 1       ? midImg
              : i === 0           ? leftImg
              : i === count - 1   ? rightImg
              :                     midImg;
    ctx.drawImage(img, x + i * tileSize, y, tileSize, tileSize);
  }
}
```

Bootstrap pattern (in your async `boot()` after fetching `assets/manifest.json`):

```js
MANIFEST = await fetch('assets/manifest.json').then(r => r.json());
await loadAllImages(MANIFEST);
loadAllSounds(MANIFEST);
```

---

## 3. Input — keyboard

Pure function, no class. Mutates a plain `keys` object you own. Workshop is keyboard-only — touch controls are out of scope.

```js
const keys = { left: false, right: false, up: false };

function setupKeys(keys) {
  const map = {
    ArrowLeft: 'left',  KeyA: 'left',
    ArrowRight:'right', KeyD: 'right',
    ArrowUp:   'up',    KeyW: 'up',  Space: 'up',
  };
  addEventListener('keydown', e => {
    if (map[e.code]) { keys[map[e.code]] = true;  e.preventDefault(); }
  });
  addEventListener('keyup', e => {
    if (map[e.code]) { keys[map[e.code]] = false; e.preventDefault(); }
  });
}

setupKeys(keys);
```

---

## 4. Level shape + builders

A canonical shape so playbook entries line up. Use as much or as little as your level needs:

```js
const LEVEL = {
  platforms: [{ x: 0,   y: 500, width: 800, height: 40 }],   // height optional, default 40
  coins:     [{ x: 200, y: 400 }],
  enemies:   [{ x: 400, y: 460, type: 'slime', patrol: 100 }],
  flag:      { x: 750, y: 460 }                              // optional
};
```

Two pure helpers — a factory and a collision resolver. Gravity and horizontal motion stay in your `Player.update()`.

```js
// Builds entity instances from plain data + your classes.
// classes = { Platform, Coin, Enemy, Flag }  (any subset; missing keys are skipped)
function buildLevel(data, classes) {
  const out = {};
  if (data.platforms && classes.Platform)
    out.platforms = data.platforms.map(p => new classes.Platform(p.x, p.y, p.width, p.height));
  if (data.coins && classes.Coin)
    out.coins = data.coins.map(c => new classes.Coin(c.x, c.y));
  if (data.enemies && classes.Enemy)
    out.enemies = data.enemies.map(e => new classes.Enemy(e.x, e.y, e.type, e.patrol));
  if (data.flag && classes.Flag)
    out.flag = new classes.Flag(data.flag.x, data.flag.y);
  return out;
}

// Resolves vertical platform collisions only. You keep gravity + horizontal motion.
// entity must have { x, y, width, height, vy, isOnGround }.
function resolveCollisions(entity, platforms) {
  entity.isOnGround = false;
  for (const p of platforms) {
    if (!aabb(entity, p)) continue;
    if (entity.vy > 0) {        // falling onto top of platform
      entity.y = p.y - entity.height;
      entity.vy = 0;
      entity.isOnGround = true;
    } else if (entity.vy < 0) { // hitting head on bottom
      entity.y = p.y + p.height;
      entity.vy = 0;
    }
  }
}
```

Wire-up sketch inside `Player.update()`:

```js
this.vy += this.GRAVITY;       // your gravity
this.y  += this.vy;             // your integration
resolveCollisions(this, platforms);
```

---

## Verification

1. Run `python3 -m http.server 8000` from the repo root.
2. Open `http://localhost:8000/demo.html` and `http://localhost:8000/index.html` — both should still run unchanged (this entry edits no game files).
3. Sanity-check a snippet by pasting `aabb` into the DevTools console:
   ```js
   aabb({x:0,y:0,width:10,height:10}, {x:5,y:5,width:10,height:10}) // → true
   aabb({x:0,y:0,width:10,height:10}, {x:20,y:0,width:10,height:10}) // → false
   ```
4. After pasting helpers into your game, open DevTools Network tab — zero 404s means the manifest is consistent and all image/sound paths resolved.
