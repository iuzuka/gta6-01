// Solmar Bay — v2 systems: the Solmar Arms gun shop, hidden stashes, the
// SBPD helicopter, kevlar, and the eight-mission save. Pure logic only, so
// these run in Node with no canvas and no localStorage.

import test from 'node:test';
import assert from 'node:assert/strict';

import { makePlayer, hurtPlayer } from '../game/src/player.js';
import { SHOP_ITEMS, shopItem, buyBlockReason, buyShopItem, nearShop } from '../game/src/shop.js';
import { makeCollectibles, stashNear, collectStash, takenStashIds, applyTakenStashes } from '../game/src/collectibles.js';
import { makePolice, heliShouldSpawn, updateHelicopter, wantedStars } from '../game/src/police.js';
import { defaultSave, sanitizeSave, serializeSave } from '../game/src/save.js';
import { MISSIONS, makeMissionState, startMission, updateMission } from '../game/src/missions.js';
import { buildCity, WORLD_W, WORLD_H } from '../game/src/city.js';

const city = buildCity();

// --- The gun shop ----------------------------------------------------------

test('shop: three items, keys 1-2-3, prices 40 / 600 / 150', () => {
  assert.equal(SHOP_ITEMS.length, 3);
  assert.deepEqual(SHOP_ITEMS.map((i) => i.id), ['ammo', 'smg', 'armor']);
  assert.deepEqual(SHOP_ITEMS.map((i) => i.price), [40, 600, 150]);
  assert.deepEqual(SHOP_ITEMS.map((i) => i.key), ['1', '2', '3']);
});

test('shop: buying ammo costs $40 and adds 24 rounds', () => {
  const p = makePlayer(0, 0);
  p.cash = 100;
  p.ammo = 6;
  const ok = buyShopItem(p, 'ammo');
  assert.equal(ok, true);
  assert.equal(p.cash, 60);
  assert.equal(p.ammo, 30);
});

test('shop: the SMG costs $600 and unlocks the weapon', () => {
  const p = makePlayer(0, 0);
  p.cash = 700;
  assert.equal(p.hasSmg, false);
  const ok = buyShopItem(p, 'smg');
  assert.equal(ok, true);
  assert.equal(p.cash, 100);
  assert.equal(p.hasSmg, true);
  assert.equal(p.weapon, 'smg');
});

test('shop: kevlar costs $150 and fills the armor bar', () => {
  const p = makePlayer(0, 0);
  p.cash = 200;
  p.armor = 20;
  const ok = buyShopItem(p, 'armor');
  assert.equal(ok, true);
  assert.equal(p.cash, 50);
  assert.equal(p.armor, 100);
});

test('shop: broke players get "not enough cash", nothing changes', () => {
  const p = makePlayer(0, 0);
  p.cash = 30;
  assert.equal(buyBlockReason(p, 'ammo'), 'not enough cash');
  assert.equal(buyShopItem(p, 'ammo'), false);
  assert.equal(p.cash, 30);
  assert.equal(p.ammo, 24);
});

test('shop: the SMG cannot be bought twice', () => {
  const p = makePlayer(0, 0);
  p.cash = 2000;
  assert.equal(buyShopItem(p, 'smg'), true);
  assert.equal(buyBlockReason(p, 'smg'), 'already owned');
  assert.equal(buyShopItem(p, 'smg'), false);
  assert.equal(p.cash, 1400); // only charged once
});

test('shop: full kevlar cannot be bought again', () => {
  const p = makePlayer(0, 0);
  p.cash = 1000;
  p.armor = 100;
  assert.equal(buyBlockReason(p, 'armor'), 'armor already full');
  assert.equal(buyShopItem(p, 'armor'), false);
  assert.equal(p.cash, 1000);
});

test('shop: shopItem looks up by id and returns null for unknown ids', () => {
  assert.equal(shopItem('smg').name, 'VKR-9 SMG');
  assert.equal(shopItem('nope'), null);
  assert.equal(buyBlockReason(makePlayer(0, 0), 'nope'), 'no such item');
});

test('shop: nearShop is true only within 90 units of the gun shop', () => {
  const shop = city.landmarks.gunshop;
  const near = makePlayer(shop.x + 50, shop.y);
  const far = makePlayer(shop.x + 200, shop.y);
  assert.equal(nearShop(near, shop), true);
  assert.equal(nearShop(far, shop), false);
  // The gun shop is on the map and inside the world.
  assert.ok(shop.x > 0 && shop.x < WORLD_W && shop.y > 0 && shop.y < WORLD_H);
  assert.ok(city.landmarks.casino && city.landmarks.docks && city.landmarks.ferry);
});

