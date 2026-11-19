// Solmar Bay — saving: the whole campaign state as plain JSON in
// localStorage. Autosave runs after every mission; the player can also save
// from the pause menu. Serialization is kept pure so tests can round-trip it.

export const SAVE_KEY = 'solmar-bay-save-v1';

export function defaultSave() {
  return {
    version: 1,
    cash: 250,
    health: 100,
    armor: 0,
    ammo: 24,
    hasPistol: true,
    hasSmg: false,
    missionIndex: 0, // next mission to play; 8 means the story is done
    missionsDone: [],
    stashes: [], // taken stash ids, see collectibles.js
    playerX: 1400,
    playerY: 660,
    clock: 9.0,
    totalEarned: 0,
    carsStolen: 0,
    savedAt: 0,
  };
}

// Keep only the fields we own, with sane fallbacks for a corrupt save.
export function sanitizeSave(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return {
    version: 1,
    cash: num(raw.cash, d.cash),
    health: num(raw.health, d.health),
    armor: Math.max(0, Math.min(100, num(raw.armor, 0))),
    ammo: Math.max(0, Math.floor(num(raw.ammo, d.ammo))),
    hasPistol: raw.hasPistol !== false,
    hasSmg: raw.hasSmg === true,
    missionIndex: Math.max(0, Math.min(8, Math.floor(num(raw.missionIndex, 0)))),
    missionsDone: Array.isArray(raw.missionsDone) ? raw.missionsDone.filter((m) => typeof m === 'string') : [],
    stashes: Array.isArray(raw.stashes) ? raw.stashes.filter((n) => Number.isInteger(n)) : [],
    playerX: num(raw.playerX, d.playerX),
    playerY: num(raw.playerY, d.playerY),
    clock: num(raw.clock, d.clock),
    totalEarned: Math.max(0, num(raw.totalEarned, 0)),
    carsStolen: Math.max(0, Math.floor(num(raw.carsStolen, 0))),
    savedAt: num(raw.savedAt, 0),
  };
}

export function serializeSave(state) {
  return JSON.stringify({
    version: 1,
    cash: Math.round(state.cash),
    health: Math.round(state.health),
    armor: Math.round(state.armor || 0),
    ammo: state.ammo,
    hasPistol: state.hasPistol,
    hasSmg: !!state.hasSmg,
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    stashes: state.stashes || [],
    playerX: Math.round(state.x),
    playerY: Math.round(state.y),
    clock: state.clock,
    totalEarned: Math.round(state.totalEarned),
    carsStolen: state.carsStolen,
    savedAt: Date.now(),
  });
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return sanitizeSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

export function hasSave() {
  return loadGame() !== null;
}
