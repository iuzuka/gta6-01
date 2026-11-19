// Solmar Bay — hidden stashes: twelve cash packages tucked around the
// city for Milo to find while free-roaming. Each one pays $75 the moment
// Milo drives or walks over it, and the count is saved with the game, so
// a completionist run has something to chase between story missions.
// The positions are fixed (not random) so a player can learn the map and
// the tests can check every stash without a running game.

import { dist } from './util.js';

export const STASH_REWARD = 75;

// Twelve spots spread across every district: corners, the beach, the
// boardwalk, the marina and the back streets of Palm Heights.
export const STASH_SPOTS = [
  { x: 200, y: 200 },   // Downtown, north-west corner
  { x: 1400, y: 200 },  // Downtown, north edge
  { x: 3400, y: 200 },  // Marina District, north-east corner
  { x: 600, y: 1000 },  // Old Town, by the hospital
  { x: 2600, y: 600 },  // Marina District, by the pier road
  { x: 1000, y: 1800 }, // Harbor Yards, market back street
  { x: 2200, y: 1400 }, // Palm Heights, quiet crossroads
  { x: 3400, y: 1400 }, // Marina District, east edge
  { x: 200, y: 2200 },  // Harbor Yards, south-west corner
  { x: 1800, y: 2200 }, // The Boardwalk, mid-strip
  { x: 3000, y: 2100 }, // Solmar Beach, sand by the sea
  { x: 2600, y: 2200 }, // The Boardwalk, east end
];

export function makeCollectibles() {
  return {
    spots: STASH_SPOTS.map((s, i) => ({ ...s, id: i, taken: false })),
    found: 0,
  };
}

// The nearest untaken stash within reach of (x, y), or null.
export function stashNear(state, x, y, radius = 46) {
  for (const s of state.spots) {
    if (s.taken) continue;
    if (dist(x, y, s.x, s.y) < radius) return s;
  }
  return null;
}

// Take a stash: marks it found and returns its reward, or 0 when the
// stash was already taken or does not exist.
export function collectStash(state, id) {
  const s = state.spots[id];
  if (!s || s.taken) return 0;
  s.taken = true;
  state.found++;
  return STASH_REWARD;
}

// Rebuild the taken flags from a save file's list of taken stash ids.
export function applyTakenStashes(state, takenIds) {
  if (!Array.isArray(takenIds)) return;
  for (const id of takenIds) {
    const s = state.spots[id];
    if (s && !s.taken) {
      s.taken = true;
      state.found++;
    }
  }
}

export function takenStashIds(state) {
  return state.spots.filter((s) => s.taken).map((s) => s.id);
}

export function drawStash(ctx, stash, time) {
  const pulse = 1 + Math.sin(time * 4 + stash.id) * 0.18;
  ctx.save();
  ctx.translate(stash.x, stash.y);
  ctx.scale(pulse, pulse);
  // A small glowing package: green glow, dark wrap, gold band.
  ctx.fillStyle = 'rgba(125,255,154,0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e7d32';
  ctx.beginPath();
  ctx.roundRect(-9, -7, 18, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(-9, -2, 18, 4);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', 0, 4);
  ctx.restore();
  ctx.textAlign = 'left';
}