// --- Kevlar ----------------------------------------------------------------

test('player: kevlar absorbs damage before health', () => {
  const p = makePlayer(0, 0);
  p.armor = 50;
  hurtPlayer(p, 30);
  assert.equal(p.armor, 20);
  assert.equal(p.health, 100);
  p.hurtTimer = 0;
  hurtPlayer(p, 40);
  assert.equal(p.armor, 0);
  assert.equal(p.health, 80);
});

test('player: a fresh player has no armor and no SMG', () => {
  const p = makePlayer(0, 0);
  assert.equal(p.armor, 0);
  assert.equal(p.hasSmg, false);
  assert.equal(p.weapon, 'pistol');
});

// --- Hidden stashes --------------------------------------------------------

test('stashes: twelve spots, all inside the world, no two on top of each other', () => {
  const s = makeCollectibles();
  assert.equal(s.spots.length, 12);
  assert.equal(s.found, 0);
  for (const spot of s.spots) {
    assert.ok(spot.x >= 60 && spot.x <= WORLD_W - 60, `x ${spot.x} out of range`);
    assert.ok(spot.y >= 60 && spot.y <= WORLD_H - 60, `y ${spot.y} out of range`);
  }
  const keys = new Set(s.spots.map((spot) => `${spot.x},${spot.y}`));
  assert.equal(keys.size, 12);
});

test('stashes: walking over one collects it, only once', () => {
  const s = makeCollectibles();
  const first = s.spots[0];
  assert.equal(stashNear(s, first.x, first.y).id, first.id);
  assert.equal(collectStash(s, first.id), 75); // the reward, not just true
  assert.equal(s.found, 1);
  assert.equal(stashNear(s, first.x, first.y), null); // taken, gone
  assert.equal(collectStash(s, first.id), 0); // already taken pays nothing
  assert.deepEqual(takenStashIds(s), [first.id]);
});

test('stashes: taken ids survive a save round-trip', () => {
  const s = makeCollectibles();
  collectStash(s, 3);
  collectStash(s, 9);
  const taken = takenStashIds(s);
  const s2 = makeCollectibles();
  applyTakenStashes(s2, taken);
  assert.equal(s2.found, 2);
  assert.equal(stashNear(s2, s2.spots[3].x, s2.spots[3].y), null);
  assert.ok(stashNear(s2, s2.spots[0].x, s2.spots[0].y));
});

// --- The helicopter ---------------------------------------------------------

test('heli: spawns at 4 stars, not at 3, not while already up', () => {
  const police = makePolice();
  police.stars = 3;
  assert.equal(heliShouldSpawn(police), false);
  police.stars = 4;
  assert.equal(heliShouldSpawn(police), true);
  police.heli = { x: 0, y: 0, angle: 0, rotor: 0, timeLeft: 30, shootTimer: 2 };
  assert.equal(heliShouldSpawn(police), false);
});

test('heli: leaves after a 30-second sortie, then waits 25 seconds', () => {
  const police = makePolice();
  police.stars = 5;
  police.heli = { x: 0, y: 0, angle: 0, rotor: 0, timeLeft: 5, shootTimer: 2 };
  updateHelicopter(police, 5, { x: 500, y: 500 }, {});
  assert.equal(police.heli, null);
  assert.equal(heliShouldSpawn(police), false); // cooling down
  updateHelicopter(police, 25, { x: 500, y: 500 }, {});
  assert.equal(heliShouldSpawn(police), true);
});

test('heli: flies toward the player and shoots at 5 stars', () => {
  const police = makePolice();
  police.stars = 5;
  const start = { x: 1000, y: 1000 };
  police.heli = { x: 0, y: 0, angle: 0, rotor: 0, timeLeft: 30, shootTimer: 0.5 };
  let shots = 0;
  updateHelicopter(police, 1, start, { onHeliShot: () => { shots++; } });
  // It moved closer to the player...
  const d0 = Math.hypot(start.x, start.y);
  const d1 = Math.hypot(start.x - police.heli.x, start.y - police.heli.y);
  assert.ok(d1 < d0, `heli did not close in: ${d0} -> ${d1}`);
  // ...and at 5 stars it opens fire when it is close enough. At 1000 units
  // out it is still too far, so no shot yet.
  assert.equal(shots, 0);
  police.heli.x = 900;
  police.heli.y = 900;
  police.heli.shootTimer = 0;
  updateHelicopter(police, 0.1, start, { onHeliShot: () => { shots++; } });
  assert.equal(shots, 1);
});

