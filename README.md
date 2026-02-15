# Platformer Game Workshop

A vanilla JavaScript + Canvas platforming game scaffold for learning game development fundamentals.

## Quick Start

Open `index.html` in any browser. No server or build tools required.

## Controls

| Key | Action |
|-----|--------|
| Arrow Left / A | Move left |
| Arrow Right / D | Move right |
| Arrow Up / W / Space | Jump |

## Features

- Gravity physics
- Platform collision detection (AABB)
- Jump only when grounded
- Respawn on fall

## Code Structure

The game is contained in a single HTML file with clearly marked sections:

- **CSS** - Canvas styling and page layout
- **INPUT HANDLING** - Keyboard event listeners
- **PLATFORM CLASS** - Platform rendering and collision
- **PLAYER CLASS** - Movement, physics, and rendering
- **GAME LOOP** - Update and draw cycle

## Workshop Extensions

Ideas for participants to build on:

- Add collectible coins
- Create enemies
- Implement multiple levels
- Add sprite animations
- Include sound effects
- Display a score counter
- Add a win condition

## Physics Constants

Tweak these values in the Player class to adjust game feel:

```javascript
this.SPEED = 5;        // Horizontal movement speed
this.JUMP_FORCE = -12; // Jump velocity (negative = up)
this.GRAVITY = 0.5;    // Downward acceleration per frame
```
