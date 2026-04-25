# Playbook: Add a win state + lives + restart

**Triggers:** "win condition", "flag at the end", "finish the level", "game over", "lives", "restart button", "hearts HUD", "die and respawn".

Three related features — pick the ones the user asked for, skip the rest.

## A. Win flag at a position

### 1. Add a flag object

In `demo.html`, near the `coins` declaration:

```js
const flag = { x: 720, y: 510, width: 40, height: 40, reached: false };
```

### 2. Draw and check in `gameLoop()` (before `player.draw()`)

```js
drawTile(ctx, IMG.items_flag_green, flag.x, flag.y, flag.width, flag.height);

if (!flag.reached
    && player.x < flag.x + flag.width  && player.x + player.width > flag.x
    && player.y < flag.y + flag.height && player.y + player.height > flag.y) {
    flag.reached = true;
    play('sfx_win');
    setTimeout(() => alert('You win! Score: ' + player.score), 100);
}
```

For a smoother non-blocking win screen, set `flag.reached` and in the main loop draw a semi-transparent overlay + "Press R to restart" text instead of `alert`.

## B. Hearts HUD + damage

### 1. Give the player HP

In the `Player` constructor:

```js
this.maxHp = 3;
this.hp = 3;
this.invulnTimer = 0;
```

### 2. Heart HUD

Extend `drawHud()`:

```js
function drawHud(ctx, player) {
    drawTile(ctx, IMG.hud_coin_icon, 12, 12, 28, 28);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.font = 'bold 22px "Courier New", monospace';
    const txt = 'x ' + player.score;
    ctx.strokeText(txt, 48, 34); ctx.fillText(txt, 48, 34);

    // hearts
    for (let i = 0; i < player.maxHp; i++) {
        const img = i < player.hp ? IMG.hud_heart_full : IMG.hud_heart_empty;
        drawTile(ctx, img, 700 + i * 32, 12, 28, 28);
    }
}
```

### 3. Damage player when hit

In enemy collision code (see `add-enemy.md`), replace the "hurt" branch with:

```js
} else if (hit === 'hurt' && player.invulnTimer <= 0) {
    player.hp--;
    player.invulnTimer = 60;        // 1 second of i-frames
    player.vy = -8;
    play('sfx_jump');                // TODO: add a dedicated hurt sfx
    if (player.hp <= 0) gameOver();
}
```

And in `Player.update()`, decrement `this.invulnTimer` each frame.

Draw the player slightly transparent while `invulnTimer > 0` to signal i-frames:

```js
// wrap drawSheetFrame in Player.draw():
if (this.invulnTimer > 0 && this.invulnTimer % 6 < 3) return;  // flicker
```

## C. Game over + restart

Add near the top of the script (module scope):

```js
let state = 'playing';  // 'playing' | 'dead' | 'won'

function gameOver() {
    state = 'dead';
    const m = SND.music_retro; if (m) m.pause();
}

function restart() {
    state = 'playing';
    player.x = 100; player.y = 500; player.vx = 0; player.vy = 0;
    player.hp = player.maxHp; player.score = 0; player.invulnTimer = 0;
    for (const c of coins)   c.collected = false;
    for (const p of pickups) p.collected = false;
    flag.reached = false;
    // reset enemies if you removed stomped ones:
    // re-run the original `const enemies = [...]` block, or keep a copy.
}
```

Listen for R key:

```js
window.addEventListener('keydown', (e) => { if (e.code === 'KeyR') restart(); });
```

In `gameLoop()`:

```js
if (state === 'dead' || state === 'won') {
    // still draw the world, then overlay
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state === 'won' ? 'YOU WIN' : 'GAME OVER', 400, 280);
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText('Press R to restart', 400, 330);
    ctx.textAlign = 'left';
    requestAnimationFrame(gameLoop);
    return;
}
```

## Verification

- Reaching the flag plays `win.ogg` and shows a win screen.
- Getting hit by an enemy decrements a heart; player flickers for ~1s.
- Losing all 3 hearts shows "GAME OVER" overlay.
- R restarts: full HP, score reset, pickups back, player at spawn.
- No 404s.
