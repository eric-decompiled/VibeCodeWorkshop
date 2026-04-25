# Playbook: Add an enemy

**Triggers:** "add an enemy", "slime that walks back and forth", "bad guy", "something that hurts the player", "defeat enemy by jumping on it".

## Available enemy sprites (already in manifest)

| Key | Frames | Feel |
|---|---|---|
| `slime` | walk1, walk2, dead | Ground-based, bounces slowly. Default pick. |
| `snail` | walk1, walk2 | Slow ground enemy. |
| `fly`   | fly1, fly2 | Flying (sine-wave y). |
| `fish`  | swim1, swim2 | Water enemy. |

Access in code: `manifest.enemies.slime.walk` (array of paths) and `manifest.enemies.slime.dead` (string).

## Steps (default: walking slime that damages on touch, dies when jumped on)

### 1. Add an `Enemy` class to `demo.html`

Place after the `Coin` class, before `Player`:

```js
class Enemy {
    constructor(x, y, type = 'slime', patrolWidth = 120) {
        this.x = x; this.y = y;
        this.width = 40; this.height = 30;
        this.type = type;
        this.vx = 1;                 // pixels per frame; flip at patrol edges
        this.startX = x;
        this.patrolWidth = patrolWidth;
        this.frame = 0;
        this.tick = 0;
        this.dead = false;
        this.deadTimer = 0;
    }
    update() {
        if (this.dead) { this.deadTimer++; return; }
        this.x += this.vx;
        if (this.x > this.startX + this.patrolWidth) this.vx = -Math.abs(this.vx);
        if (this.x < this.startX)                    this.vx =  Math.abs(this.vx);
        this.tick++;
        if (this.tick > 12) { this.tick = 0; this.frame ^= 1; }
    }
    draw(ctx) {
        if (this.dead) {
            const img = IMG[`enemy_${this.type}_dead`];
            if (img) ctx.drawImage(img, this.x, this.y + 10, this.width, this.height - 10);
            return;
        }
        const img = IMG[`enemy_${this.type}_walk${this.frame + 1}`];
        ctx.drawImage(img, this.x, this.y, this.width, this.height);
    }
    collide(p) {
        if (this.dead) return null;
        const hit = p.x < this.x + this.width && p.x + p.width > this.x
                 && p.y < this.y + this.height && p.y + p.height > this.y;
        if (!hit) return null;
        // stomped from above
        if (p.vy > 0 && p.y + p.height - this.height < this.y + 10) return 'stomp';
        return 'hurt';
    }
}

const enemies = [
    new Enemy(400, 520, 'slime', 200),
    new Enemy(560, 270, 'slime', 100),
];
```

### 2. Hook it into the game loop

In the `gameLoop()` function, after `player.update(platforms)` and before the draw pass:

```js
for (const e of enemies) {
    e.update();
    const hit = e.collide(player);
    if (hit === 'stomp') {
        e.dead = true;
        player.vy = -8;                 // little bounce
        play('sfx_pickup');
    } else if (hit === 'hurt') {
        // reset player position; add hearts system via add-win-state.md if you want lives
        player.x = 100; player.y = 500; player.vy = 0;
        play('sfx_jump');
    }
}
enemies.forEach(e => !(e.dead && e.deadTimer > 60) && e.draw(ctx));
// remove stomped enemies after a short delay:
for (let i = enemies.length - 1; i >= 0; i--)
    if (enemies[i].dead && enemies[i].deadTimer > 60) enemies.splice(i, 1);
```

### 3. Variations

- **Flying enemy**: use `type: 'fly'`, skip gravity, in `update()` add `this.y = this.startY + Math.sin(this.tick/20) * 40`.
- **Patrol distance**: tweak the 4th constructor arg.
- **Harder**: multiple enemies with different types, or speeds `this.vx = 2` etc.

## Verification

- Open `demo.html`. Enemy walks between its patrol bounds with animated frames.
- Touch enemy from the side → respawn at start.
- Land on enemy from above → enemy plays dead sprite for ~1 sec then vanishes, player bounces.
- DevTools Network tab shows zero 404s.
