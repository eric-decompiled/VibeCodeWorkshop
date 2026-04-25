# Playbook: Add a collectible

**Triggers:** "add coins", "gems", "pickups", "score counter", "collect X", "power-up".

`demo.html` already has a `Coin` class and score counter. Most requests are one of:

- **More of the same** → just add more `new Coin(x, y)` entries to the `coins` array.
- **A different-looking pickup** → reuse the `Coin` class, swap the image key.
- **A distinct second pickup type with different score** → copy `Coin` → `Gem`, change image + score delta.

## Available pickup sprites

| Manifest key | Appearance |
|---|---|
| `items.coin_gold`     | 1 point (default)    |
| `items.coin_silver`   | 3 points             |
| `items.coin_bronze`   | 1 point (alt color)  |
| `items.gem_blue`      | 5 points             |
| `items.gem_red`       | 5 points             |
| `items.gem_green`     | 5 points             |
| `items.gem_yellow`    | 5 points             |
| `items.star`          | 10 points (special)  |
| `items.key_yellow`    | Key (no score; unlocks)    |
| `items.mushroom_red`  | Power-up (size/health)     |

Point values are a suggestion — pick what matches your design.

## Steps: reuse `Coin` class with a different image

### 1. Generalize the `Coin` class

In `demo.html`, change the class:

```js
class Pickup {
    constructor(x, y, imgKey = 'items_coin_gold', value = 1, sfx = 'sfx_coin') {
        this.x = x; this.y = y;
        this.width = 24; this.height = 24;
        this.imgKey = imgKey;
        this.value = value;
        this.sfx = sfx;
        this.collected = false;
    }
    draw(ctx) {
        if (this.collected) return;
        drawTile(ctx, IMG[this.imgKey], this.x, this.y, this.width, this.height);
    }
    tryPickup(p) {
        if (this.collected) return 0;
        const hit = p.x < this.x + this.width && p.x + p.width > this.x
                 && p.y < this.y + this.height && p.y + p.height > this.y;
        if (!hit) return 0;
        this.collected = true;
        play(this.sfx);
        return this.value;
    }
}
```

### 2. Populate with mixed types

```js
const pickups = [
    new Pickup(160, 410, 'items_coin_gold', 1),
    new Pickup(410, 340, 'items_coin_gold', 1),
    new Pickup(610, 260, 'items_gem_blue',  5),
    new Pickup(260, 180, 'items_gem_red',   5),
    new Pickup(530, 110, 'items_star',     10, 'sfx_levelup'),
];
```

### 3. Update the pickup loop in `player.update()`

Change:
```js
for (const coin of coins) if (coin.tryPickup(this)) this.score++;
```
to:
```js
for (const p of pickups) this.score += p.tryPickup(this);
```

### 4. Remove the old `coins` array / `Coin` class if fully replaced.

## Steps: add an entirely new pickup type (e.g. health mushroom)

Keep `Pickup` above. Add a field and branch in `tryPickup`:

```js
// in the constructor, add:
this.effect = arguments[4] || 'score'; // 'score' | 'heal' | 'unlock'
```

Then in the player's pickup loop, check the effect and handle it (e.g. `if (effect === 'heal') player.hp++`).

## Verification

- Every pickup shows the right sprite.
- Touching one plays the assigned SFX and increments HUD score correctly.
- Collected pickups disappear immediately.
- No 404s.
