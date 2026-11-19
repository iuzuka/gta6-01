# Solmar Bay — An Open-World Crime Story

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/iuzuka/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/iuzuka/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the make.fun
**gta6-01** competition. 100% original: the city of Solmar Bay, Milo Reyes,
Rosa Vega and Dante Cole are invented here — no Rockstar names, characters,
art, music or map.

## The story

Milo Reyes drove getaway cars for the Solmar Bay underworld until a job went
wrong three years ago. Now his old friend Rosa Vega pulls him back in: eight
missions across a sun-soaked coastal city — a tutorial drive, a timed
delivery, tailing a courier, a bank job, a finale getaway, a docks deal, a
night casino heist, and one last run to the midnight ferry with the whole
police department — helicopter included — on his tail.

## What is in the game

- **A city to explore** — a road grid with six districts (Downtown, Old
  Town, Marina, Harbor Yards, Palm Heights, Solmar Beach and the Boardwalk),
  parks, a hospital, a marina and a beach, with a day/sunset/night cycle.
- **On foot and by car** — WASD movement, Shift to run, arcade driving with
  acceleration, braking/reversing, steering, skid marks and dust.
- **Traffic and pedestrians** — AI cars drive the roads and brake for the
  player; pedestrians walk the sidewalks and flee from gunfire and chases.
- **Cars to steal** — parked cars and traffic cars (E to enter/exit);
  stealing in view of the police raises your wanted level.
- **Wanted level and police** — 1–5 stars that rise with theft, assault,
  speeding past police and shooting, and fall when you escape and stay
  hidden. Police cars chase and ram; foot officers chase and shoot from
  3 stars. The escape radius is drawn on the minimap.
- **Five story missions** — objectives, waypoints, dialogue, timers, a tail,
  shootouts and a getaway, each paying cash, with a mission log (M).
- **Three more in Act II** — a docks deal against the Viper crew, a night
  heist at the Golden Palm Casino, and a five-star finale to the midnight
  ferry. Eight missions in all, paying up to $3,000.
- **Solmar Arms gun shop** — spend cash on pistol ammo, the VKR-9 SMG
  (full-auto, press 3) and a kevlar vest that absorbs damage before health.
- **Twelve hidden stashes** — cash packages tucked across every district,
  worth $75 each, saved with the game.
- **Police helicopter** — at four stars the SBPD sends a chopper that never
  loses you and fires on you at five stars. It stays up for 30 seconds,
  then breaks off for 25 — your window to disappear.
- **Combat** — fists, a pistol and the VKR-9 SMG with ammo, mouse aim,
  enemy AI that shoots back, muzzle flashes, sparks and screen shake.
- **HUD and minimap** — health, kevlar, cash, wanted stars, weapon/ammo,
  speed, clock, district name, objective tracker and a live canvas minimap
  with the player, police, mission markers and the escape radius.
- **Start and save** — title screen (New Game / Continue), pause menu,
  autosave after missions plus manual save, localStorage persistence,
  and a hospital respawn with a $200 penalty when you are wasted or busted.
- **Polish** — synthesized WebAudio sound effects and a synthwave music
  loop (no audio files), particles (dust, sparks, smoke), screen shake,
  streetlights and headlight cones after dark, neon casino and gun-shop
  signs, and a game-over screen.

## How to play

```
node serve.ts
```

Open <http://localhost:8080> in desktop Chrome.

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Shift | Run |
| E | Enter / exit a car |
| Mouse + click | Aim and shoot (pistol) / punch (fists) |
| 1 / 2 | Switch fists / pistol |
| M | Start the next mission / open the mission log |
| Esc | Pause |
| S (in pause) | Save game |
| Q (in pause) | Quit to title |

## Screenshots

Staged states of the real game (`?shot=…`): `1-start` title screen,
`2-drive` driving downtown, `3-chase` a four-star police chase at night
with the SBPD helicopter overhead, `4-mission` the casino heist at night.

## Files

- `game/index.html` — the page; `game/src/` — the game, split by system:
  `main.js` (loop, camera, render), `city.js` (the map), `player.js`,
  `vehicles.js` (traffic + driving), `pedestrians.js`, `police.js`
  (wanted level, helicopter), `missions.js` (the story), `combat.js`,
  `shop.js` (Solmar Arms gun shop), `collectibles.js` (hidden stashes),
  `hud.js` (HUD, minimap, menus, shop overlay), `audio.js` (synthesized
  sound + music), `particles.js`, `save.js`, `util.js`, `shots.js`
  (staged states).
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  the output directory and writes `dossier.json`.
- `tests/` — pure-logic tests, run with `node --test`.

## License

MIT — see `LICENSE`.
