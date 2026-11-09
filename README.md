# Kinetone

A Patatap-inspired portable animation and sound kit.

Press **A–Z** and **0–9**, tap the grid, or play **MIDI notes** to fire 36 original sounds and visuals. **Space** cycles eight kits in the current set.

A set of palettes, shuffled visuals, and tunings is generated in the current season’s colors and **locked for five minutes**. Reloading during that window keeps the same set. When the timer ends, a new set rolls in. Southern-hemisphere timezones invert the calendar. Append `?season=winter` (or spring, summer, autumn) to force a season, or `?seed=...` to start a lock on that roll.

Inspired by [Patatap](https://patatap.com) by jonobr1 and Lullatone. Sounds are synthesized in the browser (Web Audio) rather than sampled from the original.

## Play

```bash
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173). Turn up the speakers.

| Key | Action |
| --- | --- |
| A–Z, 0–9 | Play a hit |
| MIDI notes | Play a hit (C1 / MIDI 36 = Q, wrapping every 3 octaves) |
| Space | Next kit |
| Shift+Space | Previous kit |
| Enter | Auto-jam |
| `` ` `` | Record a loop, press again to play |
| Shift+F | Fullscreen |
| Esc | Stop jam / loop |
| ? | Help |

On a phone, tap the grid. Plug in a MIDI keyboard or pad controller (Chrome, Edge, or another Web MIDI browser) and allow access when prompted.

Contains flashing images.

## Kits

Eight kits are generated per set and held for five minutes. Drums stay on Q–P, bass on A–D, melody on F–L and Z–V, spice on the number row. Accents, names, scales, timbres, and which visual sits on each key change when the set rotates.