test('heli: does not shoot at 4 stars', () => {
  const police = makePolice();
  police.stars = 4;
  police.heli = { x: 900, y: 900, angle: 0, rotor: 0, timeLeft: 30, shootTimer: 0 };
  let shots = 0;
  updateHelicopter(police, 0.1, { x: 1000, y: 1000 }, { onHeliShot: () => { shots++; } });
  assert.equal(shots, 0);
});

// --- Eight missions and the save -------------------------------------------

test('missions: eight missions, rewards 150 to 3000, all ids unique', () => {
  assert.equal(MISSIONS.length, 8);
  assert.deepEqual(MISSIONS.map((m) => m.reward), [150, 300, 450, 800, 1200, 1500, 2000, 3000]);
  const ids = new Set(MISSIONS.map((m) => m.id));
  assert.equal(ids.size, 8);
  // The three new missions all start from a place on the map.
  assert.equal(MISSIONS[5].stages[0].target, 'docks');
  assert.equal(MISSIONS[6].stages[0].target, 'casino');
  assert.equal(MISSIONS[7].stages[0].target, 'marina');
  assert.equal(MISSIONS[6].night, true);
});

test('missions: the story ends at index 8, not 5', () => {
  const state = makeMissionState();
  state.index = 7;
  let pos = { x: 3000, y: 600 }; // at the Marina Pier
  const api = {
    playerX: () => pos.x,
    playerY: () => pos.y,
    toast: () => {},
    enemiesLeft: () => 0,
    wantedStars: () => 0,
    tailArrived: () => false,
    spawnTailCar: () => ({}),
    spawnBankGuards: () => {},
    spawnCourierCrew: () => {},
    spawnRivalCrew: () => {},
    spawnCasinoGuards: () => {},
    raiseWanted: () => {},
    setClock: () => {},
    sfxMission: () => {},
    addCash: () => {},
    onMissionComplete: () => {},
  };
  startMission(state, city, api);
  assert.ok(state.active, 'mission 8 should start');
  // Drive to the marina: the pickup stage advances to the chase.
  updateMission(state, city, api, 0.1);
  assert.equal(state.active.stageIndex, 1, 'chase stage reached');
  // Reach the ferry with no heat: the mission completes.
  pos = { x: 3200, y: 700 };
  updateMission(state, city, api, 0.1);
  assert.equal(state.active, null, 'mission 8 completed');
  assert.equal(state.index, 8);
  assert.equal(state.done.length, 1);
});

test('save: armor, SMG and stashes round-trip through serialize/sanitize', () => {
  const s = defaultSave();
  assert.equal(s.armor, 0);
  assert.equal(s.hasSmg, false);
  assert.deepEqual(s.stashes, []);
  assert.equal(s.missionIndex, 0);
  const state = {
    cash: 1234, health: 62, armor: 45, ammo: 40, hasPistol: true, hasSmg: true,
    missionIndex: 6, missionsDone: ['m1', 'm2'], stashes: [2, 7],
    x: 900, y: 1100, clock: 21.5, totalEarned: 5000, carsStolen: 3,
  };
  const clean = sanitizeSave(JSON.parse(serializeSave(state)));
  assert.equal(clean.armor, 45);
  assert.equal(clean.hasSmg, true);
  assert.equal(clean.missionIndex, 6);
  assert.deepEqual(clean.stashes, [2, 7]);
  assert.equal(clean.cash, 1234);
});

test('save: the mission cap is 8, and old saves clamp safely', () => {
  const clean = sanitizeSave({ missionIndex: 99, armor: 500, stashes: ['x', 4] });
  assert.equal(clean.missionIndex, 8);
  assert.equal(clean.armor, 100);
  assert.deepEqual(clean.stashes, [4]);
});

// --- Night city -------------------------------------------------------------

test('city: streetlights exist along the roads', () => {
  assert.ok(city.lights.length > 40, `only ${city.lights.length} lights`);
  for (const l of city.lights) {
    assert.ok(l.x >= 0 && l.x <= WORLD_W && l.y >= 0 && l.y <= WORLD_H);
  }
});
